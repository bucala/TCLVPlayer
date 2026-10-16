import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../lib/android-player.js', import.meta.url), 'utf8');
function client() {
  const listeners = new Map();
  const plugin = { addListener: async (name, listener) => listeners.set(name, listener), nativeBounds: vi.fn().mockResolvedValue({}),
    nativeReady: vi.fn().mockResolvedValue({ ready: true }), playNative: vi.fn().mockResolvedValue({}), nativeMetadata: vi.fn().mockResolvedValue({}), controlNative: vi.fn().mockResolvedValue({}) };
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
  it('updates programme metadata without restarting playback and deduplicates unchanged EPG', async () => {
    const { api, plugin, host } = client(); await api.install(host);
    const metadata = { id: 'fixture', programme: 'Fixture programme', programmes: [{ title: 'Fixture programme', start: 1, stop: 2 }] };
    await api.metadata(metadata); expect(plugin.nativeMetadata).not.toHaveBeenCalled();
    await api.start({ id: 'fixture' }, [], 'queue');
    await api.metadata(metadata); await api.metadata(metadata);
    await api.metadata({ ...metadata, programme: 'Next fixture programme' });
    expect(plugin.nativeMetadata).toHaveBeenCalledTimes(2);
    expect(plugin.nativeMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ programme: 'Next fixture programme' }));
    expect(plugin.playNative).toHaveBeenCalledOnce();
    expect(plugin.controlNative).not.toHaveBeenCalled();
  });
  it('retries a failed metadata update and refreshes it after another native start', async () => {
    const { api, plugin, host } = client(); await api.install(host);
    await api.start({ id: 'fixture' }, [], 'queue');
    const metadata = { id: 'fixture', programme: 'Fixture programme' };
    plugin.nativeMetadata.mockRejectedValueOnce(new Error('Fixture disconnect'));
    await expect(api.metadata(metadata)).rejects.toThrow('disconnect');
    await api.metadata(metadata);
    await api.start({ id: 'fixture' }, [], 'queue'); await api.metadata(metadata);
    expect(plugin.nativeMetadata).toHaveBeenCalledTimes(3);
  });
});
