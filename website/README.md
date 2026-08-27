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
