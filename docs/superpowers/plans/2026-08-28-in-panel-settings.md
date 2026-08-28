# In-Panel Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible rightmost Settings tab that mirrors every configurable tray-menu action needed when the macOS notch hides the tray icon.

**Architecture:** Main-process IPC remains the authority for feature visibility, login items, mirror image selection, workspaces, shortcuts, and encrypted API configuration. The renderer adds a two-column settings dashboard that consumes narrow preload APIs and reuses the existing API dialog and shortcut recorder.

**Tech Stack:** Electron 33, native HTML/CSS/JavaScript, Node test runner, LocalStorage plus main-process JSON and `safeStorage`.

**Spec:** `docs/plans/2026-08-28-in-panel-settings-design.md`

## Global Constraints

- Keep the single Electron architecture and `npm start` as the only development path.
- Keep expanded content at `1240 × 540` and preserve the 24px screen safety margin.
- Never access Electron directly from the renderer; every system action crosses `preload.js`.
- Never expose saved API Key plaintext to the settings page.
- Keep `notch-todo-data` and all existing LocalStorage keys unchanged.
- Do not package or publish without separate user confirmation.

---

### Task 1: Safe settings IPC contracts

**Files:**
- Modify: `main-services.js`
- Modify: `main.js`
- Modify: `preload.js`
- Test: `tests/main-services.test.js`

**Interfaces:**
- Produces: `updateFeaturePreference(features, featureId, enabled)` returning a normalized feature map or `null` for forbidden IDs.
- Produces: preload methods `setFeature(featureId, enabled)`, `setAutoLaunch(enabled)`, and `chooseMirrorImage()`.

- [ ] **Step 1: Write the failing feature preference test**

```js
test('feature preferences only update configurable tabs and keep home enabled', () => {
  assert.deepEqual(updateFeaturePreference({ todo: true, clip: false }, 'clip', true), {
    todo: true,
    clip: true,
    home: true,
  });
  assert.equal(updateFeaturePreference({ todo: true }, 'home', false), null);
  assert.equal(updateFeaturePreference({ todo: true }, 'settings', false), null);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test --test-name-pattern='feature preferences' tests/main-services.test.js`

Expected: FAIL because `updateFeaturePreference` is not exported.

- [ ] **Step 3: Implement the pure whitelist and IPC handlers**

```js
const CONFIGURABLE_FEATURES = new Set(['todo', 'notes', 'links', 'recordings', 'credentials', 'clip']);
function updateFeaturePreference(features, featureId, enabled) {
  if (!CONFIGURABLE_FEATURES.has(featureId) || typeof enabled !== 'boolean') return null;
  return { ...(features || {}), [featureId]: enabled, home: true };
}
```

Add `settings:set-feature`, `settings:set-auto-launch`, and `mirror:choose-image` handlers. Each handler returns an explicit `{ ok, ... }` result, refreshes the tray menu, and broadcasts the same state used by `settings:get`.

```js
ipcMain.handle('settings:set-feature', (event, payload) => {
  const current = readAppSettings();
  const features = updateFeaturePreference(current.features, payload?.featureId, payload?.enabled);
  if (!features) return { ok: false, error: 'invalid_feature' };
  const next = { ...current, features };
  if (!saveAppSettings(next)) return { ok: false, error: 'save_failed' };
  applyAppSettings();
  refreshTrayMenu();
  return { ok: true, settings: publicAppSettings() };
});
```

- [ ] **Step 4: Expose only the narrow preload methods**

```js
setFeature: (featureId, enabled) => ipcRenderer.invoke('settings:set-feature', { featureId, enabled }),
setAutoLaunch: (enabled) => ipcRenderer.invoke('settings:set-auto-launch', enabled === true),
chooseMirrorImage: () => ipcRenderer.invoke('mirror:choose-image'),
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/main-services.test.js && node --check main.js && node --check preload.js`

Commit: `feat: expose safe in-panel settings controls`

### Task 2: Permanent Settings tab and navigation behavior

**Files:**
- Modify: `main.js`
- Modify: `renderer/domain.js`
- Modify: `renderer/app.js`
- Modify: `renderer/index.html`
- Test: `tests/domain.test.js`

**Interfaces:**
- Consumes: the existing `settings:get` payload and `settings:changed` event.
- Produces: `visiblePanelTabs(allTabs, features)` where `home` and `settings` are always returned and `settings` remains last.

- [ ] **Step 1: Write the failing tab visibility test**

```js
test('settings stays at the far right when optional tabs are hidden', () => {
  const tabs = ['home', 'todo', 'notes', 'links', 'recordings', 'credentials', 'clip', 'settings'];
  assert.deepEqual(visiblePanelTabs(tabs, { todo: false, clip: true }), [
    'home', 'notes', 'links', 'recordings', 'credentials', 'clip', 'settings',
  ]);
  assert.equal(visiblePanelTabs(tabs, { settings: false }).at(-1), 'settings');
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test --test-name-pattern='settings stays at the far right' tests/domain.test.js`

Expected: FAIL because `visiblePanelTabs` is not exported.

- [ ] **Step 3: Implement navigation behavior and markup**

```js
function visiblePanelTabs(allTabs, features) {
  const state = features && typeof features === 'object' ? features : {};
  return allTabs.filter((name) => name === 'home' || name === 'settings' || state[name] !== false);
}
```

Append `settings` to `ALL_TABS`, add `TAB_SIZES.settings`, render the Settings tab button after Credentials, and add `#tab-settings` as a real tabpanel. `applyFeatureSettings()` must never hide Home or Settings.

```js
const ALL_TABS = ['home', 'todo', 'notes', 'links', 'recordings', 'credentials', 'clip', 'settings'];
function applyFeatureSettings(settings) {
  const features = { home: true, settings: true, ...(settings?.features || {}) };
  TABS = Domain.visiblePanelTabs(ALL_TABS, features);
  document.querySelectorAll('.tab[data-tab]').forEach((button) => {
    button.hidden = !TABS.includes(button.dataset.tab);
  });
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/domain.test.js && node --check renderer/app.js`

Commit: `feat: add permanent settings tab`

### Task 3: Settings dashboard interactions

**Files:**
- Modify: `renderer/app.js`
- Modify: `renderer/workspace.js`
- Modify: `renderer/index.html`
- Test: `tests/domain.test.js`

**Interfaces:**
- Consumes: `getAppSettings`, `setFeature`, `getTranscriptionConfig`, `chooseMirrorImage`, `getMirrorImage`, `getWorkspace`, `openWorkspace`, `chooseWorkspace`, `setAutoLaunch`.
- Produces: a settings dashboard that refreshes on `notch:tabchange`, `settings:changed`, `workspace:changed`, and `mirror:image-changed`.

- [ ] **Step 1: Write the failing settings view-model test**

```js
test('settings summary combines safe API status with local device settings', () => {
  assert.deepEqual(settingsSummary({
    appSettings: { shortcut: 'Space', autoLaunch: true },
    workspace: { path: '/Users/test/Panel', portable: true },
    transcription: { configured: true, llmConfigured: false },
  }), {
    shortcut: 'Space',
    autoLaunch: true,
    workspacePath: '/Users/test/Panel',
    workspaceLabel: '自定义文件夹',
    transcription: { label: '已安全保存', state: 'saved' },
    llm: { label: '未配置', state: 'empty' },
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test --test-name-pattern='settings summary' tests/domain.test.js`

Expected: FAIL because `settingsSummary` is not exported.

- [ ] **Step 3: Implement the view model and shared entry points**

Implement `settingsSummary()` in `renderer/domain.js`. Refactor the shortcut recorder into `openShortcutRecorder()` and listen for `notch:record-shortcut`. Keep `openTranscriptionSettings()` as the single API editor and invoke it from both Recordings and Settings.

```js
function settingsSummary(input = {}) {
  const appSettings = input.appSettings || {};
  const workspace = input.workspace || {};
  const statuses = apiCredentialStatuses(input.transcription || {});
  return {
    shortcut: String(appSettings.shortcut || 'Space'),
    autoLaunch: appSettings.autoLaunch === true,
    workspacePath: String(workspace.path || ''),
    workspaceLabel: workspace.portable ? '自定义文件夹' : '默认文件夹',
    transcription: statuses.transcription,
    llm: statuses.llm,
  };
}

function openShortcutRecorder() {
  shortcutRecorderActive = true;
  shortcutRecorder.hidden = false;
  shortcutRecorderValue.textContent = '等待输入…';
  requestAnimationFrame(() => shortcutRecorder.focus({ preventScroll: true }));
}
document.addEventListener('notch:record-shortcut', openShortcutRecorder);
```

- [ ] **Step 4: Wire the controls**

Feature switches call `setFeature(id, checked)` and revert on failure. Mirror replacement calls `chooseMirrorImage()` and updates both previews through the existing image event. Workspace buttons call the existing open/choose methods. Auto-launch calls `setAutoLaunch(checked)`. Entering the tab runs one `Promise.all` refresh and never reads secret plaintext.

```js
settingsFeatureList?.addEventListener('change', async (event) => {
  const input = event.target.closest('input[data-settings-feature]');
  if (!input) return;
  const result = await window.notchAPI.setFeature(input.dataset.settingsFeature, input.checked);
  if (!result?.ok) input.checked = !input.checked;
});
settingsApiButton?.addEventListener('click', openTranscriptionSettings);
settingsShortcutButton?.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('notch:record-shortcut'));
});
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/domain.test.js && node --check renderer/app.js && node --check renderer/workspace.js`

Commit: `feat: connect settings dashboard actions`

### Task 4: Visual integration, documentation, and complete verification

**Files:**
- Modify: `renderer/styles.css`
- Modify: `README.md`
- Modify: `tests/notch-focus.electron.js`

**Interfaces:**
- Consumes: the completed settings markup and state attributes.
- Produces: a responsive two-column glass-card dashboard within `1240 × 540`.

- [ ] **Step 1: Add a failing renderer acceptance test**

Extend the Electron browser test so it queries the loaded UI rather than grepping source text:

```js
const settingsSurface = await window.webContents.executeJavaScript(`({
  rightmostTab: document.querySelector('.tab[data-tab]:last-of-type')?.dataset.tab,
  panel: Boolean(document.getElementById('tab-settings')),
  api: Boolean(document.getElementById('settings-api-configure')),
  mirror: Boolean(document.getElementById('settings-mirror-choose')),
  features: document.querySelectorAll('[data-settings-feature]').length,
  shortcut: Boolean(document.getElementById('settings-shortcut-change')),
  workspace: Boolean(document.getElementById('settings-workspace-choose')),
  autoLaunch: Boolean(document.getElementById('settings-auto-launch')),
})`);
assert.deepEqual(settingsSurface, {
  rightmostTab: 'settings', panel: true, api: true, mirror: true,
  features: 6, shortcut: true, workspace: true, autoLaunch: true,
});
```

- [ ] **Step 2: Run the renderer test and confirm RED**

Run: `node --test tests/renderer-structure.test.js`

Expected: FAIL until the complete settings surface exists.

- [ ] **Step 3: Apply the visual system and README update**

Use existing CSS variables, 16–20px radii, restrained blue status accents, red only for failures, and `prefers-reduced-motion` compatibility. Keep all controls keyboard reachable and give switches accessible names. Add the Settings feature and tray-fallback behavior to README.

- [ ] **Step 4: Run full verification**

Run: `git diff --check && npm test`

Expected: all Node, Electron focus, and syntax checks pass with zero failures.

- [ ] **Step 5: Launch and visually inspect**

Run: `npm start`

Inspect Settings at the expanded `1240 × 540` size: Settings is the rightmost tab, both columns fit without clipping, feature switches update navigation, API opens the existing secure dialog, mirror selection updates previews, and leaving Home releases the camera.

- [ ] **Step 6: Commit**

Commit: `feat: finish in-panel settings experience`
