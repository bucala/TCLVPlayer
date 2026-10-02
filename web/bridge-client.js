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
      this.saved = null;
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
            code: response.status === 401 ? "unpaired" : response.status === 429 ? "limited" : "rejected" });
        }
        return response;
      } finally { clearTimeout(timer); }
    }

    async discover({ interactive = false } = {}) {
      if (this.pendingDiscovery) return this.pendingDiscovery;
      this.pendingDiscovery = (async () => {
        this.setStatus("searching");
        const results = await Promise.all([3939, 3940, 3941].map(async port => {
          const base = "http://127.0.0.1:" + port;
          try {
            const response = await this.call(base, "/ping", { timeout: interactive ? 5000 : 1200 });
            const identity = await response.json();
            if (identity.service !== "tclv-bridge" || identity.protocol !== 1 || identity.pairingRequired !== true) return null;
            if (this.saved?.base === base) {
              try {
                const check = await this.call(base, "/session", { token: this.saved.token });
                const data = await check.json();
                if (data.paired === true && data.expires > Date.now()) return { ...this.saved, expires: data.expires };
              } catch (error) {
                if (error.status === 401) this.save(null);
              }
            }
            return { base };
          } catch { return null; }
        }));
        this.connection = results.find(value => value?.token) || results.find(Boolean) || null;
        if (this.connection?.token) this.save(this.connection);
        this.setStatus(this.connection?.token ? "ready" : this.connection ? "available" : "missing");
        return this.connection;
      })();
      try { return await this.pendingDiscovery; } finally { this.pendingDiscovery = null; }
    }

    async pair(code) {
      if (!/^[A-Fa-f0-9]{12}$/.test(String(code || "").trim())) {
        throw Object.assign(new Error("Enter the code from the bridge window"), { code: "invalidCode" });
      }
      if (!this.connection) await this.discover({ interactive: true });
      if (!this.connection) throw Object.assign(new Error("Start TCLV Bridge on this computer"), { code: "missing" });
      const response = await this.call(this.connection.base, "/pair", { method: "POST", body: { code: code.trim() } });
      const data = await response.json();
      if (!/^[A-Za-z0-9_-]{43}$/.test(data.token) || !(data.expires > Date.now()) || data.expires > Date.now() + 13 * 60 * 60 * 1000) {
        throw new Error("Invalid bridge session");
      }
      this.connection = { base: this.connection.base, token: data.token, expires: data.expires };
      this.save(this.connection);
      this.setStatus("ready");
    }

    async authenticated(path, options) {
      if (this.status !== "ready" || !this.connection?.token || this.connection.expires <= Date.now()) await this.discover();
      if (!this.connection?.token) {
        throw Object.assign(new Error("Connect TCLV Bridge"), { code: this.connection ? "unpaired" : "missing" });
      }
      const connection = this.connection;
      try { return await this.call(connection.base, path, { ...options, token: connection.token }); }
      catch (error) {
        if (error.status === 401) {
          this.save(null);
          this.connection = { base: connection.base };
          this.setStatus("available");
        } else if (!error.status) {
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
      const connection = this.connection;
      this.connection = connection ? { base: connection.base } : null;
      this.save(null);
      this.setStatus(connection ? "available" : "missing");
      if (connection?.token) {
        try { await this.call(connection.base, "/session", { method: "DELETE", token: connection.token }); } catch { /* Local session still expires. */ }
      }
    }
  }
  window.TCLVBridgeClient = BridgeClient;
})();
