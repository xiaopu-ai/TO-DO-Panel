'use strict';

// 物理刘海的真实宽度。Electron 不暴露 NSScreen.auxiliaryTopLeftArea / auxiliaryTopRightArea，
// 这里用 osascript 的 ObjC 桥读一次（不需要任何 TCC 权限，约 100ms，异步、不阻塞主线程），
// 结果按 CGDirectDisplayID 缓存；Electron 的 display.id 在 macOS 上就是这个值。

const { execFile } = require('node:child_process');

const NOTCH_JXA = `
ObjC.import('AppKit');
function run() {
  var out = [];
  var screens = $.NSScreen.screens;
  for (var i = 0; i < screens.count; i++) {
    var s = screens.objectAtIndex(i);
    var left = s.auxiliaryTopLeftArea, right = s.auxiliaryTopRightArea;
    out.push({
      id: ObjC.unwrap(s.deviceDescription.objectForKey('NSScreenNumber')),
      width: s.frame.size.width,
      left: left.size.width,
      right: right.size.width,
      height: left.size.height
    });
  }
  return JSON.stringify(out);
}
`;

// 两侧辅助区都存在且合起来比屏幕窄，才说明中间真的被刘海挡住了。
function parseNotchScreens(stdout) {
  let rows;
  try {
    rows = JSON.parse(String(stdout || '').trim());
  } catch (error) {
    return new Map();
  }
  const result = new Map();
  if (!Array.isArray(rows)) return result;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = Number(row.id);
    const width = Number(row.width);
    const left = Number(row.left);
    const right = Number(row.right);
    if (!Number.isFinite(id) || !Number.isFinite(width)) continue;
    const notchWidth = left > 0 && right > 0 ? Math.round(width - left - right) : 0;
    result.set(id, {
      hasNotch: notchWidth > 0 && notchWidth < width / 2,
      notchWidth: notchWidth > 0 && notchWidth < width / 2 ? notchWidth : 0,
      notchHeight: Math.max(0, Math.round(Number(row.height) || 0)),
    });
  }
  return result;
}

function createNotchGeometry({ platform = process.platform, fallbackWidth = 200, onChange = () => {} } = {}) {
  let cache = new Map();
  let loading = false;

  function refresh() {
    if (platform !== 'darwin' || loading) return;
    loading = true;
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', NOTCH_JXA],
      { timeout: 4000 },
      (error, stdout) => {
        loading = false;
        if (error) return;
        const next = parseNotchScreens(stdout);
        if (next.size === 0) return;
        const changed = JSON.stringify([...next]) !== JSON.stringify([...cache]);
        cache = next;
        if (changed) onChange();
      }
    );
  }

  return {
    refresh,
    // 岛体中间必须让出的宽度：有刘海用真实刘海宽，没有刘海（外接屏 / 未取到）用折叠条宽度。
    coreWidth(display) {
      const entry = display ? cache.get(Number(display.id)) : null;
      return entry && entry.hasNotch ? entry.notchWidth : fallbackWidth;
    },
    hasNotch(display) {
      const entry = display ? cache.get(Number(display.id)) : null;
      return Boolean(entry && entry.hasNotch);
    },
  };
}

module.exports = { parseNotchScreens, createNotchGeometry };
