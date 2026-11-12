import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../web/bridge-player.js", import.meta.url), "utf8");
const ticket = "http://127.0.0.1:3939/media/" + "b".repeat(32);
const channel = { id: "one", name: "Example", url: "https://provider.example/live.m3u8" };

function element() {
  const listeners = new Map();
  const children = new Map();
  return {
    hidden: false, style: {}, value: "", textContent: "", dataset: {}, error: { code: 4 },
    listeners,
    addEventListener: (name, callback) => listeners.set(name, callback),
    querySelector: selector => { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
    setAttribute: vi.fn(), prepend: vi.fn(), before: vi.fn(), focus: vi.fn(), scrollIntoView: vi.fn(), removeAttribute: vi.fn(),
    load: vi.fn(), pause: vi.fn(),
    canPlayType: vi.fn().mockReturnValue("maybe"),
  };
}

function player({ configuredProxy = '/api/proxy?url=', saved = {}, extend = () => {} } = {}) {
  const body = element();
  const ui = element();
  const bar = element();
  const video = element();
  const video2 = element();
  const stage = element();
  const document = {
    createElement: vi.fn().mockReturnValueOnce(ui).mockReturnValueOnce(bar),
    querySelector: () => stage,
  };
  let client;
  const host = {
    state: { selectedChannelId: channel.id, multiview: true, mvChannel1: { ...channel, id: "two" }, player: "html5", corsProxy: "/api/proxy?url=" },
    dom: { video, video2, playerMessage2: element(), corsProxyInput: { closest: () => body } },
    translations: { sk: {}, en: {} },
    t: key => key, safeGet: (key, fallback) => saved[key] ?? fallback, safeSet: vi.fn(),
    detectLocalProxy: vi.fn(), detectCorsProxySync: () => configuredProxy,
    canProxyStreams: () => false, needsProxy: () => false,
    isBlockedWebStream: url => url.startsWith("http://"),
    getStreamType: url => url.endsWith(".mp4") ? "mp4" : "hls",
    playChannel: vi.fn(), playInSlot1: vi.fn(), destroySlot1: vi.fn(),
    fetchWebSource: vi.fn().mockResolvedValue("source"),
    translateUi: vi.fn(), setStreamStatus: vi.fn(), stopInternalPlayers: vi.fn(), showMessage: vi.fn(),
    ensureHls: vi.fn(), ensureMpegts: vi.fn(), ensureFlvJs: vi.fn(), ensureVideoJs: vi.fn(),
    ensureArtPlayer: vi.fn(), ensureJPlayer: vi.fn(), openSettings: vi.fn(),
    isMixedContent: url => url.startsWith("http://"), decodeWebSourceResponse: response => response.text(),
  };
  class Client {
    constructor({ onChange }) {
      client = this;
      this.onChange = onChange;
      this.status = "ready";
      this.openStream = vi.fn().mockResolvedValue(ticket);
      this.source = vi.fn().mockResolvedValue(new Response("source"));
      this.isMediaUrl = value => value === ticket;
      this.discover = vi.fn();
      this.pair = vi.fn();
      this.cancelApproval = vi.fn();
    }
  }
  class Hls {
    static Events = { ERROR: "error" };
    static DefaultConfig = { loader: class { load(context, _settings, callbacks) { callbacks.onSuccess({ data: context.payload }, {}, context); } } };
    static isSupported() { return true; }
    constructor(config) { this.config = config; this.handlers = new Map(); }
    on(event, handler) { this.handlers.set(event, handler); }
    error(data) { this.handlers.get("error")("error", data); }
  }
  const window = { TCLVBridgeClient: Client, Hls, confirm: vi.fn().mockReturnValue(true) };
  extend(window);
  const underlying = { play: host.playChannel, slot: host.playInSlot1, source: host.fetchWebSource };
  const fetch = vi.fn();
  const clock = { ahead: 0 };
  class Clock extends Date {
    constructor(...values) { if (values.length) super(...values); else super(Clock.now()); }
    static now() { return Date.now() + clock.ahead; }
  }
  const context = vm.createContext({
    window, document, location: { protocol: "https:", origin: "https://tclv-player.vercel.app" },
    URL, queueMicrotask, setTimeout, clearTimeout, fetch, Date: Clock, AbortController,
  });
  vm.runInContext(source, context);
  window.TCLVWebPlayer(host);
  return { host, client, ui, bar, video, video2, window, underlying, fetch, clock };
}

function chooseMode(ui, value) {
  const select = ui.querySelector("#webVideoMode");
  select.value = value;
  select.listeners.get("change")();
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("web-only Auto playback", () => {
  it.each(["TCLVNative", "Capacitor"])("never initializes inside an existing %s native runtime", native => {
    const window = { [native]: {} };
    const context = vm.createContext({ window });
    vm.runInContext(source, context);
    expect(() => window.TCLVWebPlayer({})).not.toThrow();
    expect(window.TCLVWebBridge).toBeUndefined();
  });
  it("does not claim a direct video route before any channel is started", () => {
    const { bar } = player();
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgeIdle");
    expect(bar.dataset.route).toBe("idle");
  });
  it("distinguishes a provider rejection from waiting for local pairing", async () => {
    const { host, client, bar } = player();
    client.openStream.mockRejectedValueOnce(Object.assign(new Error("Provider unavailable"), { status: 502 }));
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgeVideoError");
    expect(host.showMessage).toHaveBeenLastCalledWith("streamUnavailable bridgeCodec", 0);
    const pending = player();
    pending.client.status = "available";
    pending.client.openStream.mockRejectedValueOnce(Object.assign(new Error("Pairing required"), { code: "unpaired" }));
    await pending.host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(pending.bar.querySelector("#webVideoRoute").textContent).toBe("bridgeUnavailable");
  });
  it("plays HTTPS directly before contacting the helper", async () => {
    const { host, client, underlying } = player();
    await host.playChannel(channel);
    expect(host.playChannel).not.toHaveProperty("mock");
    expect(client.openStream).not.toHaveBeenCalled();
    expect(underlying.play).toHaveBeenCalledWith(channel);
    expect(host.ensureHls).toHaveBeenCalled();
    expect(host.canProxyStreams()).toBe(false);
  });
  it("routes HTTP through a paired bridge and retains HLS type on opaque tickets", async () => {
    const { host, client } = player();
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(client.openStream).toHaveBeenCalledWith("http://provider.example/live.m3u8");
    expect(host.getStreamType(ticket)).toBe("hls");
    expect(host.isBlockedWebStream(ticket)).toBe(false);
    expect(host.needsProxy(ticket)).toBe(false);
  });
  it("forces only the primary bridged HLS path through HLS.js without changing direct media support", async () => {
    const { host } = player();
    expect(host.dom.video.canPlayType("application/vnd.apple.mpegurl")).toBe("maybe");
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(host.dom.video.canPlayType("application/vnd.apple.mpegurl")).toBe("");
    expect(host.dom.video.canPlayType("video/mp4")).toBe("maybe");
    await host.playChannel(channel);
    expect(host.dom.video.canPlayType("application/vnd.apple.mpegurl")).toBe("maybe");
  });
  it("automatically retries both multiview slots after direct HLS network errors", async () => {
    const { host, client, window } = player();
    await host.playChannel(channel);
    await host.playInSlot1({ ...channel, id: "two" });
    const first = new window.Hls();
    host.state.hls = first;
    first.error({ type: "networkError", fatal: false });
    await settle();
    expect(client.openStream).toHaveBeenCalledWith(channel.url);
    client.openStream.mockClear();
    const second = new window.Hls();
    host.state.hls2 = second;
    second.error({ type: "networkError", fatal: true });
    await settle();
    expect(client.openStream).toHaveBeenCalledWith(channel.url);
  });
  it("retries MPEG-TS and FLV network errors through the paired helper", async () => {
    for (const [libraryName, field, extension] of [["mpegts", "mpegtsPlayer", "ts"], ["flvjs", "flvPlayer", "flv"]]) {
      const { host, client, window } = player();
      const handlers = new Map();
      window[libraryName] = {
        Events: { ERROR: "error" }, ErrorTypes: { NETWORK_ERROR: "NetworkError" },
        createPlayer: () => ({ on: (name, callback) => handlers.set(name, callback) }),
      };
      await host.playChannel({ ...channel, url: "https://provider.example/live." + extension });
      host.state[field] = window[libraryName].createPlayer();
      handlers.get("error")("NetworkError");
      await settle();
      expect(client.openStream).toHaveBeenCalledWith("https://provider.example/live." + extension);
    }
  });
  it("does not loop from a failed bridged stream back to Vercel", async () => {
    const { host, client, video, underlying } = player();
    await host.playChannel(channel);
    video.listeners.get("error")();
    await settle();
    video.listeners.get("error")();
    await settle();
    expect(client.openStream).toHaveBeenCalledOnce();
    expect(underlying.source).not.toHaveBeenCalled();
  });
  it("ignores a late bridge reply after switching channels", async () => {
    const { host, client } = player();
    let finish;
    client.openStream.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    host.state.selectedChannelId = "other";
    await host.playChannel({ ...channel, id: "other", url: "https://provider.example/other.mp4" });
    host.ensureHls.mockClear();
    finish(ticket);
    await pending;
    expect(host.ensureHls).not.toHaveBeenCalled();
  });
  it("invalidates pending secondary playback when multiview closes", async () => {
    const { host, client } = player();
    let finish;
    client.openStream.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = host.playInSlot1({ ...channel, id: "two", url: "http://provider.example/live.m3u8" });
    host.destroySlot1();
    finish(ticket);
    await pending;
    expect(host.ensureHls).not.toHaveBeenCalled();
  });
  it("respects direct-only mode and leaves source proxy configuration untouched", async () => {
    const { host, client, ui } = player();
    const select = ui.querySelector("#webVideoMode");
    select.value = "direct";
    select.listeners.get("change")();
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(client.openStream).not.toHaveBeenCalled();
    expect(host.showMessage).toHaveBeenCalledWith("bridgeDirectBlocked", 0);
    expect(host.state.corsProxy).toBe("/api/proxy?url=");
  });
  it("restarts the same HTTP channel after Direct-only switches back to Bridge-only", async () => {
    const { host, client, ui, underlying } = player();
    const select = ui.querySelector("#webVideoMode");
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    underlying.play.mockClear();
    client.openStream.mockClear();
    select.value = "direct";
    select.listeners.get("change")();
    await settle();
    expect(underlying.play).not.toHaveBeenCalled();
    expect(client.openStream).not.toHaveBeenCalled();
    select.value = "bridge";
    select.listeners.get("change")();
    await settle();
    expect(client.openStream).toHaveBeenCalledOnce();
    expect(underlying.play).toHaveBeenCalledWith({ ...channel, url: ticket });
  });
  it("does not start a late bridge response after mode changes to Direct-only", async () => {
    const { host, client, ui, underlying } = player();
    let finish;
    client.openStream.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    const select = ui.querySelector("#webVideoMode");
    select.value = "direct";
    select.listeners.get("change")();
    await settle();
    finish(ticket);
    await pending;
    expect(underlying.play).not.toHaveBeenCalled();
    expect(host.showMessage).toHaveBeenCalledWith("bridgeDirectBlocked", 0);
  });
  it("retries the waiting stream automatically after pairing succeeds", async () => {
    const { host, client, ui, underlying } = player();
    client.openStream.mockRejectedValueOnce(Object.assign(new Error("Unpaired"), { code: "unpaired" }));
    await host.playChannel({ ...channel, url: "http://provider.example/live.m3u8" });
    expect(underlying.play).not.toHaveBeenCalled();
    ui.querySelector("#bridgePairCode").value = "A1B2C3D4E5F6";
    await ui.querySelector("#bridgePairForm").listeners.get("submit")({ preventDefault: vi.fn() });
    await settle();
    expect(underlying.play).toHaveBeenCalledWith({ ...channel, url: ticket });
    expect(ui.querySelector("#bridgePairCode").value).toBe("");
  });
  it("does not scan localhost or change a disabled source proxy at startup", async () => {
    const { host, client } = player();
    host.state.corsProxy = "";
    await host.detectLocalProxy();
    expect(client.discover).not.toHaveBeenCalled();
    expect(host.state.corsProxy).toBe("");
  });
  it("blocks playlist channels pointing to legacy cloud video proxies", async () => {
    const { host, client } = player();
    await host.playChannel({ ...channel, url: "https://tclv-player.vercel.app/api/proxy?url=video" });
    expect(client.openStream).not.toHaveBeenCalled();
    expect(host.ensureHls).not.toHaveBeenCalled();
  });
  it('disables a saved remote source proxy without stopping or unpairing local playback', () => {
    const { host, ui, client } = player();
    ui.querySelector('#bridgeLocalOnly').listeners.get('click')();
    expect(host.state.corsProxy).toBe('');
    expect(host.dom.corsProxyInput.value).toBe('');
    expect(host.safeSet).toHaveBeenCalledWith('tclv.corsProxy', '');
    expect(client.status).toBe('ready');
    expect(host.stopInternalPlayers).not.toHaveBeenCalled();
  });
  it('never migrates an old loopback source proxy to a Vercel function', () => {
    const { host } = player({ configuredProxy: 'http://127.0.0.1:3939/proxy?url=' });
    expect(host.detectCorsProxySync()).toBe('');
  });
});

describe("opt-in playback through Vercel", () => {
  const relayed = url => "https://tclv-player.vercel.app/api/stream?url=" + encodeURIComponent(url);
  const httpChannel = { ...channel, url: "http://provider.example/live.m3u8" };

  it("keeps video off Vercel until the viewer turns it on", async () => {
    const { host, client, ui, bar, underlying, window } = player();
    expect(window.TCLVWebBridge.mode).toBe("auto");
    expect(ui.querySelector("#vercelToggle").checked).toBe(false);
    await host.playChannel(httpChannel);
    expect(client.openStream).toHaveBeenCalledWith(httpChannel.url);
    expect(underlying.play).toHaveBeenCalledWith({ ...httpChannel, url: ticket });
    expect(bar.dataset.relay).toBe("none");
    expect(host.isBlockedWebStream(relayed(httpChannel.url))).toBe(true);
  });
  it("does not enable Vercel playback without a confirmation API", () => {
    const { ui, window } = player();
    delete window.confirm;
    chooseMode(ui, "vercel");
    expect(window.TCLVWebBridge.mode).toBe("auto");
  });
  it("ignores a cleared old-source video error while relaying the same channel", async () => {
    const { host, ui, bar, video, fetch } = player();
    chooseMode(ui, "vercel");
    await host.playChannel(channel);
    video.error = null;
    video.listeners.get("error")();
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    expect(bar.dataset.relay).toBe("vercel");
  });
  it("keeps the quota warning for the second slot even when the first fails", async () => {
    const { host, ui, bar, video, window, fetch } = player();
    chooseMode(ui, "auto-vercel");
    await host.playChannel(channel);
    await host.playInSlot1({ ...httpChannel, id: "two" });
    video.listeners.get("error")();
    await settle();
    fetch.mockResolvedValue({ ok: true, json: async () => ({ service: "tclv-video-relay", enabled: true }) });
    host.setStreamStatus(channel.id, "error");
    await settle();
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgePlayingVercel");
    const hls = new window.Hls();
    host.state.hls2 = hls;
    hls.error({ type: "mediaError", fatal: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(bar.dataset.relay).toBe("none");
    expect(host.dom.playerMessage2.textContent).toBe("vercelFailed");
  });
  it("asks before spending the data limit and changes nothing when declined", () => {
    const { host, ui, window } = player();
    window.confirm = vi.fn().mockReturnValue(false);
    const toggle = ui.querySelector("#vercelToggle");
    toggle.checked = true;
    toggle.listeners.get("change")();
    expect(window.confirm).toHaveBeenCalledWith("vercelConfirm");
    expect(window.TCLVWebBridge.mode).toBe("auto");
    expect(toggle.checked).toBe(false);
    chooseMode(ui, "vercel");
    expect(ui.querySelector("#webVideoMode").value).toBe("auto");
    expect(host.safeSet).not.toHaveBeenCalled();

    window.confirm.mockReturnValue(true);
    chooseMode(ui, "vercel");
    expect(window.TCLVWebBridge.mode).toBe("vercel");
    expect(toggle.checked).toBe(true);
    expect(ui.dataset.relay).toBe("vercel");
    expect(host.safeSet).toHaveBeenCalledWith("tclv.webVideoMode", "vercel");
    // Moving between the two Vercel modes or away from them needs no new question.
    window.confirm.mockClear();
    chooseMode(ui, "auto-vercel");
    chooseMode(ui, "auto");
    expect(window.confirm).not.toHaveBeenCalled();
    expect(ui.dataset.relay).toBe("none");
  });
  it("restores a saved Vercel mode and ignores unknown saved modes", () => {
    const restored = player({ saved: { "tclv.webVideoMode": "auto-vercel" } });
    expect(restored.window.TCLVWebBridge.mode).toBe("auto-vercel");
    expect(restored.ui.querySelector("#vercelToggle").checked).toBe(true);
    expect(player({ saved: { "tclv.webVideoMode": "cloud" } }).window.TCLVWebBridge.mode).toBe("auto");
  });
  it("relays an HTTP stream without the helper and warns in the route bar", async () => {
    const { host, client, ui, bar, underlying, window } = player();
    const toggle = ui.querySelector("#vercelToggle");
    toggle.checked = true;
    toggle.listeners.get("change")();
    expect(window.TCLVWebBridge.mode).toBe("auto-vercel");
    await host.playChannel(httpChannel);
    const url = relayed(httpChannel.url);
    expect(client.openStream).not.toHaveBeenCalled();
    expect(underlying.play).toHaveBeenCalledWith({ ...httpChannel, url });
    expect(window.TCLVWebBridge.route).toBe("vercel");
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgePlayingVercel");
    expect(bar.dataset.relay).toBe("vercel");
    expect(host.getStreamType(url)).toBe("hls");
    expect(host.isBlockedWebStream(url)).toBe(false);
    expect(host.dom.video.canPlayType("application/vnd.apple.mpegurl")).toBe("");
    expect(host.dom.video.canPlayType("video/mp4")).toBe("maybe");
  });
  it("plays HTTPS directly first and falls back to Vercel only once", async () => {
    const { host, client, ui, bar, video, underlying, fetch } = player();
    chooseMode(ui, "auto-vercel");
    await host.playChannel(channel);
    expect(underlying.play).toHaveBeenLastCalledWith(channel);
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgePlayingDirect");
    expect(bar.dataset.relay).toBe("none");
    video.listeners.get("error")();
    await settle();
    expect(underlying.play).toHaveBeenLastCalledWith({ ...channel, url: relayed(channel.url) });
    expect(bar.dataset.relay).toBe("vercel");
    fetch.mockResolvedValue({ ok: true, json: async () => ({ service: "tclv-video-relay", enabled: true }) });
    video.listeners.get("error")();
    await settle();
    video.listeners.get("error")();
    await settle();
    expect(underlying.play).toHaveBeenCalledTimes(2);
    expect(client.openStream).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("/api/stream?status");
    expect(bar.querySelector("#webVideoRoute").textContent).toBe("bridgeVideoError");
    expect(bar.dataset.relay).toBe("none");
    expect(host.showMessage).toHaveBeenLastCalledWith("vercelFailed", 0);
  });
  it("explains a relay that is missing or switched off on the hosting", async () => {
    for (const reply of [{ ok: false }, { ok: true, json: async () => ({ service: "tclv-video-relay", enabled: false }) }, undefined]) {
      const { host, ui, underlying, fetch } = player();
      chooseMode(ui, "vercel");
      fetch.mockResolvedValue(reply);
      await host.playChannel(channel);
      expect(underlying.play).toHaveBeenCalledWith({ ...channel, url: relayed(channel.url) });
      host.stopInternalPlayers.mockClear();
      host.setStreamStatus(channel.id, "error");
      // The status request and its JSON body take more than a few microtasks.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(host.stopInternalPlayers).toHaveBeenCalled();
      expect(host.showMessage).toHaveBeenLastCalledWith("vercelUnavailable", 0);
    }
  });
  it("always relays in Vercel-only mode and keeps the format of the original address", async () => {
    const { host, ui, underlying } = player();
    chooseMode(ui, "vercel");
    const movie = { ...channel, url: "https://provider.example/movie.mp4" };
    await host.playChannel(movie);
    expect(underlying.play).toHaveBeenCalledWith({ ...movie, url: relayed(movie.url) });
    expect(host.getStreamType(relayed(movie.url))).toBe("mp4");
    await host.playInSlot1({ ...channel, id: "two" });
    expect(underlying.slot).toHaveBeenCalledWith({ ...channel, id: "two", url: relayed(channel.url) });
  });
  it("asks the relay for the format of a provider address without a file extension", async () => {
    const xtream = { ...channel, url: "http://provider.example/live/user/pass/1234" };
    for (const [reply, expected] of [
      [{ ok: true, headers: new Headers({ "content-type": "video/mp2t" }) }, "ts"],
      [{ ok: true, headers: new Headers({ "content-type": "application/vnd.apple.mpegurl; charset=utf-8" }) }, "hls"],
      [{ ok: true, headers: new Headers({ "content-type": "video/x-flv" }) }, "flv"],
      [{ ok: false, headers: new Headers({ "content-type": "application/json" }) }, "hls"],
      [Promise.reject(new TypeError("offline")), "hls"],
    ]) {
      const { host, ui, underlying, fetch } = player();
      chooseMode(ui, "vercel");
      let signal;
      fetch.mockImplementation((_url, init) => { signal = init.signal; return Promise.resolve(reply); });
      await host.playChannel(xtream);
      const url = relayed(xtream.url);
      expect(fetch).toHaveBeenCalledExactlyOnceWith(url, expect.objectContaining({ cache: "no-store" }));
      // Only the headers are read; the body must not keep using the transfer quota.
      expect(signal.aborted).toBe(true);
      expect(host.getStreamType(url), expected).toBe(expected);
      if (expected === "ts") { expect(host.ensureMpegts).toHaveBeenCalled(); expect(host.ensureHls).not.toHaveBeenCalled(); }
      expect(underlying.play).toHaveBeenCalledWith({ ...xtream, url });
    }
  });
  it("records opt-in playback diagnostics without stream addresses or credentials", async () => {
    let report;
    class PerformanceObserver {
      constructor(callback) { report = entries => callback({ getEntries: () => entries }); }
      observe() {}
    }
    const { host, ui, fetch, window } = player({ saved: { "tclv.debug": "1" }, extend: window => { window.PerformanceObserver = PerformanceObserver; } });
    expect(ui.querySelector("#diagToggle").checked).toBe(true);
    chooseMode(ui, "vercel");
    const xtream = { ...channel, url: "http://provider.example/live/user/pass/1234" };
    fetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers({ "content-type": "video/mp2t", "server-timing": 'relay;desc="media video/mp2t"' }) });
    await host.playChannel(xtream);
    report([{ name: relayed(xtream.url), initiatorType: "xmlhttprequest", responseStatus: 200, contentType: "video/mp2t", transferSize: 64000, duration: 812,
      serverTiming: [{ name: "provider", description: "200 application/octet-stream", duration: 140 }] }]);
    new window.Hls().error({ type: "networkError", details: "fragLoadError", fatal: true, reason: "failed " + relayed(xtream.url) });
    const record = window.TCLVWebBridge.diagnostics.join("\n");
    expect(record).toMatch(/start slot=0 channel=#[0-9a-f]{6} route=vercel .*scheme=http: .*extension=no/);
    expect(record).toMatch(/probe status=200 type=video\/mp2t/);
    expect(record).toContain("format type=ts");
    expect(record).toMatch(/request by=xmlhttprequest status=200 type=video\/mp2t kB=64 ms=812 server=provider:200 application\/octet-stream\/140ms/);
    expect(record).toContain("hls error type=networkError details=fragLoadError fatal=true reason=failed [url]");
    expect(record).not.toMatch(/provider\.example|user\/pass|1234/);
    expect(ui.querySelector("#diagLog").textContent).toBe(record);

    // A segment whose program table declares H.264 video and AAC audio.
    const segment = new Uint8Array(188 * 2).fill(0xff);
    segment.set([0x47, 0x40, 0x00, 0x10, 0x00, 0x00, 0xb0, 0x0d, 0x00, 0x01, 0xc1, 0x00, 0x00, 0x00, 0x01, 0xf0, 0x00, 0, 0, 0, 0], 0);
    segment.set([0x47, 0x50, 0x00, 0x10, 0x00, 0x02, 0xb0, 0x17, 0x00, 0x01, 0xc1, 0x00, 0x00, 0xe1, 0x00, 0xf0, 0x00,
      0x1b, 0xe1, 0x00, 0xf0, 0x00, 0x0f, 0xe1, 0x01, 0xf0, 0x00, 0, 0, 0, 0], 188);
    const { fLoader: Loader } = new window.Hls({}).config;
    const delivered = vi.fn();
    for (const payload of [segment.buffer, new Uint8Array([1, 2, 3]).buffer, segment.buffer]) new Loader().load({ payload }, {}, { onSuccess: delivered });
    // The player still receives every segment unchanged.
    expect(delivered.mock.calls.map(call => call[0].data)).toEqual([segment.buffer, expect.any(ArrayBuffer), segment.buffer]);
    const segments = window.TCLVWebBridge.diagnostics.filter(line => line.includes(" segment "));
    expect(segments).toEqual([expect.stringContaining("segment kB=0 ts=0x1b:H.264,0x0f:AAC"), expect.stringContaining("segment kB=0 ts=not MPEG-TS")]);

    const off = player();
    await off.host.playChannel(channel);
    expect(off.window.TCLVWebBridge.diagnostics).toEqual([]);
  });
  it("names an unsupported codec instead of blaming the Vercel route", async () => {
    const { host, ui, window, fetch } = player();
    chooseMode(ui, "vercel");
    fetch.mockResolvedValue({ ok: true, json: async () => ({ service: "tclv-video-relay", enabled: true }) });
    await host.playChannel(channel);
    const hls = new window.Hls();
    host.state.hls = hls;
    hls.error({ type: "mediaError", details: "bufferAddCodecError", fatal: true,
      reason: "Failed to execute 'addSourceBuffer' on 'MediaSource': The type provided ('video/mp4;codecs=hvc1.1.6.L0.B0') is unsupported." });
    // The player reports the error and shows its generic message synchronously.
    host.setStreamStatus(channel.id, "error");
    host.showMessage("streamUnavailable", 0);
    await settle();
    expect(host.showMessage).toHaveBeenLastCalledWith("codecUnsupported", 0);
    expect(host.showMessage).not.toHaveBeenCalledWith("vercelFailed", 0);
    expect(fetch).not.toHaveBeenCalled();

    const mpegts = player();
    const handlers = new Map();
    mpegts.window.mpegts = {
      Events: { ERROR: "error" }, ErrorTypes: { NETWORK_ERROR: "NetworkError", MEDIA_ERROR: "MediaError" },
      createPlayer: () => ({ on: (name, callback) => handlers.set(name, callback) }),
    };
    chooseMode(mpegts.ui, "vercel");
    await mpegts.host.playChannel({ ...channel, url: "https://provider.example/live.ts" });
    mpegts.host.state.mpegtsPlayer = mpegts.window.mpegts.createPlayer();
    handlers.get("error")("MediaError", "MediaMSEError", { msg: "Failed to execute 'addSourceBuffer' on 'MediaSource': The type provided ('video/mp4;codecs=hev1.1.6.L120.90') is unsupported." });
    await settle();
    expect(mpegts.host.showMessage).toHaveBeenLastCalledWith("codecUnsupported", 0);
  });
  it("does not probe addresses whose extension already names the format", async () => {
    const { host, ui, fetch } = player();
    chooseMode(ui, "vercel");
    for (const url of ["https://provider.example/live.m3u8", "http://provider.example/live/user/pass/1234.ts", "https://provider.example/movie.mp4"]) {
      await host.playChannel({ ...channel, url });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never lets a playlist address reach a relay by itself", async () => {
    for (const mode of ["auto", "vercel"]) {
      const { host, ui, underlying } = player();
      chooseMode(ui, mode);
      for (const url of [relayed("https://provider.example/live.m3u8"), "https://other.vercel.app/api/stream?url=x", "/api/stream?url=x"]) {
        await host.playChannel({ ...channel, url });
      }
      expect(underlying.play).not.toHaveBeenCalled();
      expect(host.ensureHls).not.toHaveBeenCalled();
    }
  });
  it("reconnects a continuous stream that the relay ended at its time limit", async () => {
    const { host, ui, underlying, window, clock } = player();
    const handlers = new Map();
    window.mpegts = {
      Events: { ERROR: "error", LOADING_COMPLETE: "loading_complete" }, ErrorTypes: { NETWORK_ERROR: "NetworkError" },
      createPlayer: () => ({ on: (name, callback) => handlers.set(name, callback) }),
    };
    chooseMode(ui, "vercel");
    const live = { ...channel, url: "https://provider.example/live.ts" };
    await host.playChannel(live);
    host.state.mpegtsPlayer = window.mpegts.createPlayer();
    handlers.get("loading_complete")();
    await settle();
    expect(underlying.play).toHaveBeenCalledOnce();
    clock.ahead = 61000;
    handlers.get("loading_complete")();
    await settle();
    expect(underlying.play).toHaveBeenCalledTimes(2);
    expect(underlying.play).toHaveBeenLastCalledWith({ ...live, url: relayed(live.url) });

    const direct = player();
    direct.window.mpegts = window.mpegts;
    await direct.host.playChannel(live);
    direct.host.state.mpegtsPlayer = direct.window.mpegts.createPlayer();
    direct.clock.ahead = 61000;
    handlers.get("loading_complete")();
    await settle();
    expect(direct.underlying.play).toHaveBeenCalledOnce();
  });
  it("estimates how much this browser relayed this month", () => {
    let report;
    class PerformanceObserver {
      constructor(callback) { report = entries => callback({ getEntries: () => entries }); }
      observe(options) { expect(options).toEqual({ type: "resource", buffered: true }); }
    }
    const month = new Date().toISOString().slice(0, 7);
    const { host, ui, window } = player({
      extend: window => { window.PerformanceObserver = PerformanceObserver; },
      saved: { "tclv.vercelRelayUsage": JSON.stringify({ month, bytes: 1000000 }) },
    });
    expect(ui.querySelector("#vercelUsage").hidden).toBe(false);
    report([
      { name: relayed("https://provider.example/seg1.ts"), transferSize: 4000000 },
      { name: relayed("https://provider.example/seg2.ts"), transferSize: 0, encodedBodySize: 500000 },
      { name: "https://provider.example/direct.ts", transferSize: 9000000 },
      { name: "https://tclv-player.vercel.app/app.js", transferSize: 300000 },
    ]);
    expect(window.TCLVWebBridge.relayBytes).toBe(5500000);
    expect(host.safeSet).toHaveBeenLastCalledWith("tclv.vercelRelayUsage", JSON.stringify({ month, bytes: 5500000 }));

    const stale = player({ saved: { "tclv.vercelRelayUsage": JSON.stringify({ month: "2001-01", bytes: 5 }) } });
    expect(stale.window.TCLVWebBridge.relayBytes).toBe(0);
    expect(stale.ui.querySelector("#vercelUsage").hidden).toBe(true);
  });
  it("turns Vercel playback off together with the remote proxy", () => {
    const { host, ui, window } = player();
    chooseMode(ui, "auto-vercel");
    ui.querySelector("#bridgeLocalOnly").listeners.get("click")();
    expect(window.TCLVWebBridge.mode).toBe("auto");
    expect(ui.querySelector("#vercelToggle").checked).toBe(false);
    expect(host.safeSet).toHaveBeenCalledWith("tclv.webVideoMode", "auto");
    expect(host.state.corsProxy).toBe("");
  });
});
