# Dynamic Panel

Dynamic Panel 是一个常驻 macOS 刘海区域的本地效率面板。折叠时保持为顶部小岛，展开后提供待办、链接、录音、窗口跳转、随笔记、密钥和可选剪贴板等能力。

> 当前版本：`0.4.1`。桌面端仅正式验证 Apple Silicon Mac；应用仍处于公开测试阶段。项目为单一 Electron 架构。

## 功能

- **首页 Bento Box**：模块可拖动和切换尺寸；镜子、快速录音、随笔记、常用指令、当前窗口、汽水音乐和番茄钟集中在一处。
- **待办**：按「课程 / 自媒体&写作 / Vibe coding / 日常」管理，分类可改名；截止时间默认当天 23:30，并在一小时前提醒。
- **链接**：回车立即保存公开的 HTTP/HTTPS 地址，标题、图标和分组在后台静默补全。
- **录制**：本地保存录音和转写文本，可在访达定位；支持配置百炼实时语音转写和 OpenAI-compatible LLM。
- **密钥**：账号与密码使用 macOS `safeStorage` 加密；账号和密码可分别复制。
- **剪贴板**：功能默认关闭，可在菜单栏「显示功能」中启用。
- **任务提醒**：接收本机 Codex / Claude Code / GPT 完成事件，点击提醒可尝试跳转到对应项目窗口。

所有业务数据默认留在本机。可从菜单栏选择一个数据文件夹，换电脑时复制该文件夹继续使用；API Key 与密码依赖当前 Mac 的安全存储，不应当作明文同步。

## 下载与安装

发布后可从 [GitHub Releases](https://github.com/xiaopu-ai/dynamic-panel/releases/latest) 下载 `Dynamic Panel-*-arm64.dmg`：

1. 打开 DMG。
2. 将 `Dynamic Panel.app` 拖入「应用程序」。
3. 首次启动若被 macOS 拦截，打开「系统设置 → 隐私与安全性」，点击「仍要打开」。
4. 再次启动后，按系统提示允许摄像头和麦克风；授权只用于镜子与录音，授权时不会启动设备。

安装包使用 ad-hoc 签名且未经过 Apple 公证，与没有开发者账号的 CC Switch 分发方式相同。用户首次安装需要手动确认「仍要打开」，确认一次后即可正常使用。

ad-hoc 签名没有固定的 Team ID，系统按可执行文件的哈希识别应用，因此**每次升级到新版本都要重新授权一次**：隐私权限（辅助功能、屏幕录制等）需要重新勾选，`safeStorage` 加密保存的 API Key 与密码也会解不开、需要重新填写。这是没有开发者账号分发的固有限制。密钥失效时界面会明确提示「转写密钥已失效」，而不是静默不工作。

## 从源码运行

要求 Node.js 18+：

```bash
git clone https://github.com/xiaopu-ai/dynamic-panel.git
cd dynamic-panel
npm install
npm test
npm start
```

折叠态、任务完成提醒和 Hover + Space 唤出都由 Electron 主进程实现，`npm start` 就是完整的运行方式。

常用命令：

| 命令 | 用途 |
|---|---|
| `npm test` | 运行单元测试与 JavaScript 语法检查 |
| `npm start` | 启动 Electron 开发版 |
| `npm run pack` | 生成未安装的 `.app` 目录 |
| `npm run build` | 生成 Apple Silicon DMG |
| `npm run build:zip` | 生成 ZIP 分发包 |

本仓库不会在普通开发或测试流程中自动执行打包。

## 生成 DMG

`package.json` 已配置 `electron-builder`：

```bash
npm install
npm test
npm run build
```

产物写入 `dist/`。当前配置生成 `arm64` DMG：`afterPack` 由内向外对 `.app` 逐层执行 ad-hoc 签名并校验，`Contents/MacOS` 下只有 Electron 一个可执行文件。

推送与 `package.json` 版本一致的 `v*.*.*` 标签后，[GitHub Actions](.github/workflows/release-dmg.yml) 会自动执行测试、构建和校验，并把 DMG 与 SHA-256 文件上传到 GitHub Releases。完整步骤见 [发布说明](docs/releasing.md)。

## 权限与集成

- **辅助功能**：枚举、区分并聚焦当前窗口；向汽水音乐发送播放控制按键。
- **屏幕录制**：macOS 10.15 起，读取其他应用的窗口标题需要这一项。缺失时系统既不报错也不弹提示，「当前窗口」会显示成一个空列表，界面上会给出对应的授权入口。
- **麦克风**：只在用户主动录音后使用，停止时立即释放。
- **摄像头**：只在用户主动打开镜子后使用，离开首页或收起时立即释放。
- **汽水音乐**：面板通过向汽水音乐进程发送播放/暂停/切歌快捷键实现控制，不读取曲目和歌手信息，播放状态按本地记录展示。应用未运行时只有「播放」会先拉起它，暂停与切歌需要它已在运行。

Codex、Claude Code 与 GPT 可向仅监听本机的接口发送完成事件，路径为 `/notify/<source>`（来源限 `codex` / `claude` / `gpt`）：

```bash
curl -X POST http://127.0.0.1:43821/notify/codex \
  -H 'Content-Type: application/json' \
  -d '{"title":"任务已完成","project":"my-project","task_id":"demo"}'
```

Codex 与 Claude Code 已有现成的转发脚本，只需注册各自的钩子：

- Codex：在 `~/.codex/config.toml` 的 `notify` 里接上 [scripts/codex-notify.js](scripts/codex-notify.js)。
- Claude Code：在 `~/.claude/settings.json` 注册 `Stop` 钩子调用 [scripts/claude-notify.js](scripts/claude-notify.js)。钩子位于 CLI 内核，所以终端、VS Code 官方插件和桌面端共用这一份配置；云端会话的 `127.0.0.1` 不是本机，脚本会自行跳过。

上面写的是源码仓库内的相对路径。**用 DMG 安装的话仓库并不存在**，钩子要填脚本在应用包内的绝对路径：

```text
/Applications/Dynamic Panel.app/Contents/Resources/app/scripts/codex-notify.js
/Applications/Dynamic Panel.app/Contents/Resources/app/scripts/claude-notify.js
```

路径含空格，写进 `settings.json` 或 `config.toml` 时记得加引号。填错不会有任何报错，只是任务完成后收不到提醒。

## 数据与隐私

- 待办、随笔记、链接、录音元数据等通过本地工作区文件和 Electron LocalStorage 保存。
- 录音与剪贴板图片保存在工作区对应目录。
- 录音转写或智能命名仅在用户配置对应 API 后联网。
- 密码和 API Key 由 macOS 安全存储加密；迁移电脑后需要重新配置。

## 仓库结构

```text
.
├── main.js                 # Electron 主进程、窗口、菜单栏与系统服务
├── main-services.js        # 可测试的领域服务
├── preload.js              # contextBridge 安全桥
├── renderer/               # 桌面界面与交互
├── tests/                  # Node 单元测试
├── build/                  # DMG、签名与 entitlements 配置
├── docs/                   # 设计说明和验收图
├── website/                # React/Vinext 官网
└── package.json
```

## 提交前清理

以下均为生成文件，不应提交 Git：

- 根目录 `node_modules/`、`dist/`
- `website/node_modules/`、`website/dist/`、`website/.vinext/`
- `.DS_Store`、日志和临时文件

`docs/screenshots/`、`renderer/assets/`、`build/`、测试与源代码应保留。

## License

[MIT](LICENSE)
