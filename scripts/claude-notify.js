#!/usr/bin/env node
'use strict';

// Claude Code Stop 钩子：把「任务已完成」转发给刘海面板的本地接收服务。
// 覆盖终端 CLI、VS Code / JetBrains 插件与桌面端——三者共用同一份 CLI 内核，
// 所以只要 ~/.claude/settings.json 注册了 Stop 钩子，本脚本就会被调用。
// 钩子必须静默失败：任何异常都不能阻塞 Claude 结束回合。

const fs = require('node:fs');
const http = require('node:http');

const NOTCH_HOST = '127.0.0.1';
const NOTCH_PORT = 43821;
const REQUEST_TIMEOUT_MS = 900;
const STDIN_TIMEOUT_MS = 1500;
// 只回读记录文件尾部，避免长会话把整份 JSONL 读进内存。
const TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const TRANSCRIPT_RETRIES = 3;
const TRANSCRIPT_RETRY_DELAY_MS = 120;

function exitQuietly() {
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    timer.unref();
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

// 从 JSONL 尾部往前找最后一条主线助手文本消息。
function lastAssistantMessage(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return '';
  let handle;
  try {
    handle = fs.openSync(transcriptPath, 'r');
  } catch (error) {
    return '';
  }
  try {
    const size = fs.fstatSync(handle).size;
    if (!size) return '';
    const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
    const buffer = Buffer.allocUnsafe(length);
    fs.readSync(handle, buffer, 0, length, size - length);
    const lines = buffer.toString('utf8').split('\n');
    // 截断读取时首行可能不完整，JSON.parse 失败会被跳过。
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (error) {
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      if (entry.type !== 'assistant') continue;
      // 子代理记录写在同一份文件里，isSidechain 标记它们不属于主线。
      if (entry.isSidechain === true || entry.isMeta === true) continue;
      const text = textFromContent(entry.message && entry.message.content);
      if (text) return text;
    }
    return '';
  } catch (error) {
    return '';
  } finally {
    try { fs.closeSync(handle); } catch (error) {}
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function post(payload) {
  return new Promise((resolve) => {
    let body;
    try {
      body = Buffer.from(JSON.stringify(payload));
    } catch (error) {
      resolve();
      return;
    }
    const request = http.request({
      hostname: NOTCH_HOST,
      port: NOTCH_PORT,
      path: '/notify/claude',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, (response) => {
      response.resume();
      response.on('end', resolve);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy());
    request.on('error', () => resolve());
    request.on('close', resolve);
    request.end(body);
  });
}

async function main() {
  // 云端 / Web 会话里 127.0.0.1 不是这台 Mac，直接放弃。
  if (String(process.env.CLAUDE_CODE_REMOTE || '').toLowerCase() === 'true') return;

  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch (error) {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};

  // 子代理结束不该弹提醒，主进程也会再过滤一次。
  if (payload.agent_id) return;

  let title = '';
  for (let attempt = 0; attempt < TRANSCRIPT_RETRIES; attempt += 1) {
    title = lastAssistantMessage(payload.transcript_path);
    if (title) break;
    // 记录文件是异步落盘的，钩子可能跑在最后一条消息写入之前。
    await sleep(TRANSCRIPT_RETRY_DELAY_MS);
  }

  await post({
    source: 'claude',
    session_id: typeof payload.session_id === 'string' ? payload.session_id : '',
    cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
    last_assistant_message: title,
  });
}

main().then(exitQuietly, exitQuietly);
