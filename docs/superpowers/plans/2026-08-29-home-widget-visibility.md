# Home Widget Visibility and Gapless Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to hide and restore any homepage widget while every non-empty widget combination still fills the complete `12 × 4` Bento grid without overlap, deformation, or lost data.

**Architecture:** Keep visibility as a new renderer-local preference, independent from the existing order and preferred-size state. Pure functions in `renderer/domain.js` validate visibility, resolve one of seven finite templates, and prove exact grid coverage before any DOM write. `renderer/app.js` commits visibility as a synchronous transaction and owns persistence, atomic DOM layout, animation cancellation, and Mirror cleanup. `renderer/workspace.js` owns Settings, recording-state guards, and background-service lifecycle. No main-process IPC is added.

**Tech Stack:** Electron 33, native HTML/CSS/JavaScript, Node test runner, LocalStorage.

**Spec:** `docs/plans/2026-08-29-home-widget-visibility-design.md`

## Global Constraints

- Keep the single Electron architecture and `npm start` as the only development path.
- Keep the expanded content area at `1240 × 540` and the homepage grid at `12 × 4`.
- Keep `notch-home-order-v3` and `notch-home-widget-sizes-v2` unchanged; visibility uses only `notch-home-hidden-modules-v1`.
- Keep all seven widget IDs stable: `music`, `pomodoro`, `recorder`, `windows`, `mirror`, `note`, `commands`.
- At least one homepage widget must remain visible.
- Hiding a widget must not erase its data, preferred size, or position in the saved order.
- Never use `transform: scale()` for a widget whose rectangle changes. Visibility changes update geometry immediately and only fade in the final layout; they never translate old cards through one another.
- Never leave the camera running after Mirror is hidden, and never allow Recorder to be hidden while recording, paused, or saving.
- A successful layout must cover each of the 48 logical cells exactly once. Partial layout results must never be applied to the DOM.
- When any widget is hidden, the homepage is in automatic-fill mode and all widget-size controls are hidden and unfocusable. Only the seven-visible state allows preferred-size changes.
- Visibility validation, candidate layout validation, resource release, in-memory commit, and DOM commit happen before the first asynchronous yield.
- Hiding Music stops its WebGL RAF; hiding Current Windows stops periodic scans; hiding Pomodoro does not stop its timer or completion notification.
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

Add `normalizeHiddenHomeModules` and `updateHomeModuleVisibility` to the existing `domain` destructuring block at the top of `tests/domain.test.js`; keep the current imports unchanged.

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
- Produces: `validateHomeWidgetLayout(layout, visibleIds, columns = 12, rows = 4)` returning a Boolean exact-cover verdict.
- Produces: `layoutVariantForPlacement(placement)` returning `mini`, `compact`, `wide`, `tall`, or `full`.
- Consumes: existing `packHomeWidgetLayout(order, sizes, columns, rows)` for the seven-visible case.

- [ ] **Step 1: Add the new resolver imports**

Add `resolveHomeWidgetLayout`, `validateHomeWidgetLayout`, and `layoutVariantForPlacement` to the existing `domain` destructuring block in `tests/domain.test.js`.

- [ ] **Step 2: Write a reusable exact-cover assertion**

Add the helper below to `tests/domain.test.js`:

```js
function assertExactHomeCover(layout, expectedIds) {
  assert.ok(layout);
  assert.equal(validateHomeWidgetLayout(layout, expectedIds, 12, 4), true);
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

test('home layout validation rejects every incomplete or unsafe shape', () => {
  const valid = resolveHomeWidgetLayout(
    ['music', 'windows'],
    { music: 'large', windows: 'large' },
    [],
    12,
    4
  );
  assert.equal(validateHomeWidgetLayout(valid, ['music', 'windows'], 12, 4), true);
  assert.equal(validateHomeWidgetLayout(null, ['music'], 12, 4), false);
  assert.equal(validateHomeWidgetLayout({ placements: {} }, ['music'], 12, 4), false);
  assert.equal(validateHomeWidgetLayout({
    placements: { music: { column: 0, row: 0, width: 12, height: 3 } },
  }, ['music'], 12, 4), false);
  assert.equal(validateHomeWidgetLayout({
    placements: { music: { column: 0, row: 0, width: 12.5, height: 4 } },
  }, ['music'], 12, 4), false);
  assert.equal(validateHomeWidgetLayout({
    placements: {
      music: { column: 0, row: 0, width: 8, height: 4 },
      windows: { column: 6, row: 0, width: 6, height: 4 },
    },
  }, ['music', 'windows'], 12, 4), false);
});
```

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```bash
node --test --test-name-pattern='every non-empty homepage|five-widget layout|layout variants|home layout validation' tests/domain.test.js
```

Expected: FAIL because the resolver, exact-cover validator, and variant function are absent.

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

Add `validateHomeWidgetLayout()` as a separate pure guard. It must reject a result unless:

1. `placements` is an object whose unique keys exactly equal the unique `visibleIds` set.
2. `column`, `row`, `width`, and `height` are integers; widths and heights are positive.
3. Every rectangle is inside `columns × rows`.
4. Marking every occupied logical cell never increments a cell above one.
5. Every one of the `columns * rows` cells ends at exactly one.

```js
function validateHomeWidgetLayout(layout, visibleIds, columns = 12, rows = 4) {
  if (!layout || !layout.placements || columns < 1 || rows < 1) return false;
  const expected = [...new Set(Array.isArray(visibleIds) ? visibleIds.map(String) : [])].sort();
  const entries = Object.entries(layout.placements);
  if (!expected.length || entries.length !== expected.length) return false;
  if (JSON.stringify(entries.map(([id]) => id).sort()) !== JSON.stringify(expected)) return false;
  const cells = Array(columns * rows).fill(0);
  for (const [, item] of entries) {
    const values = [item?.column, item?.row, item?.width, item?.height];
    if (!values.every(Number.isInteger) || item.width < 1 || item.height < 1) return false;
    if (item.column < 0 || item.row < 0
      || item.column + item.width > columns || item.row + item.height > rows) return false;
    for (let row = item.row; row < item.row + item.height; row += 1) {
      for (let column = item.column; column < item.column + item.width; column += 1) {
        const index = row * columns + column;
        cells[index] += 1;
        if (cells[index] > 1) return false;
      }
    }
  }
  return cells.every((count) => count === 1);
}
```

Export `resolveHomeWidgetLayout`, `validateHomeWidgetLayout`, and `layoutVariantForPlacement`.

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

### Task 3: Atomic renderer state, persistence, and lifecycle events

**Files:**
- Modify: `renderer/app.js`
- Modify: `tests/renderer-structure.test.js`

**Interfaces:**
- Consumes: all homepage visibility, resolver, validator, and variant functions from `NotchDomain`.
- Produces: `window.NotchHome.getVisibility()` and `window.NotchHome.isVisible(moduleId)`.
- Produces: `window.NotchHome.setModuleVisible(moduleId, visible)` returning `{ ok, changed, hiddenIds, persisted, error? }` without yielding before state commit.
- Produces: `notch:home-modules-changed` with copied `{ hiddenIds, visibleIds, automaticLayout }` arrays/state.
- Produces: `notch:home-layout-error` when initialization must enter the read-only safe fallback.

- [ ] **Step 1: Write a failing renderer contract test**

Append to `tests/renderer-structure.test.js`:

```js
test('homepage visibility has one storage key, exact validation, and lifecycle events', () => {
  assert.match(appJs, /notch-home-hidden-modules-v1/);
  assert.match(appJs, /validateHomeWidgetLayout/);
  assert.match(appJs, /window\.NotchHome\s*=/);
  assert.match(appJs, /notch:home-modules-changed/);
  assert.match(appJs, /notch:home-layout-error/);
  assert.match(appJs, /stopMirror\(\)/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern='homepage visibility has' tests/renderer-structure.test.js
```

Expected: FAIL because the storage key, validator call, bridge, and lifecycle events are absent.

- [ ] **Step 3: Load and save the visibility preference without touching existing keys**

Near `HOME_ORDER_KEY` and `HOME_SIZES_KEY` in `renderer/app.js`, add:

```js
const HOME_HIDDEN_MODULES_KEY = 'notch-home-hidden-modules-v1';
const HOME_MODULE_REGISTRY = ['music', 'pomodoro', 'recorder', 'windows', 'mirror', 'note', 'commands'];

function loadHiddenHomeModules() {
  let rawText = null;
  try {
    rawText = localStorage.getItem(HOME_HIDDEN_MODULES_KEY);
    if (rawText === null) return { hiddenIds: [], needsRepair: false };
    const parsed = JSON.parse(rawText);
    const hiddenIds = window.NotchDomain.normalizeHiddenHomeModules(parsed, HOME_MODULE_REGISTRY);
    return {
      hiddenIds,
      needsRepair: JSON.stringify(parsed) !== JSON.stringify(hiddenIds),
    };
  } catch (error) {
    return { hiddenIds: [], needsRepair: true };
  }
}

const loadedHomeVisibility = loadHiddenHomeModules();
let hiddenHomeModules = loadedHomeVisibility.hiddenIds;
let homeVisibilityPersisted = true;
let homeLayoutReadOnly = false;

function saveHiddenHomeModules() {
  try {
    localStorage.setItem(HOME_HIDDEN_MODULES_KEY, JSON.stringify(hiddenHomeModules));
    homeVisibilityPersisted = true;
    return true;
  } catch (error) {
    homeVisibilityPersisted = false;
    return false;
  }
}

if (loadedHomeVisibility.needsRepair) saveHiddenHomeModules();
```

Use the fixed registry only for validation and stable serialization. Continue using `homeOrder` for visual placement and five-widget tie-breaking. Do not add the key manually to workspace export/import logic: `collectLocalStorageSnapshot()` already captures LocalStorage generically.

- [ ] **Step 4: Split candidate resolution from DOM application**

Add a resolver wrapper that never writes DOM:

```js
function resolveValidatedHomeLayout(hiddenIds, order = homeOrder, sizes = homeSizes) {
  const visibleIds = HOME_MODULE_REGISTRY.filter((id) => !hiddenIds.includes(id));
  const layout = window.NotchDomain.resolveHomeWidgetLayout(order, sizes, hiddenIds, 12, 4);
  return window.NotchDomain.validateHomeWidgetLayout(layout, visibleIds, 12, 4)
    ? layout
    : null;
}
```

Before the first resolution, assert that the unique `data-home-module` IDs in `homeTiles` exactly equal `HOME_MODULE_REGISTRY`. A missing or duplicate tile makes exact visual coverage impossible, so fail fast instead of entering a misleading safe fallback. Add the same exact-ID assertion to `tests/renderer-structure.test.js`.

Change `applyHomeLayout()` to accept a prevalidated layout. It must not mutate `hiddenHomeModules` and must never attempt a partial fallback inside the tile loop. For every tile, synchronously apply:

```js
const placement = layout.placements[moduleId];
tile.hidden = !placement;
tile.setAttribute('aria-hidden', String(!placement));
if (placement) {
  tile.dataset.layoutVariant = layout.variants[moduleId];
  tile.dataset.layoutColumn = String(placement.column);
  tile.dataset.layoutRow = String(placement.row);
  tile.dataset.layoutWidth = String(placement.width);
  tile.dataset.layoutHeight = String(placement.height);
  tile.style.gridColumn = `${placement.column + 1} / span ${placement.width}`;
  tile.style.gridRow = `${placement.row + 1} / span ${placement.height}`;
} else {
  delete tile.dataset.layoutVariant;
  delete tile.dataset.layoutColumn;
  delete tile.dataset.layoutRow;
  delete tile.dataset.layoutWidth;
  delete tile.dataset.layoutHeight;
  tile.style.removeProperty('grid-column');
  tile.style.removeProperty('grid-row');
}
```

Set `homeBento.dataset.layoutMode` to `automatic` when any module is hidden, `preferred` when all seven are visible, and `safe` during the read-only initialization fallback. Keep `data-widget-size` derived only from `homeSizes`; never write actual template geometry into the saved preference.

- [ ] **Step 5: Add a non-destructive initialization fallback**

On first render, resolve the stored state. If it is invalid, resolve `HOME_ORDER_DEFAULTS`, `HOME_SIZE_DEFAULTS`, and `[]`, set `homeLayoutReadOnly = true`, and render that safe result. Do not modify `hiddenHomeModules`, LocalStorage, order, or size preferences. Dispatch `notch:home-layout-error` and disable homepage visibility switches for this session.

```js
let initialHomeLayout = resolveValidatedHomeLayout(hiddenHomeModules);
if (!initialHomeLayout) {
  initialHomeLayout = resolveValidatedHomeLayout([], HOME_ORDER_DEFAULTS, HOME_SIZE_DEFAULTS);
  homeLayoutReadOnly = true;
  console.error('Homepage layout validation failed; using read-only defaults.');
}
applyHomeLayout(initialHomeLayout, { reason: 'initial' });
```

If even the default layout is invalid, throw before touching tile geometry so the defect is visible in tests rather than rendering a corrupt partial grid.

- [ ] **Step 6: Commit visibility synchronously and atomically**

Implement `setHomeModuleVisible()` without `await`, timers, or animation completion before commit:

```js
function setHomeModuleVisible(moduleId, visible) {
  const current = [...hiddenHomeModules];
  if (homeLayoutReadOnly) {
    return { ok: false, changed: false, error: 'layout_read_only', hiddenIds: current, persisted: homeVisibilityPersisted };
  }
  const next = window.NotchDomain.updateHomeModuleVisibility(
    current,
    HOME_MODULE_REGISTRY,
    moduleId,
    visible
  );
  if (!next.ok) return { ...next, changed: false, persisted: homeVisibilityPersisted };
  const changed = JSON.stringify(next.hiddenIds) !== JSON.stringify(current);
  if (!changed) {
    return { ok: true, changed: false, hiddenIds: current, persisted: homeVisibilityPersisted };
  }
  if (moduleId === 'recorder' && visible === false
    && window.NotchWorkspace?.isRecordingActive?.()) {
    return { ok: false, changed: false, error: 'recording_active', hiddenIds: current, persisted: homeVisibilityPersisted };
  }

  const layout = resolveValidatedHomeLayout(next.hiddenIds);
  if (!layout) {
    return { ok: false, changed: false, error: 'layout_invalid', hiddenIds: current, persisted: homeVisibilityPersisted };
  }

  const currentLayout = resolveValidatedHomeLayout(current);
  if (!currentLayout) {
    return { ok: false, changed: false, error: 'layout_invalid', hiddenIds: current, persisted: homeVisibilityPersisted };
  }
  if (moduleId === 'mirror' && visible === false) stopMirror();
  try {
    hiddenHomeModules = next.hiddenIds;
    applyHomeLayout(layout, { reason: 'visibility' });
  } catch (error) {
    hiddenHomeModules = current;
    applyHomeLayout(currentLayout, { reason: 'rollback' });
    return { ok: false, changed: false, error: 'dom_apply_failed', hiddenIds: current, persisted: homeVisibilityPersisted };
  }
  const persisted = saveHiddenHomeModules();
  const detail = visibilitySnapshot();
  document.dispatchEvent(new CustomEvent('notch:home-modules-changed', { detail }));
  return { ok: true, changed: true, hiddenIds: [...hiddenHomeModules], persisted };
}
```

All mutation occurs before the function returns. A later rapid call therefore reads the new state. An already-satisfied absolute request returns `changed: false` before recording guards, layout work, resource cleanup, persistence, animation, or event dispatch. Candidate failure returns before Mirror cleanup, memory mutation, DOM mutation, persistence, or event dispatch. An unexpected DOM exception restores the previously validated layout and state; a stopped Mirror remains on its static cover instead of silently reacquiring the camera. LocalStorage failure is the sole degraded success: session state remains active and `persisted: false` is returned.

- [ ] **Step 7: Expose copied read-only state and dispatch initial lifecycle state**

```js
function visibilitySnapshot() {
  const effectiveHiddenIds = homeLayoutReadOnly ? [] : hiddenHomeModules;
  return {
    hiddenIds: [...effectiveHiddenIds],
    visibleIds: HOME_MODULE_REGISTRY.filter((id) => !effectiveHiddenIds.includes(id)),
    storedHiddenIds: [...hiddenHomeModules],
    automaticLayout: !homeLayoutReadOnly && hiddenHomeModules.length > 0,
    readOnly: homeLayoutReadOnly,
    persisted: homeVisibilityPersisted,
  };
}

window.NotchHome = Object.freeze({
  getVisibility: visibilitySnapshot,
  isVisible: (moduleId) => visibilitySnapshot().visibleIds.includes(String(moduleId || '')),
  setModuleVisible: setHomeModuleVisible,
});

document.dispatchEvent(new CustomEvent('notch:home-modules-changed', {
  detail: visibilitySnapshot(),
}));
if (homeLayoutReadOnly) {
  document.dispatchEvent(new CustomEvent('notch:home-layout-error'));
}
```

The initial event is required because `effects.js` loads before `app.js` and must be able to stop a WebGL loop started before stored visibility was applied.
In read-only safe mode, `hiddenIds` and `visibleIds` describe the effective all-visible DOM, while `storedHiddenIds` preserves the untouched preference for diagnostics. Settings and lifecycle consumers use only effective IDs, so their state cannot contradict the rendered fallback.

- [ ] **Step 8: Use a cancelable final-layout fade, never a pre-commit animation**

For `reason: 'visibility'`, cancel the prior homepage visibility Animation and fade only the already committed final grid:

```js
let homeVisibilityAnimation = null;
function animateCommittedHomeVisibility() {
  homeVisibilityAnimation?.cancel();
  homeVisibilityAnimation = null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  homeVisibilityAnimation = homeBento.animate(
    [{ opacity: 0.72 }, { opacity: 1 }],
    { duration: 140, easing: 'ease-out' }
  );
  homeVisibilityAnimation.finished
    .catch(() => {})
    .finally(() => { homeVisibilityAnimation = null; });
}
```

Do not animate hidden outgoing tiles, do not wait for `finished`, and do not use translate or scale for visibility changes. For existing reorder/size animation, remove `scaleX`, `scaleY`, and layout `scale(...)`; a size change uses opacity only and a pure same-size reorder may use translate.

- [ ] **Step 9: Keep ordering available but disable preferred-size editing in automatic mode**

Update drag capture, drop-target cleanup, hit testing, and animation loops to skip `tile.hidden === true`. Keep all seven IDs in `homeOrder`, so visible swaps preserve hidden entries.

When `hiddenHomeModules.length > 0`, every `[data-widget-size-cycle]` is `hidden`, `disabled`, and `tabIndex = -1`. The click handler must also return before modifying `homeSizes` when automatic mode is active. When all seven return, restore the controls and the exact prior size preferences. This is required to prevent existing 48-cell normalization from modifying a hidden sibling.

- [ ] **Step 10: Verify renderer contracts and commit**

Run:

```bash
node --test tests/renderer-structure.test.js
node --check renderer/app.js
rg -n "scaleX|scaleY|translate\([^;]+\) scale" renderer/app.js
```

Expected: renderer tests and syntax pass; no homepage layout-scale FLIP remains.

Commit:

```bash
git add renderer/app.js tests/renderer-structure.test.js
git commit -m "feat: commit homepage visibility atomically"
```

### Task 4: Settings card, recording guard, and user feedback

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/workspace.js`
- Modify: `renderer/effects.js`
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

test('hidden visual widgets stop presentation-only background work', () => {
  assert.match(effectsJs, /setEnabled/);
  assert.match(effectsJs, /notch:home-modules-changed/);
  assert.match(workspaceJs, /NotchHome\?\.isVisible/);
});
```

Add `effectsJs` beside the existing source fixtures at the top of the test:

```js
const effectsJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'effects.js'), 'utf8');
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
    <small id="settings-home-module-status">隐藏后自动填充 · 至少保留一个</small>
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
    input.disabled = state?.readOnly === true
      || (moduleId === 'recorder' && recordingActive && input.checked);
  });
  const recorderNote = settingsHomeModuleList?.querySelector('[data-home-module-setting-note="recorder"]');
  if (recorderNote) recorderNote.textContent = recordingActive ? '录音进行中' : '录音与转写';
  const status = document.getElementById('settings-home-module-status');
  if (status) {
    status.textContent = state?.readOnly
      ? '安全模式 · 暂不可修改'
      : state?.persisted === false
        ? '仅当前会话 · 未能保存'
        : '隐藏后自动填充 · 至少保留一个';
    status.dataset.state = state?.readOnly || state?.persisted === false ? 'warning' : 'saved';
  }
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

Use the existing `active` local in `updateRecordingUi()` as `recordingActive`, or rename it consistently before dispatching. The event carries no audio data and does not mutate recording state. A hidden Recorder remains restorable during an active recording, and the Recordings tab remains fully usable; only the transition from visible to hidden is blocked.

- [ ] **Step 6: Wire guarded switch changes and always resync from source state**

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
        : result?.error === 'layout_read_only'
          ? '首页布局已进入安全模式，本次会话不能修改组件'
          : result?.error === 'layout_invalid'
            ? '新布局校验失败，原布局已保留'
            : result?.error === 'dom_apply_failed'
              ? '布局应用失败，原布局已恢复'
              : '首页组件设置未更新';
    if (typeof showStatusToast === 'function') showStatusToast(message);
    return;
  }
  if (result.changed === false) return;
  const message = result.persisted === false
    ? '布局已更新，仅当前会话生效，设置未能保存'
    : input.checked ? '首页组件已恢复' : '首页组件已隐藏';
  if (typeof showStatusToast === 'function') showStatusToast(message);
});
```

Reuse the existing global `showStatusToast()` helper; do not create a second toast DOM node or a second status event protocol.

- [ ] **Step 7: Stop background presentation work for hidden widgets**

In `renderer/effects.js`, extend the object returned by `createWebglEffect()` with `setEnabled(enabled)`. Disabling must cancel the current RAF and must not request another frame; enabling must start exactly one RAF chain. Listen for `notch:home-modules-changed` and enable the music effect only when `detail.visibleIds` contains `music`.

```js
setEnabled(enabled) {
  const next = enabled === true;
  if (next === effectEnabled) return;
  effectEnabled = next;
  cancelAnimationFrame(raf);
  raf = 0;
  if (effectEnabled) restart();
}
```

The current `restart()` calls `draw(start, true)` and then independently requests another frame even though `draw()` already schedules one, which can create an untracked second RAF chain. Rewrite it so `draw()` is the only scheduling location:

```js
const draw = (now, force = false) => {
  if (disposed || !effectEnabled) return;
  const active = force || isActive();
  if (active && (force || now - lastDraw >= 15)) {
    // existing draw body
  }
  raf = !reducedMotion.matches && effectEnabled ? requestAnimationFrame(draw) : 0;
};

const restart = () => {
  cancelAnimationFrame(raf);
  raf = 0;
  start = performance.now();
  if (effectEnabled) draw(start, true);
};
```

`ResizeObserver` and reduced-motion callbacks must go through the same guard and cannot force a draw while disabled. The initial lifecycle event from `app.js` handles a stored hidden Music state even though `effects.js` loads first.

In `renderer/workspace.js`, guard `refreshWindows()` before setting `windowsLoading`:

```js
if (!window.NotchHome?.isVisible?.('windows')) return;
```

On `notch:home-modules-changed`, call `refreshWindows(true)` only when Current Windows changed from hidden to visible and Home is expanded/active. The existing 6-second interval continues calling the cheap guard but performs no IPC enumeration while hidden. Do not gate Recordings-tab recording controls on homepage Recorder visibility, and do not stop Pomodoro state when its card is hidden.

- [ ] **Step 8: Verify settings and lifecycle contracts and commit**

Run:

```bash
node --test tests/renderer-structure.test.js
node --check renderer/workspace.js
node --check renderer/effects.js
```

Expected: exactly seven homepage switches are found; lifecycle guards exist; all renderer scripts pass syntax checks.

Commit:

```bash
git add renderer/index.html renderer/workspace.js renderer/effects.js tests/renderer-structure.test.js
git commit -m "feat: add homepage widget settings and lifecycle guards"
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
.home-bento[data-layout-mode='automatic'] .widget-size-control,
.home-bento[data-layout-mode='safe'] .widget-size-control { display: none !important; }
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
  const protectedSelectors = {
    music: ['.music-copy', '.music-controls'],
    pomodoro: ['.pomodoro-readout', '.pomodoro-toggle', '.pomodoro-reset:not([hidden])'],
    recorder: ['.recorder-head', '.home-transcript:not([hidden])', '.recorder-controls'],
    windows: ['.tile-head', '.window-list'],
    mirror: ['.mirror-stage'],
    note: ['.note-toolbar', '.note-body'],
    commands: ['.tile-head', '.command-add', '.command-list'],
  };
  const tiles = [...document.querySelectorAll('#home-bento [data-home-module]')]
    .filter((tile) => !tile.hidden)
    .map((tile) => {
      const rect = tile.getBoundingClientRect();
      const regions = (protectedSelectors[tile.dataset.homeModule] || [])
        .map((selector) => tile.querySelector(selector))
        .filter(Boolean)
        .map((node) => {
          const region = node.getBoundingClientRect();
          return { left: region.left, top: region.top, right: region.right, bottom: region.bottom };
        })
        .filter((region) => region.right > region.left && region.bottom > region.top);
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
        regions,
      };
    });
  return {
    surface: { left: surface.left, top: surface.top, right: surface.right, bottom: surface.bottom },
    tiles,
  };
}
```

- [ ] **Step 2: Exercise counts one through seven at standard and narrow window sizes**

Run the same matrix at `1240 × 616` and `1000 × 576`. At each size, navigate to Settings, restore all seven switches, then for each `visibleCount` from 7 down to 1 hide the next enabled module through its real checkbox `change` event. Wait two animation frames plus 180ms before measuring.

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
  for (let left = 0; left < tile.regions.length; left += 1) {
    for (let right = left + 1; right < tile.regions.length; right += 1) {
      const a = tile.regions[left];
      const b = tile.regions[right];
      const overlaps = a.left < b.right - 1 && a.right > b.left + 1
        && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      assert.equal(overlaps, false, `${tile.id} protected content regions overlap`);
    }
  }
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

Also calculate the logical area from the four layout datasets and assert it totals exactly `48` at every count. When fewer than seven tiles are visible, assert every size control is hidden, disabled, and absent from sequential focus; when seven are visible, assert the controls return with their original `data-current-size` values.

- [ ] **Step 3: Verify the final-widget rejection in the real UI**

With one switch left on, trigger its change to unchecked. Assert that:

- the checkbox returns to checked;
- one tile remains visible;
- `localStorage['notch-home-hidden-modules-v1']` still contains only six IDs;
- the status message contains “至少保留一个”.

- [ ] **Step 4: Attack rapid updates and transaction rollback**

Add renderer-level tests for these sequences:

1. Call `setModuleVisible('mirror', false)` and `setModuleVisible('note', false)` in the same JavaScript task. Final hidden state and LocalStorage must contain both IDs.
2. Call hide, show, hide for the same module without waiting for animations. The final state must be hidden and only one visibility Animation may remain.
3. Request the current absolute state again. Assert `ok === true`, `changed === false`, and that LocalStorage writes, lifecycle events, resource calls, layout styles, and Animation count do not change. Repeat with an already-hidden Recorder while recording is mocked active; idempotence must win over the recording guard.
4. Temporarily replace `NotchDomain.resolveHomeWidgetLayout` with a function returning `null`, attempt a switch, then restore it. Assert `error === 'layout_invalid'` and byte-for-byte equality of pre/post hidden state, LocalStorage, visible DOM IDs, and grid style attributes.
5. Temporarily replace `Storage.prototype.setItem` so it throws only for `notch-home-hidden-modules-v1`. Assert the DOM and session state change, `persisted === false`, the old stored value remains, and both the toast and Settings status explain that the change is session-only. While writes still fail, attempt a last-widget rejection and assert its result remains `persisted === false`. Restore the prototype, perform one valid switch, and assert the complete current state is saved and the persistent warning clears.
6. Seed storage with unknown IDs, duplicates, a non-array, and all seven IDs across reloads. Assert the normalized safe states match the design and no reload produces an empty homepage.
7. Focus an interactive child of a widget and hide it through the API. Assert `document.activeElement` is no longer inside the hidden tile and that the hidden tile and its size control are absent from sequential keyboard focus.
8. Alternate hide/show for one non-resource widget 100 times while measuring only the synchronous call duration. On the target Apple Silicon acceptance machine, p95 must stay below 16ms, no call may create a task above 50ms, final state must match the last call, and at most one visibility Animation may remain.

- [ ] **Step 5: Verify Recorder locking without disabling the Recordings tab**

Temporarily wrap `window.NotchWorkspace` inside the Electron test through `executeJavaScript()`:

```js
window.NotchWorkspace = {
  ...window.NotchWorkspace,
  isRecordingActive: () => true,
};
document.dispatchEvent(new CustomEvent('notch:recording-state-changed'));
```

When Recorder is visible, assert its switch is disabled and a direct `NotchHome.setModuleVisible('recorder', false)` call returns `error: 'recording_active'`. When Recorder was already hidden before the mocked recording became active, assert its switch remains enabled for restoration. Assert the Recordings-tab New Recording action is not disabled merely because the homepage card is hidden. Restore the original object immediately after the assertion. Do not activate a real microphone in automated tests.

- [ ] **Step 6: Verify background lifecycle and Pomodoro continuity**

Add automated or instrumented acceptance for:

- Current Windows: wrap the renderer entry to `listWindows`, hide the widget, advance across two 6-second intervals, and assert no enumeration occurred; restore it on an expanded Home tab and assert exactly one immediate refresh.
- Music: expose a read-only running flag from the effect instance during acceptance, hide Music, and assert its RAF ID is zero; restore it and assert only one RAF chain starts.
- Pomodoro: start a short timer, hide its card for more than one second, and assert logical remaining time decreases; restore it and confirm the displayed value catches up. Do not suppress the existing completion notification path.
- Recorder: hide its homepage card while idle, enter the Recordings tab, and confirm recording controls remain available.

The test-only observability must expose state, not mutation controls, and must not ship a timer or microphone mock in production code.

- [ ] **Step 7: Verify Mirror cleanup manually with a real camera**

Automated CI must not request camera permission. During local acceptance:

1. Open Home and click Mirror to start the camera.
2. Open Settings and turn Mirror off.
3. In DevTools, confirm `document.querySelector('.mirror-video').srcObject === null`.
4. Confirm the macOS camera indicator turns off immediately.
5. Turn Mirror back on and confirm it returns as an inactive cover rather than auto-starting the camera.

Record the result in the implementation handoff; a failing camera release blocks completion.

- [ ] **Step 8: Run the Electron acceptance and commit**

Run:

```bash
env -u ELECTRON_RUN_AS_NODE electron tests/notch-focus.electron.js
```

Expected: both viewport matrices, content protection regions, rapid transactions, rollback, persistence degradation, lifecycle guards, reduced motion, and Recorder behavior pass.

Commit:

```bash
git add tests/notch-focus.electron.js
git commit -m "test: verify homepage widget geometry and guards"
```

### Task 7: Product documentation and full verification

**Files:**
- Modify: `README.md`
- Verify: `renderer/domain.js`
- Verify: `renderer/effects.js`
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
- Widget-size controls are available only when all seven widgets are visible; hidden states use automatic-fill templates.
- Hiding Mirror releases its camera; Recorder cannot be hidden while a recording is active.
- Hiding the homepage Recorder card does not disable recording from the Recordings tab.
- Hidden Music and Current Windows stop presentation-only RAF/scanning work, while a hidden Pomodoro continues timing.
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

Using `npm start`, inspect visible counts 1 through 7 at both the normal and narrow supported window sizes, including two different five-widget combinations. Then force each of the seven widgets through every reachable `mini / compact / wide / tall / full` content contract. Verify:

- no outer blank region, overlap, or grid overflow;
- no stretched text, image, video, icon, or button;
- music and Pomodoro controls retain their proportions;
- Recorder controls remain fully clickable and its transcript preview yields space first;
- Current Windows and Commands scroll internally when content exceeds capacity;
- Note toolbar remains visible while only the editor scrolls;
- Mirror uses proportional `object-fit: cover` cropping;
- long-press reordering still works between visible widgets;
- restoring hidden widgets preserves their prior size preference;
- automatic-fill mode hides size controls and restoring all seven returns them;
- hidden Music and Current Windows stop background presentation work while Pomodoro continues;
- reduced-motion mode changes layout immediately without animation.

- [ ] **Step 5: Inspect only intended file changes**

Run:

```bash
git status --short
git diff --check
git diff -- renderer/domain.js renderer/effects.js renderer/app.js renderer/workspace.js renderer/index.html renderer/styles.css tests/domain.test.js tests/renderer-structure.test.js tests/notch-focus.electron.js README.md
```

Expected: no whitespace errors and no unrelated product changes. Preserve any pre-existing untracked or modified files outside this feature.

- [ ] **Step 6: Commit documentation and final verified state**

```bash
git add README.md
git commit -m "docs: document homepage widget visibility"
```

Do not package or publish. Report the full test result, manual camera result, and any residual visual caveat before requesting separate release approval.
