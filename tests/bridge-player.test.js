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
    hidden: false, style: {}, value: "", textContent: "", dataset: {},
    listeners,
    addEventListener: (name, callback) => listeners.set(name, callback),
    querySelector: selector => { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
    prepend: vi.fn(), before: vi.fn(), focus: vi.fn(), scrollIntoView: vi.fn(), removeAttribute: vi.fn(),
    load: vi.fn(), pause: vi.fn(),
    canPlayType: vi.fn().mockReturnValue("maybe"),
  };
}

function player() {
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
    t: key => key, safeGet: (_key, fallback) => fallback, safeSet: vi.fn(),
    detectLocalProxy: vi.fn(), detectCorsProxySync: () => "/api/proxy?url=",
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
    }
  }
  class Hls {
    static Events = { ERROR: "error" };
    static isSupported() { return true; }
    constructor() { this.handlers = new Map(); }
    on(event, handler) { this.handlers.set(event, handler); }
    error(data) { this.handlers.get("error")("error", data); }
  }
  const window = { TCLVBridgeClient: Client, Hls };
  const underlying = { play: host.playChannel, slot: host.playInSlot1, source: host.fetchWebSource };
  const context = vm.createContext({
    window, document, location: { protocol: "https:", origin: "https://tclv-player.vercel.app" },
    URL, queueMicrotask, fetch: vi.fn(),
  });
  vm.runInContext(source, context);
  window.TCLVWebPlayer(host);
  return { host, client, ui, video, video2, window, underlying };
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
});
