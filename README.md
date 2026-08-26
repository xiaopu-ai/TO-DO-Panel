<div align="center">
  <img src="build/to-do-panel-icon.png" width="112" alt="TO-DO Panel 图标" />
  <h1>TO-DO Panel</h1>
  <p><strong>把 Mac 刘海，变成随手可用的工作台。</strong></p>
  <p>待办、随笔记、链接、录音与本机 AI 提醒，始终贴顶待命。</p>
  <p>
    <a href="https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest"><strong>下载 macOS 版</strong></a>
    ·
    <a href="#从源码运行">从源码运行</a>
    ·
    <a href="https://github.com/xiaopu-ai/TO-DO-Panel/issues">反馈问题</a>
  </p>
  <p>
    <img alt="Release" src="https://img.shields.io/github/v/release/xiaopu-ai/TO-DO-Panel?style=flat-square&color=7c8cff" />
    <img alt="macOS Apple Silicon" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111318?style=flat-square&logo=apple" />
    <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-35c58b?style=flat-square" />
    <img alt="Electron 33" src="https://img.shields.io/badge/Electron-33-47848f?style=flat-square&logo=electron" />
  </p>
</div>

![TO-DO Panel 首页](docs/screenshots/home.png)

![TO-DO Panel 待办](docs/screenshots/todo.png)

## 它是什么

TO-DO Panel 是一个常驻 macOS 屏幕顶部的本地工作台。默认折叠成物理刘海大小，点击后从顶部展开；常用信息和动作不必再散落在多个应用里。

| 页面 | 解决什么问题 |
| --- | --- |
| **首页** | 当前窗口、镜子、快速录音、随笔记、常用指令、汽水音乐和番茄钟集中在一个 Bento 工作台 |
| **待办** | 四个可改名的工作流，按截止时间排序，并在到期前一小时提醒 |
| **随笔记** | Markdown 速记、归档、搜索、重命名与智能标题 |
| **链接** | 保存公开网址，后台补全标题、图标和分组 |
| **录制** | 本地录音、转写、暂停续录与访达定位 |
| **密钥** | 使用 macOS 安全存储加密账号、密码和 API Key |

剪贴板历史默认关闭，可从菜单栏的「显示功能」中按需启用。Codex、Claude Code 与 GPT 的本机完成事件也可以直接显示为不抢焦点的顶部提醒。

## 下载与安装

> 当前版本：**1.0.0** · 支持 **Apple Silicon Mac**

1. 前往 [GitHub Releases](https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest) 下载 `TO-DO-Panel-*-arm64.dmg`。
2. 打开 DMG，将 `TO-DO Panel.app` 拖入「应用程序」。
3. 首次启动若被 macOS 拦截，前往「系统设置 → 隐私与安全性」，点击「仍要打开」。
4. 再次启动，根据需要授予辅助功能、屏幕录制、麦克风或摄像头权限。

安装包采用 ad-hoc 签名且未经过 Apple 公证，因此首次安装需要手动确认。每次重新打包后，macOS 可能要求重新授权；由 `safeStorage` 加密的密钥也可能需要重新填写。

## 设计原则

- **贴顶但不打扰**：折叠态宽 200px，高度跟随菜单栏；展开与通知都不使用系统窗口动画。
- **设备按需启用**：镜子只有主动点击才开启，离开首页或收起时立即释放摄像头；麦克风同理。
- **数据留在本机**：待办、笔记、链接、录音元数据和工作区设置保存在本地，无后端和云同步。
- **权限边界清晰**：链接元数据抓取会阻止本机、内网地址和不安全重定向；窗口聚焦只接受最近扫描缓存中的 ID。
- **可迁移工作区**：可从菜单栏选择数据文件夹，换电脑时复制该文件夹继续使用。

## 本机 AI 完成提醒

TO-DO Panel 只在 `127.0.0.1:43821` 监听通知接口，来源限 `codex`、`claude` 与 `gpt`：

```bash
curl -X POST http://127.0.0.1:43821/notify/codex \
  -H 'Content-Type: application/json' \
  -d '{"title":"任务已完成","project":"my-project","task_id":"demo"}'
```

仓库已提供 [Codex 转发脚本](scripts/codex-notify.js) 和 [Claude Code 转发脚本](scripts/claude-notify.js)。通过 DMG 安装后，脚本路径为：

```text
/Applications/TO-DO Panel.app/Contents/Resources/app/scripts/codex-notify.js
/Applications/TO-DO Panel.app/Contents/Resources/app/scripts/claude-notify.js
```

## 从源码运行

桌面端要求 Node.js 18+：

```bash
git clone https://github.com/xiaopu-ai/TO-DO-Panel.git
cd TO-DO-Panel
npm install
npm test
npm start
```

项目使用单一 Electron 架构，没有渲染层构建步骤，`npm start` 是完整运行路径。

| 命令 | 用途 |
| --- | --- |
| `npm test` | 单元测试与 JavaScript 语法检查 |
| `npm start` | 启动 Electron 开发版 |
| `npm run pack` | 生成未安装的 `.app` |
| `npm run build` | 生成 Apple Silicon DMG |
| `npm run build:zip` | 生成 ZIP 分发包 |

官网位于 `website/`，要求 Node.js 22.13.0+：

```bash
cd website
npm install
npm run dev
```

## 项目结构

```text
.
├── main.js                 # Electron 主进程、窗口与系统服务
├── main-services.js        # 可测试的纯领域服务
├── preload.js              # contextBridge 安全桥
├── renderer/               # 桌面界面与交互
├── tests/                  # Node 单元测试
├── build/                  # 图标、签名与 DMG 配置
├── scripts/                # Codex / Claude Code 通知转发
├── docs/                   # 设计、ADR 与发布说明
└── website/                # React 19 + Vinext 官网
```

## 发布

推送与 `package.json` 版本一致的 `v*.*.*` 标签后，GitHub Actions 会自动测试、构建并校验 DMG，然后将安装包和 SHA-256 文件上传到 Releases。完整流程见 [发布说明](docs/releasing.md)。

## License

[MIT](LICENSE) © 2026 [xiaopu-ai](https://github.com/xiaopu-ai)
