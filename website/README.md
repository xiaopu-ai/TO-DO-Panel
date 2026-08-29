# TO-DO Panel 官网

TO-DO Panel 的中文产品官网，与桌面应用源码一起维护。

- 下载入口：[GitHub Releases](https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest)
- 运行环境：Node.js 22.13.0+

```bash
npm install
npm run dev
npm run lint
npm run build
npm start
```

页面内容位于 `app/`，公开素材位于 `public/`，Sites 配置位于 `.openai/hosting.json`。

产品演示支持自动轮播与鼠标接管：用户点击页面后自动演示暂停，点击“继续自动演示”恢复。页面隐藏、离开视口或启用 `prefers-reduced-motion` 时不会继续播放。

首页启动时立即显示石板与 Mac，并在 Mac 屏幕内部播放壁纸圆角窗口的 Loading 动效。圆角蒙版在 `62% × 54%` 与 `84% × 76%` 两档尺寸间以 1.6 秒的完整周期呼吸，内部壁纸同步做反向推拉，中央 Loading 文案使用 `clamp(14px, 1.44vw, 22px)`。动画至少展示 2.4 秒，不因本地缓存命中而跳过；第二屏 WebP 截图与首个 TAB 的 H.264 MP4 就绪后，Loading 小窗的描边、高光和阴影立即移除，扩张期间底层壁纸保持隐藏，待小窗真正铺满后才无缝接管并衔接首屏入场，且全程保留 Mac 屏幕圆角。等待超过 8 秒时使用 WebP 静态封面继续展示，视频保持后台加载。TAB 录屏统一使用带 `faststart` 的无声 H.264 MP4，并以对应产品截图作为 poster。
