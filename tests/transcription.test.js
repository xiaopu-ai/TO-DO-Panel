const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

// Exercise the actual main-process IPC handlers without a microphone or cloud key.
function harness() {
  const sockets = [], events = [], timers = new Map(), handlers = new Map();
  let now = 0, timerId = 0;
  class Socket extends EventEmitter {
    static OPEN = 1;
    constructor() { super(); this.readyState = 0; this.sent = []; sockets.push(this); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    open() { this.readyState = 1; this.emit('open'); }
    message(type, payload = {}) { this.emit('message', JSON.stringify({ type, ...payload })); }
    close() { this.readyState = 3; this.emit('close', 1006); }
    terminate() { this.close(); }
    ping() { this.emit('pong'); }
  }
  const sender = { id: 1, isDestroyed: () => false, send: (_, data) => events.push(data) };
  const context = vm.createContext({
    WebSocket: Socket, Buffer, crypto: require('node:crypto'),
    TRANSCRIPTION_MODEL: 'qwen3-asr-flash-realtime', TRANSCRIPTION_SAMPLE_RATE: 16000,
    TRANSCRIPTION_FINISH_TIMEOUT_MS: 7000, transcriptionSessions: new Map(),
    resolveTranscriptionConfig: () => ({ apiKey: 'test', region: 'beijing' }),
    publicTranscriptionConfig: () => ({}),
    ipcMain: { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => handlers.set(name, fn) },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, at: now + ms }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const source = fs.readFileSync(require.resolve('../main.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function transcriptionUrl('), source.indexOf('// ============ 录音资料库')), context);
  const call = (name, data) => handlers.get(`transcription:${name}`)({ sender }, data);
  const tick = (ms) => {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  };
  const connect = () => { const socket = sockets.at(-1); socket.open(); socket.message('session.updated'); return socket; };
  return { sockets, events, timers, call, tick, connect, context };
}

test('unexpected close reconnects, buffers new audio and preserves earlier transcript', async () => {
  const h = harness();
  const start = h.call('start');
  const first = h.connect(); await start;
  first.message('conversation.item.input_audio_transcription.completed', { transcript: '前半段' });
  first.close();
  assert.equal(h.events.at(-1).status, 'reconnecting');
  h.call('audio', Buffer.from([1, 2]));
  h.tick(1000);
  assert.equal(h.sockets.length, 2);
  const second = h.connect();
  assert.equal(second.sent.find((m) => m.type === 'input_audio_buffer.append').audio, 'AQI=');
  first.message('conversation.item.input_audio_transcription.completed', { transcript: '过期消息' });
  second.message('conversation.item.input_audio_transcription.completed', { transcript: '后半段' });
  assert.equal(h.events.at(-1).final, '前半段 后半段');
  const finish = h.call('finish');
  second.message('session.finished');
  assert.equal((await finish).transcript, '前半段 后半段');
  h.tick(60000);
  assert.equal(h.sockets.length, 2);
  assert.equal(h.timers.size, 0);
});

test('service error and unexpected session.finished recover instead of silently stopping', async () => {
  for (const type of ['error', 'session.finished']) {
    const h = harness(); const start = h.call('start'); const socket = h.connect(); await start;
    socket.message(type, { error: { message: 'temporary failure' } });
    assert.equal(h.events.at(-1).status, 'reconnecting');
    h.tick(1000); assert.equal(h.sockets.length, 2);
    h.call('finish');
    h.tick(7000);
    assert.equal(h.timers.size, 0);
  }
});

test('stop during reconnect returns existing text and cancels retries', async () => {
  const h = harness(); const start = h.call('start'); const socket = h.connect(); await start;
  socket.message('conversation.item.input_audio_transcription.text', { text: '末尾未完成' });
  socket.close();
  const result = await h.call('finish');
  assert.equal(result.transcript, '末尾未完成');
  assert.equal(result.ok, false);
  h.tick(60000); assert.equal(h.sockets.length, 1); assert.equal(h.timers.size, 0);
});

test('connection is ready only after configuration acknowledgement; replacement settles old start', async () => {
  const h = harness(); const start = h.call('start'); h.sockets[0].open();
  h.call('audio', Buffer.from([1, 2]));
  assert.equal(h.sockets[0].sent.filter((m) => m.type === 'input_audio_buffer.append').length, 0);
  const replacement = h.call('start');
  assert.equal((await start).ok, false);
  h.connect(); assert.equal((await replacement).ok, true);
  h.context.closeAllTranscriptionSessions(); assert.equal(h.timers.size, 0);
});

test('buffer overflow is visible and reconnect attempts are bounded', async () => {
  const h = harness(); const start = h.call('start'); const socket = h.connect(); await start;
  socket.close();
  for (let i = 0; i < 40; i++) h.call('audio', Buffer.alloc(32000));
  assert.ok(h.events.some((e) => e.type === 'warning' && e.code === 'audio_gap'));
  h.tick(180000);
  assert.equal(h.events.at(-1).type, 'error');
  assert.ok(h.sockets.length <= 6);
  assert.equal(h.timers.size, 0);
});

test('half-open socket is detected even without a close event', async () => {
  const h = harness(); const start = h.call('start'); const socket = h.connect(); await start;
  socket.ping = () => {};
  h.tick(30000);
  assert.equal(h.events.at(-1).status, 'reconnecting');
  h.context.closeAllTranscriptionSessions(); assert.equal(h.timers.size, 0);
});

test('repeated spoken sentences survive, duplicate item delivery does not', async () => {
  const h = harness(); const start = h.call('start'); const socket = h.connect(); await start;
  for (const item_id of ['one', 'one', 'two']) {
    socket.message('conversation.item.input_audio_transcription.completed', { item_id, transcript: '你好' });
  }
  assert.equal(h.events.at(-1).final, '你好 你好');
  h.context.closeAllTranscriptionSessions();
});

function rendererHarness() {
  const source = fs.readFileSync(require.resolve('../renderer/workspace.js'), 'utf8');
  let listener, finishCalls = 0;
  const context = vm.createContext({
    window: { notchAPI: {
      onTranscriptionEvent: (fn) => { listener = fn; },
      finishTranscription: async () => { finishCalls++; return { ok: false, error: 'connection_closed', transcript: '已有文字 末尾' }; },
    } },
    recordingStatus: 'recording', recordingTranscript: '已有文字', interimTranscript: '',
    recordingCaptureIssue: '', transcriptionStatus: 'connected', transcriptionAudioGap: false,
    transcriptionConfig: { configured: true }, recordingStartTask: { isPending: () => false },
    transcriptionStartPromise: Promise.resolve({ ok: true }),
    stopTranscriptionAudioPipeline() {}, updateRecordingUi() {},
  });
  vm.runInContext(source.slice(source.indexOf('  function currentRecordingText()'), source.indexOf('  function beginRecordingDraft()')), context);
  vm.runInContext(source.slice(source.indexOf('  async function finishCloudTranscription()'), source.indexOf('  function updateRecordingUi()')), context);
  return { context, event: (e) => listener(e), finishCalls: () => finishCalls };
}

test('renderer follows reconnect status and still finishes a disconnected session', async () => {
  const h = rendererHarness();
  h.event({ type: 'status', status: 'reconnecting' });
  assert.equal(h.context.transcriptionStatus, 'reconnecting');
  assert.match(h.context.currentRecordingFeedback(), /重连/);
  await h.context.finishCloudTranscription();
  assert.equal(h.finishCalls(), 1);
  assert.equal(h.context.recordingTranscript, '已有文字 末尾');
});

test('renderer keeps a visible gap warning after connection recovers', () => {
  const h = rendererHarness();
  h.event({ type: 'warning', code: 'audio_gap' });
  h.event({ type: 'status', status: 'connected' });
  assert.match(h.context.currentRecordingFeedback(), /缺失/);
});

test('existing transcript does not hide reconnect feedback in recording detail', () => {
  const h = rendererHarness();
  const feedback = { textContent: '' }, transcript = { value: '' };
  Object.assign(h.context, {
    activeRecordingDraft: () => ({ id: 'draft' }), recordingStopDurationMs: 0,
    currentDuration: () => 50000, recordingList: null, CSS: { escape: (s) => s },
    selectedRecordingId: 'draft', formatClock: () => '00:50',
    recordingDetail: { querySelector: (selector) => ({
      '[data-recording-live-feedback]': feedback, '[data-recording-live-transcript]': transcript,
    })[selector] },
  });
  const source = fs.readFileSync(require.resolve('../renderer/workspace.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  function syncRecordingDraftUi()'), source.indexOf('  function stopTranscriptionAudioPipeline()')), h.context);
  h.event({ type: 'status', status: 'reconnecting' });
  h.context.syncRecordingDraftUi();
  assert.equal(transcript.value, '已有文字');
  assert.match(feedback.textContent, /重连/);
});

test('stop during initial connection settles start immediately and leaves no timers', async () => {
  const h = harness(); const start = h.call('start');
  const finish = await h.call('finish');
  assert.equal(finish.ok, false);
  assert.equal((await start).ok, false);
  h.tick(180000); assert.equal(h.sockets.length, 1); assert.equal(h.timers.size, 0);
});

test('late start reply cannot hide an already reported reconnect', async () => {
  const h = rendererHarness();
  const source = fs.readFileSync(require.resolve('../renderer/workspace.js'), 'utf8');
  Object.assign(h.context, { mediaStream: {}, startTranscriptionAudioPipeline() {} });
  h.context.window.notchAPI.startTranscription = async () => {
    h.event({ type: 'status', status: 'reconnecting' });
    return { ok: true };
  };
  vm.runInContext(source.slice(source.indexOf('  async function startCloudTranscription()'), source.indexOf('  async function finishCloudTranscription()')), h.context);
  await h.context.startCloudTranscription();
  assert.equal(h.context.transcriptionStatus, 'reconnecting');
});
