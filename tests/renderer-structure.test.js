const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'workspace.js'), 'utf8');
const effectsJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'effects.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');

test('clipboard rows define both favorite icons before rendering entries', () => {
  assert.match(appJs, /const starOutlineSvg\s*=/);
  assert.match(appJs, /const starFilledSvg\s*=/);
});

test('notes have a dedicated top-level tab and management panel', () => {
  assert.match(html, /data-tab="notes"/);
  assert.match(html, /id="tab-notes"/);
  assert.match(html, /id="notes-search"/);
  assert.match(html, /id="notes-list"/);
  assert.match(html, /id="notes-detail"/);
});

test('home scratch note keeps only the save action', () => {
  const homeNote = html.match(/<section class="tile home-note"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(homeNote, /id="note-save-btn"/);
  assert.doesNotMatch(homeNote, /id="note-library-btn"/);
  assert.doesNotMatch(homeNote, /id="note-library"/);
});

test('recordings expose in-page API settings and create a live draft while recording', () => {
  assert.match(html, /id="recording-configure"/);
  assert.match(workspaceJs, /function beginRecordingDraft\(\)/);
  assert.match(workspaceJs, /recordingLiveTranscript/);
  assert.match(workspaceJs, /configure-transcription/);
});

test('a live recording can be paused, resumed, and stopped from the recordings tab', () => {
  assert.match(workspaceJs, /recording-live-pause/);
  assert.match(workspaceJs, /recording-live-stop/);
  assert.match(workspaceJs, /togglePauseRecording/);
  assert.match(workspaceJs, /stopRecording/);
});

test('homepage visibility has one storage key, exact validation, and lifecycle events', () => {
  assert.match(appJs, /notch-home-hidden-modules-v1/);
  assert.match(appJs, /validateHomeWidgetLayout/);
  assert.match(appJs, /window\.NotchHome\s*=/);
  assert.match(appJs, /notch:home-modules-changed/);
  assert.match(appJs, /notch:home-layout-error/);
  assert.match(appJs, /stopMirror\(\)/);
  assert.match(appJs, /new Set\(homeTiles\.map\(\(tile\) => tile\.dataset\.homeModule\)\)/);
});

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

test('settings exposes every panel tab as a possible default opening page', () => {
  const select = html.match(/<select id="settings-default-tab"[\s\S]*?<\/select>/)?.[0] || '';
  const options = [...select.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(options, [
    'home', 'todo', 'notes', 'links', 'recordings', 'credentials', 'clip', 'settings',
  ]);
  assert.match(workspaceJs, /setDefaultTab/);
});

test('hidden visual widgets stop presentation-only background work', () => {
  assert.match(effectsJs, /setEnabled/);
  assert.match(effectsJs, /notch:home-modules-changed/);
  assert.match(workspaceJs, /NotchHome\?\.isVisible/);
});

test('todo custom categories use an inline form instead of a browser prompt', () => {
  assert.match(html, /id="todo-add-category-form"/);
  assert.match(appJs, /todoNewCategorySave/);
  assert.doesNotMatch(appJs, /window\.prompt/);
});

test('Windows collapsed strip keeps its width and reduces height', () => {
  assert.match(stylesCss, /html\.platform-win32 #app\.collapsed \.notch \{[^}]*width:\s*200px;[^}]*height:\s*6px/);
  assert.match(stylesCss, /html\.platform-win32 #app\.collapsed\.peek \.notch \{[^}]*height:\s*var\(--notch-h/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), /activeHeight = windowsPeekVisible \? Math\.min\(bounds\.height, 38\) : 6/);
});

test('todo category scroller uses the shared scrollbar tokens', () => {
  assert.match(stylesCss, /\.sections::\-webkit\-scrollbar \{ width: var\(--scrollbar-w\); \}/);
  assert.match(stylesCss, /\.sections::\-webkit\-scrollbar-thumb \{ background: var\(--scrollbar-thumb\)/);
});

test('Windows collapsed window ignores mouse clicks until the peek state is active', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(mainJs, /process\.platform === 'win32' && mode === 'collapsed'[\s\S]{0,220}setIgnoreMouseEvents\(true\)/);
  assert.match(mainJs, /windowsPeekVisible = nearTop;[\s\S]{0,120}setIgnoreMouseEvents\(!nearTop\)/);
});
