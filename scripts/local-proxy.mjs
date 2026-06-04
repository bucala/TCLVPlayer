import http from "node:http";
import https from "node:https";

const PORT = parseInt(process.env.TCLV_PROXY_PORT || "3939", 10);

function proxyRequest(targetUrl, res) {
  const mod = targetUrl.startsWith("https") ? https : http;
  const req = mod.get(targetUrl, { headers: { "User-Agent": "TCLVPlayer/1.0" } }, (upstream) => {
    res.writeHead(upstream.statusCode, {
      "Content-Type": upstream.headers["content-type"] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Private-Network": "true",
    });
    upstream.pipe(res);
  });
  req.on("error", () => {
    res.writeHead(502, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
    });
    res.end("Upstream error");
  });
  req.setTimeout(30000, () => { req.destroy(); });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://localhost:${PORT}`);

  if (parsed.pathname === "/ping") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
      "Content-Type": "application/json",
    });
    res.end('{"ok":true,"version":"1.0"}');
    return;
  }

  if (parsed.pathname === "/proxy") {
    const target = parsed.searchParams.get("url");
    if (!target) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Private-Network": "true",
      });
      res.end("Missing url parameter");
      return;
    }
    try {
      const u = new URL(target);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("Bad protocol");
    } catch {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Private-Network": "true",
      });
      res.end("Invalid URL");
      return;
    }
    proxyRequest(target, res);
    return;
  }

  res.writeHead(404, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
  });
  res.end("Not found. Use /proxy?url= or /ping");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`TCLVPlayer local proxy running on http://127.0.0.1:${PORT}`);
  console.log(`Ping: http://127.0.0.1:${PORT}/ping`);
  console.log(`Proxy: http://127.0.0.1:${PORT}/proxy?url=<encoded-url>`);
  console.log("");
  console.log("Open https://tclv-player.vercel.app/ — it will auto-detect this proxy.");
});
