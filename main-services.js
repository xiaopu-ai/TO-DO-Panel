const net = require('net');
const path = require('path');

function isPrivateAddress(address) {
  const value = String(address || '').trim().toLowerCase().split('%', 1)[0];
  if (!value) return true;
  if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7));
  const version = net.isIP(value);
  if (version === 4) {
    const parts = value.split('.').map(Number);
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] >= 224
    );
  }
  if (version === 6) {
    return (
      value === '::' ||
      value === '::1' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      /^fe[89ab]/.test(value) ||
      value.startsWith('ff')
    );
  }
  return true;
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    laquo: '«',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    raquo: '»',
  };
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : match;
  });
}

function extractMetaContent(html, key) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (!property || property[1].toLowerCase() !== key.toLowerCase()) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (content) return content[1];
  }
  return '';
}

function cleanTitle(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function extractPageTitle(html, fallback) {
  const ogTitle = extractMetaContent(html, 'og:title');
  const titleMatch = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return cleanTitle(ogTitle || (titleMatch && titleMatch[1]) || fallback) || String(fallback || '未命名链接');
}

function extractFaviconHref(html) {
  const tags = String(html || '').match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    if (!rel || !/(?:^|\s)(?:shortcut\s+)?icon(?:\s|$)/i.test(rel[1])) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (href && href[1]) return decodeHtmlEntities(href[1].trim());
  }
  return '';
}

function parseSmartMaterialMetadata(value) {
  const source = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch (error) { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const clean = (text, limit) => Array.from(String(text || '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()).slice(0, limit).join('');
  return { title: clean(parsed.title, 48), category: clean(parsed.category, 24) };
}

function selectTranscriptionSettings(current, legacy) {
  const currentSettings = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  if (Object.keys(currentSettings).length) return currentSettings;
  return legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy : {};
}

function recordingExtension(mimeType) {
  const mime = String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
  if (mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a') return 'm4a';
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'wav';
  return 'webm';
}

function normalizeWindowRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, order) => {
      const pid = Math.max(0, Math.round(Number(row && row.pid) || 0));
      const windowIndex = Math.max(0, Math.round(Number(row && row.windowIndex) || 0));
      const windowNumber = Math.max(0, Math.round(Number(row && row.windowNumber) || 0));
      const appName = String(row && row.appName || '').trim();
      const title = String(row && row.title || '').replace(/\s+/g, ' ').trim();
      const candidatePath = String(row && row.appPath || '').trim();
      const appPath = path.isAbsolute(candidatePath) && candidatePath.endsWith('.app') ? candidatePath : '';
      if (!pid || !appName || !title) return null;
      return {
        id: windowNumber ? `window-${pid}-${windowNumber}` : `window-${pid}-${windowIndex}-${order}`,
        pid,
        windowIndex,
        windowNumber,
        appName,
        appPath,
        title: title.slice(0, 240),
      };
    })
    .filter(Boolean)
    // 同一进程下标题完全相同的窗口只保留最前面那条：CGWindowList 按前后顺序返回，
    // 首条就是最靠前的那个。实测微信只开一个窗口却会返回两条同名记录（窗口号不同），
    // 界面上就成了两个「微信」。而聚焦是按标题匹配的，重复条目永远指向同一个窗口，
    // 留着也点不出第二个结果。标题不同的多窗口（如 VS Code 各工作区）不受影响。
    .filter((item, index, list) => list.findIndex(
      (other) => other.pid === item.pid && other.title === item.title
    ) === index);
}

function todoReminderState(todo, now = Date.now(), leadMs = 60 * 60 * 1000) {
  if (!todo || typeof todo !== 'object') return { state: 'invalid', delayMs: 0 };
  if (todo.done === true) return { state: 'done', delayMs: 0 };
  if (Number(todo.remindedAt) > 0) return { state: 'notified', delayMs: 0 };
  const deadline = Date.parse(String(todo.deadline || ''));
  const current = Number(now);
  if (!Number.isFinite(deadline) || !Number.isFinite(current)) return { state: 'invalid', delayMs: 0 };
  if (current > deadline) return { state: 'expired', delayMs: 0 };
  const triggerAt = deadline - Math.max(0, Number(leadMs) || 0);
  if (current >= triggerAt) return { state: 'due', delayMs: 0 };
  return { state: 'scheduled', delayMs: triggerAt - current };
}

function firstPayloadText(payload, keys) {
  for (const key of keys) {
    const value = payload && payload[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value);
    }
  }
  return '';
}

function cleanTaskLine(value, maxLength) {
  const line = String(value || '').split(/\r?\n/).map((item) => item.trim()).find(Boolean) || '';
  const cleaned = line
    .replace(/^[#>*`_~\-\s]+/, '')
    .replace(/[`*_~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, maxLength).join('');
}

const TASK_NOTIFICATION_FALLBACK_TITLES = {
  codex: 'Codex 已完成任务',
  claude: 'Claude 已完成任务',
  gpt: 'GPT 已完成任务',
};

function taskNotificationIdentity(payload, source = 'task') {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const cwd = firstPayloadText(data, ['cwd', 'working_directory', 'working-directory']);
  const project = cleanTaskLine(
    firstPayloadText(data, ['project', 'project_name', 'project-name', 'projectName'])
      || (cwd && path.isAbsolute(cwd) ? path.basename(path.normalize(cwd)) : ''),
    48
  );
  const concreteTitle = firstPayloadText(data, [
    'last_assistant_message',
    'last-assistant-message',
    'lastAssistantMessage',
    'task_title',
    'task-title',
    'taskTitle',
    'task_name',
    'task-name',
    'taskName',
    'last_user_message',
    'last-user-message',
    'lastUserMessage',
    'prompt',
    'user_prompt',
    'user-prompt',
    'userPrompt',
    'message',
    'title',
  ]);
  return {
    project,
    title: cleanTaskLine(concreteTitle, 120)
      || TASK_NOTIFICATION_FALLBACK_TITLES[source]
      || '任务已完成',
  };
}

function normalizeCredentialInput(value, id, createdAt) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const service = String(value.service || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const account = String(value.account || '').trim().slice(0, 320);
  const password = typeof value.password === 'string' ? value.password.slice(0, 4096) : '';
  if (!service || !account || !password) return null;
  return {
    id: String(id || value.id || `credential-${Date.now().toString(36)}`),
    service,
    account,
    password,
    createdAt: Number.isFinite(createdAt) ? createdAt : Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function parseSmartLinkMetadata(value) {
  const source = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch (error) { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const clean = (text, limit) => Array.from(String(text || '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()).slice(0, limit).join('');
  return {
    title: clean(parsed.title, 80),
    category: clean(parsed.category, 14),
  };
}

// 剪贴板默认关闭（DEFAULT_FEATURES.clip = false），关着就不该轮询系统剪贴板。
// 原实现收了 features 却完全不用，恒定返回 recordHistory: true，于是无论用户有没有
// 在菜单栏打开这个功能，主进程都在每 500ms 读一次粘贴板——剪贴板里躺着大图时
// （实测一张截图 1.9MB PNG + 6.9MB Photoshop 数据）主进程空转就能吃掉三成 CPU，
// 面板展开和拖拽都会明显卡顿。
// 全局快捷键始终不注册：原 Cmd+Shift+V 已撤销，app:open-clip 仅由菜单栏驱动。
function clipboardServicePolicy(features) {
  const source = features && typeof features === 'object' && !Array.isArray(features) ? features : {};
  return {
    recordHistory: source.clip === true,
    registerGlobalShortcut: false,
  };
}

function createWorkspacePersistenceGate() {
  let lastSignature = null;
  const signatureFor = (storage, destination = '') => {
    if (!storage || typeof storage !== 'object' || Array.isArray(storage)) return null;
    return JSON.stringify([
      String(destination || ''),
      Object.keys(storage).sort().map((key) => [key, storage[key]]),
    ]);
  };
  return {
    shouldWrite(storage, destination = '') {
      const signature = signatureFor(storage, destination);
      return signature !== null && signature !== lastSignature;
    },
    markWritten(storage, destination = '') {
      const signature = signatureFor(storage, destination);
      if (signature !== null) lastSignature = signature;
    },
  };
}

function hoverSpacePollingPolicy({ shortcut, visible, mode } = {}) {
  return {
    enabled: shortcut === 'Space' && visible === true && mode === 'collapsed',
    intervalMs: 60,
  };
}

const CONFIGURABLE_FEATURES = new Set(['todo', 'notes', 'links', 'recordings', 'credentials', 'clip']);

function updateFeaturePreference(features, featureId, enabled) {
  if (!CONFIGURABLE_FEATURES.has(featureId) || typeof enabled !== 'boolean') return null;
  const source = features && typeof features === 'object' && !Array.isArray(features) ? features : {};
  return { ...source, [featureId]: enabled, home: true };
}

// 汽水音乐没有「控制 / 播放」菜单，辅助功能树也读不出窗口与菜单项名，
// 所以只能往应用内发按键。Space(49) 是播放/暂停切换键，play 与 pause 共用它。
// 原实现里 play 用的是 Cmd+Right——那和 next 完全同一个键，
// 所以「点播放」实际发出的是「下一曲」，歌不会开始播，这正是状态错乱的根因。
function sodaShortcutSpec(action) {
  if (action === 'play' || action === 'pause') return { keyCode: 49, command: false, dismissOverlays: true };
  if (action === 'next') return { keyCode: 124, command: true, dismissOverlays: true };
  if (action === 'previous') return { keyCode: 123, command: true, dismissOverlays: true };
  return null;
}

async function controlSodaMusic(action, dependencies = {}, currentPlaying = false) {
  if (!['play', 'pause', 'next', 'previous'].includes(action)) {
    return { ok: false, error: 'invalid_action', running: false, playing: false };
  }

  const isRunning = dependencies.isRunning;
  const launch = dependencies.launch;
  const sendShortcut = dependencies.sendShortcut;
  const sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  if (![isRunning, launch, sendShortcut].every((dependency) => typeof dependency === 'function')) {
    return { ok: false, error: 'music_control_unavailable', running: false, playing: false };
  }

  let running = await isRunning();
  let bootstrapped = false;
  if (!running) {
    if (action !== 'play') return { ok: false, error: 'no_active_session', running: false, playing: false };
    const launched = await launch();
    if (!launched) return { ok: false, error: 'launch_failed', running: false, playing: false };
    for (let attempt = 0; attempt < 30; attempt += 1) {
      running = await isRunning();
      if (running) break;
      await sleep(200);
    }
    if (!running) return { ok: false, error: 'launch_failed', running: false, playing: false };
    bootstrapped = true;
    await sleep(3000);
  }

  const shortcutResult = await sendShortcut(action);
  if (!shortcutResult || shortcutResult.ok !== true) {
    return {
      ok: false,
      error: shortcutResult && shortcutResult.error || 'soda_control_failed',
      running: true,
      playing: Boolean(currentPlaying),
    };
  }
  const playing = action === 'pause' ? false : true;
  return { ok: true, running: true, playing, bootstrapped };
}

module.exports = {
  isPrivateAddress,
  decodeHtmlEntities,
  extractPageTitle,
  extractFaviconHref,
  recordingExtension,
  normalizeWindowRows,
  todoReminderState,
  taskNotificationIdentity,
  normalizeCredentialInput,
  parseSmartLinkMetadata,
  parseSmartMaterialMetadata,
  selectTranscriptionSettings,
  clipboardServicePolicy,
  createWorkspacePersistenceGate,
  hoverSpacePollingPolicy,
  updateFeaturePreference,
  sodaShortcutSpec,
  controlSodaMusic,
};
