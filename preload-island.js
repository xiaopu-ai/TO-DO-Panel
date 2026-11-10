const { contextBridge, ipcRenderer } = require('electron');

// 灵动岛窗口的专用桥：只暴露岛自己需要的通道。
// 主面板的 preload 带着密钥、剪贴板、文件读写等全部能力，岛窗口不应该拿到它们。
function subscribe(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('islandAPI', {
  platform: process.platform,
  onLayout: (cb) => subscribe('island:layout', (event, metrics) => cb(metrics)),
  onUsage: (cb) => subscribe('island:usage', (event, usage) => cb(usage)),
  peek: (open, height) => ipcRenderer.invoke('island:peek', { open: open === true, height }),
  openPanel: () => ipcRenderer.send('island:open-panel'),
  onTaskNotification: (cb) =>
    subscribe('task-notification:show', (event, notification) => cb(notification)),
  onTaskNotificationQueue: (cb) =>
    subscribe('task-notification:queue', (event, count) => cb(count)),
  onTaskNotificationHide: (cb) =>
    subscribe('task-notification:hide', (event, eventId) => cb(eventId)),
  taskNotificationDismissed: (eventId) =>
    ipcRenderer.send('task-notification:dismissed', eventId),
  activateTaskNotification: (eventId) =>
    ipcRenderer.invoke('task-notification:activate', eventId),
  taskNotificationHover: (paused) =>
    ipcRenderer.send('task-notification:hover', paused === true),
});
