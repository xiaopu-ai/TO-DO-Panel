'use strict';

// 音乐播放器适配层。首页的音乐组件此前写死了「汽水音乐」，没装它的用户只能看到一块
// 「未安装」的死瓷砖。这里把「用哪个播放器」和「怎么控制它」拆开：
//
//   识别  扫描应用目录，按应用名匹配已知播放器（不写死安装路径）。
//   选择  用户指定的优先；「自动」时先选正在运行的，再按固定顺序选已安装的。
//         macOS 自带 Apple Music，所以总有一个可用的兜底。
//   控制  三种策略——
//         script      Apple Music / Spotify 有 AppleScript 接口：精确控制，还能读到曲名与播放状态
//         media-keys  其余播放器发系统媒体键（播放 / 上一首 / 下一首），不抢焦点
//         soda-keys   汽水音乐沿用原方案：切到前台后发应用内快捷键
//
// 纯函数与文件系统 / 进程访问分开，后者经依赖注入，便于单测。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 顺序即「自动」模式下的优先级：国内常用的在前，系统自带的 Apple Music 垫底。
const KNOWN_PLAYERS = [
  { id: 'soda', name: '汽水音乐', pattern: /^汽水音乐$/, strategy: 'soda-keys' },
  { id: 'netease', name: '网易云音乐', pattern: /^(NeteaseMusic|网易云音乐)$/i, strategy: 'media-keys' },
  { id: 'qq', name: 'QQ音乐', pattern: /^(QQMusic|QQ音乐)$/i, strategy: 'media-keys' },
  { id: 'kugou', name: '酷狗音乐', pattern: /^(KugouMusic|Kugou|酷狗音乐|酷狗)$/i, strategy: 'media-keys' },
  { id: 'kuwo', name: '酷我音乐', pattern: /^(KuwoMusic|Kuwo|酷我音乐|酷我)$/i, strategy: 'media-keys' },
  { id: 'spotify', name: 'Spotify', pattern: /^Spotify$/i, strategy: 'script' },
  { id: 'apple', name: 'Apple Music', pattern: /^Music$/, strategy: 'script', systemOnly: true },
];

const PLAYER_IDS = new Set(KNOWN_PLAYERS.map((player) => player.id));
const MEDIA_KEYS = { play: 16, pause: 16, next: 17, previous: 18 };
const SCAN_TTL_MS = 30000;

function normalizeMusicPreference(value) {
  return typeof value === 'string' && PLAYER_IDS.has(value) ? value : 'auto';
}

// entries: [{ dir, name }]，name 是不带 .app 的应用名。
function matchInstalledPlayers(entries, systemDir = '/System/Applications') {
  const found = [];
  for (const player of KNOWN_PLAYERS) {
    const entry = (Array.isArray(entries) ? entries : []).find((item) => (
      item
      && typeof item.name === 'string'
      && player.pattern.test(item.name)
      // 「Music」这个名字太普通：只认系统目录里的那个，避免把别的同名应用当成 Apple Music。
      && (!player.systemOnly || item.dir === systemDir)
    ));
    if (entry) {
      found.push({
        id: player.id,
        name: player.name,
        strategy: player.strategy,
        // 这些都是 macOS 路径；用 posix 拼接，测试在 Windows 上跑时结果也一致。
        appPath: path.posix.join(entry.dir, `${entry.name}.app`),
      });
    }
  }
  return found;
}

// 选哪个：用户指定且仍然装着 → 用它；否则正在运行的优先（那才是用户此刻在用的），
// 再否则按 KNOWN_PLAYERS 的顺序取第一个已安装的。
function choosePlayer(installed, preference, runningIds = []) {
  const list = Array.isArray(installed) ? installed : [];
  if (list.length === 0) return null;
  const preferred = list.find((player) => player.id === preference);
  if (preferred) return preferred;
  const running = new Set(runningIds);
  return list.find((player) => running.has(player.id)) || list[0];
}

function escapeForPgrep(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SCRIPT_PLAYER_JXA = `
function run(argv) {
  var app = Application(argv[0]);
  var action = String(argv[1] || 'status');
  // running() 不会把应用拉起来；下面的命令会，所以没在运行就直接返回。
  if (!app.running()) return JSON.stringify({ running: false });
  if (action === 'play' || action === 'pause') app.playpause();
  else if (action === 'next') app.nextTrack();
  else if (action === 'previous') app.previousTrack();
  if (action !== 'status') delay(0.3);
  var state = '', title = '', artist = '';
  try { state = String(app.playerState()); } catch (e) {}
  try { title = String(app.currentTrack.name() || ''); } catch (e) {}
  try { artist = String(app.currentTrack.artist() || ''); } catch (e) {}
  return JSON.stringify({ running: true, playing: state === 'playing', title: title, artist: artist });
}`;

const MEDIA_KEY_JXA = `
ObjC.import('Cocoa');
function run(argv) {
  var key = Number(argv[0]);
  if (!(key >= 16 && key <= 18)) return 'invalid';
  function post(down) {
    var state = down ? 0xa : 0xb;
    var event = $.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(
      14, $.NSMakePoint(0, 0), state << 8, 0, 0, $(), 8, (key << 16) | (state << 8), -1
    );
    $.CGEventPost(0, event.CGEvent);
  }
  post(true);
  post(false);
  return 'ok';
}`;

function parseScriptStatus(stdout) {
  try {
    const value = JSON.parse(String(stdout || '').trim());
    if (!value || typeof value !== 'object') return null;
    return {
      running: value.running === true,
      playing: value.playing === true,
      title: typeof value.title === 'string' ? value.title.slice(0, 120) : '',
      artist: typeof value.artist === 'string' ? value.artist.slice(0, 120) : '',
    };
  } catch (error) {
    return null;
  }
}

function createMusicPlayers(dependencies = {}) {
  const execFile = dependencies.execFile;
  const runJxa = dependencies.runJxa;
  const now = typeof dependencies.now === 'function' ? dependencies.now : Date.now;
  const systemDir = dependencies.systemDir || '/System/Applications';
  const appDirs = dependencies.appDirs
    || ['/Applications', path.join(os.homedir(), 'Applications'), systemDir];
  const readDir = dependencies.readDir
    || ((dir) => fs.promises.readdir(dir).catch(() => []));

  let scan = { at: 0, players: [] };

  async function listInstalled(force = false) {
    if (!force && scan.at && now() - scan.at < SCAN_TTL_MS) return scan.players;
    const entries = [];
    for (const dir of appDirs) {
      for (const name of await readDir(dir)) {
        if (typeof name === 'string' && name.endsWith('.app')) entries.push({ dir, name: name.slice(0, -4) });
      }
    }
    scan = { at: now(), players: matchInstalledPlayers(entries, systemDir) };
    return scan.players;
  }

  function isRunning(player) {
    return new Promise((resolve) => {
      if (!player || typeof execFile !== 'function') return resolve(false);
      execFile(
        '/usr/bin/pgrep',
        ['-f', `^${escapeForPgrep(player.appPath)}/Contents/MacOS/`],
        { timeout: 1500 },
        (error) => resolve(!error)
      );
    });
  }

  async function resolve(preference) {
    const installed = await listInstalled();
    const normalized = normalizeMusicPreference(preference);
    if (installed.length === 0) return { installed, player: null, running: false };
    // 用户已指定且仍安装时不必逐个探测运行状态。
    const preferred = installed.find((player) => player.id === normalized);
    if (preferred) return { installed, player: preferred, running: await isRunning(preferred) };
    const states = await Promise.all(installed.map(isRunning));
    const runningIds = installed.filter((player, index) => states[index]).map((player) => player.id);
    const player = choosePlayer(installed, normalized, runningIds);
    return { installed, player, running: runningIds.includes(player.id) };
  }

  function launch(player) {
    return new Promise((resolve) => {
      if (!player || typeof execFile !== 'function') return resolve(false);
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      env.XPC_SERVICE_NAME = '0';
      execFile('/usr/bin/open', [player.appPath], { timeout: 4000, env }, (error) => resolve(!error));
    });
  }

  // 只对 script 策略有意义：读真实的播放状态与曲目。
  async function readScriptStatus(player) {
    if (!player || player.strategy !== 'script' || typeof runJxa !== 'function') return null;
    try {
      return parseScriptStatus(await runJxa(SCRIPT_PLAYER_JXA, [player.appPath, 'status']));
    } catch (error) {
      return null;
    }
  }

  async function sendScriptCommand(player, action) {
    try {
      const status = parseScriptStatus(await runJxa(SCRIPT_PLAYER_JXA, [player.appPath, action]));
      if (!status || !status.running) return { ok: false, error: 'music_control_failed' };
      return { ok: true, status };
    } catch (error) {
      // -1743：用户在系统的「自动化」授权框里点了不允许。
      const denied = /-1743|not authori[sz]ed/i.test(String(error && error.message || error));
      return { ok: false, error: denied ? 'automation_permission_required' : 'music_control_failed' };
    }
  }

  async function sendMediaKey(action) {
    const key = MEDIA_KEYS[action];
    if (!key) return { ok: false, error: 'invalid_action' };
    try {
      return (await runJxa(MEDIA_KEY_JXA, [key])) === 'ok'
        ? { ok: true }
        : { ok: false, error: 'music_control_failed' };
    } catch (error) {
      return { ok: false, error: 'music_control_failed' };
    }
  }

  return {
    listInstalled,
    isRunning,
    resolve,
    launch,
    readScriptStatus,
    sendScriptCommand,
    sendMediaKey,
    invalidate() { scan = { at: 0, players: [] }; },
  };
}

module.exports = {
  KNOWN_PLAYERS,
  MEDIA_KEYS,
  normalizeMusicPreference,
  matchInstalledPlayers,
  choosePlayer,
  parseScriptStatus,
  createMusicPlayers,
};
