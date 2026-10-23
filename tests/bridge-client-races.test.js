import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../web/bridge-client.js", import.meta.url), "utf8");
const base = "http://127.0.0.1:3939";
const oldToken = "o".repeat(43), newToken = "n".repeat(43);
const identity = { service: "tclv-bridge", protocol: 1, pairingRequired: true, capabilities: ["local-approval"] };
const requestId = "r".repeat(32), proof = "p".repeat(43);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const session = token => ({ token, expires: Date.now() + 3600000 });
const approval = () => ({ id: requestId, proof, approvalUrl: base + "/pair/approve/" + requestId, expires: Date.now() + 120000 });
const tick = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

function environment(saved = null) {
  const values = new Map(saved ? [["tclv.bridge.session", JSON.stringify(saved)]] : []);
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const request = vi.fn(async url => url === base + "/ping" ? json(identity) : json({}, 404));
  const context = vm.createContext({ window: {}, AbortController, URL, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  const client = new context.window.TCLVBridgeClient({ origin: "https://tclv-player.vercel.app", storage, request });
  return { client, request, values };
}

describe("bridge asynchronous connection changes", () => {
  it("keeps an approved session when an older unpaired discovery finishes later", async () => {
    const slowPort = deferred();
    const { client, request, values } = environment();
    request.mockImplementation(async url => {
      if (url === base + "/ping") return json(identity);
      await slowPort.promise;
      return json({}, 404);
    });
    const finding = client.discover();
    await tick();
    client.acceptSession(base, session(newToken));
    slowPort.resolve();
    await finding;
    expect(client.status).toBe("ready");
    expect(client.connection.token).toBe(newToken);
    expect(JSON.parse(values.get("tclv.bridge.session")).token).toBe(newToken);
  });

  it("does not restore a saved session after disconnecting while its verification is pending", async () => {
    const verification = deferred();
    const { client, request, values } = environment({ base, ...session(oldToken) });
    request.mockImplementation(async (url, options = {}) => {
      if (url === base + "/ping") return json(identity);
      if (url === base + "/session" && options.method === "GET") return verification.promise;
      return json({}, 404);
    });
    const finding = client.discover();
    await tick();
    await client.disconnect();
    verification.resolve(json({ paired: true, expires: Date.now() + 3600000 }));
    await finding;
    expect(client.status).toBe("missing");
    expect(client.connection).toBeNull();
    expect(values.size).toBe(0);
  });

  it("does not erase a newly paired session when an old verification returns unauthorized", async () => {
    const verification = deferred();
    const { client, request, values } = environment({ base, ...session(oldToken) });
    request.mockImplementation(async url => {
      if (url === base + "/ping") return json(identity);
      if (url === base + "/session") return verification.promise;
      return json({}, 404);
    });
    const finding = client.discover();
    await tick();
    client.acceptSession(base, session(newToken));
    verification.resolve(json({}, 401));
    await finding;
    expect(client.status).toBe("ready");
    expect(client.connection.token).toBe(newToken);
    expect(JSON.parse(values.get("tclv.bridge.session")).token).toBe(newToken);
  });

  it.each(["unauthorized", "network error"])("ignores a stale authenticated %s after a newer session was accepted", async reason => {
    const result = deferred();
    const { client, request, values } = environment();
    client.acceptSession(base, session(oldToken));
    request.mockImplementation(() => result.promise);
    const opening = client.openStream("https://media.example/live.m3u8");
    const failed = expect(opening).rejects.toThrow();
    client.acceptSession(base, session(newToken));
    result.resolve(reason === "unauthorized" ? json({}, 401) : Promise.reject(new TypeError("Offline")));
    await failed;
    expect(client.status).toBe("ready");
    expect(client.connection.token).toBe(newToken);
    expect(JSON.parse(values.get("tclv.bridge.session")).token).toBe(newToken);
  });

  it("permits a fresh discovery after disconnect and keeps it deduplicated when the older probe ends", async () => {
    const first = deferred(), second = deferred();
    const { client, request } = environment();
    let basePings = 0;
    request.mockImplementation(async url => {
      if (url === base + "/ping") {
        const gate = ++basePings === 1 ? first : second;
        await gate.promise;
        return json(identity);
      }
      return json({}, 404);
    });
    const older = client.discover();
    await client.disconnect();
    const fresh = client.discover();
    expect(basePings).toBe(2);
    first.resolve();
    await older;
    const duplicate = client.discover();
    expect(basePings).toBe(2);
    second.resolve();
    await Promise.all([fresh, duplicate]);
    expect(client.status).toBe("available");
    expect(client.connection.base).toBe(base);
  });

  it("revokes a late approved token after the request was cancelled", async () => {
    const result = deferred();
    const { client, request, values } = environment();
    client.connection = { base, capabilities: ["local-approval"] };
    client.status = "available";
    request.mockImplementation(async (url, options = {}) => {
      if (url === base + "/pair/request") return json(approval());
      if (url === base + "/pair/request/" + requestId && options.method === "POST") return result.promise;
      return new Response(null, { status: 204 });
    });
    await client.beginApproval();
    const polling = client.pollApproval();
    await client.cancelApproval();
    result.resolve(json({ status: "approved", ...session(newToken) }));
    await expect(polling).resolves.toBe("cancelled");
    expect(request).toHaveBeenCalledWith(base + "/session", expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer " + newToken } }));
    expect(client.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it("keeps a manual pairing response from reconnecting after disconnect", async () => {
    const result = deferred();
    const { client, request, values } = environment();
    client.connection = { base, capabilities: [] };
    client.status = "available";
    request.mockImplementation(async url => url === base + "/pair" ? result.promise : new Response(null, { status: 204 }));
    const pairing = client.pair("A1B2C3D4E5F6");
    const cancelled = expect(pairing).rejects.toMatchObject({ code: "cancelled" });
    await tick();
    await client.disconnect();
    result.resolve(json(session(newToken)));
    await cancelled;
    expect(request).toHaveBeenCalledWith(base + "/session", expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer " + newToken } }));
    expect(client.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it("does not create a local approval after cancelling during initial discovery", async () => {
    const ping = deferred();
    const { client, request } = environment();
    request.mockImplementation(async url => url === base + "/ping" ? ping.promise : json({}, 404));
    const beginning = client.beginApproval();
    const cancelled = expect(beginning).rejects.toMatchObject({ code: "cancelled" });
    await tick();
    await client.cancelApproval();
    ping.resolve(json(identity));
    await cancelled;
    expect(request.mock.calls.every(([url]) => url.endsWith("/ping"))).toBe(true);
    expect(client.approval).toBeNull();
  });
});
