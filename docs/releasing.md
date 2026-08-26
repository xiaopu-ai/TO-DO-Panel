# GitHub Release 发布流程

Dynamic Panel 采用与 CC Switch 类似的开源分发方式：源码公开在 GitHub，安装包放在 Releases，暂不购买 Developer ID，也不提交 Mac App Store。

## 用户安装

1. 从 [GitHub Releases](https://github.com/xiaopu-ai/dynamic-panel/releases/latest) 下载 `Dynamic Panel-*-arm64.dmg`。
2. 打开 DMG，将 `Dynamic Panel.app` 拖入“应用程序”。
3. 首次启动若被 macOS 拦截，打开“系统设置 → 隐私与安全性”，点击“仍要打开”。
4. 再次启动 Dynamic Panel，并按系统提示授权摄像头和麦克风。

“仍要打开”只需要确认一次。安装包使用 ad-hoc 签名且未经过 Apple 公证，因此无法省略这一步。

## 本地直接生成 DMG

不依赖 GitHub 也能出包，自己分发或先行验证时用这条路径：

```bash
npm install
npm test
npm run build
```

产物是 `dist/Dynamic Panel-<版本>-arm64.dmg`。`afterPack` 的 ad-hoc 签名校验失败会直接中断构建，
所以只要命令成功退出，产物就是可分发的。

## 维护者经 GitHub 发布新版本

> **前置条件**：本地 `main` 已跟踪 GitHub 的 `origin/main`，并已配置可写入
> `xiaopu-ai/dynamic-panel` 的 GitHub 凭据。发布前先确认工作区干净且本地提交已经推送。

GitHub Actions 只在推送语义化版本标签时发布安装包。标签必须与 `package.json` 中的版本一致，
所以先读版本号再打标签，不要照抄示例里的数字：

```bash
npm test
version=$(node -p "require('./package.json').version")
git tag "v${version}"
git push origin main
git push origin "v${version}"
```

工作流会在 GitHub 的 Apple Silicon macOS runner 上自动完成：

1. 安装锁定版本的 npm 依赖。
2. 执行桌面端检查。
3. 生成并验证 Apple Silicon DMG。
4. 生成 SHA-256 校验文件。
5. 创建 GitHub Release，并上传 DMG 与校验文件。

如果任一测试、版本检查或 DMG 校验失败，Release 不会创建。

## 发布前检查

- 不提交 `node_modules/`、`dist/`、`.env`、录音、剪贴板图片或本地工作区数据。
- 确认 `scripts/codex-notify.js` 与 `scripts/claude-notify.js` 已随包装入（在 `build.files` 白名单内），
  否则装了 DMG 的用户按 README 注册钩子时会指向空路径。
- 不把 API Key、密码、Apple ID 或其他凭据写入源码和 Release。
- 发布说明必须注明 Apple Silicon 系统要求和首次“仍要打开”的操作。
- 每个正式版本只使用一个唯一标签，不覆盖已经公开的安装包。
