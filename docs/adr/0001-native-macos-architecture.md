# ADR 0001：迁移到原生 macOS 灵动岛架构

> **本决策已于 2026-08-25 被推翻。** 原生刘海壳（`native/`）连同 Unix domain socket 桥、心跳看护与
> 兼容层回退已从仓库移除，项目回到单一 Electron 架构。原因：原生壳始终只实现了折叠态与紧凑提醒，
> 展开工作区仍是占位页，真正的产品界面是约 12900 行的 Electron 渲染层；重写它会改变用户要求保持不变的
> 交互手感，而双壳并存本身已经在制造运行分支相关的缺陷。以下内容保留为历史记录，不再描述当前实现。

- 状态：已推翻（2026-08-25，见文首说明）
- 日期：2026-08-23
- 决策者：Dynamic Panel

## 背景

当前产品由 Electron 的无边框窗口贴在屏幕顶部实现。这个方案适合快速验证 Bento 工作台，但它没有形成真正的 macOS 刘海交互层：折叠态、实时提醒、媒体会话、窗口焦点和多屏定位分别由浏览器渲染、辅助功能脚本和定时轮询拼接。

汽水音乐是架构问题最直接的表现。现有实现会启动应用、等待进程，再打开 macOS 控制中心并点击辅助功能树中的媒体控件。它不是事件驱动的媒体会话控制，因此存在可感知延迟、焦点抖动和系统 UI 结构变化后失效的风险。

竞品调研得到两类证据：

1. Alcove 将产品定义为原生 Dynamic Island，并把紧凑提醒、Live Activities、手势和 HUD 作为同一个状态系统。
2. boring.notch 使用 SwiftUI + AppKit，自定义非激活窗口，结合 MediaRemote、Accessibility、AVFoundation、EventKit 和 XPC Helper 实现系统级能力。

boring.notch 使用 GPL-3.0，而本项目是 MIT。不得直接复制其源代码，除非项目明确决定整体采用 GPL 兼容许可证。本迁移采用 clean-room：只参考公开行为、架构边界和 Apple 文档，独立实现代码。

## 决策

采用“原生壳优先、能力逐步迁移”的路线：新建 Swift 6 / SwiftUI + AppKit 的 macOS 应用，以原生窗口和服务层替代 Electron 主进程；现有 Electron 版本暂时作为视觉与数据行为基线，直到原生版本通过功能验收后再退役。

不采用一次性推倒重写，也不继续扩大 Electron 主进程中的 AppleScript/JXA/Ruby Fiddle UI 自动化。

## 目标架构

```text
DynamicPanelApp
├── NotchPresentation
│   ├── NotchPanel             NSPanel/NSWindow，自顶居中且不抢焦点
│   ├── NotchStateMachine      collapsed / liveActivity / expanded
│   ├── ScreenCoordinator      刘海、安全区、多屏与菜单栏变化
│   └── SwiftUI Views          紧凑态、提醒态、Bento 展开态
├── SystemServices
│   ├── MediaSessionService    播放/暂停/切歌/元数据，协议隔离私有实现
│   ├── WindowService          AXUIElement + CGWindow，枚举与聚焦
│   ├── RecordingService       AVAudioEngine、音频文件与流式转写
│   ├── ReminderService        待办、番茄钟与任务完成提醒
│   └── PermissionService      麦克风、摄像头、辅助功能权限
├── Domain
│   ├── Todo / Link / Note / Recording / Credential
│   └── AppState               单一可观察状态源
├── Persistence
│   ├── SQLite 或 SwiftData    结构化本地数据
│   ├── FileStore              音频、图片、可迁移工作区
│   └── KeychainStore          API Key 与密码
└── Helper（按需）
    └── XPC Service            仅承载需要隔离或额外权限的系统操作
```

## 媒体控制边界

原生化能消除“打开控制中心再点击”的桌面自动化路径，但不能凭空获得汽水音乐的私有播放 API。

媒体服务按优先级执行：

1. 若目标应用公开 AppleScript、URL Scheme 或 SDK，使用目标应用适配器。
2. 若汽水音乐正确注册为当前 macOS Now Playing 会话，直接发送系统媒体命令并订阅元数据。
3. 若它未注册活动媒体会话，直接显示“请先选择歌曲”；不启动应用、不点击 Control Center，也不伪装成即时控制。

MediaRemote 属于私有框架。若使用它，必须封装在 `MediaSessionService` 后面，避免业务层依赖，并接受无法进入 Mac App Store、系统升级兼容性和审核风险。项目当前计划通过签名、公证的 DMG 在 GitHub Releases 分发，更适合这一技术取舍。

## 关键状态与交互

```text
collapsed
  ├── 点击/快捷键 ──> expanded
  ├── 任务/DDL/番茄钟 ──> liveActivity ──超时/关闭──> collapsed
  └── 媒体变化 ──> compactMedia ──超时──> collapsed

expanded
  ├── 收起 ──> collapsed
  ├── 切页 ──> expanded
  └── 摄像头/麦克风服务只在用户主动操作后启动
```

紧凑提醒独立于展开面板，不能通过“先展开大窗口再缩回去”实现。窗口应为非激活面板，提醒出现时不夺取当前应用焦点。

## 非功能目标

- 媒体应用已运行且会话有效时，按钮到命令发出的 P95 小于 150 ms。
- 紧凑提醒不激活应用、不改变当前 Space、不展开完整面板。
- 展开/收起和提醒变形保持 60 fps；减少动态效果时提供无位移动画。
- 在内建屏、外接屏和切换主屏后始终贴合目标屏幕顶部中心。
- 折叠态尺寸由安全区和屏幕刘海动态计算，不写死为视觉近似值。
- 摄像头与麦克风权限在应用首次启动时依次请求，但此时不启动设备；实际采集仍只在用户主动点击镜子或录音后开始，并提供可诊断状态。
- 本地数据可整体导出、迁移和恢复；凭证进入 Keychain，不随明文数据包导出。

## 备选方案

### 继续 Electron

优点是迁移成本最低。缺点是会继续叠加桥接脚本、轮询、焦点控制和窗口例外，无法解决媒体与紧凑提醒的根问题。否决。

### 原生 NSPanel + WKWebView 混合

适合短期复用现有页面，也能先解决窗口定位和紧凑态。但 WebView 内仍需大量桥接，长期维护两套状态系统。仅作为 Phase 1 过渡，不作为最终架构。

### 全量原生 SwiftUI + AppKit

系统能力、焦点行为、动画状态和分发链路最一致，长期复杂度最低。采纳为目标架构。

## 后果

正向：媒体命令、提醒、窗口、录音和屏幕定位拥有明确的原生边界；UI 不再由一个超大网页窗口模拟；运行内存和启动延迟可显著下降。

代价：需要维护 Swift/macOS 工程；部分私有媒体能力要承担系统升级风险；原有 LocalStorage 需要一次性迁移；Electron 与原生版本会在一段时间内并存。

## 验收门槛

在迁移其他页面前，原生 Spike 必须先证明：

1. 折叠、紧凑提醒、展开三态在本机刘海屏上无跳动且不抢焦点。
2. 汽水音乐已运行时，播放/暂停/上一首/下一首至少连续 30 次成功，并记录响应时间。
3. 若汽水音乐无活动媒体会话，能准确识别并提示限制，而不是回退到桌面点击。
4. 多屏切换、全屏 Space 和睡眠唤醒后位置正确。
5. 可以读取当前 Electron 数据并生成无损迁移报告。
