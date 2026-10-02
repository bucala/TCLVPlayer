import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { gunzipSync } from "node:zlib";

const MAX_REDIRECTS = 5;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 15000;
const PUBLIC_SOURCE_HOSTS = new Set([
  "raw.githubusercontent.com",
  "iptv-org.github.io",
]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (!isSameOriginRequest(req)) {
    res.status(403).json({ error: "This proxy is only available to this website" });
    return;
  }

  if (req.headers.origin) res.setHeader("Access-Control-Allow-Origin", req.headers.origin);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (req.query.resource !== "source") {
    res.status(403).json({
      error: "Only playlist and EPG downloads are supported; video proxying is disabled",
      hint: "source-only",
    });
    return;
  }

  let target;
  try {
    target = parseProxyUrl(req.query.url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!isAllowedProtocol(target)) {
    res.status(400).json({ error: "Only http/https URLs allowed" });
    return;
  }

  if (!isSourceUrl(target)) {
    res.status(403).json({ error: "Only playlist and EPG URLs are supported", hint: "source-only" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  const abort = () => controller.abort();
  req.once?.("aborted", abort);
  res.once?.("close", abort);

  try {
    const { upstream, finalUrl } = await fetchWithCheckedRedirects(target, controller.signal);

    if (!upstream.ok) {
      await upstream.body?.cancel();
      res.status(upstream.status).json({ error: `Source returned ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (/^(video\/|audio\/(?!x-mpegurl|mpegurl)|image\/)/i.test(contentType)) {
      await upstream.body?.cancel();
      throw sourceError(415, "Video and binary media are not supported", "source-only");
    }
    if (Number(upstream.headers.get("content-length")) > MAX_SOURCE_BYTES) {
      await upstream.body?.cancel();
      throw sourceError(413, "Source exceeds the 3 MiB proxy limit", "source-too-large");
    }

    let bytes = await readBoundedBody(upstream.body);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      try {
        bytes = gunzipSync(bytes, { maxOutputLength: MAX_SOURCE_BYTES });
      } catch {
        throw sourceError(413, "Compressed source is invalid or exceeds the 3 MiB limit", "source-too-large");
      }
    }
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
    const kind = sourceKind(text);
    if (!kind) throw sourceError(415, "Only IPTV playlists and XMLTV EPG are supported, not HLS video", "source-only");
    const payload = Buffer.from(text);
    if (payload.length > MAX_SOURCE_BYTES) {
      throw sourceError(413, "Source exceeds the 3 MiB proxy limit", "source-too-large");
    }

    const publicSource = isPublicCacheSource(target) && isPublicCacheSource(finalUrl) &&
      !req.query.refresh && !upstream.headers.has("set-cookie") &&
      !/\b(private|no-store)\b/i.test(upstream.headers.get("cache-control") || "");
    if (publicSource) {
      const ttl = kind === "epg" ? 3600 : 900;
      res.setHeader("Cache-Control", `public, max-age=300, s-maxage=${ttl}, stale-while-revalidate=300`);
    } else {
      res.setHeader("Cache-Control", "private, no-store");
    }
    res.setHeader("Content-Type", `${kind === "epg" ? "application/xml" : "text/plain"}; charset=utf-8`);
    res.status(200).send(payload);
  } catch (err) {
    if (res.headersSent || res.destroyed) return;
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message, hint: err.hint });
      return;
    }
    res.status(controller.signal.aborted ? 504 : 502).json({
      error: controller.signal.aborted ? "Source download timed out" : "Source download failed",
    });
  } finally {
    clearTimeout(timer);
    req.removeListener?.("aborted", abort);
    res.removeListener?.("close", abort);
  }
}

function isSameOriginRequest(req) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === req.headers.host;
    } catch { return false; }
  }
  return req.headers["sec-fetch-site"] === "same-origin";
}

function parseProxyUrl(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Invalid URL");
  const url = new URL(raw);
  if (url.username || url.password) throw new Error("URL credentials are not supported");
  return url;
}

function isAllowedProtocol(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isSourceUrl(url) {
  let path;
  try { path = decodeURIComponent(url.pathname).toLowerCase(); } catch { return false; }
  if (/\.(m3u8?|xspf|xml|xmltv)(\.gz)?$/.test(path)) return true;
  if (/\/(xmltv\.php|epg\.php|playlist|epg)$/.test(path)) return true;
  if (path.endsWith("/get.php")) return /^m3u(_plus)?$/i.test(url.searchParams.get("type") || "");
  return url.hostname === "drive.google.com" && path === "/uc" && url.searchParams.has("id");
}

function sourceKind(text) {
  if (/#EXT-X-/i.test(text)) return null;
  const start = text.replace(/^(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE\s+(?:tv|playlist)\b[^>]*>\s*)*/i, "");
  if (/^<tv(?:\s|>)/i.test(start)) return "epg";
  if (/^<playlist(?:\s|>)/i.test(start)) return "playlist";
  if (/^#EXTM3U\b/i.test(text) || /^(https?|rtsp|rtmp):\/\/\S+/im.test(text)) return "playlist";
  return null;
}

function isPublicCacheSource(url) {
  return url.protocol === "https:" && PUBLIC_SOURCE_HOSTS.has(url.hostname) && !url.search;
}

function sourceError(statusCode, message, hint) {
  return Object.assign(new Error(message), { statusCode, hint });
}

async function readBoundedBody(body) {
  if (!body) throw sourceError(415, "Source is empty");
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) throw sourceError(413, "Source exceeds the 3 MiB proxy limit", "source-too-large");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function fetchWithCheckedRedirects(initialUrl, signal) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!(await isPublicHttpUrl(current))) {
      throw sourceError(403, "Private networks not allowed");
    }

    const upstream = await fetch(current.href, {
      headers: upstreamHeaders(current),
      redirect: "manual",
      signal,
    });

    if (!isRedirect(upstream.status)) return { upstream, finalUrl: current };
    const location = upstream.headers.get("location");
    if (!location) return { upstream, finalUrl: current };
    await upstream.body?.cancel();
    current = parseProxyUrl(new URL(location, current).href);
    if (/\.(ts|m4s|mp4|webm|flv|aac|mp3)(?:$|\/)/i.test(current.pathname)) {
      throw sourceError(403, "Redirect to video media is not supported", "source-only");
    }
  }

  throw sourceError(508, "Too many redirects");
}

function upstreamHeaders(url) {
  return {
    Accept: "application/xml, text/xml, application/xspf+xml, audio/x-mpegurl, text/plain",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: url.origin + "/",
    Origin: url.origin,
  };
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

async function isPublicHttpUrl(url) {
  if (!isAllowedProtocol(url)) return false;
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (isBlockedIp(hostname)) return false;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((entry) => !isBlockedIp(entry.address));
  } catch {
    return false;
  }
}

function isBlockedIp(address) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return false;
}

function isBlockedIpv4(address) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isBlockedIpv6(address) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIp(normalized.slice(7));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}
