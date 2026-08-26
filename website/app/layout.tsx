import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "TO-DO Panel — 把 Mac 刘海变成随手工作台";
const description = "常驻 macOS 刘海的本地工作台：待办、链接、录音、当前窗口、常用应用与可选 AI 完成提醒。";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "TO-DO Panel",
  keywords: ["TO-DO Panel", "macOS 刘海", "Mac 待办", "本地工作台", "Apple Silicon"],
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }], shortcut: "/favicon.png", apple: "/favicon.png" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "TO-DO Panel",
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TO-DO Panel 官网分享封面" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark", themeColor: "#000000" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
