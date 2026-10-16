"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('TCLVNative', Object.freeze({
  platform: 'windows',
  stopExternal: () => ipcRenderer.invoke('stop-external-player'),
  openExternal: (player, url) => ipcRenderer.invoke('open-external-player', { player, url }),
}));
