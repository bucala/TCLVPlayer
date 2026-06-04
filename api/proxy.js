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

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Only http/https URLs allowed" });
    return;
  }

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "[::1]" || host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\./.test(host) ||
    /^0+$/.test(host) ||
    /^fc00:/i.test(host) || /^fe80:/i.test(host) ||
    /^\[/.test(host) ||
    /^\d+$/.test(host)
  ) {
    res.status(403).json({ error: "Private networks not allowed" });
    return;
  }

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: parsed.origin + "/",
      Origin: parsed.origin,
    };

    const upstream = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!upstream.ok) {
      const isStream = /\.(ts|m3u8|m3u)(\?|$)/i.test(url) ||
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
    const isTimeout = msg.includes("timeout") || msg.includes("abort");
    const isNetwork = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("ENETUNREACH");
    res.status(502).json({
      error: msg,
      hint: isTimeout ? "timeout" : isNetwork ? "geo-blocked" : undefined,
    });
  }
}
