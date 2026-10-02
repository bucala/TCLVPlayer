import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/proxy.js";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const MAX_BYTES = 3 * 1024 * 1024;
const playlist = "#EXTM3U\n#EXTINF:-1,Example\nhttps://media.example/live.m3u8";
const epg = '<?xml version="1.0"?><tv><channel id="example"/></tv>';

function request(query = {}, headers = {}, method = "GET") {
  return Object.assign(new EventEmitter(), {
    method,
    query: { resource: "source", url: "https://sources.example/list.m3u", ...query },
    headers: { host: "tclv-player.vercel.app", "sec-fetch-site": "same-origin", ...headers },
  });
}

function response() {
  return Object.assign(new EventEmitter(), {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
    send(body) { this.body = body; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
  });
}

async function run(req = request()) {
  const res = response();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(playlist)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("source-only Vercel proxy", () => {
  it("disables the legacy video endpoint before fetching", async () => {
    const res = await run(request({ resource: undefined, url: "https://media.example/live.m3u8" }));
    expect(res.statusCode).toBe(403);
    expect(res.body.hint).toBe("source-only");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["segment.ts", "segment.m4s", "movie.mp4", "movie.webm", "live.flv"])(
    "rejects a video URL ending in %s before fetching",
    async name => {
      const res = await run(request({ url: `https://media.example/${name}` }));
      expect(res.statusCode).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects browser requests from another website", async () => {
    const res = await run(request({}, { origin: "https://other.example", "sec-fetch-site": "cross-site" }));
    expect(res.statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("requires same-origin browser context when Origin is absent", async () => {
    const res = await run(request({}, { "sec-fetch-site": undefined }));
    expect(res.statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows a same-origin preflight without downloading a source", async () => {
    const res = await run(request({}, { origin: "https://tclv-player.vercel.app" }, "OPTIONS"));
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://tclv-player.vercel.app");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects methods other than GET and OPTIONS", async () => {
    const res = await run(request({}, {}, "POST"));
    expect(res.statusCode).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects URL credentials and duplicate URL parameters", async () => {
    expect((await run(request({ url: "https://user:secret@sources.example/list.m3u" }))).statusCode).toBe(400);
    expect((await run(request({ url: ["https://sources.example/list.m3u"] }))).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["http://127.0.0.1/list.m3u", "http://192.168.1.1/epg.xml", "http://localhost/epg.xml"])(
    "rejects private destination %s",
    async url => {
      expect((await run(request({ url }))).statusCode).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("checks DNS before fetching and rejects private resolutions", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    expect((await run()).statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects both HLS master playlists and media playlists", async () => {
    for (const text of [
      "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nvariant.m3u8",
      "#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nsegment.ts",
    ]) {
      fetch.mockResolvedValueOnce(new Response(text, { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
      const res = await run(request({ url: "https://media.example/live.m3u8" }));
      expect(res.statusCode).toBe(415);
      expect(res.body.hint).toBe("source-only");
    }
  });

  it("rejects video disguised as an XML URL", async () => {
    fetch.mockResolvedValueOnce(new Response("binary", { headers: { "content-type": "video/mp2t" } }));
    const res = await run(request({ url: "https://media.example/epg.xml" }));
    expect(res.statusCode).toBe(415);
  });

  it("rejects binary or HTML bodies regardless of filename", async () => {
    fetch.mockResolvedValueOnce(new Response("<html>Not an EPG</html>"));
    expect((await run(request({ url: "https://sources.example/epg.xml" }))).statusCode).toBe(415);
  });

  it("serves an IPTV playlist without shared caching by default", async () => {
    const res = await run();
    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe(playlist);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(res.headers["content-length"]).toBeUndefined();
  });

  it("supports a provider's Xtream playlist URL without caching it publicly", async () => {
    const res = await run(request({ url: "https://sources.example/get.php?type=m3u_plus&username=user&password=secret" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("rejects get.php requests that do not explicitly request an M3U playlist", async () => {
    expect((await run(request({ url: "https://sources.example/get.php?type=video" }))).statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caches known public playlists on the CDN for 15 minutes", async () => {
    const res = await run(request({ url: "https://raw.githubusercontent.com/public/lists/main/example.m3u" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage=900");
  });

  it("caches known public XMLTV EPG on the CDN for one hour", async () => {
    fetch.mockResolvedValueOnce(new Response(epg));
    const res = await run(request({ url: "https://raw.githubusercontent.com/public/epg/main/example.xml" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage=3600");
    expect(res.headers["content-type"]).toBe("application/xml; charset=utf-8");
  });

  it.each([
    { url: "https://raw.githubusercontent.com/public/lists/main/example.m3u?token=secret" },
    { url: "https://raw.githubusercontent.com/public/lists/main/example.m3u", refresh: "1" },
  ])("does not share cache for query-bearing or refreshed sources", async query => {
    const res = await run(request(query));
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it.each([{ "set-cookie": "session=private" }, { "cache-control": "private" }])(
    "respects private upstream headers",
    async headers => {
      fetch.mockResolvedValueOnce(new Response(playlist, { headers }));
      const res = await run(request({ url: "https://raw.githubusercontent.com/public/lists/main/example.m3u" }));
      expect(res.headers["cache-control"]).toBe("private, no-store");
    },
  );

  it("decodes a .gz EPG and does not forward the compressed Content-Length", async () => {
    const compressed = gzipSync(epg);
    fetch.mockResolvedValueOnce(new Response(compressed, {
      headers: { "content-type": "application/gzip", "content-length": String(compressed.length) },
    }));
    const res = await run(request({ url: "https://sources.example/epg.xml.gz" }));
    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe(epg);
    expect(res.headers["content-length"]).toBeUndefined();
  });

  it("accepts an XMLTV document with an XML declaration, comment, and doctype", async () => {
    fetch.mockResolvedValueOnce(new Response('<?xml version="1.0"?><!--guide--><!DOCTYPE tv SYSTEM "xmltv.dtd"><tv></tv>'));
    expect((await run(request({ url: "https://sources.example/epg.xml" }))).statusCode).toBe(200);
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    fetch.mockResolvedValueOnce(new Response(epg, { headers: { "content-length": String(MAX_BYTES + 1) } }));
    const res = await run(request({ url: "https://sources.example/epg.xml" }));
    expect(res.statusCode).toBe(413);
    expect(res.body.hint).toBe("source-too-large");
  });

  it("bounds streamed downloads without Content-Length and cancels oversized bodies", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    fetch.mockResolvedValueOnce(new Response(body));
    expect((await run()).statusCode).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("limits the expanded size of compressed sources", async () => {
    const compressed = gzipSync(`<tv>${"x".repeat(MAX_BYTES)}</tv>`);
    fetch.mockResolvedValueOnce(new Response(compressed));
    expect((await run(request({ url: "https://sources.example/epg.xml.gz" }))).statusCode).toBe(413);
  });

  it("also bounds the final UTF-8 response after invalid input bytes expand", async () => {
    const bytes = new Uint8Array(MAX_BYTES);
    bytes.fill(0x80);
    bytes.set(new TextEncoder().encode("<tv>"));
    fetch.mockResolvedValueOnce(new Response(bytes));
    expect((await run(request({ url: "https://sources.example/epg.xml" }))).statusCode).toBe(413);
  });

  it("rechecks redirects and never fetches a private redirect target", async () => {
    fetch.mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: "http://127.0.0.1/epg.xml" },
    }));
    expect((await run()).statusCode).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a redirect to a video URL before downloading it", async () => {
    fetch.mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: "https://media.example/movie.mp4" },
    }));
    expect((await run()).statusCode).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not cache a public URL that redirects to a private source", async () => {
    fetch.mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: "https://sources.example/list.m3u?token=private" },
    })).mockResolvedValueOnce(new Response(playlist));
    const res = await run(request({ url: "https://raw.githubusercontent.com/public/lists/main/example.m3u" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("does not expose source URLs or credentials in network errors", async () => {
    fetch.mockRejectedValueOnce(new Error("secret network details"));
    const res = await run();
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("Source download failed");
  });

  it("aborts source downloads after 15 seconds", async () => {
    vi.useFakeTimers();
    fetch.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = run();
    await vi.advanceTimersByTimeAsync(15000);
    const res = await pending;
    expect(res.statusCode).toBe(504);
  });
});
