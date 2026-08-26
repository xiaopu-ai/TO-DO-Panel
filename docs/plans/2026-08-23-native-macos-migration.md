# Dynamic Panel 原生 macOS 迁移路线

> **本文已于 2026-08-25 作废。** 原生刘海壳已从仓库移除，项目回到单一 Electron 架构；
> 原因见 [adr/0001-native-macos-architecture.md](../adr/0001-native-macos-architecture.md) 文首说明。
> 以下内容保留为历史记录。

## 结论

先验证原生刘海壳和汽水音乐媒体会话，再迁移业务页面。媒体 Spike 不通过，不进入完整重写。

## Phase 0：冻结错误方向并修正现有缺陷

- 停止为媒体控制增加新的 Control Center UI 自动化分支。
- 保留 Electron 版本作为交互基线和数据迁移源。
- 修正待办元信息顺序为：任务名称 → 剩余电量 → 截止日期 → 删除/保存。
- 为现有 LocalStorage、录音文件、镜子图片和设置生成数据清单。

## Phase 1：原生可行性 Spike

建立独立的 `native/` Swift Package 原生应用目标（验证通过后再固化为可签名的 Xcode App target），先实现：

- `NSPanel` 非激活窗口与顶部安全区定位。
- collapsed / liveActivity / expanded 三态。
- 原生媒体会话订阅和四个播放命令。
- 汽水音乐状态、曲目信息和控制成功率日志。
- 内建屏、外接屏、Space、睡眠唤醒测试。

退出条件：满足 ADR 的五项验收门槛。若汽水音乐无法被系统媒体会话直接控制，先确认应用是否提供 AppleScript、URL Scheme 或其他公开接口；没有接口则把限制作为产品能力边界。

## Phase 2：高价值系统能力

- 紧凑任务完成提醒，可点击跳转对应窗口/仓库。
- DDL、番茄钟和录音状态 Live Activity。
- 当前窗口枚举、应用图标、工作区名称与聚焦。
- 麦克风录音、暂停/结束、音频文件落盘和流式转写。

## Phase 3：业务数据与页面

- 首页 Bento 模块和尺寸系统。
- 待办、链接、录制、应用、密钥、剪贴板、随笔记。
- SQLite/SwiftData 数据仓库与本地工作区目录。
- Keychain 凭证存储。
- Electron LocalStorage 与文件目录的幂等迁移工具。

## Phase 4：开源与分发

- 更新 README、隐私说明、权限说明和媒体兼容列表。
- Developer ID 签名、Hardened Runtime、公证和 stapling。
- 生成 DMG 并仅在明确授权后发布到 GitHub Releases。
- 原生版本达到功能等价后，将 Electron 标记为 legacy，随后删除运行时依赖。

## 许可边界

- 本项目继续 MIT 时，不复制 boring.notch 的 GPL-3.0 源文件、资源或实现片段。
- 可以依据 Apple 公共文档独立实现，也可以记录行为测试结果形成 clean-room 规格。
- 如果未来决定直接派生 boring.notch，需要先单独作出许可证 ADR，并评估整个分发作品的 GPL 义务。

## 首轮测试矩阵

| 场景 | 指标 |
| --- | --- |
| 汽水音乐前台、暂停 | 播放命令成功率与延迟 |
| 汽水音乐后台、暂停 | 不激活应用即可播放 |
| 汽水音乐播放中 | 上一首/下一首连续 30 次 |
| 其他播放器同时存在 | 命令目标不串会话 |
| 内建屏刘海 | 三态位置、圆角和安全区 |
| 外接屏/切换主屏 | 自动重新定位 |
| 全屏 Space | 不抢焦点、不错误置顶 |
| 睡眠唤醒 | 媒体订阅和窗口状态恢复 |

## 2026-08-23 本机验证结果

- 原生窗口：SwiftUI + AppKit `NSPanel` 已实现 collapsed / liveActivity / expanded 状态机；窗口使用内建屏真实 safe-area 和刘海宽度定位。
- 本机几何：内建屏逻辑尺寸 `1728 × 1117`，安全区顶部 `32pt`，折叠目标 `200 × 33`，提醒目标 `400 × 96`，展开目标 `1120 × 616`。
- 多屏：混合模式不再跟随鼠标跑到外接屏；Electron 兼容工作区实测固定在内建屏 `x=244, y=0, 1240 × 616`。
- 紧凑提醒：Codex 通知进入原生状态机，窗口表面由约 `200 × 33` 变为约 `400 × 96`，6 秒后恢复；混合模式未创建 Electron 通知窗口。
- 展开/收起：Unix Socket 兼容桥连续三轮均为 `expanded/visible=true → collapsed/visible=false`，最终只保留原生折叠壳。
- 主进程关系：`start:hybrid` 只启动原生入口，Electron 作为原生进程的受管子进程运行；实测终止兼容进程后约 1 秒自动拉起新进程，终止原生入口后兼容进程一并退出。
- 断连恢复：兼容桥不可用时，原生壳会重新显示并进入橙色“工作区未连接”紧凑态，不再隐身或打开无功能的占位展开页；桥恢复后自动回到折叠态。
- 视觉快照：建立 `collapsed / activity / unavailable / todo / timer / expanded` 六态离屏渲染，锁屏下仍可检查文字、圆角和三边描边；已发现并修复原生提醒黑底黑字及顶部多余描边。
- 快捷键：默认 Hover + Space 已由原生 Carbon HotKey 接管，解决混合模式隐藏 Electron 折叠窗后无法注册空格的问题；设置文件为 `Space` 时由原生负责，其他自定义组合键继续由兼容层注册。
- 提醒样式：Codex/GPT 完成、DDL 待办、番茄钟结束和工作区断连使用独立图标与状态色；离屏快照扩展为 6 态并通过尺寸与渲染检查。
- 本地数据：真实 `workspace.json` 为 version 1、13 个 LocalStorage 键、722 bytes；原生清单读取成功且不输出正文或密钥。
- 媒体框架：MediaRemote 可加载，命令调用返回 accepted；汽水音乐没有活动 playable 时连续播放命令均未产生播放状态或元数据，说明系统媒体命令不能冷启动其队列。
- 汽水音乐实现侧证据：其渲染层只在已有 playable 后注册 Media Session 元数据和播放/暂停/切歌处理，因此“没有当前曲目时直接播放”不能靠通用系统命令实现。
- 媒体控制路径：Electron 兼容页通过原生 `MediaSessionProbe` 读取和控制系统 Now Playing，会话存在时直接发送 MediaRemote 命令；已删除 Control Center 辅助功能树点击、应用冷启动等待与伪播放状态。
- 解锁真机验收：折叠态与实体刘海衔接正常；点击可展开；展开态 Space 可收起；折叠态 Hover + Space 可展开并再次收起；Codex 完成事件在不展开工作台时显示为原生紧凑提醒并于 6 秒后恢复。
- 尚未自动执行：真实睡眠/唤醒会打断用户当前会话，因此仅保留窗口监听和状态机检查；正式发布前仍需人工走一次睡眠唤醒与全屏 App 回归。
