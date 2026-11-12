import { Agent, fetch as providerFetch } from "undici";
import { parseTarget, resolveTarget } from "../bridge/security.mjs";
import { rewriteManifest } from "../bridge/server.mjs";

// Opt-in video relay for the web player. Unlike api/proxy.mjs it streams media,
// so every relayed byte counts against the deployment's Vercel transfer quota.
// Set TCLV_VIDEO_RELAY=off in the Vercel project to switch it off.
const RELAY_SERVICE = "tclv-video-relay";
const RELAY_PATH = "/api/stream";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const SNIFF_BYTES = 189;
const WINDOW_MS = 60000;
const MAX_CLIENTS = 5000;
const POOL_TTL_MS = 60000;
const MAX_POOLS = 64;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DEFAULT_LIMITS = {
  // HLS asks for a playlist and a segment every few seconds per rendition.
  requests: 900,
  clientStreams: 16,
  streams: 128,
  headersMs: 15000,
  idleMs: 30000,
  // Vercel stops the function at maxDuration (300 s in vercel.json). Ending a
  // live response shortly before that lets the player reconnect on a clean end.
  streamMs: 280000,
};
const PASSTHROUGH = ["content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const MEDIA_TYPE = /^(?:video\/|audio\/|application\/(?:octet-stream|vnd\.apple\.mpegurl|x-mpegurl|mp4|mp2t)\b|binary\/octet-stream\b|text\/vtt\b)/i;

function relayError(statusCode, message, hint) {
  return Object.assign(new Error(message), { statusCode, hint });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      return ["https:", "http:"].includes(parsed.protocol) && parsed.host === req.headers.host;
    } catch { return false; }
  }
  return req.headers["sec-fetch-site"] === "same-origin";
}

function queryOf(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try { return Object.fromEntries(new URL(req.url, "http://relay.invalid").searchParams); } catch { return {}; }
}

function clientKey(req) {
  return String(req.headers["x-vercel-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "local")
    .split(",")[0].trim();
}

function userAgent(req) {
  const value = req.headers["user-agent"];
  return typeof value === "string" && value.length <= 512 && /^[\x20-\x7e]+$/.test(value) ? value : DEFAULT_USER_AGENT;
}

function manifestCandidate(url, type) {
  return /\.m3u8?$/i.test(url.pathname) || !type || /mpegurl|text\/plain|octet-stream/i.test(type);
}

// Providers often label segments as text/html or text/plain. Recognise the
// container instead, so the relay stays limited to media without breaking them.
function sniffMedia(bytes) {
  if (bytes.length >= SNIFF_BYTES && bytes[0] === 0x47 && bytes[188] === 0x47) return "video/mp2t";
  if (bytes.length >= 12 && ["ftyp", "styp", "moof", "sidx"].includes(bytes.toString("latin1", 4, 8))) return "video/mp4";
  if (bytes.length >= 4 && bytes.toString("latin1", 0, 3) === "FLV") return "video/x-flv";
  if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  if (bytes.length >= 3 && bytes.toString("latin1", 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  if (bytes.toString("latin1", 0, 9).replace(/^\u00ef\u00bb\u00bf/, "").startsWith("WEBVTT")) return "text/vtt";
  return "";
}

function view(chunk) {
  return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
}

async function readManifest(read, first, size) {
  const chunks = [...first];
  if (size > MAX_MANIFEST_BYTES) throw relayError(413, "HLS manifest too large", "manifest-too-large");
  while (true) {
    const { done, value } = await read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_MANIFEST_BYTES) throw relayError(413, "HLS manifest too large", "manifest-too-large");
    chunks.push(view(value));
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

function write(res, chunk, idleMs) {
  if (res.destroyed || res.writableEnded) throw relayError(499, "Viewer closed the stream");
  if (res.write(chunk)) return undefined;
  return new Promise((accept, reject) => {
    // A paused player stops reading. Free the function instead of waiting for
    // the duration limit; the player asks again with Range when it resumes.
    const timer = setTimeout(() => { cleanup(); reject(relayError(499, "Viewer stopped reading")); }, idleMs);
    function cleanup() {
      clearTimeout(timer);
      res.off("drain", drained); res.off("close", closed); res.off("error", failed);
    }
    function drained() { cleanup(); accept(); }
    function closed() { cleanup(); reject(relayError(499, "Viewer closed the stream")); }
    function failed(error) { cleanup(); reject(error); }
    res.once("drain", drained);
    res.once("close", closed);
    res.once("error", failed);
  });
}

export function createRelay({
  resolve,
  request = providerFetch,
  env = process.env,
  now = Date.now,
  limits: limitOverrides,
} = {}) {
  const limits = { ...DEFAULT_LIMITS, ...limitOverrides };
  const clients = new Map();
  const pools = new Map();
  let streams = 0;
  let nextSweep = 0;

  function admit(key) {
    const time = now();
    if (time >= nextSweep) {
      nextSweep = time + 15000;
      for (const [id, entry] of clients) if (entry.expires <= time && !entry.streams) clients.delete(id);
    }
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= MAX_CLIENTS) return { retryAfter: 30 };
      entry = { count: 0, expires: time + WINDOW_MS, streams: 0 };
      clients.set(key, entry);
    } else if (entry.expires <= time) {
      entry.count = 0;
      entry.expires = time + WINDOW_MS;
    }
    if (++entry.count > limits.requests) return { retryAfter: Math.max(1, Math.ceil((entry.expires - time) / 1000)) };
    if (entry.streams >= limits.clientStreams || streams >= limits.streams) return { retryAfter: 2 };
    entry.streams++;
    streams++;
    return { entry };
  }

  // One keep-alive pool per provider origin avoids a new TCP/TLS handshake for
  // every segment. The pinned lookup answers for that origin only, so a pool is
  // never shared between hosts, and the DNS answer is vetted again each minute.
  function dispatcherFor(url) {
    const time = now();
    let pooled = pools.get(url.origin);
    if (!pooled || pooled.expires <= time) {
      if (pooled) retire(url.origin);
      const agent = resolveTarget(url, resolve).then(lookup => new Agent({
        connect: { lookup }, headersTimeout: limits.headersMs, bodyTimeout: limits.idleMs, keepAliveTimeout: 10000,
      }));
      pooled = { agent, expires: time + POOL_TTL_MS };
      pools.set(url.origin, pooled);
      agent.catch(() => { if (pools.get(url.origin) === pooled) pools.delete(url.origin); });
      if (pools.size > MAX_POOLS) retire(pools.keys().next().value);
    }
    return pooled.agent;
  }

  // close() lets responses that are still streaming finish on their sockets.
  function retire(origin) {
    const pooled = pools.get(origin);
    pools.delete(origin);
    pooled?.agent.then(agent => agent.close()).catch(() => {});
  }

  async function open(target, headers, signal) {
    let current = target;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const dispatcher = await dispatcherFor(current);
      if (signal.aborted) throw relayError(499, "Viewer closed the stream");
      const upstream = await request(current.href, { headers, dispatcher, redirect: "manual", signal });
      const location = REDIRECTS.has(upstream.status) ? upstream.headers.get("location") : null;
      if (!location) return { upstream, finalUrl: current };
      await upstream.body?.cancel().catch(() => {});
      current = parseTarget(new URL(location, current).href);
    }
    throw relayError(508, "Too many provider redirects", "provider");
  }

  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    if (!sameOrigin(req)) {
      send(res, 403, { error: "This relay is only available to this website", hint: "same-origin" });
      return;
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Allow", "GET, OPTIONS");
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      send(res, 405, { error: "Method not allowed" });
      return;
    }

    const query = queryOf(req);
    const enabled = !/^(?:0|off|false|no|disabled)$/i.test(String(env.TCLV_VIDEO_RELAY || "").trim());
    if (query.status !== undefined) {
      send(res, 200, { service: RELAY_SERVICE, protocol: 1, enabled, maxStreamSeconds: Math.round(limits.streamMs / 1000) });
      return;
    }
    if (!enabled) {
      send(res, 403, { error: "Video relay is disabled on this deployment", hint: "video-relay-disabled" });
      return;
    }

    let target;
    try { target = parseTarget(query.url); } catch {
      send(res, 400, { error: "Invalid stream URL" });
      return;
    }
    if (target.host === req.headers.host ||
        (target.hostname.endsWith(".vercel.app") && /^\/api\/(?:proxy|stream)$/.test(target.pathname))) {
      send(res, 400, { error: "A relay cannot be relayed", hint: "loop" });
      return;
    }

    const admission = admit(clientKey(req));
    if (!admission.entry) {
      res.setHeader("Retry-After", String(admission.retryAfter));
      send(res, 429, { error: "Video relay limit reached", hint: "relay-limit" });
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    let streamLimit = false;
    let reader;
    const cancel = () => { controller.abort(); reader?.cancel().catch(() => {}); };
    // Include header, sniff and manifest reads in the absolute deadline, not
    // just a media response that has already started reaching the viewer.
    const streamTimer = setTimeout(() => { streamLimit = true; timedOut = true; cancel(); }, limits.streamMs);
    const headersTimer = setTimeout(() => { timedOut = true; controller.abort(); }, limits.headersMs);
    async function read() {
      const timer = setTimeout(() => { timedOut = true; cancel(); }, limits.idleMs);
      try {
        const chunk = await reader.read();
        if (timedOut) throw relayError(504, "Provider timed out", "provider");
        return chunk;
      } finally { clearTimeout(timer); }
    }
    // With supportsCancellation Vercel reports a disconnect as a request error.
    // The listener stays attached so a late error can never go unhandled.
    req.on("error", cancel);
    req.once("aborted", cancel);
    res.once("close", cancel);

    try {
      const headers = { "User-Agent": userAgent(req), Accept: "*/*", "Accept-Encoding": "identity" };
      const range = req.headers.range;
      if (typeof range === "string" && /^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
        headers.Range = range;
        const condition = req.headers["if-range"];
        if (typeof condition === "string" && condition.length <= 256) headers["If-Range"] = condition;
      }

      const { upstream, finalUrl } = await open(target, headers, controller.signal);
      clearTimeout(headersTimer);
      const status = upstream.status;
      reader = upstream.body?.getReader();
      if (controller.signal.aborted) throw relayError(499, "Viewer closed the stream");
      if (status < 200 || status >= 300) {
        const contentRange = upstream.headers.get("content-range");
        if (status === 416 && contentRange) res.setHeader("Content-Range", contentRange);
        throw relayError(status >= 400 && status <= 599 ? status : 502, "Provider returned " + status, "provider");
      }

      const type = upstream.headers.get("content-type") || "";
      const knownMedia = !type || MEDIA_TYPE.test(type);
      const first = [];
      let sniffed = 0;
      let whole = !reader;
      if (reader && (!knownMedia || manifestCandidate(finalUrl, type))) {
        while (sniffed < SNIFF_BYTES) {
          const { done, value } = await read();
          if (done) { whole = true; break; }
          first.push(view(value));
          sniffed += value.byteLength;
        }
      }
      const head = first.length === 1 ? first[0] : Buffer.concat(first, sniffed);

      if (head.subarray(0, 16).toString("utf8").replace(/^\uFEFF/, "").startsWith("#EXTM3U")) {
        if (status !== 200) throw relayError(502, "Partial HLS manifest responses are not supported", "unsupported-manifest");
        const text = await readManifest(read, first, sniffed);
        let rewritten;
        try {
          rewritten = rewriteManifest(text, finalUrl, value => RELAY_PATH + "?url=" + encodeURIComponent(value));
        } catch { throw relayError(502, "Unsupported HLS manifest", "unsupported-manifest"); }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        res.end(rewritten);
        return;
      }

      // A 16-byte body is an AES-128 segment key, whatever the provider calls it.
      // Generic labels say nothing about the container; the player needs it.
      const generic = !type || /^(?:application|binary)\/octet-stream\b/i.test(type);
      const media = knownMedia ? (generic && sniffMedia(head)) || type || "application/octet-stream" :
        sniffMedia(head) || (whole && sniffed === 16 ? "application/octet-stream" : "");
      if (!media) throw relayError(415, "Only video and audio streams can be relayed", "not-media");

      const outgoing = { "Content-Type": media };
      const encoding = (upstream.headers.get("content-encoding") || "identity").toLowerCase();
      for (const name of PASSTHROUGH) {
        const value = upstream.headers.get(name);
        // The body of an encoded response arrives decoded; its sizes no longer apply.
        if (value && (encoding === "identity" || !["content-length", "content-range"].includes(name))) outgoing[name] = value;
      }
      res.writeHead(status, outgoing);
      for (const chunk of first) await write(res, chunk, limits.idleMs);
      while (reader) {
        const { done, value } = await read();
        if (done) break;
        await write(res, value, limits.idleMs);
      }
      res.end();
    } catch (error) {
      if (res.destroyed) return;
      if (res.headersSent) { if (streamLimit) res.end(); else res.destroy(); return; }
      if (error?.statusCode) {
        send(res, error.statusCode, { error: error.message, hint: error.hint });
        return;
      }
      send(res, timedOut ? 504 : 502, { error: timedOut ? "Provider timed out" : "Provider request failed", hint: "provider" });
    } finally {
      clearTimeout(headersTimer);
      clearTimeout(streamTimer);
      cancel();
      req.off("aborted", cancel);
      res.off("close", cancel);
      admission.entry.streams--;
      streams--;
    }
  };
}

export default createRelay();
