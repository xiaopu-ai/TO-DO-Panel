'use strict';

// 灵动岛渲染层。窗口尺寸由主进程瞬时切换，这里只负责：
//   1. 把主进程下发的几何写进 CSS 变量；
//   2. 在「刘海 + 耳朵」与展开卡片之间播形变；
//   3. 渲染用量与提醒内容。

const api = window.islandAPI;
const root = document.getElementById('island');
const shell = root.querySelector('.island-shell');
const peekElement = document.getElementById('island-peek');
const alertElement = document.getElementById('island-alert');
const alertTitle = document.getElementById('alert-title');
const alertSource = document.getElementById('alert-source');
const alertDetail = document.getElementById('alert-detail');
const alertQueue = document.getElementById('alert-queue');
const ears = {
  left: document.getElementById('ear-left'),
  right: document.getElementById('ear-right'),
};

const HOVER_OPEN_MS = 140; // 鼠标只是路过菜单栏时不该弹出明细
const HOVER_CLOSE_MS = 220;
const SHRINK_FALLBACK_MS = 320;
const MAX_QUEUE_COUNT = 99;
const WARN_PERCENT = 80;
const DANGER_PERCENT = 92;

const TOOL_NAMES = { claude: 'Claude Code', codex: 'Codex' };
const STATE_NAMES = { running: '运行中', done: '已完成', idle: '空闲' };
const SOURCE_NAMES = { codex: 'Codex', claude: 'Claude', gpt: 'GPT', chatgpt: 'GPT', task: '任务', todo: '待办' };

let metrics = { mode: 'hidden' };
let tools = [];
let peekRequested = false;
let openTimer = null;
let closeTimer = null;
let shrinkTimer = null;
let shrinkDone = null;
let alertEventId = null;
let alertVisible = false;
let alertHiding = false;
let alertHovering = false;
const sawRunning = new Set();
const acknowledged = new Map(); // tool -> 已读的 updatedAt

function px(value) {
  return `${Math.max(0, Number(value) || 0)}px`;
}

function percentLevel(percent) {
  if (percent >= DANGER_PERCENT) return 'danger';
  if (percent >= WARN_PERCENT) return 'warn';
  return 'normal';
}

function formatTokens(value) {
  const tokens = Number(value) || 0;
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(tokens % 1e6 === 0 ? 0 : 1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}

const resetTimeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const resetDayFormat = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });

function formatReset(resetsAt) {
  if (!resetsAt) return '';
  const date = new Date(resetsAt);
  const sameDay = date.toDateString() === new Date().toDateString();
  return `${sameDay ? '' : `${resetDayFormat.format(date)} `}${resetTimeFormat.format(date)} 重置`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function glyph(tool, className) {
  const wrap = element('span', className);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#glyph-${tool === 'codex' ? 'codex' : 'claude'}`);
  svg.append(use);
  wrap.append(svg);
  return wrap;
}

function meterRow(label, percent, note) {
  const row = element('div', 'peek-meter');
  const value = Math.round(percent);
  row.dataset.level = percentLevel(percent);
  const bar = element('span', 'peek-bar');
  const fill = element('span', 'peek-fill');
  fill.style.setProperty('--fill', String(Math.max(0, Math.min(1, percent / 100))));
  bar.append(fill);
  row.append(
    element('span', 'peek-label', label),
    bar,
    element('span', 'peek-value', `${value}%`),
    element('span', 'peek-note', note || '')
  );
  return row;
}

function emptyRow(label, text) {
  const row = element('div', 'peek-empty');
  row.append(element('span', 'peek-label', label), element('span', '', text));
  return row;
}

function isUnread(tool) {
  return tool.state === 'done'
    && sawRunning.has(tool.tool)
    && acknowledged.get(tool.tool) !== tool.updatedAt;
}

function renderEar(node, tool) {
  if (!tool) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  const hasPercent = Number.isFinite(tool.contextPercent);
  const percent = hasPercent ? Math.round(tool.contextPercent) : null;
  node.dataset.state = tool.state;
  node.dataset.unread = String(isUnread(tool));
  node.dataset.level = hasPercent ? percentLevel(tool.contextPercent) : 'normal';
  node.querySelector('use').setAttribute('href', `#glyph-${tool.tool}`);
  node.querySelector('.ear-value').textContent = hasPercent ? `${percent}%` : '–';
  const name = TOOL_NAMES[tool.tool] || tool.tool;
  node.setAttribute(
    'aria-label',
    `${name}，${STATE_NAMES[tool.state] || ''}，上下文${hasPercent ? `已用 ${percent}%` : '未知'}。点击展开面板`
  );
}

function renderPeek() {
  const blocks = tools.map((tool) => {
    const block = element('div', 'peek-tool');
    block.dataset.state = tool.state;
    const head = element('div', 'peek-head');
    const stateText = tool.state === 'running' && tool.runningCount > 1
      ? `${tool.runningCount} 个会话运行中`
      : STATE_NAMES[tool.state] || '';
    head.append(
      glyph(tool.tool, 'peek-glyph'),
      element('span', 'peek-name', TOOL_NAMES[tool.tool] || tool.tool),
      element('span', 'peek-project', tool.project || ''),
      element('span', 'peek-state', stateText)
    );
    block.append(head);

    if (Number.isFinite(tool.contextPercent)) {
      block.append(meterRow(
        '上下文',
        tool.contextPercent,
        `${formatTokens(tool.contextTokens)} / ${formatTokens(tool.contextWindow)}`
      ));
    } else {
      block.append(emptyRow('上下文', '本回合尚无数据'));
    }

    const quota = tool.quota;
    if (quota && (quota.primary || quota.secondary)) {
      if (quota.primary) block.append(meterRow('5 小时', quota.primary.usedPercent, formatReset(quota.primary.resetsAt)));
      if (quota.secondary) block.append(meterRow('本周', quota.secondary.usedPercent, formatReset(quota.secondary.resetsAt)));
    } else {
      block.append(emptyRow('额度', tool.tool === 'claude' ? '未接入状态栏上报' : '暂无数据'));
    }
    return block;
  });
  peekElement.replaceChildren(...blocks);
}

function renderUsage() {
  for (const tool of tools) {
    if (tool.state === 'running') sawRunning.add(tool.tool);
  }
  // 主进程按固定顺序给出工具：第一个占左耳，第二个占右耳。
  renderEar(ears.left, metrics.leftEar ? tools[0] : null);
  renderEar(ears.right, metrics.rightEar ? tools[1] : null);
  renderPeek();
}

function acknowledgeAll() {
  for (const tool of tools) acknowledged.set(tool.tool, tool.updatedAt);
  renderEar(ears.left, metrics.leftEar ? tools[0] : null);
  renderEar(ears.right, metrics.rightEar ? tools[1] : null);
}

function clearTimer(timer) {
  if (timer) clearTimeout(timer);
  return null;
}

// 先让形状一帧到位，再在下一帧恢复过渡，避免从上一种窗口尺寸的形状滑过来。
function snapShape(apply) {
  root.classList.add('no-anim');
  apply();
  void shell.offsetWidth;
  requestAnimationFrame(() => root.classList.remove('no-anim'));
}

function openShell(contentClass) {
  root.classList.remove('show-peek', 'show-alert');
  root.classList.add(contentClass);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.add('is-open'));
  });
}

// 收回形状，播完后回调（transitionend 丢失时由定时器兜底）。
function closeShell(done) {
  shrinkTimer = clearTimer(shrinkTimer);
  shrinkDone = () => {
    shrinkTimer = clearTimer(shrinkTimer);
    shrinkDone = null;
    root.classList.remove('show-peek', 'show-alert');
    done();
  };
  if (!root.classList.contains('is-open')) {
    shrinkDone();
    return;
  }
  root.classList.remove('is-open');
  shrinkTimer = setTimeout(() => shrinkDone && shrinkDone(), SHRINK_FALLBACK_MS);
}

shell.addEventListener('transitionend', (event) => {
  if (event.target !== shell || event.propertyName !== 'clip-path') return;
  if (shrinkDone && !root.classList.contains('is-open')) shrinkDone();
});

function applyLayout(next) {
  const previousMode = metrics.mode;
  metrics = next && typeof next === 'object' ? next : { mode: 'hidden' };
  const style = document.documentElement.style;
  style.setProperty('--center-x', px(metrics.centerX));
  style.setProperty('--core-w', px(metrics.coreWidth));
  style.setProperty('--menubar-h', px(metrics.menuBarHeight));
  style.setProperty('--ear-w', px(metrics.earWidth));
  style.setProperty('--left-ear-w', px(metrics.leftEar ? metrics.earWidth : 0));
  style.setProperty('--right-ear-w', px(metrics.rightEar ? metrics.earWidth : 0));
  root.dataset.mode = metrics.mode;
  renderUsage();

  if (metrics.mode === 'live' || metrics.mode === 'hidden') {
    peekRequested = false;
    openTimer = clearTimer(openTimer);
    closeTimer = clearTimer(closeTimer);
    snapShape(() => root.classList.remove('is-open', 'show-peek', 'show-alert'));
    return;
  }
  if (metrics.mode === 'peek') {
    if (previousMode !== 'peek') {
      snapShape(() => root.classList.remove('is-open'));
      openShell('show-peek');
    }
    return;
  }
  // alert：内容由 task-notification:show 驱动，这里只保证形状从收起态起步。
  peekRequested = false;
  if (previousMode !== 'alert' && previousMode !== 'peek') snapShape(() => root.classList.remove('is-open'));
}

// ---------- 悬停明细 ----------

async function requestPeek() {
  openTimer = null;
  if (metrics.mode !== 'live' || peekRequested || alertVisible || tools.length === 0) return;
  peekRequested = true;
  acknowledgeAll();
  const granted = await api.peek(true, peekElement.offsetHeight);
  if (!granted) peekRequested = false;
}

function dismissPeek() {
  closeTimer = null;
  if (metrics.mode !== 'peek') return;
  // 窗口刚放大时可能补发一次 pointerleave；鼠标其实还在岛上就不收。
  if (root.matches(':hover')) return;
  closeShell(() => {
    peekRequested = false;
    api.peek(false, 0);
  });
}

root.addEventListener('pointerenter', () => {
  closeTimer = clearTimer(closeTimer);
  if (metrics.mode === 'live' && !openTimer) openTimer = setTimeout(requestPeek, HOVER_OPEN_MS);
});

root.addEventListener('pointerleave', () => {
  openTimer = clearTimer(openTimer);
  if (metrics.mode === 'peek' && !closeTimer) closeTimer = setTimeout(dismissPeek, HOVER_CLOSE_MS);
});

function openPanel() {
  openTimer = clearTimer(openTimer);
  acknowledgeAll();
  api.openPanel();
}

ears.left.addEventListener('click', openPanel);
ears.right.addEventListener('click', openPanel);
peekElement.addEventListener('click', openPanel);
// 耳朵之间那段正对着物理刘海 / 折叠条，点它同样是「展开面板」。
shell.addEventListener('click', () => {
  if (metrics.mode === 'live' || metrics.mode === 'peek') openPanel();
});

// ---------- 提醒 ----------

function firstText(values, fallback) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function readQueueCount(value) {
  const count = Number(value && typeof value === 'object' ? value.pendingCount ?? value.count : value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(MAX_QUEUE_COUNT, Math.floor(count));
}

function setQueueCount(value) {
  const count = readQueueCount(value);
  alertQueue.textContent = `+${count}`;
  alertQueue.hidden = count === 0;
}

function reportAlertHover(hovering) {
  if (alertHovering === hovering) return;
  alertHovering = hovering;
  api.taskNotificationHover(hovering);
}

function showAlert(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const sourceKey = firstText([data.source], 'task').toLowerCase();
  const project = firstText([data.project], '');

  alertEventId = data.eventId ?? null;
  alertVisible = true;
  alertHiding = false;
  shrinkTimer = clearTimer(shrinkTimer);
  shrinkDone = null;

  alertTitle.textContent = firstText([data.title], '任务已完成');
  alertSource.textContent = SOURCE_NAMES[sourceKey] || '任务';
  alertDetail.textContent = firstText(
    [data.detail],
    sourceKey === 'todo' ? '将在 1 小时内截止' : project ? `已完成 · ${project}` : '已完成，可以查看了'
  );
  alertElement.dataset.source = sourceKey;
  alertElement.tabIndex = 0;
  setQueueCount(data.pendingCount);
  openShell('show-alert');
}

function hideAlert(eventId) {
  if (!alertVisible || alertHiding) return;
  if (eventId !== undefined && eventId !== null) alertEventId = eventId;
  alertHiding = true;
  reportAlertHover(false);
  closeShell(() => {
    alertVisible = false;
    alertHiding = false;
    alertElement.tabIndex = -1;
    api.taskNotificationDismissed(alertEventId);
  });
}

alertElement.addEventListener('pointerenter', () => reportAlertHover(true));
alertElement.addEventListener('pointerleave', () => reportAlertHover(false));
alertElement.addEventListener('click', async () => {
  if (!alertVisible || alertHiding) return;
  if (api.platform !== 'win32') {
    try { await api.activateTaskNotification(alertEventId); } catch (error) {}
  }
  hideAlert(alertEventId);
});
alertElement.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  hideAlert(alertEventId);
});

window.addEventListener('blur', () => reportAlertHover(false));

api.onLayout(applyLayout);
api.onUsage((usage) => {
  tools = usage && Array.isArray(usage.tools) ? usage.tools : [];
  renderUsage();
});
api.onTaskNotification(showAlert);
api.onTaskNotificationQueue(setQueueCount);
api.onTaskNotificationHide(hideAlert);
