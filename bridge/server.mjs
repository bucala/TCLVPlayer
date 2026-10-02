import http from "node:http";
import https from "node:https";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
import { bridgeError, parseTarget, resolveTarget } from "./security.mjs";

export const BRIDGE_SERVICE = "tclv-bridge";
export const BRIDGE_PROTOCOL = 1;
export const BRIDGE_VERSION = "2.0.0";
export const DEFAULT_ORIGINS = ["https://tclv-player.vercel.app", "http://127.0.0.1:3000", "http://localhost:3000"];
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_SESSION_AGE = 12 * 60 * 60 * 1000;
const MAX_TICKETS = 10000;
const MAX_SESSIONS = 8;

function equalSecret(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function localHost(req) {
  return /^127\.0\.0\.1:\d+$/.test(req.headers.host || "");
}

async function readJson(req) {
  if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) throw bridgeError(415, "JSON required");
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (body.length > 16384) throw bridgeError(413, "Request too large");
  }
  try { return JSON.parse(body); } catch { throw bridgeError(400, "Invalid JSON"); }
}

export function rewriteManifest(text, finalUrl, resourceUrl) {
  if (!text.replace(/^\uFEFF/, "").startsWith("#EXTM3U")) throw bridgeError(502, "Invalid HLS manifest");
  function rewrite(uri) {
    if (uri.includes("{$")) throw bridgeError(422, "HLS variable references are not supported by this bridge");
    return resourceUrl(parseTarget(new URL(uri, finalUrl).href).href);
  }
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (!line.trimStart().startsWith("#")) return rewrite(line.trim());
    return line.replace(/\b(URI|SERVER-URI)="([^"]*)"/g, (_match, key, uri) => `${key}="${rewrite(uri)}"`);
  }).join("\n");
}

async function openProvider(initialUrl, headers, signal, resolve, timeoutMs) {
  let current = initialUrl;
  for (let hop = 0; hop <= 5; hop++) {
    const checkedLookup = await resolveTarget(current, resolve);
    if (signal.aborted) throw bridgeError(499, "Request cancelled");
    const upstream = await new Promise((accept, reject) => {
      const transport = current.protocol === "https:" ? https : http;
      const request = transport.get(current, {
        headers,
        lookup: checkedLookup,
        signal,
      }, accept);
      request.on("error", reject);
      request.setTimeout(timeoutMs, () => request.destroy(bridgeError(504, "Provider timed out")));
    });
    if (!REDIRECTS.has(upstream.statusCode) || !upstream.headers.location) return { upstream, finalUrl: current };
    upstream.destroy();
    if (hop === 5) throw bridgeError(508, "Too many provider redirects");
    current = parseTarget(new URL(upstream.headers.location, current).href);
  }
}

function manifestCandidate(url, contentType) {
  return /\.m3u8$/i.test(url.pathname) || /(?:mpegurl|text\/plain|application\/octet-stream)/i.test(contentType);
}

async function boundedManifest(upstream, first, iterator) {
  const chunks = [...first];
  let size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (size > MAX_MANIFEST_BYTES) throw bridgeError(413, "HLS manifest too large");
  for await (const chunk of iterator) {
    size += chunk.length;
    if (size > MAX_MANIFEST_BYTES) throw bridgeError(413, "HLS manifest too large");
    chunks.push(chunk);
  }
  if (!upstream.complete) throw bridgeError(502, "Incomplete HLS manifest");
  return Buffer.concat(chunks, size);
}

function decodeManifest(bytes, encoding) {
  const decoders = { gzip: gunzipSync, deflate: inflateSync, br: brotliDecompressSync };
  if (encoding && encoding !== "identity") {
    const decode = decoders[String(encoding).toLowerCase()];
    if (!decode) throw bridgeError(502, "Unsupported HLS content encoding");
    try { bytes = decode(bytes, { maxOutputLength: MAX_MANIFEST_BYTES }); }
    catch { throw bridgeError(413, "Invalid or oversized compressed HLS manifest"); }
  }
  return bytes.toString("utf8");
}

async function writeChunk(res, chunk) {
  if (res.destroyed) throw bridgeError(499, "Request cancelled");
  if (res.write(chunk)) return;
  await new Promise((accept, reject) => {
    function cleanup() { res.off("drain", drained); res.off("close", closed); res.off("error", failed); }
    function drained() { cleanup(); accept(); }
    function closed() { cleanup(); reject(bridgeError(499, "Request cancelled")); }
    function failed(error) { cleanup(); reject(error); }
    res.once("drain", drained);
    res.once("close", closed);
    res.once("error", failed);
  });
}

export function createBridge({
  origins = DEFAULT_ORIGINS,
  pairingCode = randomBytes(6).toString("hex").toUpperCase(),
  resolve,
  timeoutMs = 30000,
  now = Date.now,
} = {}) {
  const allowedOrigins = new Set(origins.map(value => {
    const parsed = new URL(value);
    if (parsed.origin !== value || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid allowed origin");
    return value;
  }));
  const sessions = new Map();
  const pairAttempts = new Map();
  const tickets = new Map();
  let activeRequests = 0;

  function sessionFor(req, origin) {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const session = sessions.get(token);
    if (!session || session.origin !== origin || session.expires <= now()) {
      if (session) sessions.delete(token);
      throw bridgeError(401, "Pair this browser with TCLV Bridge");
    }
    return { token, session };
  }

  function resourceUrl(target, token, session) {
    const existing = session.resources.get(target);
    if (existing && tickets.get(existing)?.expires > now()) return localUrl("/media/" + existing);
    while (tickets.size >= MAX_TICKETS) {
      const oldest = tickets.keys().next().value;
      const old = tickets.get(oldest);
      sessions.get(old.token)?.resources.delete(old.target);
      tickets.delete(oldest);
    }
    const id = randomBytes(24).toString("base64url");
    tickets.set(id, { target, token, origin: session.origin, expires: session.expires });
    session.resources.set(target, id);
    return localUrl("/media/" + id);
  }

  function localUrl(path) {
    return `http://127.0.0.1:${server.address().port}${path}`;
  }

  function forget(token) {
    sessions.delete(token);
    for (const [id, ticket] of tickets) if (ticket.token === token) tickets.delete(id);
  }

  async function relay(req, res, target, token, session, rewriteHls = true) {
    if (activeRequests >= 32) throw bridgeError(429, "Too many active bridge requests");
    activeRequests++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let manifestTimer;
    const cancel = () => controller.abort();
    req.once("aborted", cancel);
    res.once("close", cancel);
    let upstream;
    try {
      const headers = { "User-Agent": "TCLVBridge/2.0", Accept: "*/*", "Accept-Encoding": "identity" };
      if (req.headers.range && /^bytes=(?:\d+-\d*|-\d+)$/.test(req.headers.range)) headers.Range = req.headers.range;
      if (req.headers["if-range"]) headers["If-Range"] = req.headers["if-range"];
      const result = await openProvider(parseTarget(target), headers, controller.signal, resolve, timeoutMs);
      upstream = result.upstream;
      clearTimeout(timer);
      const status = upstream.statusCode || 502;
      if (status < 200 || status >= 300) {
        upstream.destroy();
        if (status === 416 && upstream.headers["content-range"]) res.setHeader("Content-Range", upstream.headers["content-range"]);
        json(res, status, { error: "Provider returned " + status });
        return;
      }
      const type = upstream.headers["content-type"] || "application/octet-stream";
      const iterator = upstream[Symbol.asyncIterator]();
      const first = [];
      // Sniff extensionless manifests too, without buffering a live video body.
      if (rewriteHls && manifestCandidate(result.finalUrl, type)) {
        let size = 0;
        while (size < 11) {
          const next = await iterator.next();
          if (next.done) break;
          first.push(next.value);
          size += next.value.length;
        }
      }
      const isManifest = first.length && Buffer.concat(first).subarray(0, 16).toString("utf8").replace(/^\uFEFF/, "").startsWith("#EXTM3U");
      const encodedManifest = rewriteHls && upstream.headers["content-encoding"] &&
        (/\.m3u8$/i.test(result.finalUrl.pathname) || /mpegurl/i.test(type));
      if ((isManifest || encodedManifest) && status === 200) {
        manifestTimer = setTimeout(() => controller.abort(), timeoutMs);
        const bytes = await boundedManifest(upstream, first, iterator);
        const text = decodeManifest(bytes, upstream.headers["content-encoding"]);
        const rewritten = rewriteManifest(text, result.finalUrl, value => resourceUrl(value, token, session));
        res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8" });
        res.end(rewritten);
        return;
      }
      const outgoing = { "Content-Type": /^(?:text\/html|application\/(?:xhtml\+xml|javascript))\b/i.test(type) ?
        "application/octet-stream" : type };
      for (const name of ["content-length", "content-range", "accept-ranges", "content-encoding", "etag", "last-modified"]) {
        if (upstream.headers[name]) outgoing[name] = upstream.headers[name];
      }
      res.writeHead(status, outgoing);
      for (const chunk of first) await writeChunk(res, chunk);
      for await (const chunk of iterator) await writeChunk(res, chunk);
      res.end();
    } finally {
      clearTimeout(timer);
      clearTimeout(manifestTimer);
      controller.abort();
      upstream?.destroy();
      req.off("aborted", cancel);
      res.off("close", cancel);
      activeRequests--;
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    try {
      if (!localHost(req)) throw bridgeError(403, "Invalid bridge host");
      const origin = req.headers.origin || "";
      const url = new URL(req.url, "http://127.0.0.1");
      const mediaRequest = url.pathname.startsWith("/media/");
      if (origin && allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Private-Network", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Range, If-Range");
        res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      } else if (origin || !mediaRequest) throw bridgeError(403, "This website is not allowed to use TCLV Bridge");

      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      if (url.pathname === "/ping" && req.method === "GET") {
        json(res, 200, { service: BRIDGE_SERVICE, protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, pairingRequired: true });
        return;
      }
      if (url.pathname === "/pair" && req.method === "POST") {
        const attempts = pairAttempts.get(origin);
        if (attempts && attempts.reset > now() && attempts.count >= 5) throw bridgeError(429, "Wait a minute before pairing again");
        const body = await readJson(req);
        if (!equalSecret(String(body.code || "").trim().toUpperCase(), pairingCode)) {
          pairAttempts.set(origin, { count: (attempts?.reset > now() ? attempts.count : 0) + 1, reset: now() + 60000 });
          throw bridgeError(403, "Incorrect pairing code");
        }
        pairAttempts.delete(origin);
        for (const [token, old] of sessions) if (old.origin === origin || old.expires <= now()) forget(token);
        if (sessions.size >= MAX_SESSIONS) throw bridgeError(429, "Too many paired browsers");
        const token = randomBytes(32).toString("base64url");
        const expires = now() + MAX_SESSION_AGE;
        sessions.set(token, { origin, expires, resources: new Map() });
        json(res, 200, { token, expires });
        return;
      }
      if (url.pathname === "/session" && ["GET", "DELETE"].includes(req.method)) {
        const { token, session } = sessionFor(req, origin);
        if (req.method === "DELETE") { forget(token); res.writeHead(204); res.end(); }
        else json(res, 200, { paired: true, expires: session.expires });
        return;
      }
      if (url.pathname === "/open" && req.method === "POST") {
        const { token, session } = sessionFor(req, origin);
        const body = await readJson(req);
        const target = parseTarget(body.url);
        await resolveTarget(target, resolve);
        json(res, 200, { url: resourceUrl(target.href, token, session) });
        return;
      }
      if (url.pathname === "/source" && req.method === "GET") {
        const { token, session } = sessionFor(req, origin);
        await relay(req, res, parseTarget(url.searchParams.get("url")).href, token, session, false);
        return;
      }
      if (mediaRequest && req.method === "GET") {
        const ticket = tickets.get(url.pathname.slice("/media/".length));
        const session = ticket && sessions.get(ticket.token);
        const site = req.headers["sec-fetch-site"];
        if (!ticket || !session || ticket.expires <= now() ||
            (origin ? origin !== ticket.origin : !["cross-site", "same-site", "same-origin"].includes(site))) {
          throw bridgeError(401, "Invalid or expired media ticket");
        }
        await relay(req, res, ticket.target, ticket.token, session);
        return;
      }
      throw bridgeError(404, "Bridge route not found");
    } catch (error) {
      if (res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      json(res, error.statusCode || (error.name === "AbortError" ? 504 : 502),
        { error: error.statusCode ? error.message : "Provider request failed" });
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return { server, pairingCode };
}
