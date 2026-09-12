<div align="center">
  <img src="build/to-do-panel-icon.png" width="112" alt="TO-DO Panel 图标" />
  <h1>TO-DO Panel</h1>
  <p><strong>Mac 与 Windows 的贴顶工作台。</strong></p>
  <p>待办、随笔记、链接、录音与本机 AI 提醒，始终贴顶待命。</p>
  <p>
    <a href="https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest"><strong>下载 macOS 版</strong></a>
    ·
    <a href="https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest"><strong>下载 Windows 版</strong></a>
    ·
    <a href="#从源码运行">从源码运行</a>
    ·
    <a href="#更新日志">更新日志</a>
    ·
    <a href="https://github.com/xiaopu-ai/TO-DO-Panel/issues">反馈问题</a>
  </p>
  <p>
    <img alt="Release" src="https://img.shields.io/github/v/release/xiaopu-ai/TO-DO-Panel?style=flat-square&color=7c8cff" />
    <img alt="macOS 13+ Apple Silicon" src="https://img.shields.io/badge/macOS-13%2B%20Apple%20Silicon-111318?style=flat-square&logo=apple" />
    <img alt="Windows 10/11 x64" src="https://img.shields.io/badge/Windows-10%2F11%20x64-0078D4?style=flat-square" />
    <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-35c58b?style=flat-square" />
    <img alt="Electron 44" src="https://img.shields.io/badge/Electron-44-47848f?style=flat-square&logo=electron" />
  </p>
</div>

![TO-DO Panel 首页](docs/screenshots/home.png)

![TO-DO Panel 待办](docs/screenshots/todo.png)

## 它是什么

TO-DO Panel 是一个常驻 macOS / Windows 屏幕顶部的本地工作台。Mac 默认折叠成物理刘海大小；Windows 默认只显示窄条，鼠标靠近屏幕顶部中央时显示刘海框，点击后从顶部展开。

| 页面 | 解决什么问题 |
| --- | --- |
| **首页** | 当前窗口、镜子、快速录音、随笔记、常用指令、汽水音乐和番茄钟集中在一个 Bento 工作台 |
| **待办** | 四个内置工作流和可任意新增/删除的自定义分类；新建默认当天 23:30，常驻跨天或唤醒后自动刷新，本条手选日期保留并在提交后恢复当天默认值；截止日期可逐月切换并自然跨年，按截止时间排序，并在到期前一小时提醒 |
| **随笔记** | Markdown 速记、归档、搜索、重命名与智能标题 |
| **链接** | 保存公开网址，后台补全标题、图标和分组 |
| **录制** | 录音开始即创建实时记录，同步显示状态与转写，并可在页内配置 API |
| **密钥** | 使用系统安全存储加密账号、密码和 API Key |
| **设置** | 当菜单栏图标被刘海遮挡时，仍可在面板内配置 API、镜子、首页组件、功能显示、默认展开页、快捷键、数据目录与开机启动 |

剪贴板历史默认关闭，可从菜单栏或面板「设置」的「显示功能」中按需启用。菜单栏入口与设置页读写同一份本机配置；即使状态栏图标过多、被物理刘海遮挡，也不影响调整。Codex、Claude Code 与 GPT 的本机完成事件也可以直接显示为不抢焦点的顶部提醒。

「设置 → 首页组件」可以隐藏或恢复当前平台可用的组件（macOS 七个、Windows 五个），但首页至少保留一个。隐藏后，其余组件会自动重新铺满整个 Bento 网格，不留空洞；组件数据、用户保存的排列顺序和尺寸偏好不会被删除或覆盖。只要存在隐藏组件，首页使用自动填充布局并暂时隐藏尺寸按钮；macOS 恢复全部七个组件后，原尺寸偏好与按钮会一并恢复。Windows 采用自动填充布局。该偏好随当前本地工作区保存，存储键为 `notch-home-hidden-modules-v1`。

面板默认每次从首页展开。可在「设置 → 本机与唤出 → 默认展开页」改为任意当前可见的 Tab；若后续隐藏了被选中的功能，下次展开会自动回退到首页。

首页显隐也遵守资源边界：隐藏镜子会立即释放摄像头；录音进行中不能隐藏仍在首页显示的快速录音卡，但已隐藏该卡也不会禁用「录制」页的录音能力；隐藏音乐和当前窗口会停止纯展示用的 WebGL 动画与窗口扫描，番茄钟隐藏后仍继续计时和提醒。

实时转写连接中断时会保留已有文字并自动重连，连续连接失败最多重试 5 次。重连期间最多缓存最近 30 秒音频，恢复后继续追加转写；首页与录制页会显示重连、失败或缓存溢出提示。本机录音独立继续，已发送但尚未被服务确认的音频、以及超出缓存的离线片段可能缺字，不会自动补转已保存的旧录音。

## 下载与安装

> 当前稳定版本：**1.1.2** · **macOS 13.0+ Apple Silicon** / **Windows 10/11 x64（Intel / AMD 64 位）**

| 平台 | 在上方 GitHub Releases 下载对应安装包 |
| --- | --- |
| Mac | [TO-DO-Panel-1.1.2-arm64.dmg](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.1.2/TO-DO-Panel-1.1.2-arm64.dmg) |
| Windows | [TO-DO-Panel-1.1.2-windows-x64-setup.exe](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.1.2/TO-DO-Panel-1.1.2-windows-x64-setup.exe) |

### macOS

1. 前往 [GitHub Releases](https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest) 下载 `TO-DO-Panel-*-arm64.dmg`。
2. 打开 DMG，将 `TO-DO Panel.app` 拖入「应用程序」。
3. 首次启动若被 macOS 拦截，前往「系统设置 → 隐私与安全性」，点击「仍要打开」。
4. 再次启动，根据需要授予辅助功能、屏幕录制、麦克风或摄像头权限。

项目明确采用 GitHub Releases + ad-hoc 签名分发，不进行 Apple 公证，也不上架 Mac App Store。因此首次安装需要手动确认“仍要打开”；这是当前正式分发方式，不是待修复的发布缺陷。每次重新打包后，macOS 可能要求重新授权；由 `safeStorage` 加密的密钥也可能需要重新填写。

### Windows

下载 `TO-DO-Panel-*-windows-x64-setup.exe`，运行安装向导，再从桌面或开始菜单启动。默认仅安装给当前用户，无需管理员权限，卸载保留本机工作区数据。托盘菜单可设置功能或退出，面板设置中可开启开机启动。

安装包暂无商业代码签名，可能出现 SmartScreen 提示。请核对来源与 `.sha256` 校验码，确认后通过「更多信息 → 仍要运行」安装；企业策略可能需要管理员批准。

Windows 首版暂不显示「当前窗口」和「汽水音乐」组件；剪贴板点击复制后用 Ctrl+V 粘贴，AI 完成提醒暂不支持点击切回任务窗口。平台限制不覆盖原有组件偏好。镜子仅主动点击后开启，离开首页或收起立即释放；结束录音释放麦克风。系统拒绝访问设备时，请检查 Windows 隐私设置中桌面应用的相机 / 麦克风权限。

Windows 版在 GitHub Windows runner 上自动验证安装、启动、数据保存、加密、快捷键、模拟音视频设备、重新安装和卸载；物理设备、Windows 10 实机及多显示器硬件尚未人工验收。普通工作区可跨平台迁移，加密密钥需在新电脑重新输入。

## 更新日志

当前稳定版本为 **v1.1.2**。正在开发但尚未发布的改动会先记录在 `[未发布]`，正式发版时再归档到对应版本，避免 README 随版本增加而持续膨胀。

完整版本历史、修复内容与未发布改动见 [CHANGELOG.md](CHANGELOG.md)。

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

Windows 安装后的两个脚本位于安装目录的 `resources/app/scripts/` 中，可用 Node.js 调用；应用本身无需用户安装 Node.js。

## 从源码运行

桌面端要求 Node.js 22.12.0+：

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
| `npm run build:win` | 生成 Windows x64 EXE 安装包（建议 Windows 环境构建） |
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

推送与 `package.json` 版本一致的 `v*.*.*` 标签后，GitHub Actions 并行测试、构建并校验 macOS DMG 和 Windows EXE。两个平台全部通过后，才创建同一个 Release 并上传两个安装包及各自 SHA-256 文件。完整流程见 [发布说明](docs/releasing.md)。

## License

[MIT](LICENSE) © 2026 [xiaopu-ai](https://github.com/xiaopu-ai)
