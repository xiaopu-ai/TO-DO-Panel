## 选择你的安装包

| 电脑 | 下载文件 | 安装方式 |
| --- | --- | --- |
| Mac · Apple Silicon · macOS 13+ | [下载 macOS 安装包（.dmg）](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.1.2/TO-DO-Panel-1.1.2-arm64.dmg) | 打开 DMG，将应用拖入「应用程序」 |
| Windows 10/11 · Intel / AMD 64 位（x64） | [下载 Windows 安装包（.exe）](https://github.com/xiaopu-ai/TO-DO-Panel/releases/download/v1.1.2/TO-DO-Panel-1.1.2-windows-x64-setup.exe) | 双击 EXE，按安装向导完成安装 |

`.sha256` 是对应文件的完整性校验码，不是安装包。官网提供 macOS 与 Windows 两个下载入口。

## 1.1.2

- 修复应用常驻跨天后，新建待办默认截止日期仍停留在昨天或上次添加日期的问题。
- 日期刷新独立于首页时钟；跨天、唤醒、展开面板和切回待办时自动校准为当天 23:30。
- 输入、打开日期选择器和回车提交时再次校准默认日期，避免睡眠恢复或定时器尚未运行时保存旧日期。
- 保留当前待办手动选择的日期，添加完成后重置为当天默认时间；已有待办的截止日期不变。
- 增加真实 Electron 界面的跨天、跨年、闰日和手选日期回归检查。

## 首次安装

Mac 采用 ad-hoc 签名，不进行 Apple 公证。若首次被系统拦截，打开「系统设置 → 隐私与安全性」并点击「仍要打开」。

Windows 安装包目前没有商业代码签名，首次运行可能显示「Windows 已保护你的电脑」。请确认来自本仓库 Release 并核对校验码，再通过「更多信息 → 仍要运行」继续。安装在当前用户目录，无需管理员权限。受组织策略管理的电脑可能需要管理员批准。

Windows 使用 GitHub 托管 Windows runner 验证安装、程序启动、核心 IPC、系统加密、快捷键、录音/摄像头模拟设备生命周期、重新安装数据保留与卸载。物理摄像头/麦克风、Windows 10 实机、多显示器硬件与特定安全软件不属于此次自动测试覆盖范围。
