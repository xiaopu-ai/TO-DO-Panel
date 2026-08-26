# NotchTodo Workspace Evolution Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use test-driven development while executing this plan task-by-task.

**Goal:** 将 NotchTodo 从“待办 + 剪贴板 + 应用坞”升级为围绕指令、链接、录音转写、当前窗口与 AI 完成提醒的本地工作台，同时保留但隐藏剪贴板能力。

**Architecture:** 保持 Electron 主进程、contextBridge 与原生渲染层的现有边界。新增纯函数领域模块负责 URL、链接分组、录音元数据与任务匹配；主进程负责受控网络读取、macOS 窗口自动化和录音文件 I/O；渲染层负责五个可见 Tab 与 LocalStorage 元数据。

**Tech Stack:** Electron 33、Node.js、原生 HTML/CSS/JavaScript、Node `node:test`、macOS JXA、MediaRecorder、浏览器 SpeechRecognition 渐进增强。

---

### Task 1: 建立可测试的领域模型

**Files:**
- Create: `renderer/domain.js`
- Create: `tests/domain.test.js`
- Modify: `package.json`

**Steps:**
1. 先写 URL 标准化、自动分类、链接分组、命令清洗、录音元数据和窗口任务匹配测试。
2. 运行 `node --test tests/domain.test.js`，确认因模块缺失而失败。
3. 实现最小领域函数并导出为 CommonJS + 浏览器全局。
4. 重跑测试确认通过，并把测试加入 `npm test`。

### Task 2: 扩展安全 IPC 与本地能力

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `package.json`

**Steps:**
1. 新增麦克风权限、录音保存/读取/删除 IPC；只允许访问 `userData/recordings` 的扁平白名单文件。
2. 新增链接检查 IPC：只接受公网 `http/https`，限制重定向、响应大小和超时，提取标题并返回分类建议。
3. 新增 macOS 当前窗口列表/聚焦 IPC：用固定 JXA 脚本枚举窗口，聚焦只接受本次扫描缓存中的 ID。
4. 将 Codex/GPT 完成事件同步给主窗口，供首页按项目匹配 VS Code 窗口。
5. 更新麦克风用途描述，运行语法检查。

### Task 3: 重构导航和首页

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Create: `renderer/workspace.js`

**Steps:**
1. 隐藏剪贴板 Tab，新增“链接”“录制”Tab；保留剪贴板 DOM、数据和 IPC。
2. 把“收藏剪贴”替换为“常用指令”：回车新增、点击内联编辑、复制、删除。
3. 把镜子替换为录音控制与实时转录预览；支持开始、暂停/继续、结束。
4. 把快捷应用替换为当前窗口列表；支持刷新、逐窗口聚焦和 AI 任务完成徽标。
5. 通过自定义 Tab/折叠事件控制轮询与录音生命周期。

### Task 4: 实现链接收藏夹

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/workspace.js`
- Modify: `renderer/styles.css`

**Steps:**
1. 实现 URL 回车保存、加载态、网页标题自动命名和自动分类。
2. 实现分组创建、重命名、折叠/展开、删除空分组。
3. 实现链接打开、手动改名和删除。
4. 错误时保留可用的域名标题与“其他”分组，不丢用户输入。

### Task 5: 实现录音与转写资料库

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/workspace.js`
- Modify: `renderer/styles.css`

**Steps:**
1. MediaRecorder 采集音频，SpeechRecognition 可用时同步生成实时转录。
2. 结束后音频写入本机目录，元数据和文本写入 `notch-recordings`。
3. 录制页提供记录列表、文本详情、音频播放、复制和删除。
4. 不支持实时识别时明确显示“音频已保存，当前环境未提供实时转写”，而非伪造文本。

### Task 6: 视觉整合与完整验证

**Files:**
- Modify: `renderer/styles.css`
- Modify: `README.md`

**Steps:**
1. 延续现有纯黑玻璃、白色分级和紧凑 bento，不引入新的强调色。
2. 校验窄屏、滚动、键盘操作、空态和 `prefers-reduced-motion`。
3. 运行 `npm test`；重启 Electron 并检查通知健康接口。
4. 逐项验证命令、链接、录音、窗口跳转、任务提醒和隐藏剪贴板入口。
