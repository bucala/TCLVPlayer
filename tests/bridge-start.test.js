import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBridge } from "../bridge/server.mjs";
import { findRunningBridge, openPlayer, PLAYER_URL, startBridge } from "../bridge/start.mjs";

const servers = [];
async function listening(server) {
  servers.push(server);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}
async function unusedPort() {
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  return port;
}
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  vi.restoreAllMocks();
});

describe("bridge launcher", () => {
  it("detects a compatible running helper with the trusted website Origin", async () => {
    const bridge = createBridge();
    const port = await listening(bridge.server);
    expect(await findRunningBridge([port])).toBe(port);
  });
  it.each([
    { service: "other-app", protocol: 1, pairingRequired: true },
    { service: "tclv-bridge", protocol: 2, pairingRequired: true },
    { service: "tclv-bridge", protocol: 1, pairingRequired: false },
  ])("does not mistake a foreign process or incompatible helper for the bridge: %j", async identity => {
    const port = await listening(http.createServer((_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(identity)); }));
    expect(await findRunningBridge([port])).toBeNull();
  });
  it("bounds discovery response size and total time", async () => {
    const huge = await listening(http.createServer((_req, res) => res.end("x".repeat(8192))));
    const stalled = await listening(http.createServer((_req, res) => { res.writeHead(200); res.write("{"); }));
    expect(await findRunningBridge([huge, stalled], { timeoutMs: 100 })).toBeNull();
  });
  it.each(["win32", "darwin", "linux"])("opens only the fixed guide URL with separate arguments on %s", platform => {
    const child = { on: vi.fn(), unref: vi.fn() }, launch = vi.fn().mockReturnValue(child);
    openPlayer({ platform, launch });
    expect(launch).toHaveBeenCalledWith(platform === "win32" ? "rundll32.exe" : platform === "darwin" ? "open" : "xdg-open",
      platform === "win32" ? ["url.dll,FileProtocolHandler", PLAYER_URL] : [PLAYER_URL], { detached: true, stdio: "ignore" });
    expect(PLAYER_URL).toBe("https://tclv-player.vercel.app/#connect-bridge");
    expect(child.unref).toHaveBeenCalledOnce();
  });
  it("reuses a running helper instead of starting another process", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const bridge = createBridge(); const port = await listening(bridge.server);
    const launch = vi.fn().mockReturnValue({ on() {}, unref() {} });
    const result = await startBridge({ args: ["--open", "https://evil.example/ignored"], env: { TCLV_PROXY_PORT: String(port) }, platform: "win32", launch });
    expect(result).toEqual({ reused: true, port });
    expect(result.server).toBeUndefined();
    expect(launch.mock.calls[0][1]).toEqual(["url.dll,FileProtocolHandler", PLAYER_URL]);
  });
  it.each([
    ["protocol launch", ["--from-web"]],
    ["protocol launch even with the guide flag", ["--from-web", "--open"]],
  ])("reuses a helper without opening another browser for %s", async (_label, args) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const bridge = createBridge(), port = await listening(bridge.server);
    const launch = vi.fn();
    const result = await startBridge({ args, env: { TCLV_PROXY_PORT: String(port) }, platform: "win32", launch });
    expect(result).toEqual({ reused: true, port });
    expect(launch).not.toHaveBeenCalled();
  });
  it.each([
    ["manual start", [], false],
    ["Start menu or installer finish", ["--open"], true],
    ["website protocol launch", ["--from-web"], false],
    ["website protocol launch with both flags", ["--open", "--from-web"], false],
  ])("starts the helper and preserves browser context for %s", async (_label, args, opensBrowser) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const port = await unusedPort();
    const launch = vi.fn().mockReturnValue({ on() {}, unref() {} });
    const result = await startBridge({ args, env: { TCLV_PROXY_PORT: String(port) }, platform: "win32", launch });
    servers.push(result.server);
    expect(result.reused).toBe(false);
    expect(result.port).toBe(port);
    expect(await findRunningBridge([port])).toBe(port);
    if (opensBrowser) expect(launch).toHaveBeenCalledWith("rundll32.exe", ["url.dll,FileProtocolHandler", PLAYER_URL], { detached: true, stdio: "ignore" });
    else expect(launch).not.toHaveBeenCalled();
  });
  it("rejects an invalid configured port before launching anything", async () => {
    const launch = vi.fn();
    await expect(startBridge({ args: ["--open"], env: { TCLV_PROXY_PORT: "1" }, launch })).rejects.toThrow("between 1024 and 65535");
    expect(launch).not.toHaveBeenCalled();
  });
});
