// 端到端：真实主进程 + 渲染层，验证 todo-inbox 启动检查、运行中导入、
// 坏文件报告、同内容重放不重复，以及已有待办原样保留。
// TODO_TEST_PHASE=restart 时复用同一 profile 重启，确认导入结果已落盘。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const profile = process.env.TODO_TEST_USER_DATA;
const restartPhase = process.env.TODO_TEST_PHASE === 'restart';
app.commandLine.appendSwitch('user-data-dir', profile);
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');
// 跳过首次运行的开机自启登记，测试不改动系统登录项。
fs.writeFileSync(path.join(profile, '.first-run-done'), '1');

const existing = {
  P0: [{ id: 'keep-p0', text: '已有 P0', done: false, createdAt: 1788709776699, deadline: '2026-10-01T15:30:00.000Z', remindedAt: 0 }],
  P1: [{ id: 'keep-p1', text: '已有 P1', done: true, createdAt: 1788709776700, deadline: '2026-09-01T15:30:00.000Z', remindedAt: 1788709776800 }],
  P2: [],
  P3: [],
};
const inbox = path.join(profile, 'todo-inbox');
const processed = path.join(inbox, 'processed');
const startupPayload = JSON.stringify({ todos: [
  { text: '启动前放入', category: 'Coder', deadline: '2026-10-02T09:00:00+08:00' },
  { text: '缺分类' },
] });
if (restartPhase) {
  // 删掉镜像文件：重启后看到的待办只能来自 localStorage 本身。
  fs.rmSync(path.join(profile, 'workspace.json'), { force: true });
} else {
  fs.writeFileSync(path.join(profile, 'workspace.json'), JSON.stringify({ version: 1, localStorage: {
    'notch-todo-data': JSON.stringify(existing),
    'notch-todo-category-names-v1': JSON.stringify({ P0: 'Teacher', P1: 'Writer', P2: 'Coder', P3: 'Me.' }),
  } }));
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, 'startup.json'), startupPayload);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(150);
  }
  throw new Error(`Timed out: ${label}${last ? `; ${last.stack || last}` : ''}`);
}
function reportFor(name) {
  const file = fs.existsSync(processed)
    && fs.readdirSync(processed).find((entry) => entry.endsWith(`-${name}.report.json`));
  return file ? JSON.parse(fs.readFileSync(path.join(processed, file), 'utf8')) : null;
}
function inboxJson() {
  return fs.readdirSync(inbox).filter((name) => name.endsWith('.json'));
}

const errors = [];
let page = null;
setTimeout(() => { console.error('Todo inbox test timed out', errors); app.exit(1); }, 90000);
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(`${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  contents.on('did-finish-load', () => {
    if (contents.getURL().endsWith('/renderer/index.html')) page = contents;
  });
});

async function readTodos() {
  return page.executeJavaScript(`({
    data: JSON.parse(localStorage.getItem('notch-todo-data') || 'null'),
    dom: Object.fromEntries(['P0','P1','P2','P3'].map((p) => [p, [...document.querySelectorAll('.todo-list[data-priority="' + p + '"] .todo-item')].map((el) => el.dataset.id)])),
  })`);
}

async function verifyRestart() {
  const reportsBefore = fs.readdirSync(processed).length;
  const state = await until(async () => {
    const value = await readTodos();
    return value.dom.P0.includes('agent-live-1') ? value : null;
  }, 'imported todos after restart');
  assert.deepEqual(state.data.P0[0], existing.P0[0], 'existing P0 todo survives restart');
  assert.deepEqual(state.data.P1, existing.P1, 'existing P1 todo survives restart');
  assert.deepEqual(state.data.P0.map(({ id }) => id), ['keep-p0', 'agent-live-1']);
  assert.equal(state.data.P2.length, 1);
  assert.equal(state.data.P3.length, 1);
  // 再等两轮扫描：已处理的文件不会被重新导入。
  await delay(5000);
  assert.deepEqual(inboxJson(), []);
  assert.equal(fs.readdirSync(processed).length, reportsBefore);
  assert.deepEqual(errors, []);
  console.log('Todo inbox restart checks passed');
}

async function main() {
  await app.whenReady();
  await until(() => page, 'renderer load');
  if (restartPhase) return verifyRestart();

  // 1. 启动时检查：启动前放入的文件被导入，缺分类的条目进报告。
  const startupReport = await until(() => reportFor('startup'), 'startup report');
  assert.equal(startupReport.status, 'partial');
  assert.equal(startupReport.archivedAs.startsWith('processed/'), true);
  assert.deepEqual(startupReport.imported.map(({ category, text }) => [category, text]), [['P2', '启动前放入']]);
  assert.deepEqual(startupReport.skipped.map(({ index }) => index), [1]);
  assert.match(startupReport.skipped[0].reason, /缺少 category/);
  assert.equal(fs.readFileSync(path.join(profile, startupReport.archivedAs.replace('processed/', 'todo-inbox/processed/')), 'utf8'), startupPayload);

  // 2. 运行中放入：按显示名与内部键分类、写入 id，界面实时出现。
  fs.writeFileSync(path.join(inbox, '.live.json.tmp'), JSON.stringify([
    { id: 'agent-live-1', text: '运行中导入', category: 'teacher', deadline: 1790848800000 },
    { text: '日常项', category: 'P3' },
    { id: 'keep-p0', text: '冒充已有 id', category: 'P0' },
  ]));
  fs.renameSync(path.join(inbox, '.live.json.tmp'), path.join(inbox, 'live.json'));
  const liveReport = await until(() => reportFor('live'), 'live report');
  assert.equal(liveReport.status, 'partial');
  assert.deepEqual(liveReport.imported.map(({ id, category, categoryName }) => [id, category, categoryName]).slice(0, 1), [['agent-live-1', 'P0', 'Teacher']]);
  assert.match(liveReport.skipped[0].reason, /keep-p0.*已存在/);

  // 3. 坏文件：整份拒收，原样归档，不影响数据。
  fs.writeFileSync(path.join(inbox, 'broken.json'), '{"todos": [');
  const brokenReport = await until(() => reportFor('broken'), 'broken report');
  assert.equal(brokenReport.status, 'rejected');
  assert.match(brokenReport.error, /JSON 解析失败/);

  // 4. 同内容再放一次：稳定 id 全部命中重复，一条不加。
  fs.writeFileSync(path.join(inbox, 'replay.json'), startupPayload);
  const replayReport = await until(() => reportFor('replay'), 'replay report');
  assert.equal(replayReport.status, 'none');
  assert.equal(replayReport.skipped.length, 2);

  assert.deepEqual(inboxJson(), [], 'every inbox file must be marked as processed');

  const state = await until(async () => {
    const value = await readTodos();
    return value.dom.P0.includes('agent-live-1') ? value : null;
  }, 'imported todos rendered');
  const liveGeneratedId = liveReport.imported[1].id;
  const startupGeneratedId = startupReport.imported[0].id;
  assert.deepEqual(state.data.P0[0], existing.P0[0], 'existing P0 todo unchanged');
  assert.deepEqual(state.data.P1, existing.P1, 'existing P1 todo unchanged');
  assert.deepEqual(state.data.P0.map(({ id }) => id), ['keep-p0', 'agent-live-1']);
  assert.deepEqual(state.data.P2.map(({ id }) => id), [startupGeneratedId]);
  assert.deepEqual(state.data.P3.map(({ id }) => id), [liveGeneratedId]);
  assert.deepEqual([...state.dom.P0].sort(), ['agent-live-1', 'keep-p0']);
  assert.deepEqual(state.dom.P2, [startupGeneratedId]);
  assert.deepEqual(state.dom.P3, [liveGeneratedId]);

  // 5. 持久化照常：workspace.json 同步到了新待办。
  await until(() => {
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'workspace.json'), 'utf8'));
    const todos = JSON.parse(saved.localStorage['notch-todo-data']);
    return todos.P0.some(({ id }) => id === 'agent-live-1') && todos.P2.length === 1 && todos.P3.length === 1;
  }, 'workspace.json sync');

  assert.deepEqual(errors, []);
  console.log('Todo inbox import checks passed');
}

main().then(() => app.quit(), (error) => { console.error(error); app.exit(1); });
require('../main.js');
