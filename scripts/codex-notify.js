#!/usr/bin/env node
'use strict';

const http = require('node:http');
const { spawn } = require('node:child_process');

// Computer Use 客户端按 CODEX_HOME 推导，不写死单机路径（脚本会随 DMG 分发给其他人）。
// 没装 Computer Use 时下面的 spawn 会静默失败，只影响它自己的通知，不影响本面板。
const path = require('node:path');
const os = require('node:os');

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const SKY_CLIENT = process.env.CODEX_COMPUTER_USE_CLIENT || path.join(
  CODEX_HOME,
  'computer-use',
  'Codex Computer Use.app',
  'Contents',
  'SharedSupport',
  'SkyComputerUseClient.app',
  'Contents',
  'MacOS',
  'SkyComputerUseClient'
);
const NOTCH_HOST = '127.0.0.1';
const NOTCH_PORT = 43821;
const REQUEST_TIMEOUT_MS = 900;

const rawPayload = process.argv.length > 2 ? process.argv[process.argv.length - 1] : '{}';

// 保留 Codex 原来的 Computer Use 通知，不改变现有行为。
try {
  const child = spawn(SKY_CLIENT, ['turn-ended', rawPayload], {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', () => {});
  child.unref();
} catch (error) {
  // 通知钩子必须静默失败，不能影响 Codex 回合结束。
}

let payload;
try {
  payload = JSON.parse(rawPayload);
} catch (error) {
  payload = { title: 'Codex 已完成任务', detail: String(rawPayload || '') };
}
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  payload = { title: 'Codex 已完成任务' };
}

const body = Buffer.from(JSON.stringify(payload));
const request = http.request({
  hostname: NOTCH_HOST,
  port: NOTCH_PORT,
  path: '/notify/codex',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length,
  },
}, (response) => response.resume());

request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy());
request.on('error', () => {});
request.end(body);
