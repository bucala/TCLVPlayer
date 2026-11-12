import http from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelay } from "../api/stream.mjs";

const servers = [];
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
const packets = Buffer.alloc(376);
packets[0] = 0x47;
packets[188] = 0x47;
const video = { "content-type": "video/mp2t" };
const relayUrl = target => "/api/stream?url=" + encodeURIComponent(target);

async function relay(options = {}) {
  const handler = createRelay({ resolve: publicDns, env: {}, log: () => {}, ...options });
  const server = http.createServer((req, res) => { void handler(req, res); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const port = server.address().port;
  return { host: "127.0.0.1:" + port, get: (path, init) => get(port, path, init), open: (path, headers) => open(port, path, headers) };
}

function options(port, path, { headers = {}, method = "GET", site = "same-origin" } = {}) {
  return { host: "127.0.0.1", port, path, method, headers: { ...(site ? { "sec-fetch-site": site } : {}), ...headers } };
}

function get(port, path, init) {
  return new Promise((resolve, reject) => {
    const req = http.request(options(port, path, init), res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body, text: body.toString("utf8"), json: () => JSON.parse(body.toString("utf8")) });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// Resolves as soon as the response headers arrive, leaving the body unread.
function open(port, path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(options(port, path, { headers }), res => { res.pause(); resolve(res); });
    req.on("error", reject);
    req.end();
  });
}

function live({ chunk = packets, repeat = false, onCancel = () => {} } = {}) {
  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (!sent || repeat) controller.enqueue(new Uint8Array(chunk));
      sent = true;
    },
    cancel: onCancel,
  });
}

async function until(check, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error("Condition was not reached");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

describe("opt-in Vercel video relay", () => {
  it("serves only same-origin browser requests", async () => {
    const request = vi.fn(async () => new Response(packets, { headers: video }));
    const { get, host } = await relay({ request });
    const target = relayUrl("https://provider.example/live.ts");
    for (const init of [{ site: "" }, { site: "cross-site" }, { site: "same-site" },
      { headers: { origin: "https://other.example" } }, { headers: { origin: "null" } }]) {
      const response = await get(target, init);
      expect(response.status).toBe(403);
      expect(response.json().hint).toBe("same-origin");
    }
    expect(request).not.toHaveBeenCalled();
    expect((await get(target, { site: "", headers: { origin: "http://" + host } })).status).toBe(200);
    const allowed = await get(target);
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBeUndefined();
    expect(allowed.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(allowed.headers["cache-control"]).toBe("private, no-store");
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("accepts only GET and OPTIONS", async () => {
    const request = vi.fn();
    const { get } = await relay({ request });
    const preflight = await get(relayUrl("https://provider.example/live.ts"), { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    for (const method of ["POST", "PUT", "DELETE", "HEAD"]) {
      const response = await get(relayUrl("https://provider.example/live.ts"), { method });
      expect(response.status).toBe(405);
      expect(response.headers.allow).toBe("GET, OPTIONS");
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("reports its status and can be switched off for the whole deployment", async () => {
    const request = vi.fn(async () => new Response(packets, { headers: video }));
    const enabled = await relay({ request });
    expect((await enabled.get("/api/stream?status")).json()).toEqual({
      service: "tclv-video-relay", protocol: 1, enabled: true, maxStreamSeconds: 280,
    });
    expect(request).not.toHaveBeenCalled();
    for (const value of ["off", "0", " False ", "disabled"]) {
      const disabled = await relay({ request, env: { TCLV_VIDEO_RELAY: value } });
      expect((await disabled.get("/api/stream?status")).json().enabled).toBe(false);
      const response = await disabled.get(relayUrl("https://provider.example/live.ts"));
      expect(response.status).toBe(403);
      expect(response.json().hint).toBe("video-relay-disabled");
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects invalid, credentialed and self-referencing targets", async () => {
    const request = vi.fn();
    const { get, host } = await relay({ request });
    for (const path of ["/api/stream", "/api/stream?url=", relayUrl("ftp://provider.example/live.ts"),
      relayUrl("//provider.example/live.ts"), relayUrl("https://user:secret@provider.example/live.ts"),
      relayUrl("https://provider.example/" + "a".repeat(8200))]) {
      expect((await get(path)).status).toBe(400);
    }
    for (const target of ["http://" + host + "/api/stream?url=x", "http://" + host + "/index.html",
      "https://tclv-player.vercel.app/api/stream?url=x", "https://another.vercel.app/api/proxy?resource=source"]) {
      const response = await get(relayUrl(target));
      expect(response.status).toBe(400);
      expect(response.json().hint).toBe("loop");
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("never connects to private networks, directly or after a redirect", async () => {
    const request = vi.fn();
    const { get } = await relay({ request });
    for (const target of ["http://127.0.0.1:9/live.ts", "http://192.168.1.20/live.ts", "http://localhost/live.ts",
      "http://[::1]/live.ts", "http://169.254.169.254/latest/meta-data", "http://tv.internal/live.ts"]) {
      expect((await get(relayUrl(target))).status).toBe(403);
    }
    const rebound = await relay({ request, resolve: async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }] });
    expect((await rebound.get(relayUrl("https://provider.example/live.ts"))).status).toBe(403);
    expect(request).not.toHaveBeenCalled();

    request.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    expect((await get(relayUrl("https://provider.example/live.ts"))).status).toBe(403);
    expect(request).toHaveBeenCalledOnce();
  });

  it("follows vetted redirects and stops redirect loops", async () => {
    const request = vi.fn(async url => url.endsWith("/start.ts") ?
      new Response(null, { status: 302, headers: { location: "/edge/final.ts?token=1" } }) :
      new Response(packets, { headers: video }));
    const { get } = await relay({ request });
    const response = await get(relayUrl("https://provider.example/start.ts"));
    expect(response.status).toBe(200);
    expect(request.mock.calls.map(call => call[0])).toEqual(["https://provider.example/start.ts", "https://provider.example/edge/final.ts?token=1"]);
    expect(request.mock.calls.every(call => call[1].redirect === "manual")).toBe(true);

    const loop = await relay({ request: async () => new Response(null, { status: 307, headers: { location: "/again.ts" } }) });
    expect((await loop.get(relayUrl("https://provider.example/again.ts"))).status).toBe(508);
  });

  it("rewrites HLS manifests so renditions, segments and keys return through the relay", async () => {
    const manifest = ["#EXTM3U", '#EXT-X-KEY:METHOD=AES-128,URI="key.bin?id=7"', "#EXT-X-STREAM-INF:BANDWIDTH=800000",
      "low/index.m3u8?token=a&b=c", "#EXTINF:4,", "https://cdn.example/seg 1.ts", ""].join("\r\n");
    const request = vi.fn(async () => new Response(manifest, { headers: { "content-type": "text/plain" } }));
    const { get } = await relay({ request });
    const response = await get(relayUrl("https://provider.example/live/master?id=1#fragment"));
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/vnd.apple.mpegurl; charset=utf-8");
    expect(response.text.split("\n")).toEqual(["#EXTM3U",
      `#EXT-X-KEY:METHOD=AES-128,URI="${relayUrl("https://provider.example/live/key.bin?id=7")}"`,
      "#EXT-X-STREAM-INF:BANDWIDTH=800000",
      relayUrl("https://provider.example/live/low/index.m3u8?token=a&b=c"),
      "#EXTINF:4,",
      relayUrl("https://cdn.example/seg%201.ts"),
      ""]);
    expect(request.mock.calls[0][0]).toBe("https://provider.example/live/master?id=1");
  });

  it("refuses manifests it cannot rewrite safely", async () => {
    const oversized = await relay({ request: async () => new Response("#EXTM3U\n" + "#".repeat(2 * 1024 * 1024), { headers: { "content-type": "application/x-mpegurl" } }) });
    const large = await oversized.get(relayUrl("https://provider.example/live.m3u8"));
    expect(large.status).toBe(413);
    expect(large.json().hint).toBe("manifest-too-large");

    const variables = await relay({ request: async () => new Response("#EXTM3U\n#EXT-X-DEFINE:NAME=\"p\",VALUE=\"x\"\n{$p}/seg.ts\n") });
    const unsupported = await variables.get(relayUrl("https://provider.example/live.m3u8"));
    expect(unsupported.status).toBe(502);
    expect(unsupported.json().hint).toBe("unsupported-manifest");
  });

  it("passes media bytes and range metadata through without viewer credentials", async () => {
    const request = vi.fn(async () => new Response(packets.subarray(0, 100), { status: 206, headers: {
      ...video, "content-range": "bytes 0-99/376", "content-length": "100", "accept-ranges": "bytes", etag: '"v1"', "x-provider-secret": "1",
    } }));
    const { get } = await relay({ request });
    const response = await get(relayUrl("https://provider.example/movie.ts"), { headers: {
      range: "bytes=0-99", "if-range": '"v1"', cookie: "session=1", authorization: "Bearer viewer", referer: "https://tclv-player.vercel.app/", "user-agent": "TestPlayer/1.0",
    } });
    expect(response.status).toBe(206);
    expect(response.body.equals(packets.subarray(0, 100))).toBe(true);
    expect(response.headers).toMatchObject({ "content-type": "video/mp2t", "content-range": "bytes 0-99/376", "content-length": "100", "accept-ranges": "bytes", etag: '"v1"' });
    expect(response.headers["x-provider-secret"]).toBeUndefined();
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://provider.example/movie.ts");
    expect(init.headers).toEqual({
      "User-Agent": "TestPlayer/1.0", Accept: "*/*", "Accept-Encoding": "identity", Range: "bytes=0-99", "If-Range": '"v1"',
      Referer: "https://provider.example/", Origin: "https://provider.example",
    });
  });

  it("describes what the provider answered in Server-Timing without any address", async () => {
    const { get } = await relay({ env: { VERCEL_REGION: "fra1" }, request: async () => new Response(packets, { headers: { "content-type": "application/octet-stream" } }) });
    const response = await get(relayUrl("https://provider.example/live/user/pass/1234"));
    const timing = response.headers["server-timing"];
    expect(timing).toMatch(/^relay;desc="media video\/mp2t";dur=\d+, region;desc="fra1", provider;desc="200 application\/octet-stream";dur=\d+, hops;desc="0"$/);
    expect(timing).not.toMatch(/provider\.example|user|pass/);

    const logged = [];
    const logging = await relay({ log: line => logged.push(line), request: async () => new Response(packets, { headers: video }) });
    await logging.get(relayUrl("https://provider.example/live/user/pass/1234.ts"));
    await until(() => logged.length === 2);
    expect(logged[0]).toMatch(/^\[relay\] relay;desc="media video\/mp2t"/);
    expect(logged[1]).toMatch(/^\[relay\] end provider-closed kB=0 dur=\d+$/);
    expect(logged.join(" ")).not.toMatch(/provider\.example|user|pass/);

    const refused = await relay({ request: async () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED 93.184.216.34:80"), { code: "ECONNREFUSED" }) }); } });
    const failed = await refused.get(relayUrl("https://provider.example/live.ts"));
    expect(failed.json()).toEqual({ error: "Provider request failed", hint: "provider", detail: "ECONNREFUSED" });
    expect(failed.headers["server-timing"]).toMatch(/^relay;desc="error ECONNREFUSED"/);
    expect(failed.headers["server-timing"]).not.toContain("93.184.216.34");

    const rejected = await relay({ request: async () => new Response("denied", { status: 403, headers: { "content-type": "text/html" } }) });
    const forbidden = await rejected.get(relayUrl("https://provider.example/live.ts"));
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers["server-timing"]).toMatch(/relay;desc="error provider".*provider;desc="403 text\/html"/);
  });

  it("never passes provider URLs through in a partial HLS manifest", async () => {
    const manifest = "#EXTM3U\n#EXTINF:4,\nhttps://provider.example/segment.ts\n";
    const { get } = await relay({
      request: async () => new Response(manifest, { status: 206, headers: { "content-type": "application/vnd.apple.mpegurl" } }),
    });
    const response = await get(relayUrl("https://provider.example/live.m3u8"), { headers: { range: "bytes=0-" } });
    expect(response.status).toBe(502);
    expect(response.json().hint).toBe("unsupported-manifest");
    expect(response.text).not.toContain("provider.example");
  });

  it("drops malformed ranges and falls back to a browser user agent", async () => {
    const request = vi.fn(async () => new Response(packets, { headers: video }));
    const { get } = await relay({ request });
    await get(relayUrl("https://provider.example/movie.ts"), { headers: { range: "bytes=0-1,5-9", "if-range": '"v1"' } });
    const { headers } = request.mock.calls[0][1];
    expect(headers.Range).toBeUndefined();
    expect(headers["If-Range"]).toBeUndefined();
    expect(headers["User-Agent"]).toMatch(/^Mozilla\/5\.0 /);
  });

  it("relays media only, recognising mislabelled segments by their container", async () => {
    const cases = [
      [Buffer.from("<!doctype html><title>Portal</title>"), "text/html", 415],
      [Buffer.from('{"token":"value"}'), "application/json", 415],
      [Buffer.from("seventeen bytes!!"), "text/plain", 415],
      [packets, "text/html; charset=utf-8", 200, "video/mp2t"],
      [Buffer.from("0000001c667479706d703432", "hex"), "text/plain", 200, "video/mp4"],
      [Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nHi"), "text/plain", 200, "text/vtt"],
      [Buffer.from("0123456789abcdef"), "text/html", 200, "application/octet-stream"],
      [Buffer.from("opaque encrypted segment bytes"), "application/octet-stream", 200, "application/octet-stream"],
      // Live Xtream channels are often labelled generically; the player needs the container.
      [packets, "application/octet-stream", 200, "video/mp2t"],
      [Buffer.from("464c5601050000000900000000", "hex"), "binary/octet-stream", 200, "video/x-flv"],
    ];
    for (const [body, type, status, served] of cases) {
      const { get } = await relay({ request: async () => new Response(body, { headers: { "content-type": type } }) });
      const response = await get(relayUrl("https://provider.example/segment"));
      expect(response.status, type).toBe(status);
      if (status === 200) {
        expect(response.headers["content-type"]).toBe(served);
        expect(response.body.equals(body)).toBe(true);
      } else expect(response.json().hint).toBe("not-media");
    }
  });

  it("reports provider errors without relaying their bodies", async () => {
    const missing = await relay({ request: async () => new Response("<h1>Provider login</h1>", { status: 404, headers: { "content-type": "text/html" } }) });
    const response = await missing.get(relayUrl("https://provider.example/live.ts"));
    expect(response.status).toBe(404);
    expect(response.json()).toEqual({ error: "Provider returned 404", hint: "provider" });

    const range = await relay({ request: async () => new Response(null, { status: 416, headers: { "content-range": "bytes */376" } }) });
    const unsatisfied = await range.get(relayUrl("https://provider.example/movie.ts"), { headers: { range: "bytes=900-" } });
    expect(unsatisfied.status).toBe(416);
    expect(unsatisfied.headers["content-range"]).toBe("bytes */376");

    const broken = await relay({ request: async () => { throw new Error("connect ECONNREFUSED 93.184.216.34"); } });
    const failed = await broken.get(relayUrl("https://provider.example/live.ts"));
    expect(failed.status).toBe(502);
    expect(failed.text).not.toContain("93.184.216.34");
  });

  it("gives up on a provider that never answers", async () => {
    const request = (_url, init) => new Promise((_accept, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const { get } = await relay({ request, limits: { headersMs: 40 } });
    const response = await get(relayUrl("https://provider.example/live.ts"));
    expect(response.status).toBe(504);
    expect(response.json().hint).toBe("provider");
  });

  it("limits requests per viewer", async () => {
    const { get } = await relay({ request: async () => new Response(packets, { headers: video }), limits: { requests: 2 } });
    const target = relayUrl("https://provider.example/live.ts");
    expect((await get(target)).status).toBe(200);
    expect((await get(target)).status).toBe(200);
    const limited = await get(target);
    expect(limited.status).toBe(429);
    expect(limited.json().hint).toBe("relay-limit");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect((await get(target, { headers: { "x-vercel-forwarded-for": "203.0.113.7" } })).status).toBe(200);
  });

  it.each(["prefix", "manifest"])("bounds an idle provider while reading the %s", async phase => {
    let cancelled = false;
    const chunk = Buffer.from(phase === "manifest" ? "#EXTM3U\n#" + "x".repeat(200) : "#EXT");
    const request = async () => new Response(live({ chunk, onCancel: () => { cancelled = true; } }),
      { headers: { "content-type": "text/plain" } });
    const { get } = await relay({ request, limits: { idleMs: 40 } });
    const response = get(relayUrl("https://provider.example/live"));
    await until(() => cancelled, 600);
    expect((await response).status).toBe(504);
  });

  it("applies the absolute duration limit before the first media bytes", async () => {
    let cancelled = false, interval;
    const body = new ReadableStream({
      start(controller) { interval = setInterval(() => controller.enqueue(new Uint8Array([0x23])), 10); },
      cancel() { clearInterval(interval); cancelled = true; },
    });
    const { get } = await relay({
      request: async () => new Response(body, { headers: { "content-type": "text/plain" } }),
      limits: { streamMs: 70, idleMs: 1000 },
    });
    const response = get(relayUrl("https://provider.example/live"));
    await until(() => cancelled, 600);
    expect((await response).status).toBe(504);
  });

  it("caps concurrent streams and releases them when the viewer disconnects", async () => {
    let cancelled = 0;
    const request = vi.fn(async () => new Response(live({ onCancel: () => cancelled++ }), { headers: video }));
    const { get, open } = await relay({ request, limits: { clientStreams: 1 } });
    const target = relayUrl("https://provider.example/live.ts");
    const watching = await open(target);
    expect(watching.statusCode).toBe(200);
    const second = await get(target);
    expect(second.status).toBe(429);
    expect(second.headers["retry-after"]).toBe("2");
    watching.destroy();
    await until(() => cancelled === 1);
    const next = await open(target);
    expect(next.statusCode).toBe(200);
    next.destroy();
    await until(() => cancelled === 2);
  });

  it("ends a long response cleanly before the platform time limit", async () => {
    let cancelled = false;
    const request = async () => new Response(live({ repeat: true, onCancel: () => { cancelled = true; } }), { headers: video });
    const { get } = await relay({ request, limits: { streamMs: 80 } });
    const response = await get(relayUrl("https://provider.example/live.ts"));
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(packets.length);
    expect(response.body.length % packets.length).toBe(0);
    expect(cancelled).toBe(true);
  });

  it("is deployed with a time limit above its own stream cap and with cancellation", async () => {
    const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
    const deployed = config.functions["api/stream.mjs"];
    const { get } = await relay({ request: vi.fn() });
    expect(deployed.supportsCancellation).toBe(true);
    expect(deployed.maxDuration).toBeGreaterThan((await get("/api/stream?status")).json().maxStreamSeconds);
    expect(config.functions["api/proxy.mjs"].maxDuration).toBe(20);
  });

  it("keeps hosting functions as ES modules the CommonJS package default cannot break", () => {
    // Without "type": "module", Vercel bundles api/*.js as CommonJS and the
    // bridge/*.mjs imports then fail at cold start with ERR_REQUIRE_ESM.
    const packageType = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).type;
    const functions = readdirSync(new URL("../api/", import.meta.url));
    if (packageType !== "module") expect(functions.filter(name => name.endsWith(".js"))).toEqual([]);
    expect(functions).toEqual(expect.arrayContaining(["proxy.mjs", "stream.mjs"]));
  });

  it("stops reading from the provider when the viewer stops reading", async () => {
    let cancelled = false;
    const request = async () => new Response(live({ chunk: Buffer.alloc(256 * 1024, 0x47), repeat: true, onCancel: () => { cancelled = true; } }), { headers: video });
    const { open } = await relay({ request, limits: { idleMs: 60 } });
    const paused = await open(relayUrl("https://provider.example/live.ts"));
    await until(() => cancelled, 8000);
    paused.destroy();
  });
});
