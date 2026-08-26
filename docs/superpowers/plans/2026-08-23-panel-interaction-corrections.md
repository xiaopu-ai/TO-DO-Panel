# TO-DO Panel Interaction Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 TO-DO Panel 的快捷键、待办排序、链接分组与拖拽、列表 hover、密钥检索、剪贴板回填和原生通知安全区。

**Architecture:** 可测的纯逻辑放在 `renderer/domain.js` 和 `main-services.js`；DOM 动画、拖拽与检索留在渲染层；系统剪贴板、应用激活与键盘粘贴留在 Electron 主进程；通知安全区由 SwiftUI 原生壳处理。

**Tech Stack:** Electron 33、原生 HTML/CSS/JavaScript、Node test runner、Web Animations API、HTML Drag and Drop、SwiftUI/AppKit。

**Spec:** `docs/plans/2026-08-23-panel-interaction-corrections-design.md`

## Global Constraints

- 默认只保留 Hover + Space 展开/收起；不注册 `Command + Shift + V`。
- 剪贴板图片不存入 LocalStorage；自动粘贴失败必须保留复制降级。
- 链接仅允许公开 HTTP/HTTPS，不放宽主进程的 SSRF 防护。
- 动画必须尊重 `prefers-reduced-motion`。
- 不打包、不发布；项目无 Git 仓库，因此不执行提交步骤。

---

### Task 1: 纯逻辑回归测试

**Files:**
- Modify: `tests/domain.test.js`
- Modify: `tests/main-services.test.js`
- Modify: `renderer/domain.js`
- Modify: `main-services.js`

**Interfaces:**
- Produces: `sortTodosForDisplay(items)`, `preferredLinkGroupId(groups, url)`, `moveLinkToGroup(groups, linkId, targetGroupId)`, `filterCredentials(items, query)`, `clipboardServicePolicy()`

- [ ] **Step 1: Write failing domain tests**

```js
test('todos sort unfinished by DDL and creation time, with completed items last', () => {
  const rows = sortTodosForDisplay([
    { id: 'done', done: true, deadline: '2026-08-20T00:00:00Z', createdAt: 1 },
    { id: 'late', done: false, deadline: '2026-08-22T00:00:00Z', createdAt: 2 },
    { id: 'early-new', done: false, deadline: '2026-08-21T00:00:00Z', createdAt: 3 },
    { id: 'early-old', done: false, deadline: '2026-08-21T00:00:00Z', createdAt: 1 },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['early-old', 'early-new', 'late', 'done']);
});
```

- [ ] **Step 2: Run `node --test tests/domain.test.js tests/main-services.test.js` and verify missing exports fail**

- [ ] **Step 3: Implement the five pure helpers with non-mutating array operations and literal return values**

```js
function clipboardServicePolicy() {
  return { recordHistory: true, registerGlobalShortcut: false };
}
```

- [ ] **Step 4: Run the targeted tests and verify they pass**

### Task 2: 剪贴板服务与自动回填

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `clipboardServicePolicy()`
- Produces: preload method `pasteClipboard(entry)` returning `{ copied, pasted, error? }`

- [ ] **Step 1: Remove `CLIP_SHORTCUT`, shortcut registration and feature-gated polling; start polling unconditionally after app ready**
- [ ] **Step 2: Capture the external frontmost application immediately before hybrid expansion**
- [ ] **Step 3: Add `clipboard:paste` IPC that writes the entry, collapses the panel, activates the captured app and sends Command+V through a bounded `osascript` call**
- [ ] **Step 4: Change clipboard item clicks to call `pasteClipboard`; show a copied fallback message when accessibility automation fails**
- [ ] **Step 5: Run `npm test` and manually confirm `Command+Shift+V` is not registered**

### Task 3: 待办纵向重排

**Files:**
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `sortTodosForDisplay(items)`
- Produces: `renderList(priority, { animateOrder, focusId })`

- [ ] **Step 1: Render every list from the sorted projection**
- [ ] **Step 2: Capture old item rectangles before add/edit/toggle and animate only `translateY` deltas after DOM reorder**
- [ ] **Step 3: Preserve checkbox focus and completion pop feedback after rerender**
- [ ] **Step 4: Disable FLIP under reduced-motion and run the domain tests**

### Task 4: 链接定向添加、稳定分组与拖拽

**Files:**
- Modify: `renderer/workspace.js`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `preferredLinkGroupId`, `moveLinkToGroup`
- Produces: `addLink(rawValue, targetGroupId = '')`

- [ ] **Step 1: Add a plus icon before each group delete button and an inline group add row**
- [ ] **Step 2: Directed additions stay in the selected group while metadata only updates URL/title/icon**
- [ ] **Step 3: Top additions reuse a same-domain group before deterministic/LLM classification**
- [ ] **Step 4: Make link rows draggable and persist cross-group drops with a visible target state**
- [ ] **Step 5: Verify duplicate URLs remain rejected and empty source groups remain available unless explicitly deleted**

### Task 5: 列表 hover 与密钥检索

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/workspace.js`
- Modify: `renderer/styles.css`
- Modify: `renderer/effects.js`

**Interfaces:**
- Consumes: `filterCredentials(items, query)`

- [ ] **Step 1: Replace the generic horizontal line marker with the todo-style vertical marker and safe 3px translation**
- [ ] **Step 2: Add `#credential-search` to the library header and filter on every input event**
- [ ] **Step 3: Remove `.credential-mark` creation and change rows to a left-aligned two-column layout**
- [ ] **Step 4: Show a search-specific empty state without changing encrypted vault data**

### Task 6: 原生灵动岛通知安全区

**Files:**
- Modify: `native/Sources/DynamicPanelNative/NativePanelRootView.swift`
- Modify: `native/Sources/DynamicPanelNative/NotchPanel.swift`
- Modify: `native/Sources/DynamicPanelNative/NativeSnapshotRenderer.swift`
- Modify: `native/Checks/DynamicPanelCoreChecks/main.swift`

**Interfaces:**
- Produces: `NativePanelRootView(..., notchSafeHeight: CGFloat, ...)`

- [ ] **Step 1: Pass the real menu-bar/safe-area height from `NativeScreenGeometry` into the root view**
- [ ] **Step 2: Constrain live-activity content to the area below `notchSafeHeight`**
- [ ] **Step 3: Render snapshots with 33pt safe height and inspect `native-activity.png`**
- [ ] **Step 4: Run `npm run test:native` and verify architecture checks plus six snapshots pass**

### Task 7: 整体验收与当前实例重启

**Files:**
- Verify all modified files

- [ ] **Step 1: Run `npm test` and require zero failures**
- [ ] **Step 2: Run `npm run test:native` and require all architecture/snapshot checks to pass**
- [ ] **Step 3: Restart `npm run start:hybrid` without packaging**
- [ ] **Step 4: Verify Space toggle, todo reorder, directed link add/drop, credential search, clipboard paste fallback and native notification geometry**
