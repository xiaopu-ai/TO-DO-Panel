import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assetPath } from "./assetPath.mjs";

const title = "TO-DO Panel — 把 Mac 刘海变成随手工作台";
const description = "常驻 macOS 刘海的本地工作台：首页、待办、笔记、链接、录制、密钥与可选剪贴板，数据留在当前 Mac。";

export const metadata: Metadata = {
  metadataBase: new URL("https://xiaopu-ai.github.io/TO-DO-Panel/"),
  title,
  description,
  applicationName: "TO-DO Panel",
  keywords: ["TO-DO Panel", "macOS 刘海", "Mac 待办", "本地工作台", "Apple Silicon"],
  icons: { icon: [{ url: assetPath("/favicon.png"), type: "image/png" }], shortcut: assetPath("/favicon.png"), apple: assetPath("/favicon.png") },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "TO-DO Panel",
    title,
    description,
    images: [{ url: assetPath("/og.png"), width: 1200, height: 630, alt: "TO-DO Panel 官网分享封面" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [assetPath("/og.png")] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark", themeColor: "#000000" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
