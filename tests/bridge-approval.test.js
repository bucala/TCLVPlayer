import http from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBridge } from "../bridge/server.mjs";
import { pairingPage } from "../bridge/pairing-page.mjs";

const origin = "https://tclv-player.vercel.app";
const otherOrigin = "http://localhost:3000";
const code = "A1B2C3D4E5F6";

describe("local browser approval", () => {
  let bridge, base, time;
  async function start(origins) {
    bridge = createBridge({ origins, pairingCode: code, now: () => time });
    await new Promise(resolve => bridge.server.listen(0, "127.0.0.1", resolve));
    base = "http://127.0.0.1:" + bridge.server.address().port;
  }
  beforeEach(async () => { time = Date.now(); await start(); });
  afterEach(async () => { await new Promise(resolve => { bridge.server.close(resolve); bridge.server.closeAllConnections(); }); });
  const call = (path, body, requestOrigin = origin, method = "POST") => fetch(base + path, {
    method, headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  async function create(requestOrigin = origin) {
    const response = await call("/pair/request", {}, requestOrigin);
    expect(response.status).toBe(200);
    return response.json();
  }
  const poll = (request, proof = request.proof, requestOrigin = origin) => call("/pair/request/" + request.id, { proof }, requestOrigin);
  async function page(request) {
    const response = await fetch(request.approvalUrl);
    const html = await response.text();
    return { response, html, csrf: html.match(/name="csrf" value="([A-Za-z0-9_-]{43})"/)?.[1] };
  }
  const confirm = (request, csrf, action = "approve", requestOrigin = base) => fetch(request.approvalUrl, {
    method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/x-www-form-urlencoded" },
    body: "csrf=" + encodeURIComponent(csrf) + "&action=" + action,
  });

  it("advertises an additive capability while keeping protocol 1 and manual pairing", async () => {
    const ping = await fetch(base + "/ping", { headers: { Origin: origin } });
    expect(await ping.json()).toMatchObject({ protocol: 1, version: "2.1.0", capabilities: ["local-approval"], pairingRequired: true });
    const response = await call("/pair", { code });
    expect(await response.json()).toMatchObject({ token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expires: time + 12 * 60 * 60 * 1000 });
  });
  it("requires local explicit approval before issuing a one-use origin-bound session", async () => {
    const request = await create();
    expect(request).toMatchObject({ id: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/), proof: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expires: time + 120000 });
    expect(request.approvalUrl).toBe(base + "/pair/approve/" + request.id);
    expect(request.approvalUrl).not.toContain(request.proof);
    expect(await (await poll(request)).json()).toEqual({ status: "pending", expires: request.expires });
    const local = await page(request);
    expect(local.response.status).toBe(200);
    expect(local.html).toContain(origin); expect(local.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await confirm(request, local.csrf)).status).toBe(200);
    const result = await (await poll(request)).json();
    expect(result).toMatchObject({ status: "approved", token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expires: time + 12 * 60 * 60 * 1000 });
    expect((await fetch(base + "/session", { headers: { Origin: origin, Authorization: "Bearer " + result.token } })).status).toBe(200);
    expect((await fetch(base + "/session", { headers: { Origin: otherOrigin, Authorization: "Bearer " + result.token } })).status).toBe(401);
    expect((await poll(request)).status).toBe(410);
    expect((await fetch(request.approvalUrl)).status).toBe(410);
  });
  it("keeps proof and session tokens out of the isolated local HTML", async () => {
    const request = await create(), local = await page(request);
    expect(local.html).not.toContain(request.proof);
    expect(local.html).not.toContain(code);
    expect(local.html).not.toContain("<script"); expect(local.html).not.toMatch(/<(?:link|img|iframe)\b/);
    expect(local.html).toContain('name="action" value="approve"'); expect(local.html).toContain('name="action" value="deny"');
    expect(local.response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(local.response.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(local.response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(local.response.headers.get("cache-control")).toBe("private, no-store");
    expect(local.response.headers.get("access-control-allow-origin")).toBeNull();
    expect(local.response.headers.get("referrer-policy")).toBe("same-origin");
  });
  it("does not let knowing the request ID grant access or cancel another request", async () => {
    const request = await create();
    expect((await poll(request, "b".repeat(43))).status).toBe(403);
    expect((await call("/pair/request/" + request.id, { proof: "wrong" }, origin, "DELETE")).status).toBe(403);
    expect(await (await poll(request)).json()).toMatchObject({ status: "pending" });
    const local = await page(request); await confirm(request, local.csrf);
    expect((await poll(request, "b".repeat(43))).status).toBe(403);
    expect(await (await poll(request)).json()).toMatchObject({ status: "approved" });
  });
  it("binds requests to the creating trusted origin even if another trusted origin knows the proof", async () => {
    const request = await create();
    expect((await poll(request, request.proof, otherOrigin)).status).toBe(403);
    expect((await call("/pair/request/" + request.id, { proof: request.proof }, otherOrigin, "DELETE")).status).toBe(403);
    expect((await poll(request)).status).toBe(200);
  });
  it("never enables unknown/originless/local websites on normal bridge APIs", async () => {
    for (const requestOrigin of ["https://evil.example", "", base]) {
      expect((await call("/pair/request", {}, requestOrigin)).status).toBe(403);
      expect((await fetch(base + "/ping", { headers: { Origin: requestOrigin } })).status).toBe(403);
      expect((await call("/open", { url: "https://media.example/live.m3u8" }, requestOrigin)).status).toBe(403);
      expect((await fetch(base + "/source?url=https://source.example/guide.xml", { headers: { Origin: requestOrigin } })).status).toBe(403);
    }
  });
  it("does not expose local approval HTML to cross-origin fetches, even from the requesting site", async () => {
    const request = await create();
    for (const requestOrigin of [origin, otherOrigin, "https://evil.example"]) {
      expect((await fetch(request.approvalUrl, { headers: { Origin: requestOrigin } })).status).toBe(403);
    }
    expect((await fetch(request.approvalUrl)).status).toBe(200);
    expect((await fetch(request.approvalUrl, { headers: { Origin: base } })).status).toBe(200);
  });
  it("rejects foreign or mismatched local Host headers on confirmation pages", async () => {
    const request = await create();
    for (const host of ["evil.example:3939", "127.0.0.1:1"]) {
      const status = await new Promise((resolve, reject) => {
        const connection = http.request(request.approvalUrl, { headers: { Host: host } }, response => { response.resume(); resolve(response.statusCode); });
        connection.on("error", reject); connection.end();
      });
      expect(status).toBe(403);
    }
  });
  it("requires the exact local Origin and valid CSRF for form confirmation", async () => {
    const request = await create(), local = await page(request);
    for (const requestOrigin of [origin, otherOrigin, "https://evil.example", "", "http://127.0.0.1:1"]) {
      expect((await confirm(request, local.csrf, "approve", requestOrigin)).status).toBe(403);
    }
    expect((await confirm(request, "incorrect")).status).toBe(403);
    expect((await confirm(request, local.csrf, "unknown")).status).toBe(400);
    expect(await (await poll(request)).json()).toMatchObject({ status: "pending" });
    expect((await confirm(request, local.csrf)).status).toBe(200);
    expect((await confirm(request, local.csrf)).status).toBe(409);
  });
  it("rejects missing/ambiguous form fields and non-form requests without approving", async () => {
    const request = await create(), local = await page(request);
    expect((await call("/pair/approve/" + request.id, { csrf: local.csrf, action: "approve" }, base)).status).toBe(415);
    for (const body of ["action=approve", "csrf=" + local.csrf, "csrf=" + local.csrf + "&csrf=other&action=approve", "csrf=" + local.csrf + "&action=approve&action=deny"]) {
      expect((await fetch(request.approvalUrl, { method: "POST", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body })).status).toBe(400);
    }
    expect(await (await poll(request)).json()).toMatchObject({ status: "pending" });
  });
  it("delivers denial once and never grants a session on a GET", async () => {
    const request = await create(), local = await page(request);
    expect(await (await poll(request)).json()).toMatchObject({ status: "pending" });
    await confirm(request, local.csrf, "deny");
    expect(await (await poll(request)).json()).toEqual({ status: "denied" });
    expect((await poll(request)).status).toBe(410);
    expect((await confirm(request, local.csrf)).status).toBe(410);
  });
  it("expires pending or approved requests before they can create a session", async () => {
    const request = await create(), local = await page(request);
    await confirm(request, local.csrf); time += 120000;
    expect((await poll(request)).status).toBe(410);
    const expiredPage = await fetch(request.approvalUrl);
    expect(expiredPage.status).toBe(410); expect(await expiredPage.text()).toContain("Platnosť požiadavky vypršala");
    expect((await confirm(request, local.csrf)).status).toBe(410);
  });
  it("cancels pending and approved requests without granting access", async () => {
    for (const approved of [false, true]) {
      const request = await create();
      if (approved) { const local = await page(request); await confirm(request, local.csrf); }
      expect((await call("/pair/request/" + request.id, { proof: request.proof }, origin, "DELETE")).status).toBe(204);
      expect((await poll(request)).status).toBe(410);
    }
  });
  it("limits creation to five per origin per minute without blocking pending polls or legacy pairing", async () => {
    let request;
    for (let i = 0; i < 5; i++) request = await create();
    for (let i = 0; i < 8; i++) expect((await poll(request)).status).toBe(200);
    expect((await call("/pair/request", {})).status).toBe(429);
    expect((await call("/pair", { code })).status).toBe(200);
    time += 60000; expect((await call("/pair/request", {})).status).toBe(200);
  });
  it("bounds pending requests across trusted origins and releases expired capacity", async () => {
    await new Promise(resolve => { bridge.server.close(resolve); bridge.server.closeAllConnections(); });
    const origins = Array.from({ length: 5 }, (_, i) => "https://site" + i + ".example");
    await start(origins);
    for (const requestOrigin of origins.slice(0, 4)) for (let i = 0; i < 4; i++) await create(requestOrigin);
    expect((await call("/pair/request", {}, origins[4])).status).toBe(429);
    time += 120000;
    expect((await call("/pair/request", {}, origins[4])).status).toBe(200);
  });
  it("escapes configured origin text in approval markup", () => {
    const html = pairingPage({ origin: 'https://example.invalid/?x=<img src=x onerror="alert(1)">', id: "a".repeat(32), csrf: "b".repeat(43) });
    expect(html).toContain("&lt;img"); expect(html).not.toContain("<img"); expect(html).not.toContain('onerror="');
  });
});
