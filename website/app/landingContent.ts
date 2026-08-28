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
  accent: string;
};

export const NAV_ITEMS = [
  ["FEATURES", "#features"],
  ["TABS", "#tabs"],
  ["PRIVACY", "#privacy"],
] as const;

export const MARQUEE_ITEMS: MediaItem[] = [
  { id: "home-open", src: "", fallbackSrc: "/product-captures/home.png", kind: "video", alt: "TO-DO Panel 首页展开操作" },
  { id: "todo-flow", src: "", fallbackSrc: "/product-captures/todo.png", kind: "video", alt: "待办创建与完成操作" },
  { id: "clipboard-flow", src: "", fallbackSrc: "", kind: "video", alt: "剪贴板收藏操作" },
  { id: "notes-flow", src: "", fallbackSrc: "", kind: "video", alt: "笔记编辑与归档操作" },
  { id: "links-flow", src: "", fallbackSrc: "", kind: "video", alt: "链接保存与分组操作" },
  { id: "recordings-flow", src: "", fallbackSrc: "", kind: "video", alt: "录音与转写操作" },
  { id: "credentials-flow", src: "", fallbackSrc: "", kind: "video", alt: "密钥保存操作" },
  { id: "notification-flow", src: "", fallbackSrc: "", kind: "video", alt: "本机 AI 完成提醒" },
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
  { id: "todo", eyebrow: "PLAN THE DAY", title: "待办", description: "四个可改名工作流，按截止时间排序，并在到期前一小时提醒。", capture: "/product-captures/todo.png", accent: "red" },
  { id: "clipboard", eyebrow: "CAPTURE FAST", title: "剪贴", description: "按需启用的本机剪贴历史，支持文本、图片、收藏与快速粘贴。", capture: "", accent: "amber" },
  { id: "notes", eyebrow: "THINK IN TEXT", title: "笔记", description: "首页随手写，保存后进入资料库继续编辑、搜索与重命名。", capture: "", accent: "green" },
  { id: "links", eyebrow: "SAVE THE WEB", title: "链接", description: "粘贴公开网址，自动补全标题、图标和分组。", capture: "", accent: "blue" },
  { id: "recordings", eyebrow: "RECORD THE MOMENT", title: "录制", description: "主动点击才启用麦克风，本地保存并可选实时转写。", capture: "", accent: "rose" },
  { id: "credentials", eyebrow: "KEEP IT SAFE", title: "密钥", description: "账号、密码与 API Key 由 macOS 安全存储加密。", capture: "", accent: "violet" },
];
