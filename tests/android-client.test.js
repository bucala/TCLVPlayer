import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../lib/android-player.js', import.meta.url), 'utf8');
function client() {
  const listeners = new Map();
  const plugin = { addListener: async (name, listener) => listeners.set(name, listener), nativeBounds: vi.fn().mockResolvedValue({}),
    nativeReady: vi.fn().mockResolvedValue({ ready: true }), playNative: vi.fn().mockResolvedValue({}), controlNative: vi.fn().mockResolvedValue({}) };
  const root = { Capacitor: { Plugins: { TCLVPlayer: plugin } }, addEventListener: vi.fn() };
  const context = vm.createContext({ ...root, document: { addEventListener: vi.fn(), documentElement: {} },
    ResizeObserver: class { observe() {} }, MutationObserver: class { observe() {} },
    requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame: vi.fn(), setTimeout });
  vm.runInContext(source, context);
  const host = { slot: { getBoundingClientRect: () => ({ left: 20, top: 60, width: 800, height: 450 }) },
    settings: { hidden: true }, detail: { hidden: true }, locked: () => false, nativeChosen: () => true, onState: vi.fn(), onUnlock: vi.fn() };
  return { api: context.TCLVAndroidPlayer, plugin, listeners, host };
}
describe('Android media session lifecycle', () => {
  it('reattaches an already-playing foreground session after Activity recreation', async () => {
    const { api, plugin, listeners, host } = client(); await api.install(host);
    listeners.get('playbackState')({ hasMedia: true, playing: true, id: 'fixture' });
    expect(api.active).toBe(true); expect(host.onState).toHaveBeenCalledWith({ hasMedia: true, playing: true, id: 'fixture' });
    expect(plugin.nativeBounds).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true, width: 800 }));
  });
  it('cancels a pending native start when another player stops it', async () => {
    const { api, plugin, host } = client(); await api.install(host);
    let ready; plugin.nativeReady.mockImplementation(() => new Promise(resolve => { ready = resolve; }));
    const pending = api.start({ id: 'fixture' }, [], 'fixture'); api.stop(); ready({ ready: true }); await pending;
    expect(plugin.playNative).not.toHaveBeenCalled(); expect(api.active).toBe(false);
  });
});
