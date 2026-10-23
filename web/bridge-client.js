"use strict";

(function() {
  class BridgeClient {
    constructor({ origin = location.origin, storage, onChange = function() {}, request = window.fetch.bind(window) } = {}) {
      this.origin = origin;
      this.storage = storage;
      this.onChange = onChange;
      this.request = request;
      this.status = "missing";
      this.connection = null;
      this.pendingDiscovery = null;
      this.connectionRun = 0;
      this.saved = null;
      this.approval = null;
      this.approvalRun = 0;
      try {
        this.storage = storage || window.sessionStorage;
        const saved = JSON.parse(this.storage.getItem("tclv.bridge.session") || "null");
        if (saved && this.validBase(saved.base) && /^[A-Za-z0-9_-]{43}$/.test(saved.token) && saved.expires > Date.now()) this.saved = saved;
      } catch { /* Session storage can be disabled. Pairing still works in memory. */ }
    }

    validBase(value) {
      return /^http:\/\/127\.0\.0\.1:(3939|3940|3941)$/.test(String(value || ""));
    }

    isMediaUrl(value) {
      try {
        const url = new URL(value);
        return this.connection && url.origin === this.connection.base && /^\/media\/[A-Za-z0-9_-]{32}$/.test(url.pathname) && !url.search && !url.hash;
      } catch { return false; }
    }

    setStatus(status) {
      this.status = status;
      this.onChange(status);
    }

    save(connection) {
      this.saved = connection?.token ? { base: connection.base, token: connection.token, expires: connection.expires } : null;
      try {
        if (this.saved) this.storage.setItem("tclv.bridge.session", JSON.stringify(this.saved));
        else this.storage.removeItem("tclv.bridge.session");
      } catch { /* Do not fall back to exported application settings. */ }
    }

    invalidateDiscovery() {
      this.connectionRun++;
      this.pendingDiscovery = null;
    }

    async call(base, path, { token, body, method = "GET", timeout = 5000 } = {}) {
      if (!this.validBase(base)) throw new Error("Invalid bridge address");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const headers = {};
        if (token) headers.Authorization = "Bearer " + token;
        if (body) headers["Content-Type"] = "application/json";
        const response = await this.request(base + path, {
          method, headers, body: body ? JSON.stringify(body) : undefined,
          credentials: "omit", mode: "cors", cache: "no-store",
          referrerPolicy: "no-referrer", signal: controller.signal,
        });
        if (!response.ok) {
          throw Object.assign(new Error("Bridge request failed"), { status: response.status,
            code: response.status === 401 ? "unpaired" : response.status === 410 ? "expired" : response.status === 429 ? "limited" : "rejected" });
        }
        return response;
      } finally { clearTimeout(timer); }
    }

    async discover({ interactive = false } = {}) {
      if (this.pendingDiscovery) return this.pendingDiscovery;
      const run = this.connectionRun, saved = this.saved;
      const discovery = (async () => {
        this.setStatus("searching");
        const results = await Promise.all([3939, 3940, 3941].map(async port => {
          const base = "http://127.0.0.1:" + port;
          try {
            const response = await this.call(base, "/ping", { timeout: interactive ? 5000 : 1200 });
            const identity = await response.json();
            if (identity.service !== "tclv-bridge" || identity.protocol !== 1 || identity.pairingRequired !== true) return null;
            const capabilities = Array.isArray(identity.capabilities) ? identity.capabilities.filter(value => value === "local-approval") : [];
            if (saved?.base === base) {
              try {
                const check = await this.call(base, "/session", { token: saved.token });
                const data = await check.json();
                if (data.paired === true && data.expires > Date.now()) return { ...saved, expires: data.expires, capabilities };
              } catch (error) {
                if (error.status === 401 && run === this.connectionRun && this.saved === saved) this.save(null);
              }
            }
            return { base, capabilities };
          } catch { return null; }
        }));
        // Pairing or disconnecting can finish while another port is still being
        // probed. A late probe must not replace that newer connection decision.
        if (run !== this.connectionRun) return this.connection;
        this.connection = results.find(value => value?.token) || results.find(Boolean) || null;
        if (this.connection?.token) this.save(this.connection);
        this.setStatus(this.connection?.token ? "ready" : this.connection ? "available" : "missing");
        return this.connection;
      })();
      this.pendingDiscovery = discovery;
      try { return await discovery; } finally { if (this.pendingDiscovery === discovery) this.pendingDiscovery = null; }
    }

    acceptSession(base, data) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(data.token) || !(data.expires > Date.now()) || data.expires > Date.now() + 13 * 60 * 60 * 1000) throw new Error("Invalid bridge session");
      this.invalidateDiscovery();
      this.connection = { base, token: data.token, expires: data.expires, capabilities: this.connection?.capabilities || [] };
      this.save(this.connection); this.setStatus("ready");
    }

    async beginApproval() {
      const cancellation = this.cancelApproval(), run = this.approvalRun;
      await cancellation;
      if (run !== this.approvalRun) throw Object.assign(new Error("Approval cancelled"), { code: "cancelled" });
      if (!this.connection) await this.discover({ interactive: true });
      if (run !== this.approvalRun) throw Object.assign(new Error("Approval cancelled"), { code: "cancelled" });
      if (!this.connection) throw Object.assign(new Error("Start TCLV Bridge"), { code: "missing" });
      if (!this.connection.capabilities?.includes("local-approval")) throw Object.assign(new Error("Use the manual pairing code with this helper"), { code: "legacy" });
      const base = this.connection.base;
      const data = await (await this.call(base, "/pair/request", { method: "POST", body: {} })).json();
      let url; try { url = new URL(data.approvalUrl); } catch { throw new Error("Invalid approval address"); }
      if (!/^[A-Za-z0-9_-]{32}$/.test(data.id) || !/^[A-Za-z0-9_-]{43}$/.test(data.proof) || url.origin !== base ||
          url.pathname !== "/pair/approve/" + data.id || url.search || url.hash || url.username || url.password ||
          !(data.expires > Date.now()) || data.expires > Date.now() + 180000) throw new Error("Invalid approval request");
      if (run !== this.approvalRun) {
        try { await this.call(base, "/pair/request/" + data.id, { method: "DELETE", body: { proof: data.proof }, timeout: 1500 }); } catch { /* The abandoned request expires. */ }
        throw Object.assign(new Error("Approval cancelled"), { code: "cancelled" });
      }
      this.approval = { base, id: data.id, proof: data.proof, expires: data.expires };
      return { url: url.href, expires: data.expires };
    }

    async pollApproval() {
      const pending = this.approval;
      if (!pending || pending.expires <= Date.now()) { await this.cancelApproval(); throw Object.assign(new Error("Approval expired"), { code: "expired" }); }
      let data;
      try { data = await (await this.call(pending.base, "/pair/request/" + pending.id, { method: "POST", body: { proof: pending.proof } })).json(); }
      catch (error) { if (error.status === 410 && this.approval === pending) this.approval = null; throw error; }
      if (this.approval !== pending) {
        if (data.status === "approved") await this.discardSession(pending.base, data);
        return "cancelled";
      }
      if (data.status === "pending") return "pending";
      this.approval = null;
      if (data.status === "denied") throw Object.assign(new Error("Approval denied"), { code: "denied" });
      if (data.status !== "approved") throw new Error("Invalid approval status");
      this.acceptSession(pending.base, data); return "ready";
    }

    async cancelApproval() {
      this.approvalRun++;
      const pending = this.approval; this.approval = null;
      if (pending) try { await this.call(pending.base, "/pair/request/" + pending.id, { method: "DELETE", body: { proof: pending.proof }, timeout: 1500 }); } catch { /* The request also expires server-side. */ }
    }

    async discardSession(base, data) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(data.token)) return;
      try { await this.call(base, "/session", { method: "DELETE", token: data.token, timeout: 1500 }); } catch { /* An unreachable helper still expires the discarded session. */ }
    }

    async pair(code) {
      const cancellation = this.cancelApproval(), run = this.approvalRun;
      await cancellation;
      if (run !== this.approvalRun) throw Object.assign(new Error("Pairing cancelled"), { code: "cancelled" });
      if (!/^[A-Fa-f0-9]{12}$/.test(String(code || "").trim())) {
        throw Object.assign(new Error("Enter the code from the bridge window"), { code: "invalidCode" });
      }
      if (!this.connection) await this.discover({ interactive: true });
      if (run !== this.approvalRun) throw Object.assign(new Error("Pairing cancelled"), { code: "cancelled" });
      if (!this.connection) throw Object.assign(new Error("Start TCLV Bridge on this computer"), { code: "missing" });
      const base = this.connection.base;
      const response = await this.call(base, "/pair", { method: "POST", body: { code: code.trim() } });
      const data = await response.json();
      if (run !== this.approvalRun) {
        await this.discardSession(base, data);
        throw Object.assign(new Error("Pairing cancelled"), { code: "cancelled" });
      }
      this.acceptSession(base, data);
    }

    async authenticated(path, options) {
      if (this.status !== "ready" || !this.connection?.token || this.connection.expires <= Date.now()) await this.discover();
      if (!this.connection?.token) {
        throw Object.assign(new Error("Connect TCLV Bridge"), { code: this.connection ? "unpaired" : "missing" });
      }
      const connection = this.connection, run = this.connectionRun;
      try { return await this.call(connection.base, path, { ...options, token: connection.token }); }
      catch (error) {
        if (run !== this.connectionRun || this.connection !== connection) throw error;
        if (error.status === 401) {
          this.invalidateDiscovery();
          this.save(null);
          this.connection = { base: connection.base, capabilities: connection.capabilities || [] };
          this.setStatus("available");
        } else if (!error.status) {
          this.invalidateDiscovery();
          this.connection = null;
          this.setStatus("missing");
        }
        throw error;
      }
    }

    async openStream(target) {
      const response = await this.authenticated("/open", { method: "POST", body: { url: target } });
      const data = await response.json();
      if (!this.isMediaUrl(data.url)) throw new Error("Invalid bridge media URL");
      return data.url;
    }

    async source(target) {
      return this.authenticated("/source?url=" + encodeURIComponent(target), { timeout: 30000 });
    }

    async disconnect() {
      const cancellation = this.cancelApproval();
      this.invalidateDiscovery();
      const connection = this.connection;
      this.connection = connection ? { base: connection.base, capabilities: connection.capabilities || [] } : null;
      this.save(null);
      this.setStatus(connection ? "available" : "missing");
      await cancellation;
      if (connection?.token) {
        try { await this.call(connection.base, "/session", { method: "DELETE", token: connection.token }); } catch { /* Local session still expires. */ }
      }
    }
  }
  window.TCLVBridgeClient = BridgeClient;
})();
