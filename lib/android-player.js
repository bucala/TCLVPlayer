"use strict";
(function(root) {
  let plugin, host, active = false, lastVersion = '', pendingFrame, resize, generation = 0, starting = 0;
  function bounds() {
    if (!plugin || !host) return;
    const rect = host.slot.getBoundingClientRect();
    const obstructed = !host.settings.hidden || !host.detail.hidden;
    plugin.nativeBounds({ visible: active && !obstructed && rect.width > 0 && rect.height > 0,
      locked: host.locked(), left: rect.left, top: rect.top, width: rect.width, height: rect.height }).catch(() => {});
  }
  function scheduleBounds() { cancelAnimationFrame(pendingFrame); pendingFrame = requestAnimationFrame(bounds); }
  async function install(options) {
    plugin = root.Capacitor?.Plugins?.TCLVPlayer; host = options;
    if (!plugin?.playNative) return;
    await plugin.addListener('playbackState', event => {
      if (starting) return;
      if (event.hasMedia === false) { active = false; scheduleBounds(); return; }
      if (event.hasMedia && host.nativeChosen()) active = true;
      if (active) { host.onState(event); scheduleBounds(); }
    });
    await plugin.addListener('pipChanged', scheduleBounds);
    await plugin.addListener('unlockRequested', () => host.onUnlock());
    resize = new ResizeObserver(scheduleBounds); resize.observe(host.slot);
    const observer = new MutationObserver(scheduleBounds);
    observer.observe(host.settings, { attributes: true, attributeFilter: ['hidden'] });
    observer.observe(host.detail, { attributes: true, attributeFilter: ['hidden'] });
    observer.observe(document.documentElement, { attributes: true, subtree: false });
    root.addEventListener('resize', scheduleBounds);
    document.addEventListener('visibilitychange', scheduleBounds);
    document.addEventListener('scroll', scheduleBounds, true);
  }
  async function start(channel, channels, version) {
    const run = ++generation; starting = run;
    try {
    if (!plugin) throw new Error('Native player unavailable');
    for (let attempt = 0; attempt < 40; attempt++) {
      const ready = await plugin.nativeReady();
      if (run !== generation) return;
      if (ready.ready) break;
      if (attempt === 39) throw new Error('Native player unavailable');
      await new Promise(resolve => setTimeout(resolve, 125));
    }
    if (run !== generation) return;
    active = true;
    const payload = { id: channel.id, queueVersion: version };
    if (lastVersion !== version) payload.channels = channels;
    await plugin.playNative(payload);
    if (run !== generation) return;
    lastVersion = version;
    } finally { if (starting === run) starting = 0; }
    if (run === generation) { bounds(); void plugin.nativeReady(); }
  }
  function stop() { ++generation; starting = 0; if (!active) return; active = false; lastVersion = ''; return plugin.controlNative({ action: 'stop' }).catch(() => {}); }
  function control(action) { return plugin?.controlNative({ action }); }
  function quality(height) { return plugin?.nativeQuality({ height }); }
  root.TCLVAndroidPlayer = { install, start, stop, control, quality, refresh: () => plugin?.nativeReady(), scheduleBounds, get active() { return active; } };
})(globalThis);
