const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'workspace.js'), 'utf8');
const effectsJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'effects.js'), 'utf8');

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

test('chat tab supports roles, sessions, and save-to-notes', () => {
  assert.match(html, /data-tab="chat"/);
  assert.match(html, /id="tab-chat"/);
  assert.match(html, /id="chat-role-list"/);
  assert.match(html, /id="chat-messages"/);
  assert.match(html, /id="chat-save-note"/);
  assert.match(html, /data-settings-feature="chat"/);
  const chatJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'chat.js'), 'utf8');
  assert.match(chatJs, /chatComplete/);
  assert.match(chatJs, /saveFromChat/);
  assert.match(chatJs, /onChatChunk/);
  assert.match(chatJs, /replaceChatFromIndex|replaceIndex/);
  assert.match(chatJs, /buildPreview|NotchMarkdown/);
  assert.match(html, /id="chat-role-model"/);
  assert.match(html, /id="chat-settings-backdrop"/);
  assert.match(html, /id="settings-chat-configure"/);
  assert.match(html, /id="settings-api-configure"/);
  const preloadJs = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert.match(chatJs, /getChatConfig/);
  assert.match(preloadJs, /listChatModels/);
  assert.match(preloadJs, /getChatConfig/);
  assert.match(appJs, /groupNotesForLibrary/);
  assert.match(appJs, /notes-preview/);
  assert.match(appJs, /toggle-note-mode/);
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
    'music', 'pomodoro', 'recorder', 'windows', 'mirror', 'note', 'chat', 'commands', 'apps', 'filehub',
  ]);
  assert.match(workspaceJs, /isRecordingActive/);
  assert.match(workspaceJs, /recording_active/);
  assert.match(workspaceJs, /at_least_one_required/);
  assert.match(workspaceJs, /notch-app-favorites/);
  assert.match(workspaceJs, /launchApp/);
});

test('file hub exposes settings directories and draggable home files', () => {
  assert.match(html, /id="settings-filehub-card"/);
  assert.match(html, /data-home-module="filehub"/);
  assert.match(html, /id="home-filehub-list"/);
  assert.match(workspaceJs, /startFileDrag/);
  assert.match(workspaceJs, /openFileHubEntry/);
  assert.match(workspaceJs, /refreshFileHub/);
  const preloadJs = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert.match(preloadJs, /listFileHubFiles/);
  assert.match(preloadJs, /chooseFileHubDir/);
  assert.match(preloadJs, /openFileHubEntry/);
  assert.match(appJs, /'filehub'/);
});

test('hidden visual widgets stop presentation-only background work', () => {
  assert.match(effectsJs, /setEnabled/);
  assert.match(effectsJs, /notch:home-modules-changed/);
  assert.match(workspaceJs, /NotchHome\?\.isVisible/);
});
