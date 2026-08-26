# Dynamic Panel · 仪表盘设计规格（DASHBOARD-DESIGN）

> 本文记录渲染层（`renderer/`）的设计演进。当前产品约束以 §11 为准，精确颜色、圆角、
> 间距、字号与动效取值以 `renderer/styles.css` 的 CSS 自定义属性为准。
>
> **§0–§10 保留为演进记录，出现冲突时不要按历史规格实现。**

---

## 0. 产品形态

把原「单一四象限待办」进化为 **4 个 Tab 的桌面 HUD 仪表盘**，从刘海垂下展开：

| Tab | 名称 | 内容 |
|-----|------|------|
| 1（默认） | 首页 Home | 时钟·日期 / Markdown 速记 / 快捷应用 / 镜子 / 收藏剪贴 |
| 2 | 待办 Todo | 现有 P0–P3 四象限（迁移 + 套新材质，数据零丢失） |
| 3 | 剪贴板 Clip | 文字、链接、图片历史；收藏 / 删除 / 过滤 / 写回系统剪贴板 |
| 4 | 应用 Apps | 应用启动坞：搜索 + 全部应用网格 + 收藏，点击真实启动 |

气质关键词：**纯单色、极致冷淡、玻璃厚度、呼吸感**。比对标 Nook X 更克制、更统一。

---

## 1. 设计 Token（唯一取值表）

所有值必须落到 `:root` 的 CSS 自定义属性里，禁止散落硬编码（沿用现有 NEVER 规则）。

### 1.1 颜色 —— 纯单色体系
```
--bg-base:        #000000;                      /* OLED 纯黑底，刘海/面板同色 */
--surface-1:      rgba(255,255,255,0.045);      /* 模块块（tile）默认底 */
--surface-2:      rgba(255,255,255,0.07);       /* tile hover / 次级面 */
--surface-3:      rgba(255,255,255,0.10);       /* 输入框聚焦 / 激活态 */
--hairline:       rgba(255,255,255,0.08);       /* 发丝边框（所有 tile/面板） */
--hairline-soft:  rgba(255,255,255,0.06);
--highlight-top:  rgba(255,255,255,0.07);       /* tile/面板顶部 1px 高光（玻璃厚度） */

--text-1:         rgba(255,255,255,0.92);        /* 主文本 */
--text-2:         rgba(255,255,255,0.55);        /* 次文本 */
--text-3:         rgba(255,255,255,0.40);        /* 标签/提示 */
--text-4:         rgba(255,255,255,0.25);        /* 占位/禁用 */
```

**功能色（全局仅此两类例外，其余一律单色）：**
```
--p0: #FF5F57;  --p1: #FF9352;  --p2: #30D978;  --p3: #438CFF;   /* 当前待办优先级点：红 / 橙 / 绿 / 蓝 */
```
- App 原生图标保留自身彩色（启动坞），这是第二类例外。
- 除以上两类，**不得引入任何强调色**：时钟、进度、聚焦边框、激活态全部用白色分级（`--text-*` / `--surface-*`）。

### 1.2 圆角
```
--r-notch: 14px;     /* 折叠态下方两角 */
--r-panel: 24px;     /* 展开面板下方两角 */
--r-tile:  18px;     /* 模块块 */
--r-squircle: 12px;  /* app 图标 / 方钮 */
--r-input: 10px;
--r-pill:  999px;    /* tab 激活胶囊 / 计数 */
```

### 1.3 间距（8pt 体系）
```
--s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
```
面板内边距 16px；tile 内边距 13–15px；tile 间距 12–14px。

### 1.4 字体 / 字号
```
--font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang SC', sans-serif;
--font-mono: 'SF Mono', ui-monospace, monospace;
```
数字（时钟、进度、计数）必须 `font-variant-numeric: tabular-nums`（等宽，跳秒不抖）。
| 用途 | 字号 / 字重 / 字距 |
|------|------|
| 时钟 hero | 52px / 500 / -2px |
| 模块标签（小标题） | 11px / 500 / 0.4px / `--text-3` |
| 正文 / 列表项 | 12.5–13px / 400 |
| 次要说明 / 计数 | 10.5–11px / 500 / `--text-3` |
> 字重只用 400 与 500，不用 600/700（克制，避免发胖）。

### 1.5 动效 · Motion System v2（丝滑升级）
```
--ease:        cubic-bezier(0.32, 0.72, 0, 1);   /* 兼容旧引用 */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);    /* expo-out：入场/退场主曲线 */
--ease-spring: cubic-bezier(0.34, 1.4, 0.5, 1);  /* 轻微回弹落定：胶囊/勾选/提起 */
--ease-soft:   cubic-bezier(0.4, 0, 0.2, 1);     /* 对称缓动：窗口尺寸变形（无过冲防裁切）*/
--d-1:110ms(按压) --d-fast:180ms --d-base:240ms --d-slow:320ms --d-grand:380ms(展开大手势)
```
**核心理念**：① 入场是「从刘海垂下并落定」的一个连续手势，不是淡入；② 内容级联入场（块依次上浮）让界面"活"；③ 每个控件都有触觉反馈（按压缩小 / 提起 / 勾选弹一下）。

- **展开**：`.panel` 从 `translateY(-14px) scale(0.96)` → 归位，`transform-origin: top center`，380ms expo-out（从刘海下沿垂下并落定）；窗口尺寸变形仍瞬时（防卡顿铁律），`--ease-soft` 200ms 补间。
- **收起**：`.closing` 面板回缩 `scale(0.975) translateY(-12px)` + 淡出 180ms（snappy）。
- **内容级联**：进入任一 Tab，`.home-bento>* / .sections>* / .apps-scroll>*` 依次 `riseIn`（上浮 12px 淡入，stagger 30/78/126/174ms，`backwards` 填充以免与 hover transform 冲突）。
- **Tab 胶囊**：`translateX` 用 `--ease-spring` 360ms 落定、`width` 用 expo-out 300ms（宽度不过冲免抖）。
- **触觉微反馈**：Tab/按钮 `:active scale(0.86~0.94)`；首页 bento 块 hover `translateY(-2px)`+投影；快捷应用/启动坞图标 hover dock 式提起 `translateY(-3~4px) scale(1.06~1.1)`（spring）；「+」hover 旋转 90°；勾选框 `checkPop` 弹一下（JS 一次性 `.pop`）+ 勾 `scale(0.6→1)`；新增待办 `itemIn` 滑入（JS 一次性 `.enter`）；折叠刘海 hover 圆点拉成小药丸（抓握暗示）。
- **无障碍**：`@media (prefers-reduced-motion: reduce)` 全局降到 0.01ms。
- 一切动效只用 transform/opacity（合成层）+ 必要的 width/height 补间；禁止动其它 layout 属性。

---

## 2. 材质配方（玻璃厚度的关键）

**展开面板（.panel）**
```
background: var(--bg-base);
border: 1px solid var(--hairline);
border-top: none;                  /* 顶边贴屏，无边 */
border-radius: 0 0 var(--r-panel) var(--r-panel);
box-shadow: 0 26px 60px rgba(0,0,0,0.6), inset 0 1px 0 var(--highlight-top);
```
**模块块（.tile）**
```
background: var(--surface-1);
border: 1px solid var(--hairline);
border-radius: var(--r-tile);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
transition: background var(--d-base) var(--ease);
```
hover → `background: var(--surface-2)`。
**方钮 / app 图标（.squircle）**
```
border-radius: var(--r-squircle);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);   /* 顶部内高光，做出"按钮厚度" */
```

---

## 3. 结构与 Tab 骨架

```
#app.collapsed / #app.expanded
  └─ .notch                      （折叠态，点击展开；逻辑/尺寸不变）
  └─ .panel                      （展开态）
       ├─ .topbar                高 40–44
       │    ├─ .brand            左：18px logo 方钮（中性单色）+ 可选极小字标
       │    ├─ .tabs             分段控件：3 个 .tab（icon + 文案），含滑动激活胶囊 .tab-indicator
       │    └─ .topbar-actions   右：折叠按钮（chevron-up，点击=收起）
       └─ .panels
            ├─ #tab-home  .tab-panel
            ├─ #tab-todo  .tab-panel
            └─ #tab-apps  .tab-panel
```

**Tab 分段控件**：胶囊式（像 iOS Segmented Control）。激活项底 `--surface-2`、文字 `--text-1`；未激活文字 `--text-3`。一个绝对定位的 `.tab-indicator`（圆角胶囊 `--surface-2`）随激活项 `transform: translateX()` 滑动。
**内容切换**：只显示激活 `.tab-panel`（其余 `opacity:0; pointer-events:none; position:absolute`），切换走交叉淡入；面板高度固定（见 §6），不撑动窗口。
**Tab 图标**（内联 SVG，24 viewBox，1.5px 描边，圆角端，currentColor，渲染 ~16px）：
- 首页 home：`<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/>`
- 待办 todo：`<path d="M4 7h10"/><path d="M4 12h10"/><path d="M4 17h7"/><path d="M17.5 7.5 19 9l2.5-3"/>`（清单+勾）
- 应用 apps：四个圆角小方块 `<rect x="4" y="4" width="6.5" height="6.5" rx="2"/>` ×4（2×2）

---

## 4. 首页 Tab（#tab-home）—— bento

布局：上方时钟 hero 横条；下方左「速记」右「快捷链接 + 镜子」。用 CSS grid，三块 tile 风格统一。

- **时钟·日期 tile**：实时更新（每秒）。日期行 `周三 · 6 月 10 日`（`--text-3`，11px）。时间 `10:44` 52px tabular，纯白，**不染色**（对标版分钟是橙色，我们刻意去掉）。可选秒 `:ss` 用 `--text-3` 小号跟随。无定位/天气（本期不做）。
- **速记 tile**：自适应 Markdown 编辑器，输入即存 `localStorage`（防抖 300ms），支持编辑/预览切换。Key 见 §7。
- **快捷链接 tile**：用户可增删的链接/路径，渲染成一排 squircle（首字母或 favicon 占位）。点击：URL 走 `shell.openExternal`，本地路径走 `shell.openPath`（经 preload IPC，见 §7）。带一个「+」方钮新增（弹一个极简内联输入：名称 + URL）。
- **镜子 tile**：圆形摄像头预览。**默认不开摄像头**——显示一个含相机图标的占位圆，点击才 `getUserMedia({video})` 激活；离开首页 Tab 或再次点击即 `track.stop()` 释放。圆形用 `border-radius:50%`+`object-fit:cover`。隐私优先。

---

## 5. 待办 Tab（#tab-todo）—— 迁移现有四象限

- 把现有 `index.html` 的 `.sections`（2×2 P0–P3）整体搬进 `#tab-todo`，外观改套 §2 材质（.quadrant → .tile 风格），P0–P3 色点/勾选/计数保留。
- **数据零丢失**：继续用现有 `localStorage` key `notch-todo-data` 与数据结构 `{P0:[],P1:[],P2:[],P3:[]} / item:{id,text,done,createdAt}`。现有 `app.js` 的 `loadData/saveData/addTodo/toggleTodo/deleteTodo` 逻辑全部保留，只改 DOM 容器与样式。
- **单次回车提交**：输入框中按一次 Enter 新增；输入法组合态（`isComposing` / `keyCode 229`）忽略。见现有 `app.js`。
- 四象限标题沿用：P0 紧急·重要 / P1 重要·不紧急 / P2 紧急·不重要 / P3 日常·待办。

---

## 6. 应用 Tab（#tab-apps）—— 启动坞

- 顶部一个搜索框（`--surface-1`，聚焦 `--surface-3`，占位「搜索应用…」），实时过滤。
- 下方应用网格：每个 app = squircle 真实图标 + 名称（11px `--text-2`，单行省略）。列数自适应（`grid-template-columns: repeat(auto-fill, minmax(76px,1fr))`），区域内纵向滚动（细滚动条同现有 `.todo-list`）。
- **收藏**：长按或 hover 出现的星标可置顶；收藏存 `localStorage`（key 见 §7），收藏区在网格顶部单独一行「常用」。无收藏时不显示该行。
- 数据来自主进程 IPC（见 §7）：图标已是 dataURL，直接 `<img>`。点击 = IPC 启动。
- 空/加载态：加载时显示骨架或「正在读取应用…」。

---

## 7. 主进程扩展 & IPC 契约（preload 暴露，禁止渲染层直接 require）

**窗口尺寸**（`main.js`）：折叠 `200 × (菜单栏高 + 18px 唇边)`，最小高 38（macOS 菜单栏/物理刘海会拦截其高度带内的点击，必须露出唇边才可点；高度经 `window:metrics` IPC 下发给渲染层写入 `--notch-h`）；展开 **`EXPANDED_WIDTH=620, EXPANDED_HEIGHT=464`**。收起路径：点唇边切换 / 窗口失焦自动收起（`blur` → `window:collapse`）/ Esc 经 `before-input-event` 转发（Escape 不会原生到达页面）。

**preload.js `window.notchAPI` 新增：**
```
setMode(mode)                        // 现有，保留
listApps()        -> Promise<App[]>  // App = { name, path, icon(dataURL) }
launchApp(path)   -> Promise<bool>   // shell.openPath
openExternal(url) -> Promise<void>   // shell.openExternal（快捷链接用 URL）
openPath(p)       -> Promise<void>   // shell.openPath（快捷链接用本地路径）
```

> ⚠️ **已过期，勿照此实现**：`listApps` / `launchApp` 从未落地，现行 `preload.js` 里不存在这两个方法
> （应用页走的是另一套通道）。preload 的实际契约以 [preload.js](../../preload.js) 为准。
**main.js 新增 handler：**
- `apps:list`：用 `fs.promises.readdir` 扫 `/Applications` 与 `/System/Applications`（含 `Utilities` 子目录可选），筛 `.app`；对每个用 `app.getFileIcon(path,{size:'large'})` 取图标 → `.toDataURL()`；按名排序；结果缓存（首次较慢，之后复用）。
- `apps:launch` → `shell.openPath(path)`；`shell:openExternal` → `shell.openExternal(url)`；`shell:openPath`。
- 安全：launch/openPath 只接受绝对路径且存在；openExternal 仅允许 `http/https`。

**localStorage keys：**
```
notch-todo-data        // 现有待办（勿改）
notch-home-note        // 速记原始 Markdown 文本
notch-quicklinks       // [{id,name,target}]  target 为 url 或本地路径
notch-app-favorites    // [appPath, ...]
notch-active-tab       // 'home' | 'todo' | 'apps'（记住上次所在 Tab）
```

**摄像头打包配置**：`package.json > build.mac.extendInfo` 加 `NSCameraUsageDescription`（中文说明）；`build/entitlements.mac.plist` 加 `com.apple.security.device.camera`。开发期 `npm start` 首次调用会弹系统授权。

---

## 8. NEVER（继承项目铁律）
- NEVER 渲染层直接 `require('electron')`，一切走 preload contextBridge。
- NEVER 让窗口可拖出刘海位；每次显示强制贴顶居中（现有逻辑勿动）。
- NEVER 硬编码颜色/字号/间距，必须用 §1 的 CSS 变量。
- NEVER 提交 node_modules / dist。
- NEVER 摄像头常驻：非激活即释放 track。
- NEVER 破坏 `notch-todo-data` 既有数据与结构。

## 9. 历史验收口径（已由 §11 取代）
- `npm start` 正常启动无报错；点击刘海弹簧展开为 620×464 面板。
- 三 Tab 可切换，激活胶囊滑动顺滑，内容交叉淡入；记住上次 Tab。
- 待办：旧数据仍在；增删勾选、单次回车、四象限色点全部如常。
- 首页：时钟实时跳秒等宽；速记自动保存；快捷链接可增删并能打开；镜子点击才开、离开即关。
- 应用：能列出本机应用并显示真实图标；搜索过滤；点击启动；收藏置顶。
- 全程纯单色（除 P0–P3 点与 app 图标）；无硬编码颜色；无 require('electron') 泄漏到渲染层。

---

## 10. 历史 Round 2 改版规格（2026-06-10，已由 §11 取代）

### 10.1 Per-tab 窗口尺寸（main.js）
展开尺寸不再唯一，按当前 Tab 取值（宽超出屏幕时 clamp 到 `workArea.width - 24`）：
```
TAB_SIZES = {
  home: { width: 980,  panelHeight: 196 },   // 横向 HUD 条，对齐 Nook X 参考
  todo: { width: 1080, panelHeight: 300 },   // 四列并排
  apps: { width: 1120, panelHeight: 540 },   // 大网格
}
窗口总高 = 刘海条高(getCollapsedHeight) + panelHeight + 面板上下 padding(约 2×16)
```
- 新增 IPC `window:set-tab(tab)`：渲染层切 Tab 时调用；主进程记录 `currentTab`（校验合法值，默认 home），若处于展开态则 `applyMode('expanded', true)` 平滑变尺寸（仍贴顶居中）。渲染层启动时也同步一次上次 Tab。
- 渲染层 `.panel` 宽与展开态 `.notch` 宽改为 `100%` / `100vw`，不再写死 620。
- **多屏锚定（真机踩坑后定死）**：模式切换 / Tab 变形 / 失焦收起一律锚定**窗口当前所在屏**（`screen.getDisplayMatching(win.getBounds())`），绝不跟随光标——否则失焦瞬间刘海会瞬移到光标所在的另一块屏。只有"召唤"类动作（启动初始定位 / 托盘"重新居中" / 显示）才用光标所在屏（`getTargetDisplay()`）。跨屏移动一律瞬时 `setBounds`（动画跨屏被打断会留下中间尺寸残窗）。

### 10.2 顶栏：Tab 移到左上
`.topbar` = [tabs 分段控件（根据数量靠左或分列避让物理刘海）]。滑动胶囊机制保留。

### 10.x Round 3 修订（2026-06-10，卡顿 / 高度 / 顶部布局）
- **窗口零动画铁律**：主进程 `setBounds` 一律瞬时（系统动画 resize 持续重绘 web 内容必卡）。平滑感全在渲染层：
  - 展开 = 先瞬时放大窗口 → `.panel` 入场（translateY -10px + scale 0.985 → 复位，240ms）；
  - 收起 = 先加 `.closing` 播退场（170ms）→ 再瞬时缩窗；失焦收起由主进程直接缩窗、渲染层仅同步类；
  - 切 Tab = `morphToTab`：面板临时 `flex:0 0 auto` + 锁定当前 px → CSS 过渡到目标 px（200ms）。三档尺寸严格有序（home < todo < apps），**放大先变窗、缩小后变窗**，补间永远发生在"窗口足够大"的一侧，不露裁切。目标 px 由 `window:metrics` 下发（tabSizes + chromeY）。
- **折叠高度贴近物理刘海**：唇边 18px → **10px**（`NOTCH_LIP`），圆点 padding-bottom 3px。
- **展开态顶部布局**（对齐用户标注）：黑条退场（`.notch` 变菜单栏高的透明占位、pointer-events none），**菜单栏透出**，玻璃面板全圆角悬挂其下；顶栏单行 = [brand][tabs][`.topbar-mid` 弹性中段][collapse]，**应用 Tab 的搜索框移入中段右对齐**（其余 Tab 隐藏，`#topbar-search`）。窗口总高 = 菜单栏高 + `EXPANDED_CHROME_Y`(80 = 12+40+12+16) + panelHeight。
- **顶栏中段空白点按收起**：只认 `.topbar-mid` 本体（brand/tabs 周边缝隙不响应，防脱靶误收）。

### 10.3 首页改横向 bento（对齐 Nook X 参考图）
panel 内单行横排 grid：`grid-template-columns: 220px 252px 1fr 132px`（时钟 | 快捷应用 | 速记 | 镜子），gap var(--s-3)，全部 .tile 材质，高度填满。
- **时钟**：日期行改小胶囊（surface-1 底、**--p3 绿色**文本 11px，如「周三 · 6/10」）；时间 44px tabular：小时 --text-1、**分钟 --p1 琥珀**（对齐参考图点缀，仅复用既有 token，不新增色）；秒 --text-3 小号。
- **快捷应用**（替代原"快捷链接"模块，后者整体删除——含表单/样式/openExternal·openPath 的首页调用，storage key notch-quicklinks 废弃）：2×3 网格，数据 = `notch-app-favorites`（与应用 Tab 星标同源）。真实图标原样（同 10.5，不包壳）约 40px + 无名称或 9px 名称，点击 `launchApp`。空态文案「去“应用”页给常用加星 →」，点击与「+」按钮一样跳 apps Tab。首页激活时调用与应用 Tab 共享的 `ensureAppsLoaded()`（主进程已有在途去重）。
- **速记**：保留，占 1fr。
- **镜子**：圆形 + 「点按开启」保留，开启修复见 10.6。

### 10.4 待办 Tab：四列并排
`.sections` 改 `grid-template-columns: repeat(4, 1fr); grid-template-rows: 1fr;`，P0–P3 四竖列（列内：header / 列表 / 输入框）。交互与数据逻辑零改动。

### 10.5 应用 Tab：原生图标原样 + 拖拽排序
- **图标去壳**：删除 .app-icon 的 squircle 底/inset 高光/overflow 裁切（这是"图标像被重新设计"的原因），`<img>` 52px `object-fit: contain` 直接展示；icon:null 的首字母兜底样式保留。
- **拖拽排序**：「全部应用」网格内 HTML5 DnD；松手重排并存 `localStorage('notch-app-order')`=[path,...]；renderApps 按保存顺序排，新应用（不在表内）按 zh 排序追加尾部；搜索过滤态禁用拖拽；「常用」行不参与。
- 网格 `repeat(auto-fill, minmax(84px,1fr))`。

### 10.6 镜子修复（dev 下无法开启的根因）
macOS 渲染层 getUserMedia **不会**自动弹 TCC 授权，必须主进程申请：
- main.js：electron 解构补 `systemPreferences`；新增
  `ipcMain.handle('media:camera', async () => { if (process.platform !== 'darwin') return true; if (systemPreferences.getMediaAccessStatus('camera') === 'granted') return true; return systemPreferences.askForMediaAccess('camera'); })`
- preload 暴露 `ensureCamera()`；渲染层 startMirror 先 `await ensureCamera()`，false → mirror-hint 显示「无法访问摄像头 · 去系统设置授权」。
- 隐私规则不变：点按才开、离开首页/收起即 stop。

### 10.7 质感微调
- `--surface-1` 0.045 → 0.055（tile 与纯黑底层次更清晰）。
- 彩色仅限：P0–P3 token、app 原生图标、时钟日期胶囊(--p3)与分钟(--p1)。其余仍纯单色。

### 10.8 Round 2 验收
- 三 Tab 窗口尺寸各异且切换平滑、始终贴顶居中；Tab 在左上角。
- 首页横向四模块对齐参考；快捷应用与应用页星标联动、点击可启动；镜子点按能弹系统授权并出画面。
- 待办四列并排，旧数据/交互如常。
- 应用页图标原生原样、可拖拽排序且持久化、搜索时禁拖。

---

## 11. Round 4 渲染层规格（2026-08-06 起，与 §0–§10 冲突时以本节为准）

> **准绳与范围**：本节只描述**渲染层**（`renderer/`）的视觉与交互规格。产品行为的唯一事实来源是
> [README.md](../README.md)，冲突时以 README 为准。

- 四个 Tab 统一为 `1120 × 540` 内容尺寸。切换 Tab 只切内容，不再改变原生窗口宽高。
- 待办使用 P0–P3 的 2 × 2 矩阵，单次回车新增；当前色点为红 / 橙 / 绿 / 蓝。
- 首页速记升级为安全的 Markdown 编辑/预览，支持标题、粗斜体、列表、任务列表、引用、代码和 http/https 链接；原始文本仍存 `notch-home-note`。
- 剪贴板使用统一的 152px 固定高度卡片，过长文字截断；类型只用浅描边区分，不使用左侧色条或冗余类型标签。时间信息保留。
- 应用页是左右两栏：左侧收藏应用固定，右侧全部应用列表独立纵向滚动，页面本身不整体滚动。
- 展开与收起同时改变宽高，动画最终收束到屏幕顶部中心点；折叠态仍严格限制在物理刘海高度内。
- 新 Logo 用于 macOS 应用图标与任务完成提醒。
- 任务完成提醒是独立 `400 × 96` 顶部窗口，不抢焦点；悬停暂停、点击关闭，支持去重与最多 5 条队列。接收服务只监听 `127.0.0.1:43821` 的 `/notify/<source>`，来源白名单为 `codex` / `claude` / `gpt`。Codex 由 `~/.codex/config.toml` 的 notify 钩子转发，Claude Code 由 `~/.claude/settings.json` 的 Stop 钩子转发——钩子位于 CLI 内核，因此终端、VS Code 官方插件与桌面端共用同一份配置；云端会话不接入。
