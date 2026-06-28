import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  let target;
  try {
    target = parseProxyUrl(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!isAllowedProtocol(target)) {
    res.status(400).json({ error: "Only http/https URLs allowed" });
    return;
  }

  if (!(await isPublicHttpUrl(target))) {
    res.status(403).json({ error: "Private networks not allowed" });
    return;
  }

  try {
    const upstream = await fetchWithCheckedRedirects(target);

    if (!upstream.ok) {
      const isStream = /\.(ts|m3u8|m3u)(\?|$)/i.test(target.href) ||
        (upstream.headers.get("content-type") || "").includes("mpegurl");
      res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
        hint: isStream ? "geo-blocked" : undefined,
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);

    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);

    res.status(upstream.status);

    const body = upstream.body;
    if (body && typeof body.pipeTo === "function") {
      const { Writable } = await import("node:stream");
      const writable = Writable.toWeb(res);
      await body.pipeTo(writable);
    } else {
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    const msg = err.message || "Upstream fetch failed";
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: msg });
      return;
    }
    const isTimeout = msg.includes("timeout") || msg.includes("abort");
    const isNetwork = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("ENETUNREACH");
    res.status(502).json({
      error: msg,
      hint: isTimeout ? "timeout" : isNetwork ? "geo-blocked" : undefined,
    });
  }
}

function parseProxyUrl(raw) {
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw || typeof raw !== "string") throw new Error("Invalid URL");
  return new URL(raw);
}

function isAllowedProtocol(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

async function fetchWithCheckedRedirects(initialUrl) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!(await isPublicHttpUrl(current))) {
      const error = new Error("Private networks not allowed");
      error.statusCode = 403;
      throw error;
    }

    const upstream = await fetch(current.href, {
      headers: upstreamHeaders(current),
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });

    if (!isRedirect(upstream.status)) return upstream;
    const location = upstream.headers.get("location");
    if (!location) return upstream;
    current = new URL(location, current);
  }

  const error = new Error("Too many redirects");
  error.statusCode = 508;
  throw error;
}

function upstreamHeaders(url) {
  return {
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
