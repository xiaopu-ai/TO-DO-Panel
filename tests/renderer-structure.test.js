const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'workspace.js'), 'utf8');

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
