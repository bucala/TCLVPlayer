import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../native/electron/main.js', import.meta.url), 'utf8');
function desktop() {
  const handlers = new Map();
  const web = Object.assign(new EventEmitter(), { id: 1, mainFrame: { url: 'file:///app/dist/web/index.html' }, setWindowOpenHandler: vi.fn() });
  const window = { webContents: web, loadFile: vi.fn(), isDestroyed: () => false };
  const child = new EventEmitter(); child.kill = vi.fn();
  const execFile = vi.fn().mockImplementation(() => child);
  const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), webRequest: { onBeforeSendHeaders: vi.fn(), onHeadersReceived: vi.fn() } };
  const electron = { app: { commandLine: { appendSwitch: vi.fn() }, requestSingleInstanceLock: () => true, whenReady: () => ({ then: fn => fn() }), on: vi.fn(), quit: vi.fn() },
    BrowserWindow: function() { return window; }, session: { defaultSession: session }, Menu: { setApplicationMenu: vi.fn() }, ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, dialog: {} };
  vm.runInNewContext(source, { __dirname: '/app/native/electron', process: { platform: 'win32', env: { TCLV_VLC_PATH: 'C:/Players/vlc.exe' } }, URL, require: name => name === 'electron' ? electron : name === 'node:child_process' ? { execFile } : require(name) });
  const event = { sender: web, senderFrame: web.mainFrame };
  return { handlers, event, web, child, execFile, session };
}
describe('desktop boundary and external playback', () => {
  it('rejects external process requests from a subframe or another renderer', async () => {
    const { handlers, event } = desktop(); const open = handlers.get('open-external-player');
    await expect(open({ ...event, senderFrame: {} }, { player: 'vlc', url: 'https://media.example/live' })).rejects.toThrow('Untrusted');
  });
  it('confirms spawn and honours configured executable path with separate URL arguments', async () => {
    const { handlers, event, child, execFile } = desktop();
    const result = handlers.get('open-external-player')(event, { player: 'vlc', url: 'https://media.example/live?token=fixture' });
    child.emit('spawn'); await expect(result).resolves.toEqual({ started: true });
    expect(execFile.mock.calls[0][0]).toBe('C:/Players/vlc.exe');
    expect(execFile.mock.calls[0][1]).toEqual(['--', 'https://media.example/live?token=fixture']);
  });
  it('returns a launch error instead of falsely reporting playback success', async () => {
    const { handlers, event, child } = desktop();
    const result = handlers.get('open-external-player')(event, { player: 'vlc', url: 'https://media.example/live' });
    child.emit('error', new Error('ENOENT')); await expect(result).rejects.toThrow('VLC/mpv');
  });
  it('denies popups and remote navigation', () => {
    const { web } = desktop();
    expect(web.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' });
    const event = { preventDefault: vi.fn() }; web.emit('will-navigate', event, 'https://other.example'); expect(event.preventDefault).toHaveBeenCalled();
  });
});
