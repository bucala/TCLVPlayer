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

  const blocked = /^https?:\/\/(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|localhost)/i;
  if (blocked.test(url)) {
    res.status(403).json({ error: "Private networks not allowed" });
    return;
  }

  try {
    const parsed = new URL(url);
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: parsed.origin + "/",
      Origin: parsed.origin,
    };

    const upstream = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    res.setHeader("Cache-Control", "no-store");

    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);

    res.status(upstream.status);

    const body = await upstream.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err) {
    res.status(502).json({ error: err.message || "Upstream fetch failed" });
  }
}
