import { get } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBridge, DEFAULT_ORIGINS } from "./server.mjs";

export const PLAYER_URL = "https://tclv-player.vercel.app/#connect-bridge";
const PLAYER_ORIGIN = "https://tclv-player.vercel.app";
const DISCOVERY_PORTS = [3939, 3940, 3941];

/** Probe loopback directly: environment HTTP proxies must never receive this request. */
export async function findRunningBridge(ports = DISCOVERY_PORTS, { timeoutMs = 800 } = {}) {
  const results = await Promise.all(ports.map(port => new Promise(accept => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) { accept(null); return; }
    let finished = false, request;
    const finish = value => {
      if (finished) return;
      finished = true; clearTimeout(timer); request?.destroy(); accept(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    request = get({ hostname: "127.0.0.1", port, path: "/ping", headers: { Origin: PLAYER_ORIGIN, Accept: "application/json" } }, response => {
      response.on("error", () => finish(null));
      if (response.statusCode !== 200) { response.resume(); finish(null); return; }
      const chunks = []; let bytes = 0;
      response.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 4096) { finish(null); return; }
        chunks.push(chunk);
      });
      response.on("end", () => {
        try {
          const identity = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
          finish(identity.service === "tclv-bridge" && identity.protocol === 1 && identity.pairingRequired === true ? port : null);
        } catch { finish(null); }
      });
    });
    request.on("error", () => finish(null));
  })));
  return results.find(Boolean) || null;
}

export function openPlayer({ launch = spawn, platform = process.platform } = {}) {
  const command = platform === "win32" ? "rundll32.exe" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["url.dll,FileProtocolHandler", PLAYER_URL] : [PLAYER_URL];
  const child = launch(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => console.log("Open " + PLAYER_URL + " in your browser manually."));
  child.unref();
  return child;
}

function listen(server, port) {
  return new Promise((accept, reject) => {
    const ready = () => { server.off("error", failed); accept(); };
    const failed = error => { server.off("listening", ready); reject(error); };
    server.once("error", failed); server.once("listening", ready);
    server.listen(port, "127.0.0.1");
  });
}

export async function startBridge({ args = process.argv.slice(2), env = process.env, launch = spawn, platform = process.platform } = {}) {
  const explicitPort = env.TCLV_PROXY_PORT ? Number(env.TCLV_PROXY_PORT) : null;
  if (explicitPort !== null && (!Number.isInteger(explicitPort) || explicitPort < 1024 || explicitPort > 65535)) {
    throw new Error("TCLV_PROXY_PORT must be between 1024 and 65535.");
  }
  const ports = explicitPort ? [explicitPort] : DISCOVERY_PORTS;
  const open = args.includes("--open");
  const openOptions = { launch, platform };
  if (open) {
    const existing = await findRunningBridge(ports);
    if (existing) {
      console.log("TCLV Bridge is already running on this computer. Opening its connection guide.");
      openPlayer(openOptions); return { reused: true, port: existing };
    }
  }
  const origins = [...DEFAULT_ORIGINS, ...(env.TCLV_BRIDGE_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)];
  const bridge = createBridge({ origins });
  let port;
  for (const candidate of ports) {
    try { await listen(bridge.server, candidate); port = candidate; break; }
    catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      // Another launch may have won the bind after our initial discovery.
      if (open && await findRunningBridge([candidate])) {
        openPlayer(openOptions); return { reused: true, port: candidate };
      }
    }
  }
  if (!port) throw new Error("TCLV Bridge could not start. Its local ports are occupied.");
  console.log(`TCLV Bridge ${port} is running on this computer only.`);
  console.log("Pairing code (manual fallback):", bridge.pairingCode);
  console.log("Open " + PLAYER_URL + " and approve the connection in the local confirmation window.");
  console.log("Video route: provider > this computer > browser. Vercel never carries video.");
  console.log("Leave this window open. Press Ctrl+C to stop.");
  if (open) openPlayer(openOptions);
  return { ...bridge, port, reused: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const bridge = await startBridge();
    if (bridge.server) for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
      bridge.server.close(); bridge.server.closeAllConnections();
    });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
