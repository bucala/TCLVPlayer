import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createBridge, DEFAULT_ORIGINS } from "./server.mjs";

const explicitPort = process.env.TCLV_PROXY_PORT ? Number(process.env.TCLV_PROXY_PORT) : null;
if (explicitPort !== null && (!Number.isInteger(explicitPort) || explicitPort < 1024 || explicitPort > 65535)) {
  console.error("TCLV_PROXY_PORT must be between 1024 and 65535.");
  process.exit(1);
}
const origins = [...DEFAULT_ORIGINS, ...(process.env.TCLV_BRIDGE_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)];
const bridge = createBridge({ origins });
const ports = explicitPort ? [explicitPort] : [3939, 3940, 3941];
let port;
for (const candidate of ports) {
  try {
    await new Promise((accept, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(candidate, "127.0.0.1", () => probe.close(accept));
    });
    port = candidate;
    break;
  } catch { /* Try the next discovery port without closing another application. */ }
}
if (!port) {
  console.error("TCLV Bridge could not start. Ports 3939–3941 are occupied.");
  process.exit(1);
}

bridge.server.once("error", () => {
  console.error("TCLV Bridge could not bind its local port.");
  process.exit(1);
});
bridge.server.listen(port, "127.0.0.1", () => {
  console.log(`TCLV Bridge ${port} is running on this computer only.`);
  console.log("Pairing code:", bridge.pairingCode);
  console.log("Open https://tclv-player.vercel.app/ > Settings > Network > Pair bridge.");
  console.log("Video route: provider > this computer > browser. Vercel never carries video.");
  console.log("Leave this window open. Press Ctrl+C to stop.");
  if (process.argv.includes("--open")) {
    const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", "https://tclv-player.vercel.app/"] : ["https://tclv-player.vercel.app/"];
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => console.log("Open the web player in your browser manually."));
    child.unref();
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    bridge.server.close();
    bridge.server.closeAllConnections();
  });
}
