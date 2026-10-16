"use strict";
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, session, Menu, ipcMain, dialog } = require('electron');
const { execFile } = require('node:child_process');
const WEB_ROOT = path.resolve(__dirname, '../../dist/web');
const APP_URL = pathToFileURL(path.join(WEB_ROOT, 'index.html')).href;
const players = new Map();
const browserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!app.requestSingleInstanceLock()) app.quit();
let mainWindow;
function trusted(event) { return event.sender === mainWindow?.webContents && event.senderFrame === mainWindow.webContents.mainFrame && event.senderFrame.url === APP_URL; }
function configureSession() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'fullscreen'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'fullscreen');
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (details.webContentsId !== mainWindow?.webContents.id) return callback({ requestHeaders: details.requestHeaders });
    details.requestHeaders['User-Agent'] = browserAgent;
    callback({ requestHeaders: details.requestHeaders });
  });
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    const headers = details.responseHeaders || {};
    if (details.webContentsId === mainWindow?.webContents.id && ['xhr', 'media'].includes(details.resourceType)) {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === 'access-control-allow-origin') delete headers[key];
      headers['Access-Control-Allow-Origin'] = ['*'];
    }
    callback({ responseHeaders: headers });
  });
}
function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({ width: 1360, height: 820, minWidth: 800, minHeight: 520,
    backgroundColor: '#000000', title: 'TCLVPlayer', icon: path.resolve(__dirname, '../../assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false,
      sandbox: true, backgroundThrottling: false, webSecurity: true, navigateOnDragDrop: false } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) event.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog.showMessageBox(mainWindow, { type: 'error', message: 'Prehrávač bol ukončený. Obnoviť aplikáciu?', buttons: ['Obnoviť', 'Zavrieť'] }).then(({ response }) => response === 0 ? mainWindow.reload() : mainWindow.close());
  });
  mainWindow.loadFile(path.join(WEB_ROOT, 'index.html'));
}
ipcMain.handle('stop-external-player', async event => { if (!trusted(event)) throw new Error('Untrusted caller'); for (const child of players.values()) child.kill(); players.clear(); });
ipcMain.handle('open-external-player', async (event, data) => {
  if (!trusted(event)) throw new Error('Untrusted caller');
  if (!data || !['mpv', 'vlc'].includes(data.player)) throw new Error('Unsupported player');
  let url; try { url = new URL(data.url); } catch { throw new Error('Invalid stream URL'); }
  if (!['http:', 'https:', 'rtsp:', 'rtsps:', 'rtmp:', 'rtmps:'].includes(url.protocol)) throw new Error('Unsupported protocol');
  const command = process.env[data.player === 'mpv' ? 'TCLV_MPV_PATH' : 'TCLV_VLC_PATH'] || data.player;
  const previous = players.get(data.player); if (previous && !previous.killed) previous.kill();
  return new Promise((resolve, reject) => {
    const child = execFile(command, data.player === 'mpv' ? ['--force-window', '--', url.href] : ['--', url.href], { windowsHide: false });
    child.once('error', () => reject(new Error('Prehrávač sa nepodarilo spustiť. Skontrolujte inštaláciu a cestu k VLC/mpv.')));
    child.once('spawn', () => { players.set(data.player, child); resolve({ started: true }); });
    child.once('exit', () => { if (players.get(data.player) === child) players.delete(data.player); });
  });
});
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
app.whenReady().then(() => { configureSession(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { for (const child of players.values()) child.kill(); });
// No provider URLs or playlists are persisted outside Electron userData.
