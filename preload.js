const { contextBridge, ipcRenderer } = require('electron');

// 所有 on* 订阅统一经此注册，并回传退订函数：渲染层若重新初始化，
// 不退订就会叠加监听器，同一条通知被回调多次。
function subscribe(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('notchAPI', {
  setMode: (mode) => ipcRenderer.invoke('window:set-mode', mode),
  beginCollapse: () => ipcRenderer.invoke('window:begin-collapse'),
  setTab: (tab) => ipcRenderer.invoke('window:set-tab', tab),
  ensureCamera: () => ipcRenderer.invoke('media:camera'),
  ensureMicrophone: () => ipcRenderer.invoke('media:microphone'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  openPrivacySettings: (pane) => ipcRenderer.invoke('shell:open-privacy-settings', pane),
  getMusicStatus: () => ipcRenderer.invoke('music:status'),
  controlMusic: (action) => ipcRenderer.invoke('music:control', action),
  inspectLink: (url) => ipcRenderer.invoke('links:inspect', url),
  listWindows: () => ipcRenderer.invoke('windows:list'),
  focusWindow: (windowId) => ipcRenderer.invoke('windows:focus', windowId),
  saveRecording: (payload) => ipcRenderer.invoke('recordings:save', payload),
  readRecording: (audioPath) => ipcRenderer.invoke('recordings:read', audioPath),
  deleteRecording: (audioPath) => ipcRenderer.invoke('recordings:delete', audioPath),
  revealRecording: (audioPath) => ipcRenderer.invoke('recordings:reveal', audioPath),
  organizeMaterial: (payload) => ipcRenderer.invoke('smart:organize-material', payload),
  listCredentials: () => ipcRenderer.invoke('credentials:list'),
  getCredential: (id) => ipcRenderer.invoke('credentials:get', id),
  saveCredential: (payload) => ipcRenderer.invoke('credentials:save', payload),
  deleteCredentials: (ids) => ipcRenderer.invoke('credentials:delete-many', ids),
  copyCredential: (id, field) => ipcRenderer.invoke('credentials:copy', { id, field }),
  getTranscriptionConfig: () => ipcRenderer.invoke('transcription:get-config'),
  setTranscriptionConfig: (config) => ipcRenderer.invoke('transcription:set-config', config),
  startTranscription: () => ipcRenderer.invoke('transcription:start'),
  sendTranscriptionAudio: (bytes) => ipcRenderer.send('transcription:audio', bytes),
  finishTranscription: () => ipcRenderer.invoke('transcription:finish'),
  onTranscriptionEvent: (cb) => subscribe('transcription:event', (event, payload) => cb(payload)),
  listTaskCompletions: () => ipcRenderer.invoke('tasks:recent'),
  scheduleTodoReminders: (items) => ipcRenderer.invoke('todos:schedule-reminders', items),
  notifyPomodoro: (minutes) => ipcRenderer.invoke('pomodoro:notify', minutes),
  onTodoReminder: (cb) => subscribe('todo:reminded', (event, payload) => cb(payload)),
  onEscape: (cb) => subscribe('key:escape', () => cb()),
  onToggleShortcut: (cb) => subscribe('shortcut:toggle-panel', () => cb()),
  getHoverSpaceStatus: () => ipcRenderer.invoke('shortcut:hover-space-status'),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  setFeature: (featureId, enabled) => ipcRenderer.invoke('settings:set-feature', { featureId, enabled }),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('settings:set-auto-launch', enabled === true),
  setPanelShortcut: (accelerator) => ipcRenderer.invoke('settings:set-shortcut', accelerator),
  onAppSettingsChanged: (cb) => subscribe('settings:changed', (event, settings) => cb(settings)),
  onRecordShortcut: (cb) => subscribe('app:record-shortcut', () => cb()),
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),
  loadWorkspaceData: () => ipcRenderer.invoke('workspace:load-data'),
  saveWorkspaceData: (storage) => ipcRenderer.invoke('workspace:save-data', storage),
  openWorkspace: () => ipcRenderer.invoke('workspace:open'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  onWorkspaceChanged: (cb) => subscribe('workspace:changed', (event, info) => cb(info)),
  onCollapseRequest: (cb) => subscribe('window:request-collapse', () => cb()),
  getMetrics: () => ipcRenderer.invoke('window:metrics'),
  onMetricsChanged: (cb) =>
    subscribe('window:metrics-changed', (event, metrics) => cb(metrics)),
  writeClipboard: (entry) => ipcRenderer.invoke('clipboard:write', entry),
  pasteClipboard: (entry) => ipcRenderer.invoke('clipboard:paste', entry),
  readClipImage: (imagePath) => ipcRenderer.invoke('clipboard:readImage', imagePath),
  deleteClipImages: (paths) => ipcRenderer.invoke('clipboard:deleteImages', paths),
  onNewClipEntry: (cb) => subscribe('clipboard:new-entry', (evt, entry) => cb(entry)),
  onOpenClip: (cb) => subscribe('app:open-clip', () => cb()),
  onOpenApiSettings: (cb) => subscribe('app:open-api-settings', () => cb()),
  getMirrorImage: () => ipcRenderer.invoke('mirror:get-image'),
  chooseMirrorImage: () => ipcRenderer.invoke('mirror:choose-image'),
  onMirrorImageChanged: (cb) => subscribe('mirror:image-changed', (event, dataUrl) => cb(dataUrl)),
  onTaskNotification: (cb) =>
    subscribe('task-notification:show', (event, notification) => cb(notification)),
  onTaskNotificationQueue: (cb) =>
    subscribe('task-notification:queue', (event, count) => cb(count)),
  onTaskNotificationHide: (cb) =>
    subscribe('task-notification:hide', (event, eventId) => cb(eventId)),
  onTaskCompletion: (cb) =>
    subscribe('task-completion:new', (event, notification) => cb(notification)),
  taskNotificationDismissed: (eventId) =>
    ipcRenderer.send('task-notification:dismissed', eventId),
  activateTaskNotification: (eventId) =>
    ipcRenderer.invoke('task-notification:activate', eventId),
  taskNotificationHover: (paused) =>
    ipcRenderer.send('task-notification:hover', paused === true),
});
