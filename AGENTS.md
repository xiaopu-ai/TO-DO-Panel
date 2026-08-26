# TO-DO Panel

一个常驻 macOS 屏幕顶部的本地工作台。默认折叠成物理刘海大小，点击从顶部展开，包含**首页 / 待办 / 笔记 / 链接 / 录制 / 密钥**等页面；剪贴板默认关闭、可从菜单栏「显示功能」启用；还可接收 Codex / Claude Code / GPT 的本机完成事件并关联当前窗口。

项目为单一 Electron 架构：折叠态、展开工作区、任务完成提醒与 Hover + Space 唤出都在 Electron 主进程和渲染层内实现，`npm start` 是唯一运行路径。

> **文档准绳**：产品行为以 [README.md](README.md) 为唯一事实来源。本文与 README 冲突时以 README 为准。

## 技术栈

- 桌面端：Electron 33 + 原生 HTML/CSS/JavaScript，无渲染层构建步骤
- 官网：React 19 + Vinext + 原生 CSS，位于 `website/`
- 数据：LocalStorage + `userData/clipboard-images/` + `userData/recordings/`，无后端和云同步
- 包管理器：npm
- Node：桌面端使用 Node 18+；官网要求 Node 22.13.0+

## 命令

- 桌面开发：`npm install && npm start`
- 桌面检查：`npm test`
- 桌面打包：`npm run build`（只在用户明确确认后执行）
- 官网开发：`cd website && npm install && npm run dev`
- 官网检查：`cd website && npm run lint && npm run build`

## 目录结构

```text
.
├── main.js                 # Electron 主进程：窗口、定位、菜单栏、剪贴板、媒体与通知服务
├── main-services.js        # 可单测的纯领域服务（无 Electron 依赖）
├── preload.js              # contextBridge 安全桥接
├── renderer/               # 桌面界面与交互（index.html / styles.css / app.js / workspace.js / notification.*）
├── build/                  # DMG 打包钩子、entitlements 与应用图标
├── scripts/                # Codex 与 Claude Code 的通知转发脚本
├── tests/                  # Node 单元测试
├── docs/                   # 设计说明、ADR 与验收图
├── website/                # 官网 React/Vinext 源码
└── package.json
```

## 当前产品约束

- 折叠态：宽 200px，高度等于当前屏幕菜单栏高度，不得超出物理刘海
- 展开态：各页内容区统一 `1240 × 540`；窗口总高为 `76 + 540`，窄屏与矮屏保留 24px 安全距
- 待办：2 × 2 布局，一次回车新增，颜色为红 / 橙 / 绿 / 蓝。内部存储键仍是 `P0`–`P3`（`notch-todo-data` 结构不可变更），但界面显示名默认「课程 / 自媒体&写作 / Vibe coding / 日常」且用户可改名（存 `notch-todo-category-names-v1`）；截止时间默认当天 23:30，到期前一小时提醒
- 剪贴板：默认关闭（`DEFAULT_FEATURES.clip = false`），可在菜单栏「显示功能」中启用。历史记录由主进程轮询采集，不再占用任何全局快捷键（见 `clipboardServicePolicy`）
- 链接：只允许公开 http/https；主进程抓取标题时必须阻止本机、内网与不安全重定向
- 录制：音频写入 `userData/recordings/`，转写与元数据保存在 LocalStorage；可选百炼 Qwen3-ASR 实时转写，API Key 必须经 `safeStorage` 加密或环境变量读取
- 镜子：首页中间列使用 1:1 方形；只有主动点击才开启，离开首页或收起时立即释放摄像头 track
- 当前窗口：通过 macOS 辅助功能枚举和聚焦，使用系统应用图标；同应用多窗口编号；隐藏项保存在 LocalStorage；聚焦 IPC 只接受最近扫描缓存中的窗口 ID
- 笔记：首页随笔记保存后进入独立笔记页，可搜索、重命名、编辑和删除
- 动效：窗口边界变更不使用系统动画；视觉动效由渲染层完成，并支持 `prefers-reduced-motion`
- 通知：独立 `400 × 96` 无焦点窗口；HTTP 只监听 `127.0.0.1:43821` 的 `/notify/<source>`，来源白名单 `codex` / `claude` / `gpt`；Codex 与 Claude Code 分别由 `scripts/codex-notify.js`、`scripts/claude-notify.js` 转发，子代理结束与云端会话不弹提醒

## 代码规范

- 主进程文件 camelCase，常量大写下划线
- 渲染逻辑放在 `renderer/`，与主进程隔离
- IPC 必须通过 `preload.js` 的 contextBridge 暴露
- 视觉取值集中在 CSS 自定义属性中

## NEVER

- NEVER 在渲染进程直接 `require('electron')`
- NEVER 让窗口可被拖出刘海位置；显示与模式切换必须贴顶居中
- NEVER 让摄像头常驻；离开首页或收起时立即释放 track
- NEVER 在用户未主动点击时启动麦克风；结束录音或退出应用时必须释放音频 track
- NEVER 把剪贴板图片 dataURL 存入 LocalStorage
- NEVER 提交 `node_modules` 或 `dist`
- NEVER 在没有用户确认时打包或发布桌面应用

## 压缩指令

执行 `/compact` 时必须保留：

- 当前窗口行为与样式细节
- LocalStorage 数据结构
- 已知 macOS、多屏、菜单栏与摄像头适配问题
