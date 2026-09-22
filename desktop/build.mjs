import { build } from 'vite';
import { cp, mkdir, readFile, readdir, writeFile, rm, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.versions.node !== '24.15.0') throw Error('请使用 Node 24.15.0 构建；更换捆绑运行时前须更新许可证与最低系统版本。');
if (process.platform !== 'darwin') throw Error('Mac 客户端需要在 macOS 上构建');
const out = join(root, 'outputs/macos');
await build({ configFile: join(root, 'desktop/vite.config.mjs') });
await build({
  configFile: false, root,
  resolve: { alias: [
    { find: 'cloudflare:workers', replacement: join(root, 'desktop/cloudflare.mjs') },
    { find: /^@\//, replacement: root },
  ] },
  build: { ssr: join(root, 'app/api/workspace/route.ts'), outDir: join(out, 'api'), emptyOutDir: true, rolldownOptions: { output: { entryFileNames: 'workspace-api.mjs' } }, minify: false },
});
const app = join(out, 'DayFrame.app');
await rm(app, { recursive: true, force: true });
const contents = join(app, 'Contents');
const resources = join(contents, 'Resources');
await mkdir(join(contents, 'MacOS'), { recursive: true });
await mkdir(resources, { recursive: true });
await cp(join(out, 'client'), join(resources, 'client'), { recursive: true });
await cp(join(out, 'api/workspace-api.mjs'), join(resources, 'workspace-api.mjs'));
await cp(join(root, 'desktop/server.mjs'), join(resources, 'server.mjs'));
await cp(join(root, 'drizzle'), join(resources, 'migrations'), { recursive: true });
// Bundle the installed universal Node runtime; no Node installation at run time.
await cp(process.execPath, join(resources, 'node'));
await chmod(join(resources, 'node'), 0o755);
const license = execFileSync(process.execPath, ['-p', 'process.release.name'], { encoding: 'utf8' }).trim();
if (license !== 'node') throw Error('需要标准 Node.js 运行时');
await cp(join(root, 'desktop/NODE-LICENSE.txt'), join(resources, 'NODE-LICENSE.txt'));
// Include license notices for installed packages; no user data or environment files.
const moduleRoot = join(root, 'node_modules');
const packageDirectories = [];
for (const entry of await readdir(moduleRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
  if (entry.name.startsWith('@')) {
    for (const child of await readdir(join(moduleRoot, entry.name))) packageDirectories.push(join(moduleRoot, entry.name, child));
  } else packageDirectories.push(join(moduleRoot, entry.name));
}
const notices = [];
for (const directory of packageDirectories) {
  let metadata;
  try { metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')); } catch { continue; }
  const licenses = (await readdir(directory)).filter(name => /^licen[sc]e(?:[.-].*)?$/i.test(name));
  for (const name of licenses) {
    try { notices.push(`${metadata.name} ${metadata.version}\n${await readFile(join(directory, name), 'utf8')}`); } catch { /* Some packages use a license directory. */ }
  }
}
await writeFile(join(resources, 'THIRD-PARTY-LICENSES.txt'), notices.join('\n\n----------------------------------------\n\n'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await writeFile(join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.dayframe.desktop</string>
<key>CFBundleName</key><string>DayFrame</string>
<key>CFBundleDisplayName</key><string>DayFrame</string>
<key>CFBundleExecutable</key><string>DayFrame</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${pkg.version}</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleIconFile</key><string>DayFrame</string>
<key>LSMinimumSystemVersion</key><string>13.5</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
<key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
<key>CFBundleLocalizations</key><array><string>zh_CN</string></array>
</dict></plist>`);
const compilerFlags = ['-fobjc-arc', '-O2', '-mmacosx-version-min=13.5'];
execFileSync('xcrun', ['clang', ...compilerFlags, join(root, 'desktop/DayFrame.m'), '-framework', 'Cocoa', '-framework', 'WebKit', '-framework', 'UniformTypeIdentifiers', '-o', join(contents, 'MacOS/DayFrame')], { stdio: 'inherit' });
// Use AppKit and the system font for the application icon.
const iconTool = join(out, 'draw-icon');
execFileSync('xcrun', ['clang', ...compilerFlags, join(root, 'desktop/icon.m'), '-framework', 'Cocoa', '-o', iconTool], { stdio: 'inherit' });
execFileSync(iconTool, [out], { stdio: 'inherit' });
execFileSync('iconutil', ['-c', 'icns', join(out, 'DayFrame.iconset'), '-o', join(resources, 'DayFrame.icns')]);
// Ad-hoc signature supports local use; public distribution requires Developer ID.
execFileSync('codesign', ['--force', '--sign', '-', join(resources, 'node')], { stdio: 'inherit' });
execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
console.log(`Mac 客户端已构建：${app}`);
