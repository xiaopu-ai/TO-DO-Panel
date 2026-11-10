'use strict';

const api = window.permissionsAPI;
const list = document.getElementById('permissions-list');
const summary = document.getElementById('permissions-summary');
const relaunchNote = document.getElementById('permissions-relaunch-note');
const relaunchButton = document.getElementById('permissions-relaunch');
const doneButton = document.getElementById('permissions-done');
const skipInput = document.getElementById('permissions-skip');

const POLL_MS = 1000; // 用户在系统设置里拨开关后，这里一秒内跟着变
const SVG_NS = 'http://www.w3.org/2000/svg';

let lastSignature = '';
let initialStates = null;
let busyId = '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function checkIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'm3.5 8.5 3 3 6-7');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function renderItem(item) {
  const row = element('li', 'permission');
  row.dataset.id = item.id;
  row.dataset.state = item.state;

  const copy = element('div');
  const title = element('div', 'permission-title');
  title.append(element('span', '', item.title));
  if (!item.required) title.append(element('span', 'permission-tag', '可选'));
  copy.append(title, element('p', 'permission-reason', item.reason));

  let trailing;
  if (item.state === 'granted') {
    trailing = element('span', 'permission-status');
    trailing.append(checkIcon(), element('span', '', '已开启'));
  } else {
    trailing = element('button', 'button', item.actionLabel);
    trailing.type = 'button';
    trailing.dataset.action = item.id;
    trailing.disabled = busyId === item.id;
    trailing.setAttribute('aria-label', `${item.actionLabel}：${item.title}`);
  }
  row.append(copy, trailing);
  return row;
}

function render(items) {
  // 列表每秒轮询一次；状态没变就不动 DOM，否则键盘焦点会被每秒重置。
  const signature = JSON.stringify(items.map((item) => [item.id, item.state])) + busyId;
  if (signature === lastSignature) return;
  lastSignature = signature;

  const focusedAction = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.action
    : '';
  list.replaceChildren(...items.map(renderItem));
  if (focusedAction) {
    const next = list.querySelector(`[data-action="${focusedAction}"]`);
    if (next) next.focus();
    else doneButton.focus();
  }

  const missing = items.filter((item) => item.required && item.state !== 'granted');
  summary.textContent = missing.length === 0
    ? '必需的权限都已开启。可选项可以等用到对应功能时再开。'
    : `还差 ${missing.length} 项必需权限。点击右侧按钮会直接跳到系统设置里对应的那一页。`;

  if (!initialStates) initialStates = new Map(items.map((item) => [item.id, item.state]));
  const needsRelaunch = items.some((item) => (
    item.needsRelaunch && item.state === 'granted' && initialStates.get(item.id) !== 'granted'
  ));
  relaunchNote.hidden = !needsRelaunch;
  relaunchButton.hidden = !needsRelaunch;
}

async function refresh() {
  try {
    render(await api.getStatus());
  } catch (error) {
    // 窗口关闭过程中 IPC 可能已断开，忽略。
  }
}

list.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || busyId) return;
  busyId = button.dataset.action;
  button.disabled = true;
  try {
    await api.request(busyId);
  } finally {
    busyId = '';
    lastSignature = '';
    await refresh();
  }
});

relaunchButton.addEventListener('click', () => api.relaunch());
doneButton.addEventListener('click', () => api.close({ skip: skipInput.checked }));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') api.close({ skip: skipInput.checked });
});

refresh();
setInterval(refresh, POLL_MS);
// 从系统设置切回来的那一刻立即刷新，不等下一个轮询周期。
window.addEventListener('focus', refresh);
