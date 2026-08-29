# Home Widget Visibility and Gapless Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to hide and restore any homepage widget while every non-empty widget combination still fills the complete `12 × 4` Bento grid without overlap, deformation, or lost data.

**Architecture:** Keep visibility as a new renderer-local preference, independent from the existing order and preferred-size state. Pure functions in `renderer/domain.js` validate visibility and resolve one of seven finite, gapless templates; `renderer/app.js` owns persistence, DOM layout, transitions, and mirror cleanup; `renderer/workspace.js` owns the Settings controls and recording-state guard. No main-process IPC is added.

**Tech Stack:** Electron 33, native HTML/CSS/JavaScript, Node test runner, LocalStorage.

**Spec:** `docs/plans/2026-08-29-home-widget-visibility-design.md`

## Global Constraints

- Keep the single Electron architecture and `npm start` as the only development path.
- Keep the expanded content area at `1240 × 540` and the homepage grid at `12 × 4`.
- Keep `notch-home-order-v3` and `notch-home-widget-sizes-v2` unchanged; visibility uses only `notch-home-hidden-modules-v1`.
- Keep all seven widget IDs stable: `music`, `pomodoro`, `recorder`, `windows`, `mirror`, `note`, `commands`.
- At least one homepage widget must remain visible.
- Hiding a widget must not erase its data, preferred size, or position in the saved order.
- Never use `transform: scale()` for a widget whose rectangle changes. Position-only animation may use `translate`; size changes use opacity only.
- Never leave the camera running after Mirror is hidden, and never allow Recorder to be hidden while recording, paused, or saving.
- A successful layout must cover each of the 48 logical cells exactly once. Partial layout results must never be applied to the DOM.
- Do not modify clipboard, updater, recording compatibility, or window animation behavior in this feature.
- Do not run `npm run build`, package, sign, or publish as part of this plan.

---

### Task 1: Visibility state as a tested pure domain contract

**Files:**
- Modify: `renderer/domain.js`
- Modify: `tests/domain.test.js`

**Interfaces:**
- Produces: `normalizeHiddenHomeModules(value, moduleIds)` returning a canonical hidden-ID array.
- Produces: `updateHomeModuleVisibility(hiddenIds, moduleIds, moduleId, visible)` returning `{ ok, hiddenIds, error? }`.

- [ ] **Step 1: Import the new functions in the domain test**

Add both exports to the destructuring block at the top of `tests/domain.test.js`:

```js
const {
  // existing imports remain
  normalizeHiddenHomeModules,
  updateHomeModuleVisibility,
} = domain;
```

- [ ] **Step 2: Write failing normalization and last-widget tests**

```js
const HOME_MODULES = ['music', 'pomodoro', 'recorder', 'windows', 'mirror', 'note', 'commands'];

test('hidden homepage modules are deduplicated and normalized to module order', () => {
  assert.deepEqual(
    normalizeHiddenHomeModules(['mirror', 'unknown', 'mirror', 'music'], HOME_MODULES),
    ['music', 'mirror']
  );
  assert.deepEqual(normalizeHiddenHomeModules('mirror', HOME_MODULES), []);
  assert.deepEqual(normalizeHiddenHomeModules([...HOME_MODULES], HOME_MODULES), []);
});

test('homepage visibility refuses to hide the final visible module', () => {
  const sixHidden = HOME_MODULES.slice(0, 6);
  assert.deepEqual(
    updateHomeModuleVisibility(sixHidden, HOME_MODULES, 'commands', false),
    { ok: false, error: 'at_least_one_required', hiddenIds: sixHidden }
  );
  assert.deepEqual(
    updateHomeModuleVisibility(['mirror'], HOME_MODULES, 'mirror', true),
    { ok: true, hiddenIds: [] }
  );
  assert.deepEqual(
    updateHomeModuleVisibility([], HOME_MODULES, 'unknown', false),
    { ok: false, error: 'invalid_module', hiddenIds: [] }
  );
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
node --test --test-name-pattern='hidden homepage modules|homepage visibility' tests/domain.test.js
```

Expected: FAIL because the two functions are not exported.

- [ ] **Step 4: Implement canonical state handling**

Add these pure functions near the existing homepage domain functions in `renderer/domain.js`:

```js
function normalizeHiddenHomeModules(value, moduleIds) {
  const ids = Array.isArray(moduleIds)
    ? [...new Set(moduleIds.map((id) => String(id)))]
    : [];
  if (!ids.length || !Array.isArray(value)) return [];
  const requested = new Set(value.map((id) => String(id)));
  const hiddenIds = ids.filter((id) => requested.has(id));
  return hiddenIds.length === ids.length ? [] : hiddenIds;
}

function updateHomeModuleVisibility(hiddenIds, moduleIds, moduleId, visible) {
  const ids = Array.isArray(moduleIds)
    ? [...new Set(moduleIds.map((id) => String(id)))]
    : [];
  const current = normalizeHiddenHomeModules(hiddenIds, ids);
  const id = String(moduleId || '');
  if (!ids.includes(id) || typeof visible !== 'boolean') {
    return { ok: false, error: 'invalid_module', hiddenIds: current };
  }
  const next = new Set(current);
  if (visible) next.delete(id);
  else next.add(id);
  if (next.size >= ids.length) {
    return { ok: false, error: 'at_least_one_required', hiddenIds: current };
  }
  return { ok: true, hiddenIds: ids.filter((candidate) => next.has(candidate)) };
}
```

Export both functions from the returned domain object.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
node --test --test-name-pattern='hidden homepage modules|homepage visibility' tests/domain.test.js
node --check renderer/domain.js
```

Expected: all focused tests pass.

Commit:

```bash
git add renderer/domain.js tests/domain.test.js
git commit -m "test: define homepage widget visibility state"
```

### Task 2: Exhaustively verified gapless layout resolver

**Files:**
- Modify: `renderer/domain.js`
- Modify: `tests/domain.test.js`

**Interfaces:**
- Produces: `resolveHomeWidgetLayout(order, sizes, hiddenIds, columns = 12, rows = 4)` returning `{ visibleOrder, placements, variants }` or `null`.
- Produces: `layoutVariantForPlacement(placement)` returning `mini`, `compact`, `wide`, `tall`, or `full`.
- Consumes: existing `packHomeWidgetLayout(order, sizes, columns, rows)` for the seven-visible case.

- [ ] **Step 1: Add the new resolver imports**

```js
const {
  // existing imports remain
  resolveHomeWidgetLayout,
  layoutVariantForPlacement,
} = domain;
```

- [ ] **Step 2: Write a reusable exact-cover assertion**

Add the helper below to `tests/domain.test.js`:

```js
function assertExactHomeCover(layout, expectedIds) {
  assert.ok(layout);
  assert.deepEqual(Object.keys(layout.placements).sort(), [...expectedIds].sort());
  const cells = Array(48).fill(0);
  Object.entries(layout.placements).forEach(([id, item]) => {
    assert.ok(Number.isInteger(item.column) && item.column >= 0, `${id} has an invalid column`);
    assert.ok(Number.isInteger(item.row) && item.row >= 0, `${id} has an invalid row`);
    assert.ok(Number.isInteger(item.width) && item.width > 0, `${id} has an invalid width`);
    assert.ok(Number.isInteger(item.height) && item.height > 0, `${id} has an invalid height`);
    assert.ok(item.column + item.width <= 12, `${id} exceeds the grid width`);
    assert.ok(item.row + item.height <= 4, `${id} exceeds the grid height`);
    for (let row = item.row; row < item.row + item.height; row += 1) {
      for (let column = item.column; column < item.column + item.width; column += 1) {
        cells[row * 12 + column] += 1;
      }
    }
  });
  assert.deepEqual(cells, Array(48).fill(1));
}
```

- [ ] **Step 3: Write the 127-combination and five-widget priority tests**

```js
test('every non-empty homepage widget subset exactly covers the bento grid', () => {
  const order = ['music', 'pomodoro', 'windows', 'recorder', 'mirror', 'note', 'commands'];
  const sizes = {
    music: 'medium', pomodoro: 'mini', windows: 'large', recorder: 'small',
    mirror: 'medium', note: 'medium', commands: 'mini',
  };
  for (let visibleMask = 1; visibleMask < 2 ** order.length; visibleMask += 1) {
    const hiddenIds = order.filter((id, index) => (visibleMask & (1 << index)) === 0);
    const expectedIds = order.filter((id) => !hiddenIds.includes(id));
    const before = JSON.stringify({ order, sizes, hiddenIds });
    const layout = resolveHomeWidgetLayout(order, sizes, hiddenIds, 12, 4);
    assertExactHomeCover(layout, expectedIds);
    assert.equal(JSON.stringify({ order, sizes, hiddenIds }), before, 'resolver mutated its inputs');
  }
});

test('five-widget layout chooses the largest preference and breaks ties by saved order', () => {
  const order = ['music', 'pomodoro', 'windows', 'recorder', 'mirror', 'note', 'commands'];
  const sizes = {
    music: 'medium', pomodoro: 'mini', windows: 'large', recorder: 'small',
    mirror: 'large', note: 'medium', commands: 'mini',
  };
  const layout = resolveHomeWidgetLayout(order, sizes, ['pomodoro', 'commands'], 12, 4);
  assert.deepEqual(layout.placements.windows, { column: 0, row: 0, width: 4, height: 4 });
  assert.equal(layout.variants.windows, 'tall');
});

test('layout variants reflect actual rectangles instead of saved preferences', () => {
  assert.equal(layoutVariantForPlacement({ width: 2, height: 1 }), 'mini');
  assert.equal(layoutVariantForPlacement({ width: 2, height: 2 }), 'compact');
  assert.equal(layoutVariantForPlacement({ width: 6, height: 2 }), 'wide');
  assert.equal(layoutVariantForPlacement({ width: 4, height: 4 }), 'tall');
  assert.equal(layoutVariantForPlacement({ width: 12, height: 4 }), 'full');
});
```

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```bash
node --test --test-name-pattern='every non-empty homepage|five-widget layout|layout variants' tests/domain.test.js
```

Expected: FAIL because the resolver and variant function are absent.

- [ ] **Step 5: Implement the seven finite templates**

Use these exact zero-based templates in `renderer/domain.js`:

```js
const HOME_GAPLESS_TEMPLATES = {
  1: [{ column: 0, row: 0, width: 12, height: 4 }],
  2: [
    { column: 0, row: 0, width: 6, height: 4 },
    { column: 6, row: 0, width: 6, height: 4 },
  ],
  3: [
    { column: 0, row: 0, width: 4, height: 4 },
    { column: 4, row: 0, width: 4, height: 4 },
    { column: 8, row: 0, width: 4, height: 4 },
  ],
  4: [
    { column: 0, row: 0, width: 6, height: 2 },
    { column: 6, row: 0, width: 6, height: 2 },
    { column: 0, row: 2, width: 6, height: 2 },
    { column: 6, row: 2, width: 6, height: 2 },
  ],
  5: [
    { column: 0, row: 0, width: 4, height: 4 },
    { column: 4, row: 0, width: 4, height: 2 },
    { column: 8, row: 0, width: 4, height: 2 },
    { column: 4, row: 2, width: 4, height: 2 },
    { column: 8, row: 2, width: 4, height: 2 },
  ],
  6: [
    { column: 0, row: 0, width: 4, height: 2 },
    { column: 4, row: 0, width: 4, height: 2 },
    { column: 8, row: 0, width: 4, height: 2 },
    { column: 0, row: 2, width: 4, height: 2 },
    { column: 4, row: 2, width: 4, height: 2 },
    { column: 8, row: 2, width: 4, height: 2 },
  ],
};
```

Implement variant resolution before the layout resolver so the renderer receives a complete result:

```js
function layoutVariantForPlacement(placement) {
  const width = Number(placement?.width) || 0;
  const height = Number(placement?.height) || 0;
  if (width <= 2 && height <= 1) return 'mini';
  if (width <= 2 && height <= 2) return 'compact';
  if (height <= 2) return 'wide';
  if (width >= 6 && height >= 4) return 'full';
  return 'tall';
}
```

Implement `resolveHomeWidgetLayout()` with these rules:

1. Normalize `order` by keeping unique IDs that exist in `sizes`.
2. Canonicalize `hiddenIds` with `normalizeHiddenHomeModules()`.
3. Return `null` when dimensions differ from `12 × 4` or when there are no valid IDs.
4. For seven visible IDs, call `packHomeWidgetLayout()` with the saved order and sizes.
5. For five visible IDs, sort a copy by preference rank `large: 3`, `medium: 2`, `small: 1`, `mini: 0`; place the winner in template slot zero and the remaining IDs in their original relative order.
6. For every other count, assign visible IDs in saved-order sequence.
7. Return copies of placements and derive every `variants[id]` with `layoutVariantForPlacement()`.

The returned shape must be:

```js
{
  visibleOrder: ['music', 'windows'],
  placements: {
    music: { column: 0, row: 0, width: 6, height: 4 },
    windows: { column: 6, row: 0, width: 6, height: 4 },
  },
  variants: { music: 'full', windows: 'full' },
}
```

Export `resolveHomeWidgetLayout` and `layoutVariantForPlacement`.

- [ ] **Step 6: Verify all homepage domain tests and commit**

Run:

```bash
node --test --test-name-pattern='home|homepage|widget|layout variant' tests/domain.test.js
node --check renderer/domain.js
```

Expected: the existing packing tests and all new exact-cover tests pass.

Commit:

```bash
git add renderer/domain.js tests/domain.test.js
git commit -m "feat: resolve gapless homepage widget layouts"
```

### Task 3: Renderer persistence, complete DOM application, and safe transitions

**Files:**
- Modify: `renderer/app.js`
- Modify: `tests/renderer-structure.test.js`

**Interfaces:**
- Consumes: the four new `NotchDomain` functions.
- Produces: `window.NotchHome.getVisibility()`.
- Produces: `window.NotchHome.setModuleVisible(moduleId, visible)` returning a Promise of `{ ok, hiddenIds, persisted, error? }`.
- Produces: `notch:home-modules-changed` with `{ hiddenIds, visibleIds }`.

- [ ] **Step 1: Write a failing renderer contract test**

Append to `tests/renderer-structure.test.js`:

```js
test('homepage visibility has one renderer-owned storage key and public settings bridge', () => {
  assert.match(appJs, /notch-home-hidden-modules-v1/);
  assert.match(appJs, /window\.NotchHome\s*=/);
  assert.match(appJs, /notch:home-modules-changed/);
  assert.match(appJs, /stopMirror\(\)/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern='homepage visibility has' tests/renderer-structure.test.js
```

Expected: FAIL because the storage key and renderer bridge are absent.

- [ ] **Step 3: Load and save the visibility preference without touching existing keys**

Near `HOME_ORDER_KEY` and `HOME_SIZES_KEY` in `renderer/app.js`, add:

```js
const HOME_HIDDEN_MODULES_KEY = 'notch-home-hidden-modules-v1';

function loadHiddenHomeModules() {
  try {
    return window.NotchDomain.normalizeHiddenHomeModules(
      JSON.parse(localStorage.getItem(HOME_HIDDEN_MODULES_KEY) || 'null'),
      HOME_ORDER_DEFAULTS
    );
  } catch (error) {
    return [];
  }
}

let hiddenHomeModules = loadHiddenHomeModules();

function saveHiddenHomeModules() {
  try {
    localStorage.setItem(HOME_HIDDEN_MODULES_KEY, JSON.stringify(hiddenHomeModules));
    return true;
  } catch (error) {
    return false;
  }
}
```

Do not add the key manually to workspace export/import logic: `collectLocalStorageSnapshot()` already captures LocalStorage generically.

- [ ] **Step 4: Replace direct packing with atomic layout resolution**

Refactor `applyHomeLayout()` to call:

```js
const resolved = window.NotchDomain.resolveHomeWidgetLayout(
  homeOrder,
  homeSizes,
  hiddenHomeModules,
  12,
  4
);
```

Before writing any tile styles, verify that `resolved` exists and that its placement IDs exactly equal its visible IDs. If validation fails, log one error, restore `hiddenHomeModules = []`, resolve once more with the default full set, and only then write the DOM.

For every tile, apply all state in the same synchronous loop:

```js
const placement = resolved.placements[moduleId];
tile.hidden = !placement;
tile.setAttribute('aria-hidden', placement ? 'false' : 'true');
if (!placement) return;
tile.dataset.layoutVariant = resolved.variants[moduleId];
tile.dataset.layoutColumn = String(placement.column);
tile.dataset.layoutRow = String(placement.row);
tile.dataset.layoutWidth = String(placement.width);
tile.dataset.layoutHeight = String(placement.height);
tile.style.gridColumn = `${placement.column + 1} / span ${placement.width}`;
tile.style.gridRow = `${placement.row + 1} / span ${placement.height}`;
```

Keep `data-widget-size` and the size button label derived from `homeSizes`; never overwrite the preference with `data-layout-variant`.

- [ ] **Step 5: Replace scale FLIP with position-only and opacity transitions**

Capture rectangles only for currently visible tiles. After the new layout is applied:

```js
const sizeChanged = Math.abs(first.width - last.width) >= 0.5
  || Math.abs(first.height - last.height) >= 0.5;
if (sizeChanged) {
  tile.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 180,
    easing: 'ease-out',
  });
} else if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
  tile.animate([
    { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.76 },
    { transform: 'translate(0, 0)', opacity: 1 },
  ], {
    duration: 280,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  });
}
```

For a tile being hidden, first run a 90ms opacity animation and wait for its `finished` Promise; after the wait, recheck the Recorder guard before committing hidden state. Skip all animations when `prefers-reduced-motion: reduce` matches. Cancel any previous visibility animation on the same tile before starting another switch operation.

Delete the existing `scaleX`, `scaleY`, and `scale(...)` FLIP path from `applyHomeLayout()`.

- [ ] **Step 6: Add the single renderer-owned visibility API**

Implement `setHomeModuleVisible()` in `renderer/app.js`:

```js
async function setHomeModuleVisible(moduleId, visible) {
  if (moduleId === 'recorder' && visible === false
    && window.NotchWorkspace?.isRecordingActive?.()) {
    return {
      ok: false,
      error: 'recording_active',
      hiddenIds: [...hiddenHomeModules],
      persisted: true,
    };
  }
  const result = window.NotchDomain.updateHomeModuleVisibility(
    hiddenHomeModules,
    HOME_ORDER_DEFAULTS,
    moduleId,
    visible
  );
  if (!result.ok) return { ...result, persisted: true };

  // Run the hide transition here. Recheck recording_active after its await.
  hiddenHomeModules = result.hiddenIds;
  if (moduleId === 'mirror' && visible === false) stopMirror();
  applyHomeLayout(true);
  const persisted = saveHiddenHomeModules();
  const detail = {
    hiddenIds: [...hiddenHomeModules],
    visibleIds: HOME_ORDER_DEFAULTS.filter((id) => !hiddenHomeModules.includes(id)),
  };
  document.dispatchEvent(new CustomEvent('notch:home-modules-changed', { detail }));
  return { ok: true, hiddenIds: [...hiddenHomeModules], persisted };
}

window.NotchHome = Object.freeze({
  getVisibility: () => ({
    hiddenIds: [...hiddenHomeModules],
    visibleIds: HOME_ORDER_DEFAULTS.filter((id) => !hiddenHomeModules.includes(id)),
  }),
  setModuleVisible: setHomeModuleVisible,
});
```

If persistence fails, keep the session layout active and return `persisted: false`; the Settings layer will show the warning. Do not clear any widget data.

- [ ] **Step 7: Make drag and size controls operate on visible tiles only**

Update capture, drop-target cleanup, hit testing, and animation loops to skip `tile.hidden === true`. Keep `homeOrder` as all seven IDs, so swapping two visible widgets changes their relative saved positions without deleting hidden IDs. Continue normalizing preferred sizes against the existing 48-cell seven-widget model so restoring a widget always has a valid complete layout.

- [ ] **Step 8: Verify renderer contracts and commit**

Run:

```bash
node --test tests/renderer-structure.test.js
node --check renderer/app.js
```

Expected: tests and syntax checks pass; searching the homepage layout function finds no scale FLIP.

Run:

```bash
rg -n "scaleX|scaleY|translate\([^;]+\) scale" renderer/app.js
```

Expected: no match in the homepage layout implementation.

Commit:

```bash
git add renderer/app.js tests/renderer-structure.test.js
git commit -m "feat: persist and apply homepage widget visibility"
```

### Task 4: Settings card, recording guard, and user feedback

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/workspace.js`
- Modify: `tests/renderer-structure.test.js`

**Interfaces:**
- Consumes: `window.NotchHome.getVisibility()` and `window.NotchHome.setModuleVisible()`.
- Produces: seven switches using `data-settings-home-module`.
- Extends: `window.NotchWorkspace` with `isRecordingActive()`.

- [ ] **Step 1: Write the failing settings structure test**

Append to `tests/renderer-structure.test.js`:

```js
test('settings exposes exactly one switch for every homepage widget', () => {
  const switches = [...html.matchAll(/data-settings-home-module="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(switches, [
    'music', 'pomodoro', 'recorder', 'windows', 'mirror', 'note', 'commands',
  ]);
  assert.match(workspaceJs, /isRecordingActive/);
  assert.match(workspaceJs, /recording_active/);
  assert.match(workspaceJs, /at_least_one_required/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern='settings exposes exactly one' tests/renderer-structure.test.js
```

Expected: FAIL because the card and recording API are absent.

- [ ] **Step 3: Add a separate Homepage Widgets card**

In `renderer/index.html`, add a sibling card after “显示功能”; do not merge these switches with top-level feature switches:

```html
<section class="tile settings-card settings-home-modules-card">
  <div class="settings-card-heading">
    <div><span class="tile-label">首页</span><strong>首页组件</strong></div>
    <small>至少保留一个</small>
  </div>
  <div class="settings-home-module-grid" id="settings-home-module-list">
    <label><span><b>音乐</b><small>播放状态与控制</small></span><input type="checkbox" data-settings-home-module="music" aria-label="显示音乐" /><i aria-hidden="true"></i></label>
    <label><span><b>番茄钟</b><small>专注计时</small></span><input type="checkbox" data-settings-home-module="pomodoro" aria-label="显示番茄钟" /><i aria-hidden="true"></i></label>
    <label><span><b>快速录音</b><small data-home-module-setting-note="recorder">录音与转写</small></span><input type="checkbox" data-settings-home-module="recorder" aria-label="显示快速录音" /><i aria-hidden="true"></i></label>
    <label><span><b>当前窗口</b><small>窗口快速切换</small></span><input type="checkbox" data-settings-home-module="windows" aria-label="显示当前窗口" /><i aria-hidden="true"></i></label>
    <label><span><b>镜子</b><small>相机与封面</small></span><input type="checkbox" data-settings-home-module="mirror" aria-label="显示镜子" /><i aria-hidden="true"></i></label>
    <label><span><b>随笔记</b><small>首页快速记录</small></span><input type="checkbox" data-settings-home-module="note" aria-label="显示随笔记" /><i aria-hidden="true"></i></label>
    <label><span><b>常用指令</b><small>提示词快捷入口</small></span><input type="checkbox" data-settings-home-module="commands" aria-label="显示常用指令" /><i aria-hidden="true"></i></label>
  </div>
</section>
```

- [ ] **Step 4: Expose the current recording activity without exposing mutable state**

In `renderer/workspace.js`, define:

```js
function isRecordingActive() {
  return ['recording', 'paused', 'saving'].includes(recordingStatus);
}
```

Use it inside `updateRecordingUi()` and add it to the existing bridge:

```js
window.NotchWorkspace = {
  refreshWindows,
  startRecording,
  isRecordingActive,
};
```

- [ ] **Step 5: Render switch state from the renderer-owned source**

Add `settingsHomeModuleList` and this synchronizer in `renderer/workspace.js`:

```js
function renderHomeModuleSettings() {
  const state = window.NotchHome?.getVisibility?.();
  const hidden = new Set(state?.hiddenIds || []);
  const recordingActive = isRecordingActive();
  settingsHomeModuleList?.querySelectorAll('input[data-settings-home-module]').forEach((input) => {
    const moduleId = input.dataset.settingsHomeModule;
    input.checked = !hidden.has(moduleId);
    input.disabled = moduleId === 'recorder' && recordingActive;
  });
  const recorderNote = settingsHomeModuleList?.querySelector('[data-home-module-setting-note="recorder"]');
  if (recorderNote) recorderNote.textContent = recordingActive ? '录音进行中' : '录音与转写';
}
```

Call it from `renderSettingsPanel()`, from `updateRecordingUi()`, and from a `notch:home-modules-changed` listener.

At the end of `updateRecordingUi()`, publish the same read-only state notification used by renderer acceptance, and bind it once during Settings initialization:

```js
document.dispatchEvent(new CustomEvent('notch:recording-state-changed', {
  detail: { active: recordingActive },
}));

document.addEventListener('notch:recording-state-changed', renderHomeModuleSettings);
document.addEventListener('notch:home-modules-changed', renderHomeModuleSettings);
```

Use the existing `active` local in `updateRecordingUi()` as `recordingActive`, or rename it consistently before dispatching. The event carries no audio data and does not mutate recording state.

- [ ] **Step 6: Wire guarded asynchronous switch changes**

```js
settingsHomeModuleList?.addEventListener('change', async (event) => {
  const input = event.target.closest('input[data-settings-home-module]');
  if (!input || !window.NotchHome?.setModuleVisible) return;
  input.disabled = true;
  const result = await window.NotchHome.setModuleVisible(
    input.dataset.settingsHomeModule,
    input.checked
  );
  renderHomeModuleSettings();
  if (!result?.ok) {
    const message = result?.error === 'at_least_one_required'
      ? '首页至少保留一个组件'
      : result?.error === 'recording_active'
        ? '录音进行中，暂时不能隐藏快速录音'
        : '首页组件设置未更新';
    if (typeof showStatusToast === 'function') showStatusToast(message);
    return;
  }
  const message = result.persisted === false
    ? '布局已更新，但设置未能保存'
    : input.checked ? '首页组件已恢复' : '首页组件已隐藏';
  if (typeof showStatusToast === 'function') showStatusToast(message);
});
```

Reuse the existing global `showStatusToast()` helper; do not create a second toast DOM node or a second status event protocol.

- [ ] **Step 7: Verify settings contracts and commit**

Run:

```bash
node --test tests/renderer-structure.test.js
node --check renderer/workspace.js
```

Expected: exactly seven homepage switches are found and both renderer scripts pass syntax checks.

Commit:

```bash
git add renderer/index.html renderer/workspace.js tests/renderer-structure.test.js
git commit -m "feat: add homepage widget visibility settings"
```

### Task 5: Responsive widget internals and a scroll-safe Settings layout

**Files:**
- Modify: `renderer/styles.css`
- Test: `tests/notch-focus.electron.js`

**Interfaces:**
- Consumes: `data-layout-variant` on every visible homepage widget.
- Produces: stable `mini`, `compact`, `wide`, `tall`, and `full` internal layouts without content scaling.

- [ ] **Step 1: Add shared containment and explicit hidden behavior**

Add an authoritative block after the existing homepage widget-size rules so it wins the cascade without rewriting unrelated styles:

```css
.home-bento > [data-home-module] {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.home-bento > [data-home-module][hidden] { display: none !important; }
.home-bento > [data-home-module] button,
.home-bento > [data-home-module] input,
.home-bento > [data-home-module] textarea { flex-shrink: 0; }
```

- [ ] **Step 2: Define geometry by actual layout variant**

Add final selectors for the five actual variants. These override geometry only; color, typography, and component identity remain unchanged.

```css
.home-bento > [data-layout-variant='wide'] { align-content: stretch; }
.home-bento > [data-layout-variant='tall'],
.home-bento > [data-layout-variant='full'] { align-content: stretch; }

.home-recorder[data-layout-variant] .recorder-controls { transform: none; }
.home-recorder[data-layout-variant='wide'] { grid-template-columns: minmax(0, 1fr) auto; }
.home-recorder[data-layout-variant='wide'] .home-transcript { min-height: 0; overflow: hidden; }

.home-mirror[data-layout-variant] .mirror-video,
.home-mirror[data-layout-variant] .mirror-photo { width: 100%; height: 100%; object-fit: cover; }

.home-note[data-layout-variant='wide'],
.home-note[data-layout-variant='tall'],
.home-note[data-layout-variant='full'] { display: flex; flex-direction: column; }
.home-note[data-layout-variant] .note-body { min-width: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; }
.home-note[data-layout-variant] .note-input { width: 100%; height: 100%; min-height: 0; overflow: auto; }

.home-windows[data-layout-variant] .window-list,
.home-commands[data-layout-variant] .command-list { min-width: 0; min-height: 0; overflow: auto; }
```

Before adding the final block, run `rg -n "data-widget-size" renderer/styles.css` and classify every match as either saved-preference decoration or actual geometry. Keep preference-based background artwork selectors. Move every selector that controls padding, display, position, font/control dimensions, or content capacity to `data-layout-variant`, so a saved `mini` preference cannot hide content when the actual rectangle is `wide`, `tall`, or `full`. Use only child classes present in `renderer/index.html`: `.music-copy`, `.music-controls`, `.pomodoro-readout`, `.pomodoro-toggle`, `.pomodoro-reset`, `.recorder-head`, `.home-transcript`, `.recorder-controls`, `.window-list`, `.mirror-stage`, `.mirror-photo`, `.mirror-video`, `.note-toolbar`, `.note-body`, `.note-input`, `.command-add`, and `.command-list`.

The required behavior per variant is fixed:

- `mini`: keep the primary status/action; hide secondary preview text.
- `compact`: preserve fixed control sizes and use one compact content column.
- `wide`: use horizontal distribution; the content/list receives remaining width and may scroll.
- `tall`: use a complete vertical layout; text/list regions receive remaining height and may scroll.
- `full`: increase visible content capacity, not control or font scale.

- [ ] **Step 3: Remove inherited transform scaling from actual-size overrides**

Search all homepage module rules:

```bash
rg -n "home-(music|pomodoro|recorder|windows|mirror|note|commands).*transform|scale\(" renderer/styles.css
```

For any transform used to compensate for `data-widget-size`, add an explicit `transform: none` in the corresponding `data-layout-variant` rule and reproduce the intended layout with grid/flex sizing. Preserve hover translations and icon micro-interactions that do not resize whole content groups.

- [ ] **Step 4: Make the third Settings card fit without clipping other cards**

Change only the primary Settings column into an internally scrolling stack:

```css
.settings-column-primary {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-right: 3px;
}
.settings-column-primary > .settings-card { flex: 0 0 auto; }
.settings-home-modules-card { display: flex; flex-direction: column; }
.settings-home-module-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
```

Share the existing switch visuals by extending `.settings-feature-grid` selectors to `.settings-home-module-grid`. Add disabled-row styling and keep the label readable when Recorder is locked. The right Settings column must keep its existing geometry.

- [ ] **Step 5: Add a reduced-motion assertion to the Electron test**

In `tests/notch-focus.electron.js`, emulate reduced motion through Chromium before changing visibility:

```js
await window.webContents.debugger.attach('1.3');
await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
```

After a representative switch change, query all visible homepage tiles and assert `getAnimations().length === 0`. Detach the debugger in `finally` if it is attached.

- [ ] **Step 6: Verify CSS syntax indirectly through the renderer and commit**

Run:

```bash
env -u ELECTRON_RUN_AS_NODE electron tests/notch-focus.electron.js
node --check renderer/app.js
node --check renderer/workspace.js
```

Expected: the renderer loads, Settings remains usable, and reduced motion creates no layout animation.

Commit:

```bash
git add renderer/styles.css tests/notch-focus.electron.js
git commit -m "style: make homepage widgets responsive to actual layout"
```

### Task 6: Real-renderer geometry and resource acceptance

**Files:**
- Modify: `tests/notch-focus.electron.js`

**Interfaces:**
- Consumes: `data-layout-column`, `data-layout-row`, `data-layout-width`, `data-layout-height`, and `data-layout-variant`.
- Produces: renderer-level checks for all visible counts plus recording and Mirror safety.

- [ ] **Step 1: Add a browser-side geometry measurement helper**

Inside the `executeJavaScript()` payload, use this helper:

```js
function measureHomepage() {
  const surface = document.getElementById('home-bento').getBoundingClientRect();
  const tiles = [...document.querySelectorAll('#home-bento [data-home-module]')]
    .filter((tile) => !tile.hidden)
    .map((tile) => {
      const rect = tile.getBoundingClientRect();
      const controlsInside = [...tile.querySelectorAll('button:not([hidden]), input:not([hidden]), textarea:not([hidden]), video:not([hidden]), img:not([hidden])')]
        .every((control) => {
          const child = control.getBoundingClientRect();
          return child.width === 0 || child.height === 0 || (
            child.left >= rect.left - 1 && child.right <= rect.right + 1
            && child.top >= rect.top - 1 && child.bottom <= rect.bottom + 1
          );
        });
      return {
        id: tile.dataset.homeModule,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        controlsInside,
        variant: tile.dataset.layoutVariant,
      };
    });
  return {
    surface: { left: surface.left, top: surface.top, right: surface.right, bottom: surface.bottom },
    tiles,
  };
}
```

- [ ] **Step 2: Exercise representative combinations for counts one through seven**

Navigate to Settings, restore all seven switches, then for each `visibleCount` from 7 down to 1 hide the next enabled module through its real checkbox `change` event. Wait two animation frames plus 320ms before measuring.

For every count, assert in Node:

```js
assert.equal(measurement.tiles.length, visibleCount);
assert.ok(measurement.tiles.every((tile) => tile.controlsInside));
measurement.tiles.forEach((tile) => {
  assert.ok(tile.rect.left >= measurement.surface.left - 1);
  assert.ok(tile.rect.right <= measurement.surface.right + 1);
  assert.ok(tile.rect.top >= measurement.surface.top - 1);
  assert.ok(tile.rect.bottom <= measurement.surface.bottom + 1);
  assert.ok(['mini', 'compact', 'wide', 'tall', 'full'].includes(tile.variant));
});
for (let left = 0; left < measurement.tiles.length; left += 1) {
  for (let right = left + 1; right < measurement.tiles.length; right += 1) {
    const a = measurement.tiles[left].rect;
    const b = measurement.tiles[right].rect;
    const overlaps = a.left < b.right - 1 && a.right > b.left + 1
      && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    assert.equal(overlaps, false);
  }
}
```

Also calculate the logical area from the four layout datasets and assert it totals exactly `48` at every count.

- [ ] **Step 3: Verify the final-widget rejection in the real UI**

With one switch left on, trigger its change to unchecked. Assert that:

- the checkbox returns to checked;
- one tile remains visible;
- `localStorage['notch-home-hidden-modules-v1']` still contains only six IDs;
- the status message contains “至少保留一个”.

- [ ] **Step 4: Verify Recorder locking**

Temporarily wrap `window.NotchWorkspace` inside the Electron test through `executeJavaScript()`:

```js
window.NotchWorkspace = {
  ...window.NotchWorkspace,
  isRecordingActive: () => true,
};
document.dispatchEvent(new CustomEvent('notch:recording-state-changed'));
```

Assert the Recorder switch is disabled and that a direct `NotchHome.setModuleVisible('recorder', false)` call returns `error: 'recording_active'`. Restore the original object immediately after the assertion. Do not activate a real microphone in automated tests.

- [ ] **Step 5: Verify Mirror cleanup manually with a real camera**

Automated CI must not request camera permission. During local acceptance:

1. Open Home and click Mirror to start the camera.
2. Open Settings and turn Mirror off.
3. In DevTools, confirm `document.querySelector('.mirror-video').srcObject === null`.
4. Confirm the macOS camera indicator turns off immediately.
5. Turn Mirror back on and confirm it returns as an inactive cover rather than auto-starting the camera.

Record the result in the implementation handoff; a failing camera release blocks completion.

- [ ] **Step 6: Run the Electron acceptance and commit**

Run:

```bash
env -u ELECTRON_RUN_AS_NODE electron tests/notch-focus.electron.js
```

Expected: all seven counts, no-overlap checks, last-widget rejection, reduced motion, and Recorder guard pass.

Commit:

```bash
git add tests/notch-focus.electron.js
git commit -m "test: verify homepage widget geometry and guards"
```

### Task 7: Product documentation and full verification

**Files:**
- Modify: `README.md`
- Verify: `renderer/domain.js`
- Verify: `renderer/app.js`
- Verify: `renderer/workspace.js`
- Verify: `renderer/index.html`
- Verify: `renderer/styles.css`
- Verify: `tests/domain.test.js`
- Verify: `tests/renderer-structure.test.js`
- Verify: `tests/notch-focus.electron.js`

**Interfaces:**
- Documents: the Settings path, last-widget rule, local-only persistence, resource guards, and independent order/size preferences.

- [ ] **Step 1: Update README as the product source of truth**

Document these exact behaviors in the homepage/settings sections:

- Settings → Homepage Widgets can hide or restore any of the seven homepage widgets.
- At least one widget must remain visible.
- Remaining widgets automatically refill the full homepage without blank cells.
- Hiding does not delete widget data or overwrite saved order/size preferences.
- Hiding Mirror releases its camera; Recorder cannot be hidden while a recording is active.
- The preference is local to the current workspace and uses `notch-home-hidden-modules-v1`.

- [ ] **Step 2: Run focused tests first**

Run:

```bash
node --test tests/domain.test.js
node --test tests/renderer-structure.test.js
env -u ELECTRON_RUN_AS_NODE electron tests/notch-focus.electron.js
```

Expected: all focused tests pass.

- [ ] **Step 3: Run the complete desktop test suite**

Run:

```bash
npm test
```

Expected: all Node tests, Electron acceptance checks, and JavaScript syntax checks pass.

- [ ] **Step 4: Perform the visual acceptance matrix**

Using `npm start`, inspect visible counts 1 through 7, including two different five-widget combinations. At each count verify:

- no outer blank region, overlap, or grid overflow;
- no stretched text, image, video, icon, or button;
- music and Pomodoro controls retain their proportions;
- Recorder controls remain fully clickable and its transcript preview yields space first;
- Current Windows and Commands scroll internally when content exceeds capacity;
- Note toolbar remains visible while only the editor scrolls;
- Mirror uses proportional `object-fit: cover` cropping;
- long-press reordering still works between visible widgets;
- restoring hidden widgets preserves their prior size preference;
- reduced-motion mode changes layout immediately without animation.

- [ ] **Step 5: Inspect only intended file changes**

Run:

```bash
git status --short
git diff --check
git diff -- renderer/domain.js renderer/app.js renderer/workspace.js renderer/index.html renderer/styles.css tests/domain.test.js tests/renderer-structure.test.js tests/notch-focus.electron.js README.md
```

Expected: no whitespace errors and no unrelated product changes. Preserve any pre-existing untracked or modified files outside this feature.

- [ ] **Step 6: Commit documentation and final verified state**

```bash
git add README.md
git commit -m "docs: document homepage widget visibility"
```

Do not package or publish. Report the full test result, manual camera result, and any residual visual caveat before requesting separate release approval.
