"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, session, Menu } = require("electron");

const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function getIconPath() {
  const ico = path.join(__dirname, "..", "..", "assets", "icon.png");
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#000000",
    title: "TCLVPlayer",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      details.requestHeaders["User-Agent"] = BROWSER_USER_AGENT;
      if (!details.requestHeaders["Referer"]) {
        try {
          const u = new URL(details.url);
          details.requestHeaders["Referer"] = u.origin + "/";
        } catch {}
      }
      delete details.requestHeaders["Origin"];
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const headers = details.responseHeaders || {};
      headers["Access-Control-Allow-Origin"] = ["*"];
      headers["Access-Control-Allow-Headers"] = ["*"];
      headers["Access-Control-Allow-Methods"] = ["*"];
      delete headers["x-frame-options"];
      delete headers["X-Frame-Options"];
      callback({ responseHeaders: headers });
    }
  );

  const packagedWeb = path.join(__dirname, "..", "..", "dist", "web", "index.html");
  const sourceWeb = path.join(__dirname, "..", "..", "index.html");
  mainWindow.loadFile(fs.existsSync(packagedWeb) ? packagedWeb : sourceWeb);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
