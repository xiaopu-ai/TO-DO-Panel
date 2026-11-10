const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseCodexSession,
  parseClaudeSession,
  normalizeQuotaWindow,
  normalizeClaudeStatusline,
  effectiveState,
  pickSession,
  createAgentUsageMonitor,
  RUNNING_STALE_MS,
} = require('../main/agent-usage');
const { parseNotchScreens, createNotchGeometry } = require('../main/notch-geometry');
const { buildPermissionList, missingRequiredPermissions, permissionSettingsUrl } = require('../main/permissions');

const lines = (rows) => rows.map((row) => JSON.stringify(row)).join('\n');
const NOW = 1794300000000;

function codexRows({ complete = true, turnId = 'turn-1' } = {}) {
  return [
    { type: 'session_meta', payload: { cwd: '/Users/me/work/demo' } },
    { type: 'event_msg', payload: { type: 'task_started', turn_id: turnId, model_context_window: 400000 } },
    { type: 'turn_context', payload: { cwd: '/Users/me/work/demo', model: 'gpt-x' } },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { last_token_usage: { input_tokens: 99000, output_tokens: 1000, total_tokens: 100000 }, model_context_window: 400000 },
        rate_limits: {
          primary: { used_percent: 14, window_minutes: 300, resets_at: NOW / 1000 + 3600 },
          secondary: { used_percent: 60, window_minutes: 10080, resets_at: NOW / 1000 - 10 },
          plan_type: 'plus',
        },
      },
    },
    ...(complete ? [{ type: 'event_msg', payload: { type: 'task_complete', turn_id: turnId, last_agent_message: 'Done.\nDetails' } }] : []),
  ];
}

test('codex session exposes context, quota and run state from the rollout tail', () => {
  const running = parseCodexSession(lines(codexRows({ complete: false })), { nowMs: NOW });
  assert.equal(running.state, 'running');
  assert.equal(running.contextPercent, 25);
  assert.equal(running.project, 'demo');
  assert.equal(running.quota.primary.usedPercent, 14);
  assert.equal(running.quota.primary.resetsAt, NOW + 3600000);
  // 已过重置时间的窗口不能继续显示旧的高水位。
  assert.deepEqual(running.quota.secondary, { usedPercent: 0, resetsAt: 0, stale: true });

  const done = parseCodexSession(lines(codexRows()), { nowMs: NOW });
  assert.equal(done.state, 'done');
  assert.equal(done.completedTurnId, 'turn-1');
  assert.equal(done.title, 'Done.');
});

test('a truncated first line and junk lines are skipped, not fatal', () => {
  const text = `ted":true}}\nnot json\n${lines(codexRows())}`;
  assert.equal(parseCodexSession(text, { nowMs: NOW }).state, 'done');
});

function claudeRows(final) {
  const usage = { input_tokens: 10, cache_creation_input_tokens: 990, cache_read_input_tokens: 99000, output_tokens: 0 };
  return [
    { type: 'user', uuid: 'u1', cwd: '/Users/me/app', message: { role: 'user', content: 'do it' } },
    { type: 'assistant', uuid: 'a1', message: { role: 'assistant', model: 'claude-x', stop_reason: 'tool_use', usage, content: [{ type: 'tool_use' }] } },
    { type: 'user', uuid: 'u2', message: { role: 'user', content: [{ type: 'tool_result' }] } },
    { type: 'assistant', uuid: 's1', isSidechain: true, message: { role: 'assistant', stop_reason: 'end_turn', usage: { input_tokens: 5 }, content: [{ type: 'text', text: 'sub' }] } },
    ...(final ? [{ type: 'assistant', uuid: 'a2', message: { role: 'assistant', model: 'claude-x', stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'All done\nmore' }] } }] : []),
  ];
}

test('claude session ignores sidechains and tracks the main-line turn', () => {
  const running = parseClaudeSession(lines(claudeRows(false)));
  assert.equal(running.state, 'running');
  assert.equal(running.contextTokens, 100000);
  assert.equal(running.contextPercent, 50);
  assert.equal(running.project, 'app');

  const done = parseClaudeSession(lines(claudeRows(true)));
  assert.equal(done.state, 'done');
  assert.equal(done.completedTurnId, 'u1');
  assert.equal(done.title, 'All done');
});

test('claude usage above the standard window is measured against the extended one', () => {
  const rows = [{ type: 'assistant', message: { role: 'assistant', stop_reason: 'end_turn', usage: { input_tokens: 500000 }, content: [] } }];
  const session = parseClaudeSession(lines(rows));
  assert.equal(session.contextWindow, 1000000);
  assert.equal(session.contextPercent, 50);
});

test('quota windows accept seconds, milliseconds and statusline field names', () => {
  assert.equal(normalizeQuotaWindow({ used_percentage: 33.33, resets_at: NOW + 1000 }, NOW).usedPercent, 33.3);
  assert.equal(normalizeQuotaWindow({ used_percent: 250 }, NOW).usedPercent, 100);
  assert.equal(normalizeQuotaWindow({}, NOW), null);
  const quota = normalizeClaudeStatusline({ rate_limits: { five_hour: { used_percentage: 12, resets_at: NOW / 1000 + 60 } } }, NOW);
  assert.equal(quota.primary.usedPercent, 12);
  assert.equal(quota.secondary, null);
  assert.equal(normalizeClaudeStatusline({ rate_limits: {} }, NOW), null);
  assert.equal(normalizeClaudeStatusline(null, NOW), null);
});

test('a session stuck in running goes idle once its file stops changing', () => {
  assert.equal(effectiveState({ state: 'running' }, NOW - RUNNING_STALE_MS - 1, NOW), 'idle');
  assert.equal(effectiveState({ state: 'running' }, NOW - 1000, NOW), 'running');
  assert.equal(effectiveState({ state: 'done' }, 0, NOW), 'done');
});

test('a running session wins over a more recent finished one', () => {
  const picked = pickSession([
    { state: 'done', mtimeMs: NOW - 10 },
    { state: 'running', mtimeMs: NOW - 5000 },
  ], NOW);
  assert.equal(picked.state, 'running');
  assert.equal(picked.runningCount, 1);
  assert.equal(pickSession([{ state: 'done', mtimeMs: 0 }], NOW), null);
});

test('monitor reports only completions that happen after it started watching', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-usage-'));
  const day = new Date();
  const dir = path.join(root, 'codex', String(day.getFullYear()), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'rollout-test.jsonl');
  fs.writeFileSync(file, lines(codexRows({ turnId: 'old' })));

  const completions = [];
  const snapshots = [];
  let clock = Date.now();
  const monitor = createAgentUsageMonitor({
    codexRoot: path.join(root, 'codex'),
    claudeRoot: path.join(root, 'claude'),
    now: () => clock,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onCompletion: (completion) => completions.push(completion),
  });
  try {
    await monitor.tick();
    assert.equal(completions.length, 0, '启动时已存在的完成不上报');
    assert.equal(snapshots.at(-1).codex.state, 'done');
    assert.equal(snapshots.at(-1).claude, null);

    // 一个完整的新回合整个落在两次轮询之间。
    fs.appendFileSync(file, `\n${lines(codexRows({ turnId: 'new' }))}`);
    clock += 2000;
    await monitor.tick();
    assert.deepEqual(completions.map((item) => item.turnId), ['new']);
    assert.equal(completions[0].source, 'codex');

    clock += 2000;
    await monitor.tick();
    assert.equal(completions.length, 1, '同一回合不重复上报');
  } finally {
    monitor.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notch width comes from the gap between the two auxiliary areas', () => {
  const screens = parseNotchScreens(JSON.stringify([
    { id: 1, width: 1728, left: 771, right: 772, height: 32 },
    { id: 2, width: 1920, left: 0, right: 0, height: 0 },
  ]));
  assert.deepEqual(screens.get(1), { hasNotch: true, notchWidth: 185, notchHeight: 32 });
  assert.equal(screens.get(2).hasNotch, false);
  assert.equal(parseNotchScreens('garbage').size, 0);

  const geometry = createNotchGeometry({ platform: 'linux', fallbackWidth: 200 });
  assert.equal(geometry.coreWidth({ id: 1 }), 200, '未取到刘海数据时退回折叠条宽度');
});

test('permission list maps system status to a single next action', () => {
  const list = buildPermissionList({ accessibility: 'denied', 'screen-recording': 'granted', microphone: 'not-determined', camera: 'denied' });
  const byId = Object.fromEntries(list.map((item) => [item.id, item]));
  assert.equal(byId.accessibility.state, 'settings');
  assert.equal(byId['screen-recording'].state, 'granted');
  assert.equal(byId.microphone.state, 'prompt');
  assert.equal(byId.microphone.actionLabel, '允许');
  assert.equal(byId.camera.actionLabel, '打开设置');
  assert.equal(byId.automation.state, 'unknown');
  assert.deepEqual(missingRequiredPermissions({ accessibility: 'denied', 'screen-recording': 'not-determined' }), ['accessibility', 'screen-recording']);
  assert.deepEqual(missingRequiredPermissions({ accessibility: 'granted', 'screen-recording': 'granted' }), []);
  assert.match(permissionSettingsUrl('camera'), /^x-apple\.systempreferences:.*Privacy_Camera$/);
  assert.equal(permissionSettingsUrl('constructor'), null);
});

const { matchInstalledPlayers, choosePlayer, normalizeMusicPreference, parseScriptStatus, createMusicPlayers } = require('../main/music-players');

test('music players are recognised by app name, Apple Music only from the system folder', () => {
  const installed = matchInstalledPlayers([
    { dir: '/Applications', name: 'NeteaseMusic' },
    { dir: '/Applications', name: '汽水音乐' },
    { dir: '/Applications', name: 'Music' }, // 第三方同名应用，不能当成 Apple Music
    { dir: '/System/Applications', name: 'Music' },
    { dir: '/Applications', name: 'Safari' },
  ]);
  assert.deepEqual(installed.map((player) => player.id), ['soda', 'netease', 'apple']);
  assert.equal(installed[1].appPath, '/Applications/NeteaseMusic.app');
  assert.equal(installed[2].appPath, '/System/Applications/Music.app');
  assert.deepEqual(matchInstalledPlayers([]), []);
});

test('player choice: explicit preference, then whatever is running, then the default order', () => {
  const installed = matchInstalledPlayers([
    { dir: '/Applications', name: '汽水音乐' },
    { dir: '/Applications', name: 'QQMusic' },
    { dir: '/System/Applications', name: 'Music' },
  ]);
  assert.equal(choosePlayer(installed, 'qq', ['soda']).id, 'qq');
  assert.equal(choosePlayer(installed, 'auto', ['apple']).id, 'apple');
  assert.equal(choosePlayer(installed, 'auto', []).id, 'soda');
  // 指定的播放器后来被卸载：退回自动。
  assert.equal(choosePlayer(installed, 'netease', []).id, 'soda');
  assert.equal(choosePlayer([], 'auto', []), null);
  assert.equal(normalizeMusicPreference('spotify'), 'spotify');
  assert.equal(normalizeMusicPreference('constructor'), 'auto');
  assert.equal(normalizeMusicPreference(undefined), 'auto');
});

test('script status parsing tolerates garbage and truncates long titles', () => {
  assert.deepEqual(parseScriptStatus('{"running":true,"playing":true,"title":"Song","artist":"A"}'), { running: true, playing: true, title: 'Song', artist: 'A' });
  assert.equal(parseScriptStatus('execution error'), null);
  assert.equal(parseScriptStatus(JSON.stringify({ running: true, title: 'x'.repeat(500) })).title.length, 120);
});

test('auto mode follows the running player and never probes when the user pinned one', async () => {
  const probes = [];
  const running = new Set(['/Applications/QQMusic.app']);
  const players = createMusicPlayers({
    appDirs: ['/Applications', '/System/Applications'],
    readDir: async (dir) => (dir === '/Applications' ? ['汽水音乐.app', 'QQMusic.app', 'Notes.app'] : ['Music.app']),
    execFile: (file, args, options, callback) => {
      probes.push(args[1]);
      const hit = [...running].some((appPath) => args[1].includes(appPath.replace(/\./g, '\\.')));
      callback(hit ? null : new Error('no match'));
    },
  });
  const auto = await players.resolve('auto');
  assert.equal(auto.player.id, 'qq');
  assert.equal(auto.running, true);
  assert.equal(probes.length, 3);

  probes.length = 0;
  const pinned = await players.resolve('soda');
  assert.equal(pinned.player.id, 'soda');
  assert.equal(pinned.running, false);
  assert.equal(probes.length, 1);
});

const { MIN_ALERT_TURN_MS } = require('../main/agent-usage');

test('turn duration is read so quick back-and-forth turns do not raise alerts', () => {
  const codex = parseCodexSession(lines([
    { type: 'event_msg', payload: { type: 'task_started', turn_id: 't' } },
    { type: 'event_msg', payload: { type: 'task_complete', turn_id: 't', duration_ms: 4200 } },
  ]), { nowMs: NOW });
  assert.equal(codex.turnDurationMs, 4200);

  const claude = parseClaudeSession(lines([
    { type: 'user', uuid: 'u', timestamp: '2026-11-10T10:00:00.000Z', message: { role: 'user', content: 'hi' } },
    { type: 'assistant', uuid: 'a', timestamp: '2026-11-10T10:02:00.000Z', message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] } },
  ]));
  assert.equal(claude.turnDurationMs, 120000);
  // 尾部读不到回合起点时不猜时长。
  const unknown = parseClaudeSession(lines([
    { type: 'assistant', uuid: 'a', timestamp: '2026-11-10T10:02:00.000Z', message: { role: 'assistant', stop_reason: 'end_turn', content: [] } },
  ]));
  assert.equal(unknown.turnDurationMs, null);
  assert.ok(MIN_ALERT_TURN_MS >= 10000);
});
