"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("TCLVNative", {
  platform: "windows",
});
