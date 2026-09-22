import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const out = fileURLToPath(new URL('../outputs/macos/', import.meta.url));
const staging = await mkdtemp(join(tmpdir(), 'dayframe-installer-'));
try {
await cp(join(out, 'DayFrame.app'), join(staging, 'DayFrame.app'), { recursive: true });
await symlink('/Applications', join(staging, 'Applications'));
await writeFile(join(staging, '使用说明.txt'), 'DayFrame 离线客户端\n\n将 DayFrame 拖入 Applications 后打开。\n支持 macOS 13.5 或更高版本，安装包架构：' + process.arch + '。\n数据保存在 ~/Library/Application Support/DayFrame，与应用文件分开。\n通过设置导入或导出 DayFrame JSON 备份。\n本机自用版本采用临时签名，尚未进行 Developer ID 公证。\n此安装包不含个人数据。\n');
const dmg = join(out, `DayFrame-${process.arch}.dmg`);
execFileSync('hdiutil', ['create', '-volname', 'DayFrame', '-srcfolder', staging, '-ov', '-format', 'UDZO', dmg], { stdio: 'inherit' });
execFileSync('hdiutil', ['verify', dmg], { stdio: 'inherit' });
console.log(dmg);
} finally { await rm(staging, { recursive: true, force: true }); }
