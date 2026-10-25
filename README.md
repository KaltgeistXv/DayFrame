# DayFrame

DayFrame 是个人效率工作台，包含任务、项目、文件夹、标签、日历、看板、甘特图和打卡热力图。仓库提供 Web 源码与 macOS 离线客户端源码。

## 在线体验

**[打开 DayFrame 在线体验 →](https://kaltgeistxv.github.io/DayFrame/)**

无需安装或登录，可体验任务、项目、列表、看板、日历、甘特图与打卡等功能。

> 体验版内置虚构数据。修改只保留在当前页面内存中，不上传、不写入浏览器存储；刷新或关闭页面后重置。体验版不提供设置和备份导入导出，完整功能请运行本仓库源码。

在线页面复用作品集的静态体验版，发布文件位于 `docs/index.html`，第三方许可见 [THIRD-PARTY-NOTICES.txt](docs/THIRD-PARTY-NOTICES.txt)。GitHub Pages 从 `main` 分支的 `/docs` 目录发布；更新体验版时需替换静态产物，完整应用的服务端构建不会自动转换为演示页面。

## 本地运行 Web 版

需要 Node.js 22.13 或更新版本。

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

打开终端显示的本地网址。首次启动是空白工作空间；本地数据库保存在忽略 Git 的 `.wrangler/` 目录中。`wrangler.local.json` 只配置本地开发数据库。若自行部署，请配置自己的数据库与托管项目。

## 演示数据

`examples/DayFrame-demo-2026-09.json` 是独立的虚构数据。需要演示时，在应用的「设置 → 数据 → 导入备份」中选择该文件。导入前请确认目标工作空间的数据是否需要保留。

## 检查与构建

```sh
npm run check
npm run build
```

macOS 离线客户端的构建说明见 [docs/mac-client.md](docs/mac-client.md)。桌面打包需要 Apple Silicon Mac、macOS Command Line Tools 和 Node.js 24.15.0。

仓库不包含个人工作空间、备份、凭据、本地数据库、安装包或原托管项目编号。
