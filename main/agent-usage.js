'use strict';

// AI 编码工具用量监控：只读 Codex / Claude Code 自己落在本机的会话记录，
// 不装钩子、不调任何网络接口、不碰凭证。
//
//   Codex   ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
//           event_msg.token_count 自带上下文窗口与 5 小时 / 每周额度，
//           task_started / task_complete 给出运行状态。
//   Claude  ~/.claude/projects/<项目>/<会话>.jsonl
//           主线 assistant 消息的 usage 给出上下文占用；记录里没有额度，
//           额度只能由状态栏脚本（scripts/claude-statusline.js）经本地端口上报。
//
// 解析函数全部是纯函数，方便单测；文件系统访问集中在 createAgentUsageMonitor。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TAIL_BYTES = 512 * 1024; // Claude 单行可达 200KB+，尾部读少了会连一条完整记录都拿不到
const POLL_MS = 2000;
const DISCOVER_MS = 10000;
const RUNNING_STALE_MS = 15 * 60 * 1000; // 记录停在「运行中」但超过这么久没写入，视为已中断
const SESSION_VISIBLE_MS = 12 * 60 * 60 * 1000; // 超过半天没动的会话不再占用岛
const CLAUDE_DEFAULT_WINDOW = 200000;
const CLAUDE_EXTENDED_WINDOW = 1000000;
const CLAUDE_QUOTA_STALE_MS = 6 * 60 * 60 * 1000;
// 监控自己发现的完成只对「跑了一阵子」的回合提醒：几秒钟的一问一答用户本来就盯着，
// 每条都从刘海弹一次只会让人把提醒关掉。时长读不出来时按长回合处理（宁可多提醒）。
const MIN_ALERT_TURN_MS = 30 * 1000;

function parseJsonLines(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    try {
      const row = JSON.parse(trimmed);
      if (row && typeof row === 'object') rows.push(row);
    } catch (error) {
      // 尾部截断读取时首行通常不完整，跳过即可。
    }
  }
  return rows;
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
}

function positiveInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function projectName(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return '';
  return path.basename(path.normalize(cwd.trim())).slice(0, 48);
}

function firstLine(text, maxLength = 120) {
  const line = String(text || '').split('\n').map((part) => part.trim()).find(Boolean) || '';
  return line.replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeQuotaWindow(value, nowMs) {
  if (!value || typeof value !== 'object') return null;
  const usedPercent = clampPercent(value.used_percent ?? value.used_percentage ?? value.usedPercent);
  if (usedPercent === null) return null;
  const rawReset = Number(value.resets_at ?? value.resetsAt);
  // 两家都用 Unix 秒；兼容毫秒与 ISO 字符串。
  let resetsAt = 0;
  if (Number.isFinite(rawReset) && rawReset > 0) resetsAt = rawReset < 1e12 ? rawReset * 1000 : rawReset;
  else if (typeof (value.resets_at ?? value.resetsAt) === 'string') {
    resetsAt = Date.parse(value.resets_at ?? value.resetsAt) || 0;
  }
  // 窗口已经重置而记录还是旧值：用量归零比显示一个过期的高水位更接近事实。
  if (resetsAt && nowMs && resetsAt <= nowMs) return { usedPercent: 0, resetsAt: 0, stale: true };
  return { usedPercent, resetsAt, stale: false };
}

function parseCodexSession(text, options = {}) {
  const nowMs = options.nowMs || Date.now();
  const rows = parseJsonLines(text);
  const session = {
    tool: 'codex',
    state: 'idle',
    contextTokens: 0,
    contextWindow: 0,
    contextPercent: null,
    quota: null,
    project: '',
    title: '',
    model: '',
    turnId: '',
    completedTurnId: '',
    turnDurationMs: null,
  };
  for (const row of rows) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    if (row.type === 'session_meta' || row.type === 'turn_context') {
      if (payload.cwd) session.project = projectName(payload.cwd);
      if (typeof payload.model === 'string') session.model = payload.model;
      continue;
    }
    if (row.type !== 'event_msg') continue;
    if (payload.type === 'task_started') {
      session.state = 'running';
      session.turnId = String(payload.turn_id || '');
      session.contextWindow = positiveInt(payload.model_context_window) || session.contextWindow;
    } else if (payload.type === 'task_complete') {
      session.state = 'done';
      session.completedTurnId = String(payload.turn_id || '');
      session.title = firstLine(payload.last_agent_message);
      session.turnDurationMs = Number.isFinite(Number(payload.duration_ms)) ? Number(payload.duration_ms) : null;
    } else if (payload.type === 'turn_aborted' || payload.type === 'error') {
      session.state = 'idle';
    } else if (payload.type === 'token_count') {
      const info = payload.info && typeof payload.info === 'object' ? payload.info : {};
      const last = info.last_token_usage && typeof info.last_token_usage === 'object'
        ? info.last_token_usage
        : {};
      session.contextTokens = positiveInt(last.total_tokens)
        || positiveInt(last.input_tokens) + positiveInt(last.output_tokens)
        || session.contextTokens;
      session.contextWindow = positiveInt(info.model_context_window) || session.contextWindow;
      const limits = payload.rate_limits && typeof payload.rate_limits === 'object'
        ? payload.rate_limits
        : null;
      if (limits) {
        session.quota = {
          primary: normalizeQuotaWindow(limits.primary, nowMs),
          secondary: normalizeQuotaWindow(limits.secondary, nowMs),
          plan: typeof limits.plan_type === 'string' ? limits.plan_type : '',
        };
      }
    }
  }
  if (session.contextWindow > 0 && session.contextTokens > 0) {
    session.contextPercent = clampPercent((session.contextTokens / session.contextWindow) * 100);
  }
  return session;
}

function claudeMessageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function isClaudeToolResult(row) {
  const content = row.message && row.message.content;
  return Array.isArray(content) && content.some((block) => block && block.type === 'tool_result');
}

function parseClaudeSession(text) {
  const rows = parseJsonLines(text);
  let turnStartedAt = 0;
  const session = {
    tool: 'claude',
    state: 'idle',
    contextTokens: 0,
    contextWindow: CLAUDE_DEFAULT_WINDOW,
    contextPercent: null,
    quota: null,
    project: '',
    title: '',
    model: '',
    turnId: '',
    completedTurnId: '',
    turnDurationMs: null,
  };
  for (const row of rows) {
    // 子代理与元记录写在同一份文件里，不代表主线进度。
    if (row.isSidechain === true || row.isMeta === true) continue;
    if (row.cwd) session.project = projectName(row.cwd);
    const message = row.message && typeof row.message === 'object' ? row.message : null;
    if (row.type === 'user' && message) {
      session.state = 'running';
      if (!isClaudeToolResult(row)) {
        session.turnId = String(row.uuid || '');
        turnStartedAt = Date.parse(row.timestamp) || 0;
      }
    } else if (row.type === 'assistant' && message) {
      const usage = message.usage && typeof message.usage === 'object' ? message.usage : null;
      if (usage) {
        const tokens = positiveInt(usage.input_tokens)
          + positiveInt(usage.cache_creation_input_tokens)
          + positiveInt(usage.cache_read_input_tokens)
          + positiveInt(usage.output_tokens);
        if (tokens > 0) session.contextTokens = tokens;
      }
      if (typeof message.model === 'string' && message.model !== '<synthetic>') session.model = message.model;
      const stop = message.stop_reason;
      if (stop === 'end_turn' || stop === 'stop_sequence' || stop === 'refusal') {
        session.state = 'done';
        session.completedTurnId = session.turnId || String(row.uuid || '');
        session.title = firstLine(claudeMessageText(message.content)) || session.title;
        const endedAt = Date.parse(row.timestamp) || 0;
        session.turnDurationMs = turnStartedAt && endedAt >= turnStartedAt ? endedAt - turnStartedAt : null;
      } else {
        session.state = 'running';
      }
    }
  }
  // 记录里不写窗口大小：超过 20 万必然是长上下文档位，否则按标准窗口算。
  if (/\[1m\]/i.test(session.model) || session.contextTokens > CLAUDE_DEFAULT_WINDOW) {
    session.contextWindow = CLAUDE_EXTENDED_WINDOW;
  }
  if (session.contextTokens > 0) {
    session.contextPercent = clampPercent((session.contextTokens / session.contextWindow) * 100);
  }
  return session;
}

// 把「记录里的状态」折算成「此刻的状态」：写到一半就被杀掉的会话永远停在 running。
function effectiveState(session, mtimeMs, nowMs) {
  if (session.state === 'running' && nowMs - mtimeMs > RUNNING_STALE_MS) return 'idle';
  return session.state;
}

// 状态栏脚本上报的 Claude 额度（Claude Code 状态栏输入里的 rate_limits）。
function normalizeClaudeStatusline(payload, nowMs = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const limits = payload.rate_limits && typeof payload.rate_limits === 'object' ? payload.rate_limits : null;
  if (!limits) return null;
  const primary = normalizeQuotaWindow(limits.five_hour, nowMs);
  const secondary = normalizeQuotaWindow(limits.seven_day, nowMs);
  if (!primary && !secondary) return null;
  return { primary, secondary, plan: '', receivedAt: nowMs };
}

function pickSession(sessions, nowMs) {
  const visible = sessions.filter((item) => nowMs - item.mtimeMs <= SESSION_VISIBLE_MS);
  if (visible.length === 0) return null;
  const running = visible.filter((item) => item.state === 'running');
  const pool = running.length > 0 ? running : visible;
  const latest = pool.reduce((best, item) => (item.mtimeMs > best.mtimeMs ? item : best));
  return { ...latest, runningCount: running.length };
}

function publicSession(session) {
  if (!session) return null;
  return {
    tool: session.tool,
    state: session.state,
    runningCount: session.runningCount || 0,
    contextTokens: session.contextTokens,
    contextWindow: session.contextWindow,
    contextPercent: session.contextPercent,
    quota: session.quota,
    project: session.project,
    model: session.model,
    updatedAt: Math.round(session.mtimeMs),
  };
}

async function readTail(filePath, size) {
  const length = Math.min(size, TAIL_BYTES);
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

async function listDir(dir) {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

async function recentFiles(files, nowMs) {
  const rows = [];
  for (const filePath of files) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (nowMs - stat.mtimeMs <= SESSION_VISIBLE_MS) rows.push({ filePath, mtimeMs: stat.mtimeMs });
    } catch (error) {
      // 文件在枚举后被删掉，忽略。
    }
  }
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 6).map((row) => row.filePath);
}

async function discoverCodexFiles(root, nowMs) {
  // 目录按日期分层；跨午夜的长会话落在开始那天，所以多看两天。
  const files = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date(nowMs - offset * 86400000);
    const dir = path.join(
      root,
      String(day.getFullYear()),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0')
    );
    for (const entry of await listDir(dir)) {
      if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) files.push(path.join(dir, entry.name));
    }
  }
  return recentFiles(files, nowMs);
}

async function discoverClaudeFiles(root, nowMs) {
  const files = [];
  for (const project of await listDir(root)) {
    if (!project.isDirectory()) continue;
    const dir = path.join(root, project.name);
    // 目录 mtime 在新建会话文件时才变；这里仍需逐个 stat 文件，但只在低频的发现阶段做。
    for (const entry of await listDir(dir)) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path.join(dir, entry.name));
    }
  }
  return recentFiles(files, nowMs);
}

function createAgentUsageMonitor(options = {}) {
  const home = options.home || os.homedir();
  const codexRoot = options.codexRoot || path.join(home, '.codex', 'sessions');
  const claudeRoot = options.claudeRoot || path.join(home, '.claude', 'projects');
  const onSnapshot = typeof options.onSnapshot === 'function' ? options.onSnapshot : () => {};
  const onCompletion = typeof options.onCompletion === 'function' ? options.onCompletion : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;

  const tracked = new Map(); // filePath -> { tool, mtimeMs, size, session, primed }
  let files = { codex: [], claude: [] };
  let claudeQuota = null;
  let timer = null;
  let lastDiscoverAt = 0;
  let busy = false;
  let lastSerialized = '';
  let snapshot = { codex: null, claude: null, updatedAt: 0 };

  async function refreshFile(filePath, tool, nowMs) {
    let stat;
    try {
      stat = await fs.promises.stat(filePath);
    } catch (error) {
      tracked.delete(filePath);
      return;
    }
    const previous = tracked.get(filePath);
    if (previous && previous.mtimeMs === stat.mtimeMs && previous.size === stat.size) {
      previous.session.state = effectiveState(previous.raw, stat.mtimeMs, nowMs);
      return;
    }
    let text;
    try {
      text = await readTail(filePath, stat.size);
    } catch (error) {
      return;
    }
    const raw = tool === 'codex' ? parseCodexSession(text, { nowMs }) : parseClaudeSession(text);
    const session = { ...raw, state: effectiveState(raw, stat.mtimeMs, nowMs), mtimeMs: stat.mtimeMs };
    // 只报本进程启动之后才出现的完成：首次读到的历史完成只登记、不上报。
    // 以回合 id 而非「上一轮是否 running」判断，短回合整个落在两次轮询之间也不会漏。
    if (
      previous
      && session.state === 'done'
      && session.completedTurnId
      && session.completedTurnId !== previous.reportedTurnId
      && !(Number.isFinite(session.turnDurationMs) && session.turnDurationMs < MIN_ALERT_TURN_MS)
    ) {
      onCompletion({
        source: tool,
        sessionId: path.basename(filePath, '.jsonl'),
        turnId: session.completedTurnId,
        title: session.title,
        project: session.project,
      });
    }
    tracked.set(filePath, {
      tool,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      raw,
      session,
      reportedTurnId: session.state === 'done' ? session.completedTurnId : (previous?.reportedTurnId || ''),
    });
  }

  function buildSnapshot(nowMs) {
    const byTool = { codex: [], claude: [] };
    for (const [filePath, entry] of tracked) {
      if (!files[entry.tool].includes(filePath)) {
        tracked.delete(filePath);
        continue;
      }
      byTool[entry.tool].push(entry.session);
    }
    const codex = publicSession(pickSession(byTool.codex, nowMs));
    const claude = publicSession(pickSession(byTool.claude, nowMs));
    if (claude && claudeQuota && nowMs - claudeQuota.receivedAt <= CLAUDE_QUOTA_STALE_MS) {
      claude.quota = {
        primary: claudeQuota.primary,
        secondary: claudeQuota.secondary,
        plan: claudeQuota.plan,
      };
    }
    return { codex, claude };
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const nowMs = now();
      if (nowMs - lastDiscoverAt >= DISCOVER_MS) {
        lastDiscoverAt = nowMs;
        const [codex, claude] = await Promise.all([
          discoverCodexFiles(codexRoot, nowMs),
          discoverClaudeFiles(claudeRoot, nowMs),
        ]);
        files = { codex, claude };
      }
      await Promise.all([
        ...files.codex.map((filePath) => refreshFile(filePath, 'codex', nowMs)),
        ...files.claude.map((filePath) => refreshFile(filePath, 'claude', nowMs)),
      ]);
      const next = buildSnapshot(nowMs);
      const serialized = JSON.stringify(next);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        snapshot = { ...next, updatedAt: nowMs };
        onSnapshot(snapshot);
      }
    } catch (error) {
      // 监控是旁路功能，任何读盘异常都不能影响面板本身。
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(tick, POLL_MS);
      if (typeof timer.unref === 'function') timer.unref();
      void tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      tracked.clear();
      files = { codex: [], claude: [] };
      lastDiscoverAt = 0;
      lastSerialized = '';
      snapshot = { codex: null, claude: null, updatedAt: 0 };
    },
    isRunning: () => Boolean(timer),
    getSnapshot: () => snapshot,
    setClaudeQuota(payload) {
      const quota = normalizeClaudeStatusline(payload, now());
      if (!quota) return false;
      claudeQuota = quota;
      lastSerialized = ''; // 强制下一轮推送
      return true;
    },
    tick,
  };
}

module.exports = {
  parseJsonLines,
  parseCodexSession,
  parseClaudeSession,
  normalizeQuotaWindow,
  normalizeClaudeStatusline,
  effectiveState,
  pickSession,
  createAgentUsageMonitor,
  RUNNING_STALE_MS,
  SESSION_VISIBLE_MS,
  MIN_ALERT_TURN_MS,
};
