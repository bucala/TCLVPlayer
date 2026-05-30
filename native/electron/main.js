"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { app, BrowserWindow, ipcMain } = require("electron");

const playerExecutables = {
  mpv: process.env.TCLV_MPV_PATH || "mpv",
  vlc: process.env.TCLV_VLC_PATH || "vlc",
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#191b1f",
    title: "TCLVPlayer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const packagedWeb = path.join(__dirname, "..", "..", "dist", "web", "index.html");
  const sourceWeb = path.join(__dirname, "..", "..", "index.html");
  mainWindow.loadFile(fs.existsSync(packagedWeb) ? packagedWeb : sourceWeb);
}

function validateStreamUrl(url) {
  const value = String(url || "").trim();
  if (!/^(https?|rtsp|rtmp|file):/i.test(value)) {
    throw new Error("Unsupported stream URL.");
  }
  return value;
}

ipcMain.handle("tclv:open-external-player", async (_event, payload) => {
  const player = String(payload?.player || "").toLowerCase();
  const executable = playerExecutables[player];
  if (!executable) {
    throw new Error("Unsupported player.");
  }

  const streamUrl = validateStreamUrl(payload?.url);
  const child = spawn(executable, [streamUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  return {
    ok: true,
    player,
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
