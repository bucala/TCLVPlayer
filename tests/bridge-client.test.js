import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../web/bridge-client.js", import.meta.url), "utf8");
const base = "http://127.0.0.1:3939";
const token = "a".repeat(43);
const expires = () => Date.now() + 3600000;
const identity = { service: "tclv-bridge", protocol: 1, version: "2.0.0", pairingRequired: true };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function client(saved = null) {
  const values = new Map(saved ? [["tclv.bridge.session", JSON.stringify(saved)]] : []);
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const request = vi.fn().mockImplementation(async url => url.startsWith(base) ? json(identity) : json({}, 404));
  const context = vm.createContext({ window: {}, AbortController, URL, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  return { client: new context.window.TCLVBridgeClient({ origin: "https://tclv-player.vercel.app", storage, request }), request, values };
}

const requestId = "r".repeat(32);
const proof = "p".repeat(43);
const approvalIdentity = { ...identity, capabilities: ["local-approval", "unknown-capability"] };
const approvalRequest = () => ({ id: requestId, proof, approvalUrl: base + "/pair/approve/" + requestId, expires: Date.now() + 120000 });

function approvalClient({ data = approvalRequest(), poll = () => json({ status: "pending" }) } = {}) {
  const environment = client();
  environment.request.mockImplementation(async (url, options = {}) => {
    if (url.endsWith("/ping")) return url.startsWith(base) ? json(approvalIdentity) : json({}, 404);
    if (url === base + "/pair/request" && options.method === "POST") return json(data);
    if (url === base + "/pair/request/" + requestId && options.method === "POST") return poll();
    if (url === base + "/pair/request/" + requestId && options.method === "DELETE") return new Response(null, { status: 204 });
    return json({}, 404);
  });
  return { ...environment, data };
}

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

describe("web bridge connection", () => {
  it("verifies bridge identity before accepting a ping response", async () => {
    const { client: bridge, request } = client();
    request.mockResolvedValue(json({ ok: true, version: "1.0" }));
    await bridge.discover();
    expect(bridge.status).toBe("missing");
    expect(bridge.connection).toBeNull();
  });
  it("finds an unpaired helper without changing metadata proxy settings", async () => {
    const { client: bridge, request, values } = client();
    await bridge.discover();
    expect(bridge.status).toBe("available");
    expect(bridge.connection.base).toBe(base);
    expect(request).toHaveBeenCalledTimes(3);
    expect(values.size).toBe(0);
  });
  it("works without storage access instead of exposing tokens through application settings", async () => {
    const { client: bridge, request } = client();
    bridge.storage = {
      setItem: () => { throw new Error("Storage denied"); },
      removeItem: () => { throw new Error("Storage denied"); },
    };
    await bridge.discover();
    request.mockResolvedValue(json({ token, expires: expires() }));
    await expect(bridge.pair("A1B2C3D4E5F6")).resolves.toBeUndefined();
    expect(bridge.status).toBe("ready");
  });
  it("deduplicates simultaneous discovery", async () => {
    const { client: bridge, request } = client();
    await Promise.all([bridge.discover(), bridge.discover()]);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("revalidates saved sessions rather than assuming a helper restart kept them", async () => {
    const { client: bridge, request, values } = client({ base, token, expires: expires() });
    request.mockImplementation(async url => url.endsWith("/session") ? json({}, 401) : url.startsWith(base) ? json(identity) : json({}, 404));
    await bridge.discover();
    expect(bridge.status).toBe("available");
    expect(values.has("tclv.bridge.session")).toBe(false);
  });
  it("restores a session only after authenticated verification", async () => {
    const { client: bridge, request } = client({ base, token, expires: expires() });
    request.mockImplementation(async url => url.endsWith("/session") ? json({ paired: true, expires: expires() }) : url.startsWith(base) ? json(identity) : json({}, 404));
    await bridge.discover();
    expect(bridge.status).toBe("ready");
    const call = request.mock.calls.find(([url]) => url.endsWith("/session"));
    expect(call[1].headers.Authorization).toBe("Bearer " + token);
    expect(call[1].credentials).toBe("omit");
    expect(call[1].referrerPolicy).toBe("no-referrer");
  });
  it("ignores saved remote or non-discovery bridge addresses", async () => {
    const { client: bridge } = client({ base: "https://evil.example", token, expires: expires() });
    expect(bridge.saved).toBeNull();
    await expect(bridge.call("https://evil.example", "/ping")).rejects.toThrow("Invalid bridge address");
  });
  it("pairs with a code, stores only a tab session and sends no token in media URLs", async () => {
    const { client: bridge, request, values } = client();
    await bridge.discover();
    request.mockImplementation(async url => {
      if (url.endsWith("/pair")) return json({ token, expires: expires() });
      if (url.endsWith("/open")) return json({ url: base + "/media/" + "b".repeat(32) });
      return json(identity);
    });
    await bridge.pair("A1B2C3D4E5F6");
    expect(bridge.status).toBe("ready");
    expect(values.get("tclv.bridge.session")).not.toContain("A1B2");
    expect(await bridge.openStream("http://provider.example/live")).toBe(base + "/media/" + "b".repeat(32));
    expect(request.mock.calls.at(-1)[1].body).toContain("provider.example");
    expect(request.mock.calls.at(-1)[0]).not.toContain(token);
  });
  it("does not accept malicious remote video URLs returned by a helper", async () => {
    const { client: bridge, request } = client();
    bridge.connection = { base, token, expires: expires() };
    bridge.status = "ready";
    request.mockResolvedValue(json({ url: "https://tclv-player.vercel.app/api/proxy?url=video" }));
    await expect(bridge.openStream("http://provider.example/live")).rejects.toThrow("Invalid bridge media URL");
  });
  it("clears authorization when a running helper rejects the session", async () => {
    const { client: bridge, request } = client();
    bridge.connection = { base, token, expires: expires() };
    bridge.status = "ready";
    request.mockResolvedValue(json({}, 401));
    await expect(bridge.openStream("http://provider.example/live")).rejects.toMatchObject({ code: "unpaired" });
    expect(bridge.status).toBe("available");
    expect(bridge.connection.token).toBeUndefined();
  });
  it("shows offline state and permits a new explicit discovery after local-network denial", async () => {
    const { client: bridge, request } = client();
    request.mockRejectedValue(new TypeError("Local network denied"));
    await bridge.discover({ interactive: true });
    expect(bridge.status).toBe("missing");
    request.mockImplementation(async url => url.startsWith(base) ? json(identity) : json({}, 404));
    await bridge.discover({ interactive: true });
    expect(bridge.status).toBe("available");
  });
  it("rejects invalid codes without sending them", async () => {
    const { client: bridge, request } = client();
    await expect(bridge.pair("bad")).rejects.toMatchObject({ code: "invalidCode" });
    expect(request).not.toHaveBeenCalled();
  });
  it("forgets the tab session even when disconnect cannot reach the helper", async () => {
    const { client: bridge, request, values } = client({ base, token, expires: expires() });
    bridge.connection = { base, token, expires: expires() };
    request.mockRejectedValue(new TypeError("Offline"));
    await bridge.disconnect();
    expect(values.size).toBe(0);
    expect(bridge.status).toBe("available");
    expect(bridge.connection.token).toBeUndefined();
  });
});

describe("web bridge local approval", () => {
  it("discovers approval support and exposes only a local approval address and expiry", async () => {
    const { client: bridge, request, values, data } = approvalClient();
    const approval = await bridge.beginApproval();
    expect(bridge.connection.capabilities).toEqual(["local-approval"]);
    expect(approval).toEqual({ url: data.approvalUrl, expires: data.expires });
    expect(approval.url).not.toContain(proof);
    expect(approval.url).not.toContain(token);
    expect(values.size).toBe(0);
    const creation = request.mock.calls.find(([url]) => url === base + "/pair/request");
    expect(creation[1]).toMatchObject({ method: "POST", body: "{}", credentials: "omit", referrerPolicy: "no-referrer" });
    expect(creation[1].headers.Authorization).toBeUndefined();
  });

  it("keeps a request pending, accepts approval once and stores only the tab session", async () => {
    let polls = 0;
    const sessionExpires = expires();
    const { client: bridge, request, values } = approvalClient({
      poll: () => json(++polls === 1 ? { status: "pending" } : { status: "approved", token, expires: sessionExpires }),
    });
    const changed = vi.fn();
    bridge.onChange = changed;
    await bridge.beginApproval();
    await expect(bridge.pollApproval()).resolves.toBe("pending");
    expect(values.size).toBe(0);
    await expect(bridge.pollApproval()).resolves.toBe("ready");
    expect(changed.mock.calls.filter(([status]) => status === "ready")).toHaveLength(1);
    expect(bridge.approval).toBeNull();
    expect(JSON.parse(values.get("tclv.bridge.session"))).toEqual({ base, token, expires: sessionExpires });
    expect(values.get("tclv.bridge.session")).not.toContain(proof);
    expect(values.get("tclv.bridge.session")).not.toContain(requestId);
    const statusCalls = request.mock.calls.filter(([url, options]) => url === base + "/pair/request/" + requestId && options.method === "POST");
    expect(statusCalls).toHaveLength(2);
    for (const [url, options] of statusCalls) {
      expect(url).not.toContain(proof);
      expect(url).not.toContain(token);
      expect(JSON.parse(options.body)).toEqual({ proof });
    }
    const callsAfterApproval = request.mock.calls.length;
    await expect(bridge.pollApproval()).rejects.toMatchObject({ code: "expired" });
    expect(request).toHaveBeenCalledTimes(callsAfterApproval);
  });

  it.each([
    ["remote host", "https://evil.example/pair/approve/" + requestId],
    ["localhost alias", "http://localhost:3939/pair/approve/" + requestId],
    ["another helper port", "http://127.0.0.1:3940/pair/approve/" + requestId],
    ["credentials", "http://user:secret@127.0.0.1:3939/pair/approve/" + requestId],
    ["query string", base + "/pair/approve/" + requestId + "?proof=" + proof],
    ["fragment", base + "/pair/approve/" + requestId + "#" + proof],
    ["different request", base + "/pair/approve/" + "s".repeat(32)],
    ["another route", base + "/media/" + requestId],
    ["invalid URL", "not a URL"],
  ])("rejects an approval address with %s before retaining secrets", async (_reason, approvalUrl) => {
    const { client: bridge, values } = approvalClient({ data: { ...approvalRequest(), approvalUrl } });
    await expect(bridge.beginApproval()).rejects.toThrow(/Invalid approval/);
    expect(bridge.approval).toBeNull();
    expect(bridge.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it.each([
    ["invalid request ID", () => ({ id: "short" })],
    ["invalid proof", () => ({ proof: "short" })],
    ["expired request", () => ({ expires: Date.now() - 1 })],
    ["unbounded lifetime", () => ({ expires: Date.now() + 181000 })],
  ])("rejects %s without persisting approval data", async (_reason, override) => {
    const { client: bridge, values } = approvalClient({ data: { ...approvalRequest(), ...override() } });
    await expect(bridge.beginApproval()).rejects.toThrow("Invalid approval request");
    expect(bridge.approval).toBeNull();
    expect(values.size).toBe(0);
  });

  it("clears a denied request and never creates a session", async () => {
    const { client: bridge, values } = approvalClient({ poll: () => json({ status: "denied" }) });
    await bridge.beginApproval();
    await expect(bridge.pollApproval()).rejects.toMatchObject({ code: "denied" });
    expect(bridge.approval).toBeNull();
    expect(bridge.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it("cancels an expired local request using the proof only in the request body", async () => {
    const { client: bridge, request, values } = approvalClient();
    await bridge.beginApproval();
    bridge.approval.expires = Date.now() - 1;
    await expect(bridge.pollApproval()).rejects.toMatchObject({ code: "expired" });
    expect(bridge.approval).toBeNull();
    expect(request.mock.calls.at(-1)).toEqual([
      base + "/pair/request/" + requestId,
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ proof }) }),
    ]);
    expect(values.size).toBe(0);
  });

  it("maps server expiry to an expired error and forgets the request proof", async () => {
    const { client: bridge, request, values } = approvalClient({ poll: () => json({}, 410) });
    await bridge.beginApproval();
    await expect(bridge.pollApproval()).rejects.toMatchObject({ status: 410, code: "expired" });
    expect(bridge.approval).toBeNull();
    const callCount = request.mock.calls.length;
    await expect(bridge.pollApproval()).rejects.toMatchObject({ code: "expired" });
    expect(request).toHaveBeenCalledTimes(callCount);
    expect(values.size).toBe(0);
  });

  it("forgets a cancelled request even when the helper is offline", async () => {
    const { client: bridge, request, values } = approvalClient();
    await bridge.beginApproval();
    request.mockRejectedValue(new TypeError("Offline"));
    await expect(bridge.cancelApproval()).resolves.toBeUndefined();
    expect(bridge.approval).toBeNull();
    expect(values.size).toBe(0);
    const callCount = request.mock.calls.length;
    await expect(bridge.pollApproval()).rejects.toMatchObject({ code: "expired" });
    expect(request).toHaveBeenCalledTimes(callCount);
  });

  it("discards an approval response that arrives after cancellation", async () => {
    const response = deferred();
    const { client: bridge, values } = approvalClient({ poll: () => response.promise });
    await bridge.beginApproval();
    const polling = bridge.pollApproval();
    await bridge.cancelApproval();
    response.resolve(json({ status: "approved", token, expires: expires() }));
    await expect(polling).resolves.toBe("cancelled");
    expect(bridge.approval).toBeNull();
    expect(bridge.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it("deletes a request created after the user already cancelled", async () => {
    const response = deferred();
    const creationStarted = deferred();
    const { client: bridge, request, values, data } = approvalClient();
    await bridge.discover();
    const normalRequest = request.getMockImplementation();
    request.mockImplementation((url, options) => {
      if (url === base + "/pair/request" && options.method === "POST") {
        creationStarted.resolve();
        return response.promise;
      }
      return normalRequest(url, options);
    });
    const beginning = bridge.beginApproval();
    const cancelled = expect(beginning).rejects.toMatchObject({ code: "cancelled" });
    await creationStarted.promise;
    await bridge.cancelApproval();
    response.resolve(json(data));
    await cancelled;
    expect(bridge.approval).toBeNull();
    expect(request.mock.calls.at(-1)).toEqual([
      base + "/pair/request/" + requestId,
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ proof }) }),
    ]);
    expect(values.size).toBe(0);
  });

  it.each([
    ["invalid token", () => ({ token: "short", expires: expires() })],
    ["expired session", () => ({ token, expires: Date.now() - 1 })],
    ["unbounded session", () => ({ token, expires: Date.now() + 14 * 60 * 60 * 1000 })],
  ])("does not retain a session after approval returns an %s", async (_reason, session) => {
    const { client: bridge, values } = approvalClient({ poll: () => json({ status: "approved", ...session() }) });
    await bridge.beginApproval();
    await expect(bridge.pollApproval()).rejects.toThrow("Invalid bridge session");
    expect(bridge.approval).toBeNull();
    expect(bridge.connection.token).toBeUndefined();
    expect(bridge.status).toBe("available");
    expect(values.size).toBe(0);
  });

  it("offers legacy code pairing when the helper does not advertise approval", async () => {
    const { client: bridge, request, values } = client();
    await expect(bridge.beginApproval()).rejects.toMatchObject({ code: "legacy" });
    expect(request.mock.calls.every(([url]) => url.endsWith("/ping"))).toBe(true);
    request.mockResolvedValue(json({ token, expires: expires() }));
    await expect(bridge.pair("A1B2C3D4E5F6")).resolves.toBeUndefined();
    expect(bridge.status).toBe("ready");
    expect(values.has("tclv.bridge.session")).toBe(true);
  });

  it("reports a missing helper without attempting to create an approval", async () => {
    const { client: bridge, request } = client();
    request.mockRejectedValue(new TypeError("Connection refused"));
    await expect(bridge.beginApproval()).rejects.toMatchObject({ code: "missing" });
    expect(bridge.approval).toBeNull();
    expect(request.mock.calls.every(([url]) => url.endsWith("/ping"))).toBe(true);
  });

  it("preserves local approval support after disconnecting a paired helper", async () => {
    const { client: bridge } = approvalClient({ poll: () => json({ status: "approved", token, expires: expires() }) });
    await bridge.beginApproval();
    await bridge.pollApproval();
    await bridge.disconnect();
    expect(bridge.status).toBe("available");
    await expect(bridge.beginApproval()).resolves.toMatchObject({ url: base + "/pair/approve/" + requestId });
  });

  it("preserves local approval support when the helper rejects an old session", async () => {
    const { client: bridge, request } = approvalClient({ poll: () => json({ status: "approved", token, expires: expires() }) });
    await bridge.beginApproval();
    await bridge.pollApproval();
    const normalRequest = request.getMockImplementation();
    request.mockImplementation((url, options) => url.endsWith("/open") ? json({}, 401) : normalRequest(url, options));
    await expect(bridge.openStream("http://provider.example/live")).rejects.toMatchObject({ code: "unpaired" });
    expect(bridge.status).toBe("available");
    await expect(bridge.beginApproval()).resolves.toMatchObject({ url: base + "/pair/approve/" + requestId });
  });
});
