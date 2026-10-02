"use strict";

window.TCLVWebPlayer = function(host) {
  if (window.TCLVNative || window.Capacitor) return;
  const original = {};
  const originalStatus = host.setStreamStatus;
  for (const name of ["detectLocalProxy", "detectCorsProxySync", "canProxyStreams", "needsProxy", "isBlockedWebStream",
    "getStreamType", "playChannel", "playInSlot1", "destroySlot1", "fetchWebSource", "translateUi"]) {
    original[name] = host[name];
  }
  const labels = {
    sk: {
      bridgeMode: "Webové video", bridgeAuto: "Auto: priamo → lokálny bridge", bridgeDirect: "Iba priamo",
      bridgeOnly: "Iba lokálny bridge", bridgeConnect: "Nájsť bridge", bridgePair: "Spárovať bridge",
      bridgeDisconnect: "Odpojiť", bridgeCode: "Párovací kód z okna bridge", bridgeDownload: "Stiahnuť TCLV Bridge pre Windows (ZIP)",
      bridgeInstall: "ZIP obsahuje všetko, Node.js netreba inštalovať. Kliknite pravým na ZIP › Rozbaliť všetko. Až v rozbalenom priečinku spustite Start TCLV Bridge.cmd. Nie priamo v ZIP. Okno bridge nechajte otvorené.",
      bridgePrivacy: "Poskytovateľ → tento počítač → prehliadač. Bridge ani video neprechádzajú cez Vercel.",
      bridgePermission: "Ak prehliadač žiada prístup k lokálnej sieti, povoľte ho pre TCLVPlayer. Po zamietnutí zmeňte povolenie lokálnej siete v nastaveniach stránky a skúste znovu. Bridge musí bežať na tom istom počítači.",
      bridgeMissing: "Bridge nie je pripojený. Spustite ho a kliknite Nájsť bridge.",
      bridgeAvailable: "Bridge nájdený. Zadajte kód z jeho okna a spárujte ho.",
      bridgeReady: "Lokálny bridge je spárovaný.", bridgeSearching: "Hľadám lokálny bridge…",
      bridgeInvalidCode: "Zadajte 12-znakový kód z okna TCLV Bridge.", bridgeRejected: "Párovanie zlyhalo. Overte kód a skúste znovu.",
      bridgeLimited: "Priveľa pokusov. Počkajte minútu a skúste znovu.",
      bridgeNeeded: "Tento stream potrebuje lokálny bridge. Otvorte Sieť, spustite a spárujte TCLV Bridge, potom sa prehrávanie obnoví.",
      bridgeDirectBlocked: "HTTP video na HTTPS webe nie je povolené. Vyberte Auto alebo lokálny bridge v Nastaveniach › Sieť.",
      bridgePlayingDirect: "Video: priamo", bridgePlayingLocal: "Video: lokálny bridge",
      bridgeCodec: "Bridge nemení kodeky ani DRM a neobchádza geo-blokovanie alebo chybu poskytovateľa.",
    },
    en: {
      bridgeMode: "Web video", bridgeAuto: "Auto: direct → local bridge", bridgeDirect: "Direct only",
      bridgeOnly: "Local bridge only", bridgeConnect: "Find bridge", bridgePair: "Pair bridge",
      bridgeDisconnect: "Disconnect", bridgeCode: "Pairing code from the bridge window", bridgeDownload: "Download TCLV Bridge for Windows (ZIP)",
      bridgeInstall: "The ZIP includes everything; no Node.js installation needed. Right-click the ZIP > Extract all. Run Start TCLV Bridge.cmd from the extracted folder, not inside the ZIP. Keep its window open.",
      bridgePrivacy: "Provider → this computer → browser. Neither the bridge nor video goes through Vercel.",
      bridgePermission: "If your browser asks for local-network access, allow it for TCLVPlayer. If denied, change the local-network permission in site settings and retry. The bridge must run on the same computer.",
      bridgeMissing: "Bridge is not connected. Start it and click Find bridge.",
      bridgeAvailable: "Bridge found. Enter the code from its window and pair it.",
      bridgeReady: "Local bridge is paired.", bridgeSearching: "Looking for the local bridge…",
      bridgeInvalidCode: "Enter the 12-character code from the TCLV Bridge window.", bridgeRejected: "Pairing failed. Check the code and retry.",
      bridgeLimited: "Too many attempts. Wait a minute and retry.",
      bridgeNeeded: "This stream needs the local bridge. Open Network, start and pair TCLV Bridge. Playback will then retry automatically.",
      bridgeDirectBlocked: "HTTP video is blocked on an HTTPS website. Select Auto or local bridge in Settings > Network.",
      bridgePlayingDirect: "Video: direct", bridgePlayingLocal: "Video: local bridge",
      bridgeCodec: "The bridge does not change codecs or DRM, bypass geo-blocking, or repair provider errors.",
    },
  };
  Object.assign(host.translations.sk, labels.sk, {
    labelCorsProxy: "Proxy pre playlisty a EPG (len web)",
    webNetworkHint: labels.sk.bridgePrivacy,
    webStreamHint: labels.sk.bridgeNeeded,
  });
  Object.assign(host.translations.en, labels.en, {
    labelCorsProxy: "Playlist and EPG proxy (web only)",
    webNetworkHint: labels.en.bridgePrivacy,
    webStreamHint: labels.en.bridgeNeeded,
  });
  let mode = host.safeGet("tclv.webVideoMode", "auto");
  if (!["auto", "direct", "bridge"].includes(mode)) mode = "auto";
  const slots = [0, 1].map(index => ({ index, run: 0, channel: null, route: "", retried: false, pending: false }));
  const mediaTypes = new Map();
  const body = host.dom.corsProxyInput?.closest(".settings-body");
  if (!body) return;
  const ui = document.createElement("div");
  ui.className = "web-bridge-settings";
  ui.innerHTML = `<label class="field-label"><span data-i18n="bridgeMode"></span><select id="webVideoMode">
    <option value="auto" data-i18n="bridgeAuto"></option><option value="direct" data-i18n="bridgeDirect"></option><option value="bridge" data-i18n="bridgeOnly"></option>
    </select></label><p id="bridgeStatus" class="settings-hint" role="status"></p>
    <div class="field-row"><button id="bridgeFind" type="button" data-i18n="bridgeConnect"></button><button id="bridgeDisconnect" type="button" data-i18n="bridgeDisconnect" hidden></button></div>
    <form id="bridgePairForm" hidden><label class="field-label"><span data-i18n="bridgeCode"></span><input id="bridgePairCode" type="password" autocomplete="off" spellcheck="false" maxlength="12" required /></label>
    <button type="submit" data-i18n="bridgePair"></button></form>
    <a class="bridge-download" href="./downloads/TCLV-Bridge.zip" download data-i18n="bridgeDownload"></a>
    <p class="settings-hint" data-i18n="bridgeInstall"></p><p class="settings-hint" data-i18n="bridgePermission"></p>
    <p class="settings-hint" data-i18n="bridgeCodec"></p>`;
  body.prepend(ui);
  const bar = document.createElement("div");
  bar.className = "web-bridge-bar";
  bar.innerHTML = '<span id="webVideoRoute" role="status"></span><button id="bridgeQuickConnect" type="button"></button>';
  document.querySelector(".player-stage")?.before(bar);
  const query = selector => ui.querySelector(selector);
  const modeSelect = query("#webVideoMode");
  const statusLabel = query("#bridgeStatus");
  const findButton = query("#bridgeFind");
  const disconnectButton = query("#bridgeDisconnect");
  const pairForm = query("#bridgePairForm");
  const codeInput = query("#bridgePairCode");
  const routeLabel = bar.querySelector("#webVideoRoute");
  const quickButton = bar.querySelector("#bridgeQuickConnect");
  modeSelect.value = mode;
  const client = new window.TCLVBridgeClient({ onChange: renderStatus });

  function renderStatus(status = client.status) {
    const keys = { missing: "bridgeMissing", available: "bridgeAvailable", ready: "bridgeReady", searching: "bridgeSearching" };
    statusLabel.textContent = host.t(keys[status] || "bridgeMissing");
    pairForm.hidden = status !== "available";
    disconnectButton.hidden = status !== "ready";
    findButton.disabled = status === "searching";
    quickButton.textContent = host.t(status === "ready" ? "bridgeReady" : "bridgeConnect");
    routeLabel.textContent = host.t(slots[0].route === "bridge" ? "bridgePlayingLocal" : "bridgePlayingDirect");
  }

  function eligible(url) {
    try {
      const parsed = new URL(url, location.origin);
      return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password &&
        !(parsed.pathname === "/api/proxy" && (parsed.origin === location.origin || parsed.hostname.endsWith(".vercel.app")));
    } catch { return false; }
  }

  function current(slot, run) {
    return slot.run === run && (slot.index === 0 ? host.state.selectedChannelId === slot.channel?.id :
      host.state.multiview && host.state.mvChannel1?.id === slot.channel?.id);
  }

  function stop(slot) {
    if (slot.index === 1) original.destroySlot1();
    else {
      host.stopInternalPlayers();
      host.dom.video.removeAttribute("src");
      host.dom.video.load();
    }
  }

  function message(slot, text) {
    if (slot.index === 0) host.showMessage(text, 0);
    else if (host.dom.playerMessage2) {
      host.dom.playerMessage2.textContent = text;
      host.dom.playerMessage2.style.display = "block";
    }
  }

  function help(slot, error) {
    slot.pending = true;
    originalStatus(slot.channel.id, "error");
    const rejected = error?.status && ![401, 429].includes(error.status);
    message(slot, rejected ? host.t("streamUnavailable") + " " + host.t("bridgeCodec") : host.t("bridgeNeeded"));
    renderStatus();
  }

  async function preload(channel, slot) {
    const type = original.getStreamType(channel.url);
    if (slot.index === 0 && host.state.player === "videojs") await host.ensureVideoJs();
    if (slot.index === 0 && host.state.player === "artplayer") await host.ensureArtPlayer();
    if (slot.index === 0 && host.state.player === "jplayer" && !["hls", "ts", "flv"].includes(type)) await host.ensureJPlayer();
    if (type === "ts") await host.ensureMpegts();
    if (type === "flv" && host.state.player === "flvjs") await host.ensureFlvJs();
    if (type === "hls") await host.ensureHls();
  }

  async function start(slot, channel, bridge = false) {
    const run = ++slot.run;
    slot.channel = channel;
    slot.pending = false;
    stop(slot);
    if (!eligible(channel.url)) {
      originalStatus(channel.id, "error");
      message(slot, host.t("streamUnavailable"));
      return;
    }
    const mixed = location.protocol === "https:" && /^http:\/\//i.test(channel.url);
    const useBridge = bridge || mode === "bridge" || (mixed && mode === "auto");
    slot.route = useBridge ? "bridge" : "direct";
    renderStatus();
    if (mixed && mode === "direct") {
      originalStatus(channel.id, "error");
      message(slot, host.t("bridgeDirectBlocked"));
      return;
    }
    let url = channel.url;
    try {
      if (useBridge) {
        message(slot, host.t("reconnecting"));
        url = await client.openStream(channel.url);
        if (!current(slot, run)) return;
        mediaTypes.set(url, original.getStreamType(channel.url));
        if (mediaTypes.size > 100) mediaTypes.delete(mediaTypes.keys().next().value);
      }
      await preload(channel, slot);
      if (!current(slot, run)) return;
      if (useBridge && slot.index === 0 && window.Hls?.isSupported?.() && !host.dom.video._tclvBridgeHls) {
        // Native browser HLS cannot reliably consume rewritten loopback manifests.
        // Keep that path for direct streams; use HLS.js for authenticated tickets.
        const canPlayType = host.dom.video.canPlayType.bind(host.dom.video);
        host.dom.video.canPlayType = function(type) {
          if (client.isMediaUrl(this.src) && /mpegurl/i.test(type)) return "";
          if (slots[0].route === "bridge" && /mpegurl/i.test(type)) return "";
          return canPlayType(type);
        };
        host.dom.video._tclvBridgeHls = true;
      }
      const routed = { ...channel, url };
      if (slot.index === 1) await original.playInSlot1(routed);
      else await original.playChannel(routed);
      if (current(slot, run) && slot.index === 0 && host.state.artPlayer?.on) {
        host.state.artPlayer.on("video:error", () => { if (current(slot, run)) retry(slot); });
      }
      if (current(slot, run) && slot.index === 0 && host.state.videoJsPlayer?.one) {
        host.state.videoJsPlayer.one("error", () => { if (current(slot, run)) retry(slot); });
      }
      if (current(slot, run) && slot.index === 0 && host.state.player === "jplayer" && window.jQuery) {
        window.jQuery(host.dom.jPlayerHost).off("jPlayer_error.tclvBridge").on("jPlayer_error.tclvBridge", () => {
          if (current(slot, run)) retry(slot);
        });
      }
    } catch (error) {
      if (!current(slot, run)) return;
      if (useBridge) help(slot, error);
      else if (mode === "auto" && !slot.retried) retry(slot);
      else message(slot, host.t("html5Notice"));
    }
  }

  function retry(slot) {
    if (mode !== "auto" || slot.route !== "direct" || slot.retried || !current(slot, slot.run)) return;
    slot.retried = true;
    void start(slot, slot.channel, true);
  }

  let installedHls;
  let hlsValue = window.Hls;
  function wrapHls(Hls) {
    if (!Hls || Hls === installedHls) return Hls;
    class WebHls extends Hls {
      constructor(config) {
        super(config);
        this.on(Hls.Events.ERROR, (_event, data) => {
          if (data.type !== "networkError") return;
          const slot = host.state.hls === this ? slots[0] : host.state.hls2 === this ? slots[1] : null;
          if (!slot) return;
          const run = slot.run;
          queueMicrotask(() => { if (current(slot, run)) retry(slot); });
        });
      }
    }
    installedHls = WebHls;
    return WebHls;
  }
  hlsValue = wrapHls(hlsValue);
  Object.defineProperty(window, "Hls", {
    configurable: true,
    get: () => hlsValue,
    set: value => { hlsValue = wrapHls(value); },
  });
  for (const [libraryName, fields] of [["mpegts", ["mpegtsPlayer", "mpegts2"]], ["flvjs", ["flvPlayer"]]]) {
    let value;
    function wrapLibrary(library) {
      if (!library?.createPlayer) return library;
      return { ...library, createPlayer: function(...args) {
        const player = library.createPlayer(...args);
        player.on(library.Events.ERROR, type => {
          if (type !== library.ErrorTypes.NETWORK_ERROR) return;
          const slot = host.state[fields[0]] === player ? slots[0] : fields[1] && host.state[fields[1]] === player ? slots[1] : null;
          if (!slot) return;
          const run = slot.run;
          queueMicrotask(() => { if (current(slot, run)) retry(slot); });
        });
        return player;
      } };
    }
    value = wrapLibrary(window[libraryName]);
    Object.defineProperty(window, libraryName, {
      configurable: true, get: () => value, set: library => { value = wrapLibrary(library); },
    });
  }

  host.detectLocalProxy = async function() {
    if (client.saved) await client.discover();
  };
  host.detectCorsProxySync = function() {
    const configured = original.detectCorsProxySync();
    try {
      const url = new URL(configured, location.origin);
      if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/proxy") {
        return location.origin + "/api/proxy?url=";
      }
    } catch { /* Preserve disabled and custom source proxies. */ }
    return configured;
  };
  host.canProxyStreams = () => false;
  host.needsProxy = () => false;
  host.isBlockedWebStream = url => client.isMediaUrl(url) ? false : original.isBlockedWebStream(url);
  host.getStreamType = url => mediaTypes.get(url) || original.getStreamType(url);
  host.playChannel = function(channel) {
    slots[0].retried = false;
    return start(slots[0], channel);
  };
  host.playInSlot1 = function(channel) {
    slots[1].retried = false;
    return start(slots[1], channel);
  };
  host.destroySlot1 = function() {
    slots[1].run++;
    slots[1].channel = null;
    slots[1].pending = false;
    slots[1].route = "";
    original.destroySlot1();
  };
  host.fetchWebSource = async function(url, options) {
    if (client.status !== "ready" || !host.state.corsProxy) return original.fetchWebSource(url, options);
    if (!host.isMixedContent(url)) {
      let response;
      try { response = await fetch(url, { cache: options.forceReload ? "reload" : "no-cache" }); } catch { /* Try the paired local bridge. */ }
      if (response) {
        if (!response.ok) throw new Error(response.status + " " + response.statusText);
        return host.decodeWebSourceResponse(response);
      }
    }
    try { return await host.decodeWebSourceResponse(await client.source(url)); }
    catch (error) {
      if (error.status && error.status !== 401) throw error;
      return original.fetchWebSource(url, options);
    }
  };
  host.translateUi = function() { original.translateUi(); renderStatus(); };
  for (const [index, video] of [host.dom.video, host.dom.video2].entries()) {
    video?.addEventListener("error", () => retry(slots[index]));
  }
  function resumePending() {
    for (const slot of slots) if (slot.pending && current(slot, slot.run)) void start(slot, slot.channel, true);
  }
  findButton.addEventListener("click", async () => {
    await client.discover({ interactive: true });
    if (client.status === "available") codeInput.focus();
    if (client.status === "ready") resumePending();
  });
  quickButton.addEventListener("click", () => { host.openSettings(); ui.scrollIntoView({ block: "nearest" }); findButton.focus(); });
  pairForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = pairForm.querySelector("button");
    button.disabled = true;
    try {
      await client.pair(codeInput.value);
      codeInput.value = "";
      resumePending();
    } catch (error) {
      const key = error.code === "invalidCode" ? "bridgeInvalidCode" : error.code === "limited" ? "bridgeLimited" :
        error.code === "missing" ? "bridgeMissing" : "bridgeRejected";
      statusLabel.textContent = host.t(key);
    } finally { button.disabled = false; }
  });
  disconnectButton.addEventListener("click", async () => {
    for (const slot of slots) {
      if (slot.route !== "bridge") continue;
      slot.run++;
      stop(slot);
      slot.pending = true;
      if (slot.channel) message(slot, host.t("bridgeNeeded"));
    }
    await client.disconnect();
  });
  modeSelect.addEventListener("change", () => {
    mode = modeSelect.value;
    host.safeSet("tclv.webVideoMode", mode);
    for (const slot of slots) if (slot.channel && current(slot, slot.run)) {
      slot.retried = false;
      void start(slot, slot.channel);
    }
  });
  host.translateUi();
  // Test/diagnostic status contains no provider URLs, session tokens, or pairing code.
  window.TCLVWebBridge = { get status() { return client.status; }, get mode() { return mode; } };
};
