#!/usr/bin/env node
'use strict';

// Claude Code 状态栏脚本（可选）：把状态栏输入里的额度（rate_limits）转发给 TO-DO Panel。
// Claude 的会话记录里只有上下文占用、没有 5 小时 / 每周额度，额度只出现在状态栏输入里，
// 所以想在灵动岛上看到 Claude 额度，需要在 ~/.claude/settings.json 注册本脚本：
//
//   "statusLine": { "type": "command", "command": "node \"<应用路径>/scripts/claude-statusline.js\"" }
//
// 注意：状态栏只在终端 CLI 里运行；仅使用桌面端时不会触发，岛上会显示「未接入状态栏上报」。
// 脚本必须静默失败，并始终输出一行状态栏文本。

const http = require('node:http');

const HOST = '127.0.0.1';
const PORT = 43821;
const TIMEOUT_MS = 600;

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    const chunks = [];
    const finish = () => resolve(Buffer.concat(chunks).toString('utf8'));
    const timer = setTimeout(finish, 1000);
    timer.unref();
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

function post(payload) {
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify(payload));
    const request = http.request({
      hostname: HOST,
      port: PORT,
      path: '/usage/claude',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (response) => {
      response.resume();
      response.on('end', resolve);
    });
    request.setTimeout(TIMEOUT_MS, () => request.destroy());
    request.on('error', resolve);
    request.on('close', resolve);
    request.end(body);
  });
}

function percent(value) {
  const number = Number(value && value.used_percentage);
  return Number.isFinite(number) ? `${Math.round(number)}%` : '';
}

async function main() {
  let input = {};
  try { input = JSON.parse(await readStdin()) || {}; } catch (error) {}
  const limits = input.rate_limits && typeof input.rate_limits === 'object' ? input.rate_limits : null;
  const parts = [];
  if (input.model && input.model.display_name) parts.push(String(input.model.display_name));
  const context = percent(input.context_window);
  if (context) parts.push(`上下文 ${context}`);
  if (limits) {
    const fiveHour = percent(limits.five_hour);
    const sevenDay = percent(limits.seven_day);
    if (fiveHour) parts.push(`5h ${fiveHour}`);
    if (sevenDay) parts.push(`7d ${sevenDay}`);
  }
  process.stdout.write(`${parts.join(' · ')}\n`);
  if (limits && String(process.env.CLAUDE_CODE_REMOTE || '').toLowerCase() !== 'true') {
    await post({ rate_limits: limits });
  }
}

main().then(() => process.exit(0), () => process.exit(0));
