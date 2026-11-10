const { contextBridge, ipcRenderer } = require('electron');

// 权限引导窗口的专用桥：只有查询、发起授权、重启与关闭四类动作。
contextBridge.exposeInMainWorld('permissionsAPI', {
  getStatus: () => ipcRenderer.invoke('permissions:status'),
  request: (id) => ipcRenderer.invoke('permissions:request', String(id || '')),
  relaunch: () => ipcRenderer.send('permissions:relaunch'),
  close: (options) => ipcRenderer.send('permissions:close', { skip: Boolean(options && options.skip) }),
});
