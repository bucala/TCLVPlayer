import http from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridge, rewriteManifest } from "../bridge/server.mjs";
import { isPublicAddress, parseTarget, resolveTarget } from "../bridge/security.mjs";

const origin = "https://tclv-player.vercel.app";
const pairingCode = "A1B2C3D4E5F6";
const target = "http://provider.example/live.m3u8";
const actualGet = http.get;
const listen = server => new Promise(accept => server.listen(0, "127.0.0.1", accept));
const close = server => new Promise(accept => { server.close(accept); server.closeAllConnections(); });

describe("bridge destination security", () => {
  it.each(["0.0.0.0", "10.0.0.1", "127.0.0.1", "100.64.0.1", "169.254.169.254", "172.16.0.1",
    "192.168.1.1", "192.0.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::", "::1",
    "fc00::1", "fd00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1",
    "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1"])("blocks private/reserved address %s", address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:808:808"])("permits public address %s", address => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it.each(["file:///C:/Windows/win.ini", "ftp://provider.example/live", "http://user:pass@provider.example/live",
    "not a URL"])("rejects unsafe target %s", value => {
    expect(() => parseTarget(value)).toThrow();
  });
  it("rejects DNS answers containing any private address", async () => {
    await expect(resolveTarget(parseTarget(target), async () => [
      { address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 },
    ])).rejects.toMatchObject({ statusCode: 403 });
  });
  it("pins validated DNS results rather than resolving again", async () => {
    const resolve = vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const lookup = await resolveTarget(parseTarget(target), resolve);
    const result = await new Promise((accept, reject) => lookup("provider.example", { all: true }, (error, addresses) => {
      if (error) reject(error); else accept(addresses);
    }));
    expect(result).toEqual([{ address: "8.8.8.8", family: 4 }]);
    expect(resolve).toHaveBeenCalledOnce();
  });
});

describe("HLS rewriting", () => {
  it("rewrites variants, keys, initialization segments, audio, parts and bare segment URLs", () => {
    const text = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/list.m3u8"\n#EXT-X-KEY:METHOD=AES-128,URI="../key"\n' +
      '#EXT-X-MAP:URI="init.mp4"\n#EXT-X-PART:URI="part.m4s"\n#EXT-X-CONTENT-STEERING:SERVER-URI="steer.json"\n' +
      "#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant/list.m3u8\n#EXTINF:4,\nsegment.ts";
    const urls = [];
    const rewritten = rewriteManifest(text, new URL("http://provider.example/live/master.m3u8"), url => {
      urls.push(url);
      return "http://127.0.0.1:3939/media/opaque-" + urls.length;
    });
    expect(urls).toEqual(["http://provider.example/live/audio/list.m3u8", "http://provider.example/key",
      "http://provider.example/live/init.mp4", "http://provider.example/live/part.m4s",
      "http://provider.example/live/steer.json", "http://provider.example/live/variant/list.m3u8", "http://provider.example/live/segment.ts"]);
    expect(rewritten).not.toContain("provider.example");
    expect(rewritten).toContain("#EXT-X-STREAM-INF:BANDWIDTH=1000");
  });
  it("fails closed for unsafe key protocols and unsupported HLS variables", () => {
    expect(() => rewriteManifest('#EXTM3U\n#EXT-X-KEY:URI="file:///secret"', new URL(target), url => url)).toThrow();
    expect(() => rewriteManifest("#EXTM3U\n{$host}/segment.ts", new URL(target), url => url)).toThrow();
  });
});

describe("paired standalone bridge", () => {
  let provider;
  let bridge;
  let base;
  let requests;
  let providerResponse;
  let resolve;
  let time;
  let token;

  beforeEach(async () => {
    time = Date.now();
    requests = [];
    resolve = vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    providerResponse = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
      res.end("#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST");
    };
    provider = http.createServer((req, res) => providerResponse(req, res));
    await listen(provider);
    vi.spyOn(http, "get").mockImplementation((url, options, callback) => {
      requests.push({ url: url.href, headers: options.headers, lookup: options.lookup });
      // Only test transport is redirected to our local fixture. Production pins public DNS.
      return actualGet(`http://127.0.0.1:${provider.address().port}${url.pathname}${url.search}`, {
        headers: options.headers, signal: options.signal,
      }, callback);
    });
    bridge = createBridge({ pairingCode, resolve, timeoutMs: 150, now: () => time });
    await listen(bridge.server);
    base = `http://127.0.0.1:${bridge.server.address().port}`;
  });

  afterEach(async () => {
    await close(bridge.server);
    await close(provider);
    vi.restoreAllMocks();
  });

  function request(path, options = {}) {
    return fetch(base + path, { ...options, headers: { Origin: origin, ...options.headers } });
  }
  async function pair() {
    const response = await request("/pair", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pairingCode }),
    });
    token = (await response.json()).token;
    return token;
  }
  async function open(url = target) {
    const response = await request("/open", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ url }),
    });
    return response;
  }

  it("identifies the helper without trusting a legacy ping response", async () => {
    const response = await request("/ping");
    expect(await response.json()).toMatchObject({ service: "tclv-bridge", protocol: 1, pairingRequired: true });
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects unknown origins, absent origins and DNS-rebinding Host headers", async () => {
    for (const headers of [{ Origin: "https://evil.example" }, { Origin: "" }]) {
      expect((await request("/ping", { headers })).status).toBe(403);
    }
    const status = await new Promise((accept, reject) => {
      const req = http.request(base + "/ping", { headers: { Origin: origin, Host: "evil.example:3939" } }, res => {
        res.resume();
        accept(res.statusCode);
      });
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403);
  });
  it("answers local-network preflights only for allowed origins", async () => {
    const response = await request("/pair", { method: "OPTIONS", headers: { "Access-Control-Request-Private-Network": "true" } });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-private-network")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect((await request("/pair", { method: "OPTIONS", headers: { Origin: "https://evil.example" } })).status).toBe(403);
  });
  it("does not expose an unauthenticated legacy proxy or source route", async () => {
    expect((await request("/proxy?url=" + encodeURIComponent(target))).status).toBe(404);
    expect((await request("/source?url=" + encodeURIComponent(target))).status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("rate limits incorrect codes and permits retry after a minute", async () => {
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"code":"000000000000"}' };
    for (let i = 0; i < 5; i++) expect((await request("/pair", options)).status).toBe(403);
    expect((await request("/pair", options)).status).toBe(429);
    time += 61000;
    expect(await pair()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("requires a paired origin-bound session and expires it", async () => {
    await pair();
    const headers = { Authorization: "Bearer " + token };
    expect((await request("/session", { headers })).status).toBe(200);
    expect((await request("/session", { headers: { ...headers, Origin: "http://localhost:3000" } })).status).toBe(401);
    time += 12 * 60 * 60 * 1000;
    expect((await request("/session", { headers })).status).toBe(401);
  });
  it("opens opaque media URLs without exposing provider credentials or session tokens", async () => {
    await pair();
    const response = await open("http://provider.example/live/user/placeholder-pass/1.m3u8?key=placeholder");
    const data = await response.json();
    expect(data.url).toMatch(/\/media\/[A-Za-z0-9_-]{32}$/);
    expect(data.url).not.toContain(token);
    expect(data.url).not.toContain("placeholder");
    expect(data.url).not.toContain("provider");
    expect(requests).toHaveLength(0);
  });
  it("preserves IPTV playlist channel URLs on the separate metadata route", async () => {
    await pair();
    const playlist = "#EXTM3U\n#EXTINF:-1,Example\nhttp://provider.example/live/1.m3u8";
    providerResponse = (_req, res) => { res.writeHead(200, { "Content-Type": "audio/x-mpegurl" }); res.end(playlist); };
    const response = await request("/source?url=" + encodeURIComponent("http://provider.example/list.m3u"),
      { headers: { Authorization: "Bearer " + token } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(playlist);
  });
  it("blocks private targets even after pairing", async () => {
    await pair();
    for (const url of ["http://127.0.0.1:22", "http://169.254.169.254/latest/meta-data", "http://[::1]/"]) {
      expect((await open(url)).status).toBe(403);
    }
  });
  it("streams through the computer and rewrites extensionless redirected HLS using the final URL", async () => {
    await pair();
    providerResponse = (req, res) => {
      if (req.url === "/live.m3u8") { res.writeHead(302, { Location: "/cdn/master" }); res.end(); }
      else if (req.url === "/cdn/master") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("#EXTM3U\n#EXTINF:4,\nchild/segment.ts\n#EXT-X-ENDLIST");
      } else { res.writeHead(200, { "Content-Type": "video/mp2t" }); res.end("test-video"); }
    };
    const media = (await (await open()).json()).url;
    const response = await fetch(media, { headers: { Origin: origin } });
    const manifest = await response.text();
    const segment = manifest.split("\n").find(line => line.startsWith("http://"));
    expect(segment).toMatch(/\/media\/[A-Za-z0-9_-]{32}$/);
    expect(manifest).not.toContain("provider.example");
    expect(await (await fetch(segment, { headers: { Origin: origin } })).text()).toBe("test-video");
    expect(requests.at(-1).url).toBe("http://provider.example/cdn/child/segment.ts");
    expect(requests.every(item => typeof item.lookup === "function")).toBe(true);
    expect(requests.every(item => !item.headers.Authorization && !item.headers.Cookie && !item.headers.Origin)).toBe(true);
  });
  it("checks every redirect destination and rejects private or unsafe destinations", async () => {
    await pair();
    for (const location of ["http://127.0.0.1/admin", "http://[::ffff:7f00:1]/", "file:///etc/passwd"]) {
      providerResponse = (_req, res) => { res.writeHead(302, { Location: location }); res.end(); };
      const media = (await (await open()).json()).url;
      const response = await fetch(media, { headers: { Origin: origin } });
      expect([400, 403]).toContain(response.status);
    }
  });
  it("rewrites compressed HLS and removes upstream encoding/length headers", async () => {
    await pair();
    const bytes = gzipSync("#EXTM3U\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST");
    providerResponse = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl", "Content-Encoding": "gzip", "Content-Length": bytes.length });
      res.end(bytes);
    };
    const media = (await (await open()).json()).url;
    const response = await fetch(media, { headers: { Origin: origin } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.text()).toContain("/media/");
  });
  it("limits provider redirect loops", async () => {
    await pair();
    providerResponse = (_req, res) => { res.writeHead(302, { Location: "/loop" }); res.end(); };
    const media = (await (await open()).json()).url;
    expect((await fetch(media, { headers: { Origin: origin } })).status).toBe(508);
    expect(requests).toHaveLength(6);
  });
  it("preserves byte ranges and does not forward the browser's credentials", async () => {
    await pair();
    providerResponse = (req, res) => {
      expect(req.headers.range).toBe("bytes=2-4");
      res.writeHead(206, { "Content-Type": "video/mp4", "Content-Range": "bytes 2-4/10", "Accept-Ranges": "bytes", "Content-Length": 3 });
      res.end("234");
    };
    const media = (await (await open("http://provider.example/video.mp4")).json()).url;
    const response = await fetch(media, { headers: { Origin: origin, Range: "bytes=2-4", Cookie: "private=test", Authorization: "Bearer unrelated" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(await response.text()).toBe("234");
    expect(requests[0].headers.Cookie).toBeUndefined();
    expect(requests[0].headers.Authorization).toBeUndefined();
  });
  it("permits originless HTML video requests with a ticket, but not navigation or foreign-origin requests", async () => {
    await pair();
    providerResponse = (_req, res) => { res.writeHead(200, { "Content-Type": "video/mp4" }); res.end("video"); };
    const media = (await (await open("http://provider.example/video.mp4")).json()).url;
    expect((await fetch(media)).status).toBe(401);
    expect((await fetch(media, { headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(200);
    expect((await fetch(media, { headers: { Origin: "https://evil.example" } })).status).toBe(403);
  });
  it("revokes media tickets when the browser disconnects", async () => {
    await pair();
    const media = (await (await open()).json()).url;
    expect((await request("/session", { method: "DELETE", headers: { Authorization: "Bearer " + token } })).status).toBe(204);
    expect((await fetch(media, { headers: { Origin: origin } })).status).toBe(401);
  });
  it("limits rewritten manifests", async () => {
    await pair();
    providerResponse = (_req, res) => { res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" }); res.end("#EXTM3U\n" + " ".repeat(2 * 1024 * 1024)); };
    const media = (await (await open()).json()).url;
    expect((await fetch(media, { headers: { Origin: origin } })).status).toBe(413);
  });
  it("times out a provider that never responds", async () => {
    await pair();
    providerResponse = () => {};
    const media = (await (await open()).json()).url;
    expect((await fetch(media, { headers: { Origin: origin } })).status).toBe(504);
  });
  it("cancels the provider stream when the browser stops reading", async () => {
    await pair();
    let cancelled = false;
    providerResponse = (_req, res) => {
      res.writeHead(200, { "Content-Type": "video/mp2t" });
      res.write("video-start");
      res.once("close", () => { cancelled = true; });
    };
    const media = (await (await open("http://provider.example/live.ts")).json()).url;
    const response = await fetch(media, { headers: { Origin: origin } });
    const reader = response.body.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(cancelled).toBe(true));
  });
});
