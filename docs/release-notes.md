## 选择你的安装包

| 电脑 | 下载文件 | 安装方式 |
| --- | --- | --- |
| Mac · Apple Silicon · macOS 13+ | [下载 macOS 安装包（.dmg）](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.2.0/TO-DO-Panel-1.2.0-arm64.dmg) | 打开 DMG，将应用拖入「应用程序」 |
| Windows 10/11 · Intel / AMD 64 位（x64） | [下载 Windows 安装包（.exe）](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.2.0/TO-DO-Panel-1.2.0-windows-x64-setup.exe) | 双击 EXE，按安装向导完成安装 |

`.sha256` 是对应文件的完整性校验码，不是安装包。官网提供 macOS 与 Windows 两个下载入口。

## 1.2.0

- 新增待办收件箱：本机脚本或 AI 助手把 JSON 放进工作区 `todo-inbox/`，运行中约 2 秒、启动时各检查一次，按 `P0`–`P3` 或分类显示名追加待办，无需重启。
- 收件箱只追加、不改动已有待办；处理后的文件移入 `processed/` 并生成报告，逐条记录跳过原因，同一文件、同一 id 不会重复导入。
- 修复装了 Filteronme、OBS、尚镜等虚拟摄像头后镜子打不开的问题：镜子不再默认选中排在最前的虚拟摄像头。
- 镜子优先使用电脑自带相机，其次外接相机和 iPhone 连续互通，虚拟摄像头排在最后；某个摄像头 3 秒内不出画面就自动换下一个。
- 镜子启动中途再次点击取消时，不再误报「暂时无法打开摄像头」，并立即释放摄像头。

## 首次安装

Mac 采用 ad-hoc 签名，不进行 Apple 公证。若首次被系统拦截，打开「系统设置 → 隐私与安全性」并点击「仍要打开」。

Windows 安装包目前没有商业代码签名，首次运行可能显示「Windows 已保护你的电脑」。请确认来自本仓库 Release 并核对校验码，再通过「更多信息 → 仍要运行」继续。安装在当前用户目录，无需管理员权限。受组织策略管理的电脑可能需要管理员批准。

Windows 使用 GitHub 托管 Windows runner 验证安装、程序启动、核心 IPC、系统加密、快捷键、录音/摄像头模拟设备生命周期、重新安装数据保留与卸载。物理摄像头/麦克风、Windows 10 实机、多显示器硬件与特定安全软件不属于此次自动测试覆盖范围。
