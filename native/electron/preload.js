"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("TCLVNative", {
  platform: "windows",
  openExternal: function(player, url) {
    ipcRenderer.send("open-external-player", { player: player, url: url });
  },
});
