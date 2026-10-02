import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const epg = '<tv><channel id="example"/></tv>';
const playlist = "#EXTM3U\n#EXTINF:-1,Example\nhttps://media.example/live.m3u8";
const sourceUrl = "https://sources.example/epg.xml";

function section(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  if (first < 0 || last < first) throw new Error(`Missing source section: ${start}`);
  return source.slice(first, last);
}

const code = [
  section("var LOCAL_PROXY_PORTS =", "function saveCurrentPlayer("),
  section("function streamUrl(", "function tryHlsPlayback("),
  section("function isNativePlatform()", "async function loadPlaylistText("),
].join("\n");

function cacheStorage() {
  const entries = new Map();
  return {
    entries,
    open: vi.fn().mockResolvedValue({
      match: async key => entries.get(key)?.clone(),
      delete: async key => entries.delete(key),
      put: async (key, value) => { entries.set(key, value); },
      keys: async () => [...entries.keys()],
    }),
  };
}

function app({ stored = {}, native = null, caches = cacheStorage() } = {}) {
  const saved = new Map(Object.entries(stored));
  const fetch = vi.fn().mockImplementation(async () => new Response(epg));
  const window = { caches, crypto: webcrypto };
  if (native === "electron") window.TCLVNative = {};
  if (native === "android") window.Capacitor = {
    Plugins: { CapacitorHttp: { request: vi.fn().mockResolvedValue({ status: 200, data: epg }) } },
  };
  const context = vm.createContext({
    location: { protocol: "https:", origin: "https://tclv-player.vercel.app" },
    window,
    state: { corsProxy: "https://tclv-player.vercel.app/api/proxy?url=" },
    dom: {},
    safeGet: (key, fallback = null) => saved.has(key) ? saved.get(key) : fallback,
    safeSet: (key, value) => saved.set(key, value),
    t: key => key,
    showMessage: vi.fn(),
    fetch,
    URL,
    Blob,
    Response,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(code, context);
  return { context, fetch, saved, caches };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("web video routing", () => {
  it("defaults new web installations to HTML5 without changing native defaults", () => {
    const { context } = app();
    expect(context.fallbackPlayer("web-https")).toBe("html5");
    expect(context.fallbackPlayer("android")).toBe("html5");
    expect(context.fallbackPlayer("electron")).toBe("html5");
  });

  it("never switches HTTPS HLS to the Vercel proxy", () => {
    const { context } = app();
    const url = "https://media.example/live.m3u8";
    expect(context.canUseProxyFallback(url, false)).toBe(false);
    const xhr = { open: vi.fn() };
    context.hlsConfig(url, true).xhrSetup(xhr, "https://media.example/segment.ts");
    expect(xhr.open).not.toHaveBeenCalled();
    expect(context.streamUrl(url)).toBe(url);
  });

  it("blocks HTTP video and HTTP HLS segments without a local bridge", () => {
    const { context } = app();
    expect(context.isBlockedWebStream("http://media.example/live.m3u8")).toBe(true);
    expect(() => context.streamUrl("http://media.example/live.ts")).toThrow("webStreamHint");
    const xhr = { open: vi.fn() };
    expect(() => context.hlsConfig("https://media.example/live.m3u8").xhrSetup(xhr, "http://media.example/segment.ts"))
      .toThrow("webStreamHint");
    expect(xhr.open).not.toHaveBeenCalled();
  });

  it("blocks a playlist channel that explicitly points to the old Vercel video proxy", () => {
    const { context } = app();
    expect(context.isBlockedWebStream("https://tclv-player.vercel.app/api/proxy?url=anything")).toBe(true);
  });

  it("does not send video through custom public proxies either", () => {
    const { context } = app();
    context.state.corsProxy = "https://public-proxy.example/?url=";
    expect(context.canUseProxyFallback("https://media.example/live.m3u8", false)).toBe(false);
    expect(context.isBlockedWebStream("http://media.example/live.ts")).toBe(true);
  });

  it("allows video fallback through a loopback proxy without using Vercel", () => {
    const { context } = app();
    context.state.corsProxy = "http://127.0.0.1:3939/proxy?url=";
    const stream = "http://media.example/live.m3u8";
    expect(context.isBlockedWebStream(stream)).toBe(false);
    expect(context.streamUrl(stream)).toBe(context.state.corsProxy + encodeURIComponent(stream));
    expect(context.canUseProxyFallback("https://media.example/live.m3u8", false)).toBe(true);
  });

  it.each(["electron", "android"])("preserves direct HTTP playback on %s", native => {
    const { context } = app({ native });
    expect(context.isBlockedWebStream("http://media.example/live.m3u8")).toBe(false);
    expect(context.streamUrl("http://media.example/live.ts")).toBe("http://media.example/live.ts");
    expect(context.hlsConfig("http://media.example/live.m3u8").xhrSetup).toBeUndefined();
  });
});

describe("web proxy configuration", () => {
  it("preserves a saved custom proxy on HTTPS", () => {
    const { context } = app({ stored: { "tclv.corsProxy": "https://custom.example/?url=" } });
    expect(context.detectCorsProxySync()).toBe("https://custom.example/?url=");
  });

  it("respects an explicitly disabled proxy", async () => {
    const { context, fetch } = app({ stored: { "tclv.corsProxy": "" } });
    context.state.corsProxy = context.detectCorsProxySync();
    await context.detectLocalProxy();
    expect(context.state.corsProxy).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not overwrite a configured remote proxy during local detection", async () => {
    const { context, fetch } = app();
    context.state.corsProxy = "https://custom.example/?url=";
    await context.detectLocalProxy();
    expect(context.state.corsProxy).toBe("https://custom.example/?url=");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("discovers a loopback bridge before loading sources", async () => {
    const { context, fetch } = app();
    fetch.mockImplementation(async url => {
      if (url.endsWith("/ping")) return new Response(null, { status: url.includes(":3939") ? 200 : 404 });
      if (url.startsWith("https://sources.example")) throw new TypeError("CORS");
      return new Response(epg);
    });
    await context.detectLocalProxy();
    await context.loadTextFromUrl(sourceUrl);
    expect(context.state.corsProxy).toBe("http://127.0.0.1:3939/proxy?url=");
    expect(fetch.mock.calls.some(([url]) => url.includes("/api/proxy"))).toBe(false);
    const init = section("async function init()", "function refreshChannelProgress()");
    expect(init.indexOf("await detectLocalProxy()")).toBeLessThan(init.indexOf("activatePlaylist("));
  });

  it("keeps the existing configuration when no bridge responds", async () => {
    const { context, fetch } = app();
    fetch.mockRejectedValue(new TypeError("Offline"));
    await context.detectLocalProxy();
    expect(context.state.corsProxy).toBe("https://tclv-player.vercel.app/api/proxy?url=");
  });
});

describe("playlist and EPG downloads", () => {
  it("tries direct HTTPS before the source-only proxy", async () => {
    const { context, fetch } = app();
    fetch.mockRejectedValueOnce(new TypeError("CORS")).mockResolvedValueOnce(new Response(epg));
    expect(await context.loadTextFromUrl(sourceUrl)).toBe(epg);
    expect(fetch.mock.calls[0][0]).toBe(sourceUrl);
    const proxyUrl = new URL(fetch.mock.calls[1][0]);
    expect(proxyUrl.pathname).toBe("/api/proxy");
    expect(proxyUrl.searchParams.get("resource")).toBe("source");
    expect(proxyUrl.searchParams.get("url")).toBe(sourceUrl);
  });

  it("does not use Vercel for directly accessible sources", async () => {
    const { context, fetch } = app();
    expect(await context.loadTextFromUrl(sourceUrl)).toBe(epg);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(sourceUrl);
  });

  it("does not retry explicit HTTP errors through the proxy", async () => {
    const { context, fetch } = app();
    fetch.mockResolvedValueOnce(new Response(null, { status: 404, statusText: "Not Found" }));
    await expect(context.loadTextFromUrl(sourceUrl)).rejects.toThrow("404");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("skips blocked mixed-content fetches and uses the metadata proxy once", async () => {
    const { context, fetch } = app();
    const url = "http://sources.example/epg.xml";
    expect(await context.loadTextFromUrl(url)).toBe(epg);
    expect(fetch).toHaveBeenCalledOnce();
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("resource")).toBe("source");
  });

  it("does not duplicate a failed Vercel request with a raw URL fallback", async () => {
    const { context, fetch } = app();
    fetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(context.loadTextFromUrl("http://sources.example/epg.xml")).rejects.toThrow("proxyBlocked");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("explains oversized sources", async () => {
    const { context, fetch } = app();
    fetch.mockResolvedValueOnce(new Response(null, { status: 413 }));
    await expect(context.loadTextFromUrl("http://sources.example/epg.xml")).rejects.toThrow("sourceTooLarge");
  });

  it("coalesces simultaneous downloads of the same URL", async () => {
    const { context, fetch } = app();
    expect(await Promise.all([context.loadTextFromUrl(sourceUrl), context.loadTextFromUrl(sourceUrl)]))
      .toEqual([epg, epg]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reuses the memory cache for subsequent EPG loads", async () => {
    const { context, fetch } = app();
    await context.loadTextFromUrl(sourceUrl);
    await context.loadTextFromUrl(sourceUrl);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("persists EPG across page loads without storing raw source URLs in cache keys", async () => {
    const caches = cacheStorage();
    const url = sourceUrl + "?username=private&password=secret";
    await app({ caches }).context.loadTextFromUrl(url);
    const nextPage = app({ caches });
    expect(await nextPage.context.loadTextFromUrl(url)).toBe(epg);
    expect(nextPage.fetch).not.toHaveBeenCalled();
    const key = [...caches.entries.keys()][0];
    expect(key).toMatch(/\/\.tclv-source-cache\/[a-f0-9]{64}$/);
    expect(key).not.toContain("secret");
  });

  it("downloads again after the cached source expires", async () => {
    const { context, fetch } = app();
    await context.loadTextFromUrl(sourceUrl);
    context.webSourceMemory.get(sourceUrl).expires = 0;
    const key = await context.sourceCacheKey(sourceUrl);
    const cache = await context.window.caches.open(context.WEB_SOURCE_CACHE);
    await cache.put(key, new Response(epg, { headers: { "X-TCLV-Expires": "1" } }));
    await context.loadTextFromUrl(sourceUrl);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses six-hour EPG and fifteen-minute playlist cache lifetimes", async () => {
    const { context } = app();
    const before = Date.now();
    await context.writeWebSourceCache(sourceUrl, epg);
    await context.writeWebSourceCache("https://sources.example/list.m3u", playlist);
    expect(context.webSourceMemory.get(sourceUrl).expires - before).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(context.webSourceMemory.get("https://sources.example/list.m3u").expires - before).toBeLessThan(16 * 60 * 1000);
  });

  it("bounds the number of persisted sources", async () => {
    const { context, caches } = app();
    for (let i = 0; i < 12; i++) await context.writeWebSourceCache(`https://sources.example/${i}.xml`, epg);
    expect(caches.entries.size).toBe(8);
    expect(context.webSourceMemory.size).toBe(8);
  });

  it("force reload bypasses both browser cache and shared proxy cache", async () => {
    const { context, fetch } = app();
    await context.loadTextFromUrl(sourceUrl);
    fetch.mockRejectedValueOnce(new TypeError("CORS")).mockResolvedValueOnce(new Response(epg));
    await context.loadTextFromUrl(sourceUrl, { forceReload: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][1].cache).toBe("reload");
    expect(new URL(fetch.mock.calls[2][0]).searchParams.get("refresh")).toBe("1");
  });

  it("works when browser Cache Storage is unavailable", async () => {
    const { context, fetch } = app({ caches: undefined });
    context.window.caches = undefined;
    await context.loadTextFromUrl(sourceUrl);
    await context.loadTextFromUrl(sourceUrl);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not decompress an already-decoded .gz response twice", async () => {
    const { context, fetch } = app();
    fetch.mockResolvedValueOnce(new Response(epg));
    expect(await context.loadTextFromUrl(sourceUrl + ".gz")).toBe(epg);
  });

  it("keeps Electron sources direct and does not apply the web cache", async () => {
    const { context, fetch } = app({ native: "electron" });
    fetch.mockImplementation(async () => new Response(epg));
    await context.loadTextFromUrl(sourceUrl);
    await context.loadTextFromUrl(sourceUrl);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([url]) => url === sourceUrl)).toBe(true);
    expect(context.webSourceMemory.size).toBe(0);
  });

  it("keeps Android sources on CapacitorHttp, including gzip decoding", async () => {
    const { context, fetch } = app({ native: "android" });
    const request = context.window.Capacitor.Plugins.CapacitorHttp.request;
    expect(await context.loadTextFromUrl(sourceUrl)).toBe(epg);
    context.atob = value => globalThis.atob(value);
    context.DecompressionStream = globalThis.DecompressionStream;
    request.mockResolvedValueOnce({ status: 200, data: gzipSync(epg).toString("base64") });
    expect(await context.loadTextFromUrl(sourceUrl + ".gz")).toBe(epg);
    expect(request).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});
