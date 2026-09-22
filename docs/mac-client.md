# DayFrame Mac 离线客户端

## 使用

本机应用安装在 `~/Applications/DayFrame.app`，可从 Finder 或 Spotlight 打开。支持 Apple Silicon、macOS 13.5 或更高版本。此版本为本机自用的临时签名版本，未做 Developer ID 公证，不代表已上架或适合公开分发。

数据保存在 `~/Library/Application Support/DayFrame/workspace.sqlite`，更新或移动 `.app` 不会覆盖数据。通过设置导出/导入 JSON 备份；原生保存窗口取消不会被视为备份成功。工作空间名称、任务、项目、标签、打卡数据均使用原有业务规则。

首次迁移复制原本地工作空间，原数据库保留。之后客户端与网页版分别保存，不自动同步。安装包不含个人数据；在另一台 Mac 使用时需要单独导入备份。

## 架构与公共来源

- `desktop/DayFrame.m`：AppKit 窗口、系统菜单、WKWebView、原生文件选择与保存桥接。
- `desktop/main.tsx`：复用 `WorkspacePage`、全局样式和组件，未复制一套页面。
- `desktop/server.mjs`：捆绑 Node 本地 HTTP 服务，只监听回环地址；随机会话凭据、来源校验、请求体上限以及完整操作串行执行。
- `desktop/database.mjs`：将原 API 使用的 D1 小接口适配到 SQLite；事务失败整体回滚。
- `desktop/cloudflare.mjs`：只在桌面构建中替换云绑定。原网页版不受影响。
- `lib/backup-download.ts`：桌面端等待原生保存结果；网页仍使用原文件选择/下载分支。

端口保存在应用数据目录中，使同一工作空间的视图记忆能够跨重启保留。进程退出时关闭本地服务；关闭窗口后可从 Dock 重开，使用 ⌘Q 完全退出。端口被占用时会明确报错，不连接其他服务。

## 开发与打包

需要 macOS Command Line Tools、Node 24.15.0 和项目依赖。应用捆绑 Node，使用者不需要安装 Node 或启动终端。最低系统版本根据捆绑运行时确定。

```sh
npm run check
npm run build
npm run desktop:package
```

桌面脚本会构建原生应用、运行 3 项桌面集成测试、生成并校验 DMG。产物放在 `outputs/macos/`，与网页版 `dist/` 分离，避免互相清理。

- `DayFrame.app`：应用。
- `DayFrame-arm64.dmg`：本机架构的安装包。
- `npm run desktop:test`：需先完成桌面构建；使用临时数据库。

新空数据库复用 `drizzle/*.sql` 初始化，不注入示例数据。已有数据库会检查兼容字段；未来修改模型时需设计新的桌面迁移，不可仅修改网页 schema 后直接交付旧客户端数据库。

迁移需退出客户端并指定源和目标：

```sh
node desktop/migrate.mjs /absolute/source.sqlite /absolute/destination.sqlite
```

SQLite 在线备份包含已提交 WAL 数据，并校验完整性；目标存在则拒绝覆盖。不要手工拷贝正在使用中的 `.sqlite` 文件来代替备份。

## 本次验证（2026-09-16）

- 原项目检查与 183 项测试通过；网页构建通过。
- 桌面集成验证：事务回滚、WAL 数据迁移和拒绝覆盖、会话保护、跨来源拒绝、离线任务/项目/设置/打卡、导入恢复。
- 原生窗口中创建任务并重新加载，确认持久保存。
- 原生保存窗口导出 JSON，实际检查文件；原生打开窗口导入并确认预览与成功反馈。
- DMG 校验及本地代码签名验证。

桌面与网页仍共用业务日期规则（Asia/Shanghai）；本次未改变日期语义。构建中的大包体提示不影响离线运行，后续可按性能需求拆分。

## 相关依据

- [Apple WebKit 带返回值的消息桥接](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply)
- [Node SQLite 与在线备份](https://nodejs.org/download/release/v24.15.0/docs/api/sqlite.html)
