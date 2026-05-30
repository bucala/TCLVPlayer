"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("TCLVNative", {
  platform: "windows",
  openExternalPlayer(payload) {
    return ipcRenderer.invoke("tclv:open-external-player", payload);
  },
});
