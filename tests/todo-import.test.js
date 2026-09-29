const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeTodoImport,
  resolveTodoImportCategory,
  parseTodoImportDeadline,
  defaultTodoDeadline,
} = require('../renderer/domain');
const {
  isTodoInboxCandidate,
  parseTodoInboxBuffer,
  todoInboxArchiveNames,
  buildTodoInboxReport,
} = require('../main-services');

const NAMES = { P0: 'Teacher', P1: 'Writer', P2: 'Coder', P3: 'Me.' };
const NOW = Date.UTC(2026, 8, 29, 4, 0, 0);

function existingData() {
  return {
    P0: [{ id: 'keep-1', text: '备课', done: false, createdAt: 1, deadline: '2026-10-01T15:30:00.000Z', remindedAt: 0 }],
    P1: [{ id: 'keep-2', text: '写稿', done: true, createdAt: 2, deadline: '2026-09-01T15:30:00.000Z', remindedAt: 99 }],
    P2: [],
    P3: [],
  };
}

test('resolveTodoImportCategory accepts internal keys and display names', () => {
  assert.deepEqual(resolveTodoImportCategory('P2', NAMES), { category: 'P2' });
  assert.deepEqual(resolveTodoImportCategory(' p3 ', NAMES), { category: 'P3' });
  assert.deepEqual(resolveTodoImportCategory('Teacher', NAMES), { category: 'P0' });
  assert.deepEqual(resolveTodoImportCategory('  coder ', NAMES), { category: 'P2' });
  assert.deepEqual(resolveTodoImportCategory('me.', NAMES), { category: 'P3' });
  assert.match(resolveTodoImportCategory('Me', NAMES).error, /未知 category/);
  assert.match(resolveTodoImportCategory('', NAMES).error, /缺少 category/);
  assert.match(resolveTodoImportCategory(2, NAMES).error, /缺少 category/);
});

test('resolveTodoImportCategory prefers internal keys and rejects ambiguous names', () => {
  assert.deepEqual(resolveTodoImportCategory('P1', { ...NAMES, P2: 'P1' }), { category: 'P1' });
  assert.match(resolveTodoImportCategory('Work', { P0: 'Work', P1: 'work', P2: 'x', P3: 'y' }).error, /同时匹配 P0、P1/);
});

test('parseTodoImportDeadline accepts ISO strings with and without offsets', () => {
  assert.deepEqual(parseTodoImportDeadline('2026-10-01T18:00:00+08:00', NOW), { deadline: '2026-10-01T10:00:00.000Z' });
  assert.deepEqual(parseTodoImportDeadline('2026-10-01T18:00:00+0800', NOW), { deadline: '2026-10-01T10:00:00.000Z' });
  assert.deepEqual(parseTodoImportDeadline('2026-10-01T10:00:00.5Z', NOW), { deadline: '2026-10-01T10:00:00.500Z' });
  assert.deepEqual(parseTodoImportDeadline('2026-10-01T02:00-08:00', NOW), { deadline: '2026-10-01T10:00:00.000Z' });
  assert.equal(
    parseTodoImportDeadline('2026-10-01T18:00', NOW).deadline,
    new Date(2026, 9, 1, 18, 0, 0, 0).toISOString()
  );
  assert.equal(
    parseTodoImportDeadline('2026-10-01', NOW).deadline,
    new Date(2026, 9, 1, 23, 30, 0, 0).toISOString()
  );
});

test('parseTodoImportDeadline accepts millisecond timestamps and defaults when omitted', () => {
  const ms = Date.UTC(2026, 9, 1, 10);
  assert.deepEqual(parseTodoImportDeadline(ms, NOW), { deadline: new Date(ms).toISOString() });
  assert.deepEqual(parseTodoImportDeadline(undefined, NOW), { deadline: defaultTodoDeadline(new Date(NOW)), defaulted: true });
  assert.deepEqual(parseTodoImportDeadline(null, NOW), { deadline: defaultTodoDeadline(new Date(NOW)), defaulted: true });
  assert.deepEqual(parseTodoImportDeadline('', NOW), { deadline: defaultTodoDeadline(new Date(NOW)), defaulted: true });
});

test('parseTodoImportDeadline rejects malformed, impossible and second-based values', () => {
  assert.match(parseTodoImportDeadline('2026-02-30', NOW).error, /日期不存在/);
  assert.match(parseTodoImportDeadline('2026-02-30T10:00:00Z', NOW).error, /日期不存在/);
  assert.match(parseTodoImportDeadline('2026-10-01T24:00:00Z', NOW).error, /时间不存在/);
  assert.match(parseTodoImportDeadline('2026-10-01T10:00:00+15:00', NOW).error, /时区偏移无效/);
  assert.match(parseTodoImportDeadline('Oct 1 2026', NOW).error, /ISO 8601/);
  assert.match(parseTodoImportDeadline('1790848800000', NOW).error, /ISO 8601/);
  assert.match(parseTodoImportDeadline(1790848800, NOW).error, /秒级/);
  assert.match(parseTodoImportDeadline(1.5, NOW).error, /整数/);
  assert.match(parseTodoImportDeadline(-1, NOW).error, /超出可用范围/);
  assert.match(parseTodoImportDeadline('1999-12-31T00:00:00Z', NOW).error, /超出可用范围/);
  assert.match(parseTodoImportDeadline({}, NOW).error, /ISO 8601/);
});

test('mergeTodoImport appends valid entries and never touches existing todos', () => {
  const data = existingData();
  const snapshot = JSON.parse(JSON.stringify(data));
  const result = mergeTodoImport(data, {
    todos: [
      { text: '  讲 LoRA  第三节 ', category: 'Teacher', deadline: '2026-10-02T09:00:00+08:00', id: 'agent-1' },
      { text: '修复导入', category: 'P2', deadline: Date.UTC(2026, 9, 3, 1) },
      { text: '买菜', category: 'me.' },
    ],
  }, { categoryNames: NAMES, now: NOW, sourceId: 'abc123' });

  assert.deepEqual(data, snapshot, 'input must not be mutated');
  assert.equal(result.error, undefined);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.imported.map(({ index, category, todo }) => [index, category, todo.id, todo.text]), [
    [0, 'P0', 'agent-1', '讲 LoRA 第三节'],
    [1, 'P2', 'import-abc123-1', '修复导入'],
    [2, 'P3', 'import-abc123-2', '买菜'],
  ]);
  assert.deepEqual(result.data.P0[0], snapshot.P0[0]);
  assert.equal(result.data.P0[0], data.P0[0], 'existing items keep identity');
  assert.deepEqual(result.data.P1, snapshot.P1);
  assert.deepEqual(result.data.P0[1], {
    id: 'agent-1',
    text: '讲 LoRA 第三节',
    done: false,
    createdAt: NOW,
    deadline: '2026-10-02T01:00:00.000Z',
    remindedAt: 0,
  });
  assert.equal(result.data.P3[0].deadline, defaultTodoDeadline(new Date(NOW)));
  assert.equal(result.data.P2.length, 1);
});

test('mergeTodoImport skips invalid entries with reasons and keeps valid ones', () => {
  const result = mergeTodoImport(existingData(), [
    { text: 'ok', category: 'P1', id: 7 },
    'just a string',
    { category: 'P1' },
    { text: 'x'.repeat(81), category: 'P1' },
    { text: 'bad category', category: 'Nope' },
    { text: 'bad deadline', category: 'P1', deadline: '明天' },
    { text: 'bad id', category: 'P1', id: 'has space' },
    { text: 42, category: 'P1' },
    { text: 'many problems', category: '', deadline: 'x', id: 'ok-id' },
  ], { categoryNames: NAMES, now: NOW, sourceId: 'f00d' });

  assert.deepEqual(result.imported.map(({ todo }) => todo.id), ['7']);
  assert.deepEqual(result.skipped.map(({ index }) => index), [1, 2, 3, 4, 5, 6, 7, 8]);
  const reasons = Object.fromEntries(result.skipped.map(({ index, reason }) => [index, reason]));
  assert.match(reasons[1], /条目必须是对象/);
  assert.match(reasons[2], /缺少 text/);
  assert.match(reasons[3], /超过 80 个字符/);
  assert.match(reasons[4], /未知 category「Nope」/);
  assert.match(reasons[5], /ISO 8601/);
  assert.match(reasons[6], /id 只能包含/);
  assert.match(reasons[7], /text 必须是字符串/);
  assert.match(reasons[8], /缺少 category；deadline/);
  assert.equal(result.skipped.find(({ index }) => index === 8).id, 'ok-id');
  assert.deepEqual(result.data.P0, existingData().P0);
});

test('mergeTodoImport deduplicates against existing ids, within a file and on replay', () => {
  const data = existingData();
  const payload = [
    { text: 'dup existing', category: 'P3', id: 'keep-2' },
    { text: 'first', category: 'P3', id: 'agent-9' },
    { text: 'second', category: 'P2', id: 'agent-9' },
    { text: 'no id', category: 'P3' },
  ];
  const first = mergeTodoImport(data, payload, { categoryNames: NAMES, now: NOW, sourceId: 'beef' });
  assert.deepEqual(first.imported.map(({ todo }) => todo.id), ['agent-9', 'import-beef-3']);
  assert.deepEqual(first.skipped.map(({ index, reason }) => [index, /已存在/.test(reason)]), [[0, true], [2, true]]);

  // 同一份文件再投递一次（例如移走前崩溃）：全部命中重复，一条不加。
  const replay = mergeTodoImport(first.data, payload, { categoryNames: NAMES, now: NOW + 5000, sourceId: 'beef' });
  assert.deepEqual(replay.imported, []);
  assert.equal(replay.skipped.length, 4);
  assert.deepEqual(replay.data, first.data);
});

test('mergeTodoImport rejects unsupported top-level shapes without changes', () => {
  for (const payload of [null, 'text', 3, { items: [] }, { todos: 'x' }]) {
    const result = mergeTodoImport(existingData(), payload, { categoryNames: NAMES, now: NOW, sourceId: 'a1' });
    assert.match(result.error, /顶层必须是数组/);
    assert.deepEqual(result.imported, []);
    assert.deepEqual(result.data, existingData());
  }
  const empty = mergeTodoImport(existingData(), { todos: [] }, { categoryNames: NAMES, now: NOW, sourceId: 'a1' });
  assert.equal(empty.error, undefined);
  assert.deepEqual(empty.imported, []);
});

test('mergeTodoImport caps entries per file and warns about past deadlines', () => {
  const payload = Array.from({ length: 5 }, (_, index) => ({ text: `t${index}`, category: 'P0', deadline: NOW + 60_000 }));
  payload[1].deadline = NOW - 60_000;
  const result = mergeTodoImport({}, payload, { categoryNames: NAMES, now: NOW, sourceId: 'cap', maxItems: 3 });
  assert.equal(result.imported.length, 3);
  assert.deepEqual(result.skipped, [{ index: 3, reason: '单个文件最多导入 3 条，第 4–5 条未导入' }]);
  assert.deepEqual(result.warnings, [{ index: 1, id: 'import-cap-1', message: 'deadline 早于导入时间' }]);
  assert.deepEqual(Object.keys(result.data), ['P0', 'P1', 'P2', 'P3']);
});

test('isTodoInboxCandidate only accepts visible top-level json files', () => {
  assert.equal(isTodoInboxCandidate('todos.json'), true);
  assert.equal(isTodoInboxCandidate('Agent.JSON'), true);
  assert.equal(isTodoInboxCandidate('.todos.json'), false);
  assert.equal(isTodoInboxCandidate('todos.json.tmp'), false);
  assert.equal(isTodoInboxCandidate('todos.report.json'), false);
  assert.equal(isTodoInboxCandidate('processed'), false);
  assert.equal(isTodoInboxCandidate(''), false);
});

test('parseTodoInboxBuffer hashes content and reports JSON problems', () => {
  const good = parseTodoInboxBuffer(Buffer.from('﻿{"todos":[]}'));
  assert.equal(good.ok, true);
  assert.deepEqual(good.payload, { todos: [] });
  assert.match(good.hash, /^[0-9a-f]{64}$/);
  assert.equal(parseTodoInboxBuffer(Buffer.from('{"todos":[]}')).hash !== good.hash, true);
  assert.deepEqual(
    [parseTodoInboxBuffer(Buffer.from('  ')).ok, parseTodoInboxBuffer(Buffer.from('  ')).error],
    [false, '文件为空']
  );
  const broken = parseTodoInboxBuffer(Buffer.from('{"todos":['));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /^JSON 解析失败/);
  assert.match(broken.hash, /^[0-9a-f]{64}$/);
  assert.equal(parseTodoInboxBuffer(null).ok, false);
});

test('todoInboxArchiveNames uses a local timestamp and avoids collisions', () => {
  const now = new Date(2026, 8, 29, 15, 30, 12, 7);
  assert.deepEqual(todoInboxArchiveNames('agent.json', now), {
    archive: '20260929-153012-007-agent.json',
    report: '20260929-153012-007-agent.report.json',
  });
  const taken = new Set(['20260929-153012-007-agent.json', '20260929-153012-007-agent-1.report.json']);
  assert.deepEqual(todoInboxArchiveNames('agent.json', now, (name) => taken.has(name)), {
    archive: '20260929-153012-007-agent-2.json',
    report: '20260929-153012-007-agent-2.report.json',
  });
  assert.equal(todoInboxArchiveNames('../../evil.json', now).archive, '20260929-153012-007-evil.json');
});

test('buildTodoInboxReport summarizes status and sanitizes renderer rows', () => {
  const processedAt = Date.UTC(2026, 8, 29, 7, 30);
  const imported = { index: 0, id: 'a', category: 'P0', categoryName: 'Teacher', text: '备课', deadline: '2026-10-01T10:00:00.000Z', extra: 'drop' };
  const full = buildTodoInboxReport({ fileName: 'x.json', processedAt, result: { imported: [imported], skipped: [], warnings: [] } });
  assert.equal(full.status, 'imported');
  assert.equal(full.processedAt, '2026-09-29T07:30:00.000Z');
  assert.deepEqual(full.imported, [{ index: 0, id: 'a', category: 'P0', categoryName: 'Teacher', text: '备课', deadline: '2026-10-01T10:00:00.000Z' }]);
  assert.deepEqual(full.summary, { imported: 1, skipped: 0, warnings: 0 });

  const partial = buildTodoInboxReport({ fileName: 'x.json', processedAt, result: { imported: [imported], skipped: [{ index: 1, reason: 'r'.repeat(400) }, 'junk'] } });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.skipped.length, 1);
  assert.equal(partial.skipped[0].reason.length, 300);

  assert.equal(buildTodoInboxReport({ fileName: 'x.json', result: { imported: [], skipped: [{ index: 0, reason: 'dup' }] } }).status, 'none');

  const rejected = buildTodoInboxReport({ fileName: 'dir/x.json', processedAt, error: 'JSON 解析失败：boom' });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.file, 'x.json');
  assert.equal(rejected.error, 'JSON 解析失败：boom');
  assert.deepEqual(rejected.imported, []);

  const fromRenderer = buildTodoInboxReport({ fileName: 'x.json', result: { error: '文件顶层必须是数组', imported: [imported] } });
  assert.equal(fromRenderer.status, 'rejected');
  assert.deepEqual(fromRenderer.imported, []);
});
