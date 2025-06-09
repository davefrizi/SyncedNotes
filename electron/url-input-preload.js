const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadNote: (url) => ipcRenderer.invoke('load-note', url),
  cancel: () => ipcRenderer.invoke('cancel-input'),
  minimize: () => ipcRenderer.invoke('url-window-minimize'),
  clearSaved: () => ipcRenderer.invoke('clear-saved')
});