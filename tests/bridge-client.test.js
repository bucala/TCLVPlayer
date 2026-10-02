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
