import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function startServer({ resources, dataDir, port = 0 }) {
  process.env.DAYFRAME_DATA_DIR = dataDir;
  process.env.DAYFRAME_RESOURCES = resources;
  const { GET, POST } = await import(pathToFileURL(join(resources, 'workspace-api.mjs')).href);
  const secret = randomBytes(32).toString('hex');
  const cookieName = 'dayframe_' + randomBytes(8).toString('hex');
  const clientRoot = resolve(resources, 'client');
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2' };
  let origin = '';
  // Serialize full actions as well as individual SQL batches. This matches the
  // single-user client and prevents async read/modify/write races across requests.
  let queue = Promise.resolve();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
    const fail = (status, message) => { res.writeHead(status, { 'Content-Type':'text/plain; charset=utf-8' }); res.end(message); };
    try {
      if (req.headers.host !== new URL(origin).host) return fail(403, '请求地址无效');
      const url = new URL(req.url, origin);
      if (url.pathname === '/launch' && req.method === 'GET' && url.searchParams.get('key') === secret) {
        res.writeHead(303, { Location: '/', 'Set-Cookie': `${cookieName}=${secret}; HttpOnly; SameSite=Strict; Path=/` });
        return res.end();
      }
      const cookies = (req.headers.cookie || '').split(';').map(s => s.trim());
      if (!cookies.includes(`${cookieName}=${secret}`)) return fail(403, '请从 DayFrame 客户端打开');
      if (req.headers.origin && req.headers.origin !== origin) return fail(403, '请求来源无效');
      if (url.pathname === '/api/workspace') {
        if (!['GET','POST'].includes(req.method)) return fail(405, '请求方式无效');
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 10 * 1024 * 1024) return fail(413, '文件不能超过 10 MB'); chunks.push(chunk); }
        if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return fail(415, '请求格式无效');
        const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
        const pending = queue.then(() => req.method === 'GET' ? GET() : POST(request));
        queue = pending.catch(() => {});
        const response = await pending;
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (!['GET','HEAD'].includes(req.method)) return fail(405, '请求方式无效');
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(clientRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(clientRoot + '/')) return fail(403, '路径无效');
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!res.headersSent) fail(error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? '文件不存在' : '客户端暂时无法处理请求');
      else res.end();
    }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, url: `${origin}/launch?key=${secret}`, port: server.address().port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  const dataDir = process.env.DAYFRAME_DATA_DIR;
  const resources = process.env.DAYFRAME_RESOURCES;
  if (!dataDir || !resources) throw Error('客户端目录未配置');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const portFile = join(dataDir, 'port');
  let port = 0;
  try { port = Number(await readFile(portFile, 'utf8')); } catch {}
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('本地端口配置无效');
  const instance = await startServer({ resources, dataDir, port });
  await writeFile(portFile, String(instance.port), { mode: 0o600 });
  process.stdout.write(JSON.stringify({ url: instance.url }) + '\n');
  // A closed parent pipe means the app quit or crashed. Do not leave a daemon.
  process.stdin.resume();
  const stop = () => instance.server.close(() => process.exit(0));
  process.stdin.on('end', stop);
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
