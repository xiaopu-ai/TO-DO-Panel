import { assetPath } from "./assetPath.mjs";

export const DOWNLOAD_URL = "https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest";
export const GITHUB_URL = "https://github.com/xiaopu-ai/TO-DO-Panel";

export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  src: string;
  fallbackSrc: string;
  kind: MediaKind;
  alt: string;
};

export type TabItem = {
  id: "todo" | "clipboard" | "notes" | "links" | "recordings" | "credentials";
  eyebrow: string;
  title: string;
  description: string;
  capture: string;
  captureKind: MediaKind;
  accent: string;
};

export const NAV_ITEMS = [
  ["GITHUB", GITHUB_URL],
  ["FEATURES", "#features"],
  ["TABS", "#tabs"],
] as const;

export const MARQUEE_ITEMS: MediaItem[] = [
  { id: "todo", src: assetPath("/product-captures/todo.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 待办完整面板" },
  { id: "clipboard", src: assetPath("/product-captures/clipboard.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 剪贴完整面板" },
  { id: "notes", src: assetPath("/product-captures/notes.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 笔记完整面板" },
  { id: "links", src: assetPath("/product-captures/links.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 链接完整面板" },
  { id: "recordings", src: assetPath("/product-captures/recordings.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 录制完整面板" },
  { id: "credentials", src: assetPath("/product-captures/credentials.png"), fallbackSrc: "", kind: "image", alt: "TO-DO Panel 密钥完整面板" },
];

export const CAPABILITIES = [
  ["01", "贴顶待命", "需要时展开，用完即收起。"],
  ["02", "任务提醒", "四个工作流与清晰的截止时间。"],
  ["03", "随手收集", "笔记、链接和剪贴集中整理。"],
  ["04", "本地录音", "主动开启，可选实时转写。"],
  ["05", "AI 完成提醒", "Codex、Claude 与 GPT 做完再告诉你。"],
  ["06", "数据留在本机", "工作内容无需离开当前 Mac。"],
] as const;

export const TAB_ITEMS: TabItem[] = [
  { id: "todo", eyebrow: "PLAN THE DAY", title: "待办", description: "四个可改名工作流，按截止时间排序，并在到期前一小时提醒。", capture: assetPath("/tab-captures/todo.gif"), captureKind: "image", accent: "red" },
  { id: "clipboard", eyebrow: "CAPTURE FAST", title: "剪贴", description: "按需启用的本机剪贴历史，支持文本、图片、收藏与快速粘贴。", capture: assetPath("/tab-captures/clipboard.gif"), captureKind: "image", accent: "amber" },
  { id: "notes", eyebrow: "THINK IN TEXT", title: "笔记", description: "首页随手写，保存后进入资料库继续编辑、搜索与重命名。", capture: assetPath("/tab-captures/notes.gif"), captureKind: "image", accent: "green" },
  { id: "links", eyebrow: "SAVE THE WEB", title: "链接", description: "粘贴公开网址，自动补全标题、图标和分组。", capture: assetPath("/tab-captures/links.gif"), captureKind: "image", accent: "blue" },
  { id: "recordings", eyebrow: "RECORD THE MOMENT", title: "录制", description: "主动点击才启用麦克风，本地保存并可选实时转写。", capture: assetPath("/tab-captures/recordings.gif"), captureKind: "image", accent: "rose" },
  { id: "credentials", eyebrow: "KEEP IT SAFE", title: "密钥", description: "账号、密码与 API Key 由 macOS 安全存储加密。", capture: assetPath("/tab-captures/credentials.gif"), captureKind: "image", accent: "violet" },
];
