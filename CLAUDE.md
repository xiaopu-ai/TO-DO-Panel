# 桌面刘海屏待办

一个常驻在 macOS 屏幕顶部刘海位置的纯单色玻璃**仪表盘**：默认折叠成刘海大小，点击从刘海垂下展开，含**首页 / 待办 / 笔记 / 链接 / 录制 / 密钥**等 Tab。首页包含居中的 1:1 镜子、Markdown 速记、常用指令、快速录音、汽水音乐、番茄钟和当前窗口；剪贴板默认关闭、可从菜单栏「显示功能」启用；Codex / Claude Code / GPT 完成事件会弹出提醒并进入首页任务状态。

项目为单一 Electron 架构：折叠态、展开面板、任务完成提醒与 Hover + Space 唤出都在 Electron 主进程和渲染层内实现，`npm start` 是唯一运行路径。

> **文档准绳**：产品行为以 [README.md](README.md) 为唯一事实来源，本文与 README 冲突时以 README 为准。

## 技术栈

- 框架：Electron（无 React/Vue，直接 HTML/CSS/JS）
- 样式：原生 CSS（贴近 Apple 风格的玻璃质感 + 圆角）
- 语言：JavaScript（无构建步骤）
- 后端：无（元数据存 LocalStorage，录音与旧剪贴板图片存 userData）
- 包管理器：npm
- Node 版本：>=18

## 命令

- 启动开发：`npm start`
- 安装依赖：`npm install`
- 打包发布：`npm run build`（已接入 electron-builder；仅在用户明确确认后执行）
- 官网开发：`cd website && npm install && npm run dev`
- 官网检查：`cd website && npm run lint && npm run build`

## 目录结构

```
桌面刘海屏待办/
  package.json       # Electron 依赖 + 启动脚本
  main.js            # 主进程：窗口创建、定位、置顶与 IPC
  preload.js         # 安全桥接 contextBridge
  renderer/
    index.html       # 渲染入口
    styles.css       # 刘海 + 仪表盘玻璃样式
    app.js           # 页面交互逻辑 + LocalStorage 持久化
    notification.html/css/js  # 独立任务完成提醒窗口
    assets/app-logo-128.png    # 提醒窗口小尺寸 Logo
  docs/
    DASHBOARD-DESIGN.md  # 仪表盘设计演进与当前产品规格
  website/               # React 19 + Vinext 官网源码
```

## 关键设计参数

- 刘海尺寸：宽 200px，高 = **菜单栏高度本身**（= 物理刘海高，约 37pt；异常屏回退最小 38px；主进程按屏计算）—— 用户硬约束「折叠态绝对不超过原生物理刘海高度」，故去掉原 6px 唇边、折叠条一像素不超出刘海；本项目窗口 setAlwaysOnTop screen-saver 级，实测菜单栏不拦截该级窗口点击，折叠条虽全在菜单栏带内仍可点击展开（NOTCH_LIP 常量已删）
- 展开尺寸：各可见 Tab 统一 `1240 × 540` 内容尺寸，窗口从屏幕最顶垂下（y=0），总高 = `EXPANDED_CHROME_Y(76) + panelHeight(540)`；窄屏宽度 clamp 到屏幕宽度减 24px
- 展开态布局：黑幕从屏幕最顶垂下、盖住菜单栏带（与刘海连为一体，只圆下方两角）；顶栏经 padding-top = 菜单栏高 + 4 让位到拦截带下方；产品名为「TO-DO Panel」，顶部 Tab 避让物理刘海。
- 窗口变形（防卡顿铁律）：**主进程 setBounds 一律瞬时、禁用系统动画**；展开先瞬时放大窗口再播面板入场，收起先播退场再瞬时缩窗。切 Tab 只替换内容，不改变原生窗口尺寸
- 多屏锚定：模式切换 / Tab 变形 / 失焦收起一律锚定**窗口当前所在屏**（getDisplayMatching），绝不跟随光标——否则失焦瞬间刘海会瞬移到光标所在的另一块屏；仅启动 / 托盘重新居中 / 显示跟随光标屏
- 展开/收起交互：折叠态点折叠条展开（无唇边，靠 screen-saver 级窗口穿透菜单栏拦截）；收起 = 再点顶部刘海位正下方的顶栏（整条顶栏除 Tab/按钮/输入外都是收起热区，含品牌区）/ 收起钮 / 点面板外任意处（窗口失焦）自动收起 / Esc（主进程 before-input-event 转发兜底，Escape 不会原生到达页面）
- 可见 Tab：首页 bento（可选百炼实时转写的快速录音 / 图标式当前窗口 / 可滚轮缩放的中心 1:1 镜子 / Markdown 速记 / 常用指令 / 汽水音乐 / 番茄钟）+ 待办 2 × 2 矩阵（内部键 P0–P3，显示名可改）+ 笔记管理 + 链接分组 + 录制管理 + 密钥。剪贴板默认关闭、可从菜单栏「显示功能」启用
- 剪贴板类型样式：文字 / 链接 / 图片只用浅描边区分，禁止左侧色条与冗余类型标签；长文本按卡片高度截断并显示省略效果
- 动效对齐 Linear：日常微交互 100–180ms，展开/收起保留从顶部生长与回到顶点的连续手势；窗口本身仍零动画，`prefers-reduced-motion` 必须降级
- 任务完成提醒：独立 `400 × 96` 无焦点窗口，队列上限 5，悬停暂停、点击关闭；HTTP 入口只监听 `127.0.0.1:43821` 的 `/notify/<source>`，来源白名单 `codex` / `claude` / `gpt`，白名单外一律 404。Codex 走 `~/.codex/config.toml` 的 notify → `scripts/codex-notify.js`（`--previous-notify` 保留原 Computer Use 通知）；Claude Code 走 `~/.claude/settings.json` 的 Stop 钩子 → `scripts/claude-notify.js`（钩子在 CLI 内核里，终端 / VS Code 插件 / 桌面端一份配置全覆盖；Stop 载荷无标题字段，需回读 `transcript_path` JSONL 尾部取最后一条主线助手消息，`isSidechain` 的是子代理记录要跳过）。子代理结束不弹提醒：脚本按 `agent_id` 先挡一层，主进程 `isSubagentNotification` 再挡一层（Claude 的 `agent_type` 存的是子代理名如 `Explore`，不含 subagent 字样，故以 `agent_id` 存在为准）。`CLAUDE_CODE_REMOTE=true` 的云端会话直接放弃，因为那里的 127.0.0.1 不是本机
- 剪贴板：主进程 500ms 轮询 clipboard（Electron 无 changeCount，靠文本本身/图片「宽x高:PNG字节长度」指纹去重），文字里正则 `/^https?:/i` 判链接；跳过 org.nspasteboard.ConcealedType（密码管理器敏感内容）；图片写盘到 userData/clipboard-images/（IPC 统一走 isInsideClipDir 路径白名单，尾分隔符防兄弟目录逃逸），元数据存 LocalStorage，图片 dataURL 仅内存 Map 缓存（绝不进 LocalStorage，否则爆配额）；FIFO 上限 100（notch-clip-history 最新在头，超出淘汰最老并连带删图）；收藏 = notch-clip-favorites（id 数组，与 notch-app-favorites 同构）；点条目 clipboard:write 写回系统剪贴板供用户 Cmd+V。**不再占用任何全局快捷键**：`clipboardServicePolicy` 恒定返回 `registerGlobalShortcut: false`，原 Cmd+Shift+V 已撤销（`app:open-clip` 通道保留，仅由菜单栏驱动）
- 配色：纯黑底 #000000、白色分级文本，强调色仅 P0–P3 色点（P0 红 / P1 橙 / P2 绿 / P3 蓝）、剪贴板浅类型描边与 app 原生图标
- 圆角：折叠条下方两角 10px（--r-notch）、展开面板下方两角 16px（--r-panel），两者上沿都贴顶不圆角
- 动效 Motion System v2：窗口边界始终瞬时变更；展开、收起、内容级联、Tab 胶囊与控件反馈由渲染层完成；`prefers-reduced-motion` 全局降级
- 待办提交：输入框内按一次回车新增；输入法组合态（isComposing / keyCode 229）不提交

## 代码规范

- 主进程文件 camelCase，常量大写下划线
- 所有渲染逻辑写在 renderer/ 下，与主进程隔离
- 通过 contextBridge 暴露 IPC，禁止 nodeIntegration
- 样式使用 CSS 自定义属性（var(--xxx)）集中管理 token

## NEVER

- NEVER 在渲染进程直接 require('electron')，必须走 preload
- NEVER 让窗口可被拖动出刘海位置，每次显示都强制贴顶居中
- NEVER 硬编码颜色/字号/间距，必须使用 CSS 变量
- NEVER 提交 node_modules / dist
- NEVER 在没有用户确认的情况下打包发布
- NEVER 让摄像头常驻：非首页/收起即释放 track

## 压缩指令

当执行 /compact 时，必须保留：
- 当前正在调整的窗口行为或样式细节
- LocalStorage 数据结构（任务模型）
- 已知 macOS 适配问题
