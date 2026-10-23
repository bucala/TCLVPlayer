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
      bridgeLocalOnly: "Vypnúť vzdialený proxy", bridgeLocalOnlyDone: "Vzdialený proxy je vypnutý. Video, playlisty aj EPG používajú priame spojenia alebo spárovaný lokálny bridge.",
      bridgeLimits: "Video nečerpá prenos Vercel proxy. Stránka, knižnice a stiahnutie bridge ZIP stále používajú hosting. Vypnutím vzdialeného proxy obídete aj serverové sťahovanie playlistov a EPG.",
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
      bridgeLocalOnly: "Disable remote proxy", bridgeLocalOnlyDone: "Remote proxy is disabled. Video, playlists and EPG use direct connections or the paired local bridge.",
      bridgeLimits: "Video does not use Vercel proxy transfer. The page, libraries and bridge ZIP download still use hosting. Disabling the remote proxy also avoids server-side playlist and EPG downloads.",
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
  Object.assign(labels.sk, {
    bridgeNotChecked: "Pripravte pomocníka a skontrolujte pripojenie.",
    bridgeTitle: "Prehrávanie na tomto počítači", bridgeIntro: "Ak video hrá priamo, nič ďalšie nepotrebujete. Pre ostatné streamy vás pripojíme cez lokálneho pomocníka.",
    bridgeInstallStep: "Pripravte pomocníka", bridgeSetupDownload: "Stiahnuť pre Windows", bridgeSetupHint: "Jednorazová inštalácia. Bez rozbaľovania ZIP-u a bez zadávania príkazov.",
    bridgeRunStep: "Spustite TCLV Bridge", bridgeLaunch: "Spustiť nainštalovaný bridge", bridgeRunHint: "Nechajte ho spustený počas sledovania. Pri výzve prehliadača potvrďte otvorenie aplikácie.",
    bridgeConnect: "Skontrolovať pripojenie", bridgeApproveStep: "Potvrďte tento prehliadač", bridgeApprove: "Pripojiť tento prehliadač", bridgeApproveHint: "Otvorí sa lokálne okno s adresou tejto stránky. Potvrďte v ňom pripojenie; kód netreba prepisovať.",
    bridgeWaiting: "V lokálnom okne potvrďte pripojenie. Po potvrdení sa vrátime k prehrávaniu.", bridgeCancel: "Zrušiť", bridgeOpenApproval: "Otvoriť potvrdenie znovu",
    bridgeDenied: "Pripojenie ste zamietli. Môžete ho skúsiť znova.", bridgeExpired: "Potvrdenie vypršalo. Kliknite na Pripojiť tento prehliadač a skúste znova.", bridgeCancelled: "Pripájanie bolo zrušené.",
    bridgePopupBlocked: "Okno potvrdenia sa neotvorilo. Povoľte vyskakovacie okno alebo použite odkaz Otvoriť potvrdenie znovu.",
    bridgeLegacy: "Beží staršia verzia pomocníka. Aktualizujte ho alebo použite párovací kód nižšie.",
    bridgeReadyTitle: "Pripojenie je pripravené", bridgeReadyHint: "Video s lokálnou cestou ide cez tento počítač. Pripojenie platí pre túto kartu prehliadača; po reštarte pomocníka ho treba potvrdiť znovu.",
    bridgeAvailable: "Pomocník beží. Teraz potvrďte pripojenie prehliadača.", bridgeMissing: "Spusteného pomocníka sa nepodarilo nájsť. Spustite ho a povoľte lokálnu sieť, ak si to prehliadač vyžiada.",
    bridgePortable: "Prenosná verzia bez inštalácie", bridgeManual: "Starší pomocník alebo ručný kód", bridgeTrouble: "Pripojenie nefunguje?", bridgeAdvanced: "Pokročilé nastavenia siete",
    bridgeOtherOS: "Inštalátor je pre Windows. Na inom počítači použite priamy stream alebo manuálne spusteného pomocníka pre váš systém.",
    bridgeMobile: "Pomocník musí bežať na tom istom zariadení ako prehliadač. Na Androide odporúčame natívnu aplikáciu; Windows pomocník na inom PC sa s týmto zariadením nespáruje.",
    bridgeQuickSetup: "Nastaviť prehrávanie", bridgeQuickManage: "Spravovať pripojenie", bridgeIdle: "Video zatiaľ nehrá", bridgeConnecting: "Pripájam video cez tento počítač…", bridgeUnavailable: "Video čaká na lokálne pripojenie",
    bridgePlayingDirect: "Cesta videa: priamo od poskytovateľa", bridgePlayingLocal: "Cesta videa: cez tento počítač", bridgeVideoError: "Prehrávanie sa nepodarilo spustiť",
    bridgePrivacy: "Video ide priamo alebo cez tento počítač. Vercel ho neprenáša.", bridgeHosting: "Načítanie stránky, knižníc a stiahnutie pomocníka naďalej používajú hosting.",
    bridgeNeeded: "Na tento stream treba lokálne pripojenie. Kliknite na Nastaviť prehrávanie nad videom; po pripojení sa stream obnoví.",
  });
  Object.assign(labels.en, {
    bridgeNotChecked: "Get the helper, then check the connection.",
    bridgeTitle: "Playback on this computer", bridgeIntro: "If the video plays directly, you need nothing else. For other streams, connect through the local helper.",
    bridgeInstallStep: "Get the helper", bridgeSetupDownload: "Download for Windows", bridgeSetupHint: "Install once. No ZIP extraction or terminal commands.",
    bridgeRunStep: "Start TCLV Bridge", bridgeLaunch: "Open installed bridge", bridgeRunHint: "Keep it running while watching. Allow your browser to open the app when prompted.",
    bridgeConnect: "Check connection", bridgeApproveStep: "Approve this browser", bridgeApprove: "Connect this browser", bridgeApproveHint: "A local window will show this website's address. Approve the connection there; no code to copy.",
    bridgeWaiting: "Approve the connection in the local window. Playback will resume after approval.", bridgeCancel: "Cancel", bridgeOpenApproval: "Reopen approval window",
    bridgeDenied: "You declined the connection. You can try again.", bridgeExpired: "Approval expired. Click Connect this browser to try again.", bridgeCancelled: "Connection cancelled.",
    bridgePopupBlocked: "The approval window did not open. Allow the popup or use Reopen approval window.",
    bridgeLegacy: "An older helper is running. Update it or use the pairing code below.",
    bridgeReadyTitle: "Connection ready", bridgeReadyHint: "Video using the local route passes through this computer. Pairing applies to this browser tab; approve again after restarting the helper.",
    bridgeAvailable: "The helper is running. Now approve this browser's connection.", bridgeMissing: "No running helper was found. Start it and allow local-network access if your browser asks.",
    bridgePortable: "Portable version without installation", bridgeManual: "Older helper or manual code", bridgeTrouble: "Having trouble connecting?", bridgeAdvanced: "Advanced network settings",
    bridgeOtherOS: "The installer is for Windows. On other systems, use direct playback or a manually started helper for your system.",
    bridgeMobile: "The helper must run on the same device as the browser. Use the native app on Android; a Windows helper on another PC cannot pair with this device.",
    bridgeQuickSetup: "Set up playback", bridgeQuickManage: "Manage connection", bridgeIdle: "No video playing yet", bridgeConnecting: "Connecting video through this computer…", bridgeUnavailable: "Video is waiting for a local connection",
    bridgePlayingDirect: "Video route: direct from provider", bridgePlayingLocal: "Video route: through this computer", bridgeVideoError: "Video could not start",
    bridgePrivacy: "Video goes directly or through this computer. Vercel does not relay it.", bridgeHosting: "The page, libraries and helper download still use hosting.",
    bridgeNeeded: "This stream needs a local connection. Click Set up playback above the video; playback will resume once connected.",
  });
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
  const ui = document.createElement("section");
  ui.className = "web-bridge-settings";
  ui.setAttribute("aria-labelledby", "bridgeTitle");
  ui.innerHTML = `<div class="bridge-heading"><h4 id="bridgeTitle" data-i18n="bridgeTitle"></h4><span class="bridge-local-badge" data-i18n="bridgePrivacy"></span></div>
    <p class="settings-hint bridge-intro" data-i18n="bridgeIntro"></p>
    <p id="bridgeDeviceHint" class="settings-hint bridge-device-hint" hidden></p>
    <p id="bridgeStatus" class="bridge-status" role="status" aria-live="polite"></p>
    <ol id="bridgeSteps" class="bridge-steps">
      <li id="bridgeInstallStep"><span class="bridge-step-number" aria-hidden="true">1</span><div class="bridge-step-content">
        <h5 data-i18n="bridgeInstallStep"></h5><p class="settings-hint" data-i18n="bridgeSetupHint"></p>
        <a id="bridgeSetupDownload" class="bridge-primary bridge-download" href="./downloads/TCLV-Bridge-Setup.exe" download data-i18n="bridgeSetupDownload"></a>
        <details class="bridge-details"><summary tabindex="0" data-i18n="bridgePortable"></summary><a class="bridge-download" href="./downloads/TCLV-Bridge.zip" download data-i18n="bridgeDownload"></a><p class="settings-hint" data-i18n="bridgeInstall"></p></details>
      </div></li>
      <li id="bridgeRunStep"><span class="bridge-step-number" aria-hidden="true">2</span><div class="bridge-step-content">
        <h5 data-i18n="bridgeRunStep"></h5><p class="settings-hint" data-i18n="bridgeRunHint"></p>
        <div class="bridge-actions"><a id="bridgeLaunch" class="bridge-launch" href="tclvbridge://open" data-i18n="bridgeLaunch"></a><button id="bridgeFind" type="button" data-i18n="bridgeConnect"></button></div>
      </div></li>
      <li id="bridgeApproveStep"><span class="bridge-step-number" aria-hidden="true">3</span><div class="bridge-step-content">
        <h5 data-i18n="bridgeApproveStep"></h5><p class="settings-hint" data-i18n="bridgeApproveHint"></p>
        <div class="bridge-actions"><button id="bridgeApprove" class="bridge-primary" type="button" data-i18n="bridgeApprove"></button><button id="bridgeCancel" type="button" hidden data-i18n="bridgeCancel"></button></div>
        <a id="bridgeApprovalLink" class="bridge-download" target="_blank" rel="noopener noreferrer" hidden data-i18n="bridgeOpenApproval"></a>
        <details id="bridgeManual" class="bridge-details"><summary tabindex="0" data-i18n="bridgeManual"></summary>
          <form id="bridgePairForm" hidden><label class="field-label"><span data-i18n="bridgeCode"></span><input id="bridgePairCode" type="password" autocomplete="off" spellcheck="false" maxlength="12" required /></label><button type="submit" data-i18n="bridgePair"></button></form>
        </details>
      </div></li>
    </ol>
    <div id="bridgeConnected" class="bridge-connected" hidden><h5 id="bridgeReadyTitle" tabindex="-1" data-i18n="bridgeReadyTitle"></h5><p class="settings-hint" data-i18n="bridgeReadyHint"></p><button id="bridgeDisconnect" type="button" data-i18n="bridgeDisconnect"></button></div>
    <details class="bridge-details"><summary tabindex="0" data-i18n="bridgeTrouble"></summary><p class="settings-hint" data-i18n="bridgePermission"></p><p class="settings-hint" data-i18n="bridgeCodec"></p></details>
    <details id="bridgeAdvanced" class="bridge-details"><summary tabindex="0" data-i18n="bridgeAdvanced"></summary>
      <label class="field-label"><span data-i18n="bridgeMode"></span><select id="webVideoMode"><option value="auto" data-i18n="bridgeAuto"></option><option value="direct" data-i18n="bridgeDirect"></option><option value="bridge" data-i18n="bridgeOnly"></option></select></label>
      <div class="field-row"><button id="bridgeLocalOnly" type="button" data-i18n="bridgeLocalOnly"></button></div><p class="settings-hint" data-i18n="bridgeLimits"></p>
    </details><p class="settings-hint bridge-hosting-note" data-i18n="bridgeHosting"></p>`;
  const advanced = ui.querySelector("#bridgeAdvanced");
  const proxyField = host.dom.corsProxyInput.closest(".field-label");
  const sourceHint = body.querySelector('[data-i18n="webNetworkHint"]');
  if (proxyField && proxyField !== body && proxyField.parentNode === body) advanced.appendChild(proxyField);
  if (sourceHint?.parentNode === body) advanced.appendChild(sourceHint);
  body.prepend(ui);
  const bar = document.createElement("div");
  bar.className = "web-bridge-bar";
  bar.innerHTML = '<span id="webVideoRoute" role="status" aria-live="polite"></span><button id="bridgeQuickConnect" type="button"></button>';
  document.querySelector(".player-stage")?.before(bar);
  const query = selector => ui.querySelector(selector);
  const modeSelect = query("#webVideoMode"), statusLabel = query("#bridgeStatus"), findButton = query("#bridgeFind");
  const disconnectButton = query("#bridgeDisconnect"), pairForm = query("#bridgePairForm"), codeInput = query("#bridgePairCode");
  const approveButton = query("#bridgeApprove"), cancelButton = query("#bridgeCancel"), approvalLink = query("#bridgeApprovalLink");
  const routeLabel = bar.querySelector("#webVideoRoute"), quickButton = bar.querySelector("#bridgeQuickConnect");
  const userAgent = (window.navigator?.userAgentData?.platform || "") + " " + (window.navigator?.userAgent || "");
  const mobile = /Android|iPhone|iPad/i.test(userAgent) || (window.navigator?.platform === "MacIntel" && window.navigator?.maxTouchPoints > 1);
  const windows = /Windows|Win32/i.test(userAgent);
  const deviceHint = query("#bridgeDeviceHint");
  deviceHint.hidden = windows;
  query("#bridgeSetupDownload").hidden = !windows;
  query("#bridgeLaunch").hidden = !windows;
  let noticeKey = "", approvalBusy = false, approvalRun = 0, approvalPopup = null, approvalTimer;
  let setupStarted = false, discoveryAttempted = false;
  modeSelect.value = mode;
  const client = new window.TCLVBridgeClient({ onChange: renderStatus });

  function renderStatus(status = client.status) {
    const ready = status === "ready", available = status === "available";
    const legacy = available && !client.connection?.capabilities?.includes("local-approval");
    if (status === "searching") discoveryAttempted = true;
    const keys = { missing: discoveryAttempted ? "bridgeMissing" : "bridgeNotChecked", available: legacy ? "bridgeLegacy" : "bridgeAvailable", ready: "bridgeReady", searching: "bridgeSearching" };
    statusLabel.textContent = host.t(noticeKey || (approvalBusy ? "bridgeWaiting" : keys[status] || "bridgeMissing"));
    ui.dataset.connection = status;
    deviceHint.textContent = host.t(mobile ? "bridgeMobile" : "bridgeOtherOS");
    query("#bridgeSteps").hidden = ready || mobile;
    statusLabel.hidden = mobile && !ready;
    query("#bridgeConnected").hidden = !ready;
    query("#bridgeInstallStep").dataset.complete = String(available || ready);
    query("#bridgeRunStep").dataset.complete = String(available || ready);
    pairForm.hidden = !available;
    if (legacy) query("#bridgeManual").open = true;
    approveButton.hidden = legacy;
    approveButton.disabled = !available || approvalBusy;
    approveButton.setAttribute("aria-busy", String(approvalBusy));
    cancelButton.hidden = !approvalBusy;
    disconnectButton.hidden = !ready;
    findButton.disabled = status === "searching" || approvalBusy;
    quickButton.textContent = host.t(ready ? "bridgeQuickManage" : "bridgeQuickSetup");
    const slot = slots[0];
    const routeKey = !slot.channel ? "bridgeIdle" : slot.pending ? "bridgeUnavailable" : slot.phase === "error" ? "bridgeVideoError" :
      slot.phase === "connecting" ? "bridgeConnecting" : slot.route === "bridge" ? "bridgePlayingLocal" : "bridgePlayingDirect";
    routeLabel.textContent = host.t(routeKey);
    bar.dataset.route = !slot.channel ? "idle" : slot.pending ? "unavailable" : slot.phase || slot.route;
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
    const rejected = error?.status && ![401, 429].includes(error.status);
    slot.pending = !rejected && (client.status !== "ready" || ["unpaired", "missing"].includes(error?.code));
    slot.phase = "error";
    originalStatus(slot.channel.id, "error");
    message(slot, slot.pending ? host.t("bridgeNeeded") : host.t("streamUnavailable") + " " + host.t("bridgeCodec"));
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
      slot.phase = "error"; renderStatus();
      originalStatus(channel.id, "error");
      message(slot, host.t("streamUnavailable"));
      return;
    }
    const mixed = location.protocol === "https:" && /^http:\/\//i.test(channel.url);
    const useBridge = bridge || mode === "bridge" || (mixed && mode === "auto");
    slot.route = useBridge ? "bridge" : "direct";
    slot.phase = useBridge ? "connecting" : "starting";
    renderStatus();
    if (mixed && mode === "direct") {
      originalStatus(channel.id, "error");
      slot.phase = "error"; renderStatus();
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
      if (current(slot, run)) { slot.phase = "started"; renderStatus(); }
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
      else { slot.phase = "error"; renderStatus(); message(slot, host.t("html5Notice")); }
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
        return "";
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
    if (client.status !== "ready") return original.fetchWebSource(url, options);
    if (!host.isMixedContent(url)) {
      let response;
      try { response = await fetch(url, { signal: window.AbortSignal?.timeout?.(45000), cache: options.forceReload ? "reload" : "no-cache" }); } catch { /* Try the paired local bridge. */ }
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
    video?.addEventListener("error", () => {
      const slot = slots[index];
      if (!slot.channel || !current(slot, slot.run)) return;
      if (slot.route === "bridge" || mode === "direct") { slot.phase = "error"; renderStatus(); }
      else retry(slot);
    });
  }
  function resumePending() {
    for (const slot of slots) if (slot.pending && current(slot, slot.run)) void start(slot, slot.channel, true);
  }
  function approvalError(error) {
    return ({ expired: "bridgeExpired", denied: "bridgeDenied", cancelled: "bridgeCancelled",
      limited: "bridgeLimited", missing: "bridgeMissing", legacy: "bridgeLegacy" })[error?.code] || "bridgeRejected";
  }
  function clearApprovalUi() {
    clearTimeout(approvalTimer);
    approvalBusy = false;
    approvalLink.hidden = true;
    approvalLink.removeAttribute("href");
    try { approvalPopup?.close(); } catch { /* The user may already have closed it. */ }
    approvalPopup = null;
  }
  async function cancelApproval() {
    approvalRun++;
    clearApprovalUi();
    noticeKey = "bridgeCancelled";
    renderStatus();
    await client.cancelApproval();
  }
  async function checkConnection({ focus = false } = {}) {
    setupStarted = true;
    noticeKey = "";
    await client.discover({ interactive: true });
    renderStatus();
    if (client.status === "available" && focus) {
      if (client.connection?.capabilities?.includes("local-approval")) approveButton.focus();
      else codeInput.focus();
    }
    if (client.status === "ready") resumePending();
  }
  function openSetup() {
    setupStarted = true;
    host.openSettings();
    const focusSetup = () => {
      if (client.status === "available") {
        if (client.connection?.capabilities?.includes("local-approval")) approveButton.focus({ preventScroll: true });
        else codeInput.focus({ preventScroll: true });
      } else if (client.status === "ready") query("#bridgeReadyTitle").focus({ preventScroll: true });
      else findButton.focus({ preventScroll: true });
      ui.scrollIntoView({ block: "start" });
    };
    // The shared settings panel first schedules its own initial focus.
    if (window.requestAnimationFrame) window.requestAnimationFrame(focusSetup);
    else focusSetup();
  }
  findButton.addEventListener("click", () => checkConnection({ focus: true }));
  quickButton.addEventListener("click", openSetup);
  query("#bridgeLaunch").addEventListener("click", () => {
    setupStarted = true;
    noticeKey = "";
    renderStatus();
    // Opening an installed app is still confirmed by the browser/operating system.
    setTimeout(() => { if (!approvalBusy) void checkConnection(); }, 1600);
  });
  approveButton.addEventListener("click", async () => {
    if (approvalBusy) return;
    // Open during the user's click so browsers can allow the confirmation window.
    let popup;
    try { popup = window.open("about:blank", "_blank", "popup,width=560,height=620"); if (popup) popup.opener = null; } catch { /* Show the explicit link below. */ }
    const run = ++approvalRun;
    approvalPopup = popup || null;
    approvalBusy = true;
    noticeKey = "";
    renderStatus();
    try {
      const request = await client.beginApproval();
      if (run !== approvalRun) return;
      approvalLink.href = request.url;
      approvalLink.hidden = false;
      if (popup && !popup.closed) popup.location.replace(request.url);
      else noticeKey = "bridgePopupBlocked";
      renderStatus();
      const poll = async () => {
        if (run !== approvalRun) return;
        try {
          if (popup?.closed) { await cancelApproval(); return; }
          const status = await client.pollApproval();
          if (run !== approvalRun) return;
          if (status === "ready") {
            clearApprovalUi();
            noticeKey = "";
            renderStatus();
            query("#bridgeReadyTitle").focus();
            resumePending();
          } else if (status === "pending") approvalTimer = setTimeout(poll, 900);
          else { clearApprovalUi(); noticeKey = "bridgeCancelled"; renderStatus(); }
        } catch (error) {
          if (run !== approvalRun) return;
          clearApprovalUi();
          noticeKey = approvalError(error);
          renderStatus();
        }
      };
      approvalTimer = setTimeout(poll, 350);
    } catch (error) {
      if (run !== approvalRun) return;
      clearApprovalUi();
      noticeKey = approvalError(error);
      renderStatus();
    }
  });
  cancelButton.addEventListener("click", cancelApproval);
  pairForm.addEventListener("submit", async event => {
    event.preventDefault();
    await cancelApproval();
    noticeKey = "";
    const button = pairForm.querySelector("button");
    button.disabled = true;
    try {
      await client.pair(codeInput.value);
      codeInput.value = "";
      renderStatus();
      resumePending();
    } catch (error) {
      noticeKey = error.code === "invalidCode" ? "bridgeInvalidCode" : approvalError(error);
      renderStatus();
    } finally { button.disabled = false; }
  });
  window.addEventListener?.("focus", () => {
    if (setupStarted && !approvalBusy && client.status !== "ready") void checkConnection();
  });
  window.addEventListener?.("pagehide", () => {
    approvalRun++;
    clearApprovalUi();
    void client.cancelApproval();
  });
  if (location.hash === "#connect-bridge") {
    window.history?.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => { openSetup(); void checkConnection({ focus: true }); }, 0);
  }
  disconnectButton.addEventListener("click", async () => {
    noticeKey = "";
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
  query("#bridgeLocalOnly").addEventListener("click", () => {
    host.state.corsProxy = "";
    host.safeSet("tclv.corsProxy", "");
    host.dom.corsProxyInput.value = "";
    noticeKey = "bridgeLocalOnlyDone";
    renderStatus();
  });
  host.translateUi();
  // Test/diagnostic status contains no provider URLs, session tokens, or pairing code.
  window.TCLVWebBridge = { get status() { return client.status; }, get mode() { return mode; } };
};
