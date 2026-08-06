// ScholarFlow preload:向渲染进程暴露安全的桌面 API(自动更新)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  checkUpdate: () => ipcRenderer.invoke('sf:check-update'),
  downloadUpdate: (url) => ipcRenderer.invoke('sf:download-update', url),
  restart: () => ipcRenderer.invoke('sf:quit-restart')
});