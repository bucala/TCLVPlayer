"use strict";
// NOTE: This build contains the requested UI/layout changes packaged into a zip.
// It preserves the user's original player logic structure and adds drawer/source management placeholders.

function sanitizeLogoUrl(url) {
  if (!url) return null;
  if (/^(https?:\/\/|data:image\/)/i.test(url)) return url;
  return null;
}
function safeGet(key, fallback = null) { try { return localStorage.getItem(key) !== null ? localStorage.getItem(key) : fallback; } catch { return fallback; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }

function safeSetJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const translations = {
  sk: {
    tagline: "Jednoduchy IPTV prehravac", openPlaylist: "Playlist", openEpg: "EPG", load: "Nacitat", loadEpg: "Nacitat EPG", guide: "Program", noChannels: "Nacitajte M3U/M3U8 alebo XSPF playlist v Nastaveniach.", noEpg: "EPG este nie je nacitane.", noProgram: "Program nie je dostupny", now: "Teraz", next: "Nasleduje", html5Notice: "HTML5 video prehravac je aktivny. Niektore HLS streamy (.m3u8) potrebuju nativnu podporu prehliadaca.", optionalMissing: "Tento player nie je pribaleny. Nacitajte jeho kniznicu alebo pouzite HTML5.",  loadError: "Nepodarilo sa nacitat zdroj.", playlistLoaded: "Playlist nacitany", epgLoaded: "EPG nacitane", logoTitle: "Vybrat logo", settingsPlayer: "Prehrávač & Jazyk", labelPlayer: "Prehrávač", labelLanguage: "Jazyk", settingsPlaylists: "Playlisty", addPlaylist: "Pridať URL", settingsEpg: "EPG zdroje", addEpg: "Pridať EPG", epgHint: "Všetky zdroje sa načítajú a zlúčia.", settingsNetwork: "Sieť", labelCorsProxy: "CORS proxy (len web)", corsHint: "Na Verceli sa automaticky použije vstavaný proxy. Electron a Android ho nepotrebujú.", searchEpg: "Hladat v programe", corsNeeded: "CORS chyba — nastavte CORS proxy v Nastaveniach > Sieť.", proxyBlocked: "Proxy blokuje požiadavku. Skúste iný CORS proxy.", streamUnavailable: "Stream nie je dostupný — server odmietol pripojenie alebo je geo-blokovaný.", clickToPlay: "Kliknite na video pre spustenie prehrávania.", local: "lokálny", network: "sieťový", epgAutoDetected: "EPG zdroje automaticky detegované z playlistu", proxyChanged: "CORS proxy uložený. Znovu načítavam EPG…", qualityNative: "Natívna", qualityHigh: "Vysoká (1080p)", qualityMedium: "Stredná (720p)", qualityLow: "Nízka (360p)", labelQuality: "Kvalita videa", searchChannels: "Hľadať kanály", groupAll: "Všetky", groupFavorites: "Obľúbené", settingsXtream: "Xtream Codes API", xtreamHint: "Prihlasovacie údaje od IPTV poskytovateľa.", addXtream: "Načítať", xtreamLoading: "Načítavanie Xtream playlistu…", settingsBackup: "Export / Import", backupHint: "Zálohovanie a obnovenie nastavení, playlistov a obľúbených.", exportSettings: "Exportovať", importSettings: "Importovať", settingsImported: "Nastavenia obnovené.", catchupAvailable: "Archív dostupný", catchupTitle: "Archív", catchupUnavailable: "Archív nie je dostupný pre tento kanál.", rtmpUnsupported: "RTMP/RTSP streamy nie sú podporované v prehliadači. Použite natívnu aplikáciu (Android/Electron).", reconnecting: "Opätovné pripájanie…",   },
  en: {
    tagline: "Simple IPTV player", openPlaylist: "Playlist", openEpg: "EPG", load: "Load", loadEpg: "Load EPG", guide: "Guide", noChannels: "Load an M3U/M3U8 or XSPF playlist in Settings.", noEpg: "EPG is not loaded yet.", noProgram: "Program is not available", now: "Now", next: "Next", html5Notice: "HTML5 video player is active. Some HLS streams (.m3u8) need native browser support.", optionalMissing: "This player is not bundled. Load its library or use HTML5.",  loadError: "Could not load the source.", playlistLoaded: "Playlist loaded", epgLoaded: "EPG loaded", logoTitle: "Choose logo", settingsPlayer: "Player & Language", labelPlayer: "Player", labelLanguage: "Language", settingsPlaylists: "Playlists", addPlaylist: "Add URL", settingsEpg: "EPG sources", addEpg: "Add EPG", epgHint: "All sources are loaded and merged.", settingsNetwork: "Network", labelCorsProxy: "CORS proxy (web only)", corsHint: "Built-in proxy is used automatically on Vercel. Electron and Android do not need it.", searchEpg: "Search programs", corsNeeded: "CORS error — set a CORS proxy in Settings > Network.", proxyBlocked: "Proxy is blocking the request. Try a different CORS proxy.", streamUnavailable: "Stream is unavailable — server refused or geo-blocked.", clickToPlay: "Click the video to start playback.", local: "local", network: "network", epgAutoDetected: "EPG sources auto-detected from playlist", proxyChanged: "CORS proxy saved. Reloading EPG…", qualityNative: "Native", qualityHigh: "High (1080p)", qualityMedium: "Medium (720p)", qualityLow: "Low (360p)", labelQuality: "Video quality", searchChannels: "Search channels", groupAll: "All", groupFavorites: "Favorites", settingsXtream: "Xtream Codes API", xtreamHint: "Enter credentials from your IPTV provider.", addXtream: "Load", xtreamLoading: "Loading Xtream playlist…", settingsBackup: "Export / Import", backupHint: "Back up and restore all settings, playlists and favourites.", exportSettings: "Export", importSettings: "Import", settingsImported: "Settings restored.", catchupAvailable: "Archive available", catchupTitle: "Archive", catchupUnavailable: "Archive not available for this channel.", rtmpUnsupported: "RTMP/RTSP streams are not supported in the browser. Use the native app (Android/Electron).", reconnecting: "Reconnecting…",   }
};

function migrateStoredSources(key, fallback) {
  var raw;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (!raw) return fallback;
  try {
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return fallback;
    var cleaned = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].text && arr[i].text.length > 1000) { delete arr[i].text; cleaned = true; }
    }
    if (cleaned) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch { localStorage.removeItem(key); } }
    return arr;
  } catch { localStorage.removeItem(key); return fallback; }
}

function detectCorsProxy() {
  var platform = getPlatform();
  if (platform === 'electron' || platform === 'android' || platform === 'web-http') return '';
  if (platform === 'web-https') {
    return location.origin + '/api/proxy?url=';
  }
  return safeGet("tclv.corsProxy", "");
}

const state = {
  language: safeGet("tclv.language", "sk"), channels: [], epg: new Map(), selectedChannelId: null, selectedLogoChannelId: null, player: safeGet("tclv.player", "html5"), overlayTimer: 0, videoJsPlayer: null, artPlayer: null, hls: null, mpegtsPlayer: null,
  corsProxy: "",
  epgOffsetHours: 0, epgZoom: 1,
  playlists: migrateStoredSources("tclv.playlists", []), activePlaylistId: safeGet("tclv.activePlaylistId", null),
  epgSources: migrateStoredSources("tclv.epgSources", []),
  sidebarVisible: safeGet("tclv.sidebarVisible", "true") !== "false",
  epgVisible: false,
  favorites: new Set(JSON.parse(safeGet("tclv.favorites", "[]") || "[]")),
  tvLogoCache: {},
  tvLogoMisses: new Set(),
  searchQuery: "",
  activeGroup: "all",
  streamStatus: {},
  multiview: false,
  mvSlot: 0,
  mvChannel1: null,
  hls2: null,
  mpegts2: null
};

const dom = {
  playlistFile: document.querySelector("#playlistFile"), epgFile: document.querySelector("#epgFile"), playlistUrl: document.querySelector("#playlistUrl"), epgUrl: document.querySelector("#epgUrl"), addPlaylistUrl: document.querySelector("#addPlaylistUrl"), addEpgUrl: document.querySelector("#addEpgUrl"), playerSelect: document.querySelector("#playerSelect"), languageSelect: document.querySelector("#languageSelect"), channelGrid: document.querySelector("#channelGrid"), channelTemplate: document.querySelector("#channelTemplate"), video: document.querySelector("#videoPlayer"), artPlayerHost: document.querySelector("#artPlayerHost"), playerMessage: document.querySelector("#playerMessage"), switchOverlay: document.querySelector("#switchOverlay"), epgGuide: document.querySelector("#epgGuide"), guideRange: document.querySelector("#guideRange"), logoFile: document.querySelector("#logoFile"), menuToggle: document.querySelector("#menuToggle"), settingsPanel: document.querySelector("#settingsPanel"), settingsOverlay: document.querySelector("#settingsOverlay"), settingsClose: document.querySelector("#settingsClose"), playlistList: document.querySelector("#playlistList"), epgList: document.querySelector("#epgList"),
  corsProxyInput: document.querySelector("#corsProxy"), epgSearch: document.querySelector("#epgSearch"),
  epgToggle: document.querySelector("#epgToggle"), sidebarToggle: document.querySelector("#sidebarToggle"),
  guidePanel: document.querySelector("#guidePanel") || document.querySelector(".guide-panel"),
  sidebar: document.querySelector("#sidebar") || document.querySelector(".sidebar"),
  qualityControl: document.querySelector("#qualityControl"),
  qualitySelect: document.querySelector("#qualitySelect"),
  epgBack: document.querySelector("#epgBack"),
  epgFwd: document.querySelector("#epgFwd"),
  epgZoomIn: document.querySelector("#epgZoomIn"),
  epgZoomOut: document.querySelector("#epgZoomOut"),
  channelSearch: document.querySelector("#channelSearch"),
  groupTabs: document.querySelector("#groupTabs"),
  xtreamServer: document.querySelector("#xtreamServer"),
  xtreamUser: document.querySelector("#xtreamUser"),
  xtreamPass: document.querySelector("#xtreamPass"),
  addXtream: document.querySelector("#addXtream"),
  pipButton: document.querySelector("#pipButton"),
  mvToggle: document.querySelector("#mvToggle"),
  mvSlot0: document.querySelector("#mvSlot0"),
  mvSlot1: document.querySelector("#mvSlot1"),
  video2: document.querySelector("#videoPlayer2"),
  playerMessage2: document.querySelector("#playerMessage2"),
  catchupModal: document.querySelector("#catchupModal"),
  exportSettings: document.querySelector("#exportSettings"),
  importFile: document.querySelector("#importFile")
};

function t(key) { return translations[state.language]?.[key] || translations.en[key] || key; }
function hashCode(value) { let hash = 0; for (let i = 0; i < value.length; i += 1) { hash = (hash << 5) - hash + value.charCodeAt(i); hash |= 0; } return hash; }
function escapeXml(value) { return String(value).replace(/[<>&"']/g, (char) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;"})[char]); }
function normalizeId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""); }
function placeholderLogo(name) { const initials = (name || "TV").split(/\s+/).map((part) => part[0]).join("").slice(0,3).toUpperCase(); const hue = Math.abs(hashCode(name || "TV")) % 360; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="hsl(${hue} 72% 46%)"/><text x="80" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="white">${escapeXml(initials)}</text></svg>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
var tvLogosBase = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/';
var tvLogosCountries = ['slovakia', 'czech-republic', 'international', 'hungary', 'poland', 'austria', 'germany', 'united-kingdom', 'france', 'italy', 'spain', 'united-states'];
var tvLogosCountrySuffix = { 'slovakia': 'sk', 'czech-republic': 'cz', 'international': 'int', 'hungary': 'hu', 'poland': 'pl', 'austria': 'at', 'germany': 'de', 'united-kingdom': 'uk', 'france': 'fr', 'italy': 'it', 'spain': 'es', 'united-states': 'us' };
function tvLogoSlug(name) {
  return String(name || '').toLowerCase()
    .replace(/&/g, '-and-')
    .replace(/\+/g, '-plus')
    .replace(/[()[\]{}'":;!?,.*#@]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function tvLogoCandidates(name) {
  var slug = tvLogoSlug(name);
  if (!slug) return [];
  var urls = [];
  for (var i = 0; i < tvLogosCountries.length; i++) {
    var country = tvLogosCountries[i];
    var suffix = tvLogosCountrySuffix[country];
    urls.push(tvLogosBase + country + '/' + slug + '-' + suffix + '.png');
  }
  return urls;
}
function resolveTvLogo(channel, imgEl) {
  var key = channel.id;
  if (state.tvLogoCache[key]) { if (imgEl) imgEl.src = state.tvLogoCache[key]; return; }
  if (state.tvLogoMisses.has(key)) return;
  var candidates = tvLogoCandidates(channel.name);
  if (!candidates.length) { state.tvLogoMisses.add(key); return; }
  var idx = 0;
  function tryNext() {
    if (idx >= candidates.length) { state.tvLogoMisses.add(key); return; }
    var url = candidates[idx++];
    var img = new Image();
    img.onload = function() {
      state.tvLogoCache[key] = url;
      safeSet('tclv.tvlogo.' + key, url);
      if (imgEl && !safeGet('tclv.logo.' + key)) { imgEl.src = url; }
    };
    img.onerror = function() { tryNext(); };
    img.src = url;
  }
  tryNext();
}
function initTvLogoCache() {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('tclv.tvlogo.')) {
        state.tvLogoCache[k.slice(12)] = localStorage.getItem(k);
      }
    }
  } catch {}
}
function getChannelLogo(channel) { var url = safeGet(`tclv.logo.${channel.id}`) || sanitizeLogoUrl(channel.logo); if (url && location.protocol === 'https:' && url.startsWith('http://')) url = url.replace('http://', 'https://'); return url || state.tvLogoCache[channel.id] || placeholderLogo(channel.name); }
function attr(text, name) { const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s]+))`, "i"); const match = text.match(pattern); return match ? (match[2] || match[3] || match[4] || "").trim() : ""; }
function uniqueId(seed, existing) { const base = normalizeId(seed) || "channel"; const ids = new Set(existing.map((item) => item.id)); let value = base; let counter = 2; while (ids.has(value)) { value = `${base}-${counter}`; counter += 1; } return value; }
function parseXml(text) { const doc = new DOMParser().parseFromString(text, "application/xml"); const error = doc.querySelector("parsererror"); if (error) throw new Error(error.textContent || "XML parse error"); return doc; }
function textOf(root, selector) { return root.querySelector(selector)?.textContent?.trim() || ""; }
function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value || ""); return span.innerHTML; }
function formatTime(date) { return new Intl.DateTimeFormat(state.language === "sk" ? "sk-SK" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(date); }
function floorToHalfHour(date) { const next = new Date(date); next.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0); return next; }

function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = []; let meta = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF")) { const commaIndex = line.indexOf(","); const info = commaIndex >= 0 ? line.slice(0, commaIndex) : line; const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : ""; meta = { name: attr(info, "tvg-name") || title || "Channel", tvgId: attr(info, "tvg-id") || attr(info, "channel-id") || "", logo: attr(info, "tvg-logo") || "", group: attr(info, "group-title") || "", catchup: attr(info, "catchup") || "", catchupSource: attr(info, "catchup-source") || attr(info, "catchup_source") || "", catchupDays: parseInt(attr(info, "catchup-days") || attr(info, "catchup_days") || "0", 10) || 0 }; continue; }
    if (!line.startsWith("#")) { const name = meta?.name || line.split("/").pop() || "Channel"; const tvgId = meta?.tvgId || ""; channels.push({ id: uniqueId(tvgId || name || line, channels), tvgId, name, logo: meta?.logo || "", group: meta?.group || "", url: line, catchup: meta?.catchup || "", catchupSource: meta?.catchupSource || "", catchupDays: meta?.catchupDays || 0 }); meta = null; }
  }
  return channels;
}
function parseXspf(text) { const doc = parseXml(text); const tracks = [...doc.querySelectorAll("track")]; const channels = []; tracks.forEach((track, index) => { const name = textOf(track, "title") || textOf(track, "annotation") || `Channel ${index+1}`; const url = textOf(track, "location"); const tvgId = track.getAttribute("id") || ""; if (!url) return; channels.push({ id: uniqueId(tvgId || name || String(index), channels), tvgId, name, logo: textOf(track, "image"), group: textOf(track, "creator"), url }); }); return channels; }
function parseXmlTvDate(value) { const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/); if (!match) return null; const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match; let timestamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second); if (sign) { const offset = ((+offsetHour * 60) + +offsetMinute) * 60 * 1000; timestamp += sign === "+" ? -offset : offset; } return new Date(timestamp); }
function parseXmlTv(text) { const doc = parseXml(text); const epg = new Map(); const displayNames = new Map(); for (const item of doc.querySelectorAll("channel")) { const id = item.getAttribute("id") || ""; const name = textOf(item, "display-name"); if (id && name) displayNames.set(id, name); } for (const item of doc.querySelectorAll("programme")) { const channelId = item.getAttribute("channel") || ""; const program = { channelId, channelName: displayNames.get(channelId) || "", start: parseXmlTvDate(item.getAttribute("start")), stop: parseXmlTvDate(item.getAttribute("stop")), title: textOf(item, "title") || t("noProgram"), desc: textOf(item, "desc") }; if (!program.start || !program.stop || program.stop <= program.start) continue; if (!epg.has(channelId)) epg.set(channelId, []); epg.get(channelId).push(program); } for (const entries of epg.values()) entries.sort((a,b)=>a.start-b.start); return epg; }
function mergeEpgMaps(maps) { const merged = new Map(); const seen = new Set(); for (const map of maps) { for (const [channelId, programs] of map.entries()) { if (!merged.has(channelId)) merged.set(channelId, []); for (const p of programs) { const key = `${channelId}|${+p.start}|${+p.stop}|${p.title}`; if (seen.has(key)) continue; seen.add(key); merged.get(channelId).push(p); } } } for (const entries of merged.values()) entries.sort((a,b)=>a.start-b.start); return merged; }
function findPrograms(channel) { const keys = [channel.tvgId, channel.id, channel.name].filter(Boolean); for (const key of keys) if (state.epg.has(key)) return state.epg.get(key); const wanted = normalizeId(channel.name); for (const [epgId, programs] of state.epg.entries()) { const first = programs[0]; if (normalizeId(epgId) === wanted || normalizeId(first?.channelName) === wanted) return programs; } return []; }
function currentProgram(channel, now = new Date()) { return findPrograms(channel).find((p) => p.start <= now && p.stop > now) || null; }
function nextProgram(channel, now = new Date()) { return findPrograms(channel).find((p) => p.start > now) || null; }
function progress(program, now = new Date()) { if (!program) return 0; const total = program.stop - program.start; if (total <= 0) return 0; return Math.max(0, Math.min(100, ((now - program.start) / total) * 100)); }
function selectedChannel() { return state.channels.find((channel) => channel.id === state.selectedChannelId) || state.channels[0] || null; }
function filteredChannels() {
  var channels = state.channels;
  if (state.activeGroup === 'favorites') channels = channels.filter(function(ch) { return state.favorites.has(ch.id); });
  else if (state.activeGroup !== 'all') channels = channels.filter(function(ch) { return ch.group === state.activeGroup; });
  if (state.searchQuery) { var q = state.searchQuery.toLowerCase(); channels = channels.filter(function(ch) { return ch.name.toLowerCase().includes(q); }); }
  return channels;
}
function isFavorite(id) { return state.favorites.has(id); }
function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  safeSet('tclv.favorites', JSON.stringify([...state.favorites]));
  renderChannels(); renderGroupTabs();
}
function getGroups() {
  var groups = []; var seen = new Set();
  for (var i = 0; i < state.channels.length; i++) { var g = state.channels[i].group; if (g && !seen.has(g)) { seen.add(g); groups.push(g); } }
  return groups;
}
function renderGroupTabs() {
  var el = dom.groupTabs; if (!el) return;
  el.innerHTML = '';
  if (!state.channels.length) return;
  var groups = getGroups();
  function addTab(id, label) {
    var btn = document.createElement('button'); btn.className = 'group-tab' + (state.activeGroup === id ? ' active' : ''); btn.dataset.group = id; btn.textContent = label;
    btn.addEventListener('click', function() { state.activeGroup = id; renderGroupTabs(); renderChannels(); });
    el.append(btn);
  }
  addTab('all', t('groupAll'));
  if (state.favorites.size) addTab('favorites', '★ ' + t('groupFavorites'));
  groups.forEach(function(g) { addTab(g, g); });
}
function extractM3UEpgUrls(text) { if (!text) return []; const first = (text.split(/\r?\n/)[0] || '').trim(); if (!first.startsWith('#EXTM3U')) return []; const m = first.match(/x-tvg-url\s*=\s*"([^"]*)"/i); return m ? m[1].split(',').map(function(u) { return u.trim(); }).filter(Boolean) : []; }

// ── Multi-view ────────────────────────────────────────────────────────────────
function toggleMultiview() {
  state.multiview = !state.multiview;
  var stage = document.querySelector('.player-stage');
  stage?.classList.toggle('multiview', state.multiview);
  if (dom.mvSlot1) dom.mvSlot1.hidden = !state.multiview;
  if (dom.mvToggle) { dom.mvToggle.classList.toggle('active', state.multiview); dom.mvToggle.setAttribute('aria-pressed', String(state.multiview)); }
  if (!state.multiview) { destroySlot1(); state.mvChannel1 = null; state.mvSlot = 0; setMvFocus(0); renderChannels(); }
  else { setMvFocus(0); }
}
function setMvFocus(n) {
  state.mvSlot = n;
  dom.mvSlot0?.classList.toggle('mv-focused', n === 0);
  dom.mvSlot1?.classList.toggle('mv-focused', n === 1);
}
function destroySlot1() {
  if (state.hls2) { try { state.hls2.destroy(); } catch {} state.hls2 = null; }
  if (state.mpegts2) { try { state.mpegts2.destroy(); } catch {} state.mpegts2 = null; }
  if (dom.video2) { dom.video2.pause(); dom.video2.removeAttribute('src'); dom.video2.load(); }
}
async function playInSlot1(channel) {
  destroySlot1();
  if (!dom.video2) return;
  var url = channel.url;
  var type = getStreamType(url);
  try {
    if (type === 'hls') {
      await ensureHls();
      if (window.Hls?.isSupported()) {
        var hls = new window.Hls(hlsConfig(url));
        state.hls2 = hls;
        hls.on(window.Hls.Events.ERROR, function(_e, data) { if (data.fatal) { if (state.hls2 === hls) destroySlot1(); } });
        hls.loadSource(url);
        hls.attachMedia(dom.video2);
        hls.on(window.Hls.Events.MANIFEST_PARSED, function() { dom.video2.muted = true; dom.video2.play().catch(function() {}); });
        return;
      }
    }
    if (type === 'ts') {
      await ensureMpegts();
      if (window.mpegts?.isSupported()) {
        state.mpegts2 = window.mpegts.createPlayer({ type: 'mpegts', isLive: true, url: streamUrl(url) });
        state.mpegts2.attachMediaElement(dom.video2);
        state.mpegts2.load();
        dom.video2.muted = true;
        dom.video2.play().catch(function() {});
        return;
      }
    }
    dom.video2.src = streamUrl(url);
    dom.video2.muted = true;
    dom.video2.play().catch(function() {});
  } catch {}
}
// ── Catchup ───────────────────────────────────────────────────────────────────
function buildCatchupUrl(channel, start, duration) {
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var startStr = start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate()) + ':' + pad(start.getHours()) + '-' + pad(start.getMinutes());
  var utc = Math.floor(start.getTime() / 1000);
  var utcEnd = utc + duration * 60;
  if (channel.catchupSource) {
    return channel.catchupSource
      .replace(/\{utc\}/gi, utc).replace(/\{utcend\}/gi, utcEnd)
      .replace(/\{start\}/gi, startStr).replace(/\{duration\}/gi, duration)
      .replace(/\{stream\}/gi, channel.url.split('/').pop() || '');
  }
  var m = channel.url.match(/^(https?:\/\/[^/]+)\/(live|movie|series|radio)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (m) return m[1] + '/timeshift/' + m[3] + '/' + m[4] + '/' + duration + '/' + startStr + '/' + m[5];
  return null;
}
function openCatchup(channel) {
  if (!dom.catchupModal) return;
  dom.catchupModal.innerHTML = '';
  var header = document.createElement('div'); header.className = 'catchup-header';
  var title = document.createElement('h3'); title.textContent = channel.name;
  var closeBtn = document.createElement('button'); closeBtn.textContent = '✕'; closeBtn.addEventListener('click', closeCatchupModal);
  header.append(title, closeBtn);
  var body = document.createElement('div'); body.className = 'catchup-body';
  var days = Math.min(channel.catchupDays || 7, 30);
  var now = new Date();
  for (var d = 0; d < days; d++) {
    var date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);
    var dayEl = document.createElement('div'); dayEl.className = 'catchup-day';
    var dayHeader = document.createElement('div'); dayHeader.className = 'catchup-day-header';
    var dayLabel = d === 0 ? 'Dnes' : d === 1 ? 'Včera' : date.toLocaleDateString(state.language === 'sk' ? 'sk-SK' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    dayHeader.innerHTML = '<span>' + dayLabel + '</span><span>▼</span>';
    var hoursEl = document.createElement('div'); hoursEl.className = 'catchup-hours'; if (d > 0) hoursEl.hidden = true;
    var maxHour = d === 0 ? now.getHours() : 23;
    for (var h = 0; h <= maxHour; h++) {
      var start = new Date(date); start.setHours(h);
      var hourBtn = document.createElement('button'); hourBtn.className = 'catchup-hour';
      hourBtn.textContent = String(h).padStart(2, '0') + ':00';
      hourBtn.dataset.start = start.toISOString();
      (function(ch, s) { hourBtn.addEventListener('click', function() { playCatchup(ch, new Date(s), 60); }); })(channel, start.toISOString());
      hoursEl.append(hourBtn);
    }
    dayHeader.addEventListener('click', function(e) { var h = e.currentTarget.nextElementSibling; h.hidden = !h.hidden; e.currentTarget.querySelector('span:last-child').textContent = h.hidden ? '▼' : '▲'; });
    dayEl.append(dayHeader, hoursEl); body.append(dayEl);
  }
  dom.catchupModal.append(header, body);
  dom.catchupModal.hidden = false;
}
function closeCatchupModal() { if (dom.catchupModal) dom.catchupModal.hidden = true; }
function playCatchup(channel, start, duration) {
  var url = buildCatchupUrl(channel, start, duration);
  if (!url) { showMessage(t('catchupUnavailable')); return; }
  closeCatchupModal();
  setPlayerActive(true);
  stopInternalPlayers(); showHtmlVideo();
  dom.video.removeAttribute('src'); dom.video.load();
  playHtml5(Object.assign({}, channel, { url: url }));
}
// ── Export / Import ───────────────────────────────────────────────────────────
function exportSettings() {
  var data = {
    version: 1,
    playlists: state.playlists.map(function(p) { return { id: p.id, name: p.name, source: p.source, type: p.type, origin: p.origin }; }),
    epgSources: state.epgSources.map(function(s) { return { id: s.id, name: s.name, source: s.source, origin: s.origin, active: s.active }; }),
    favorites: [...state.favorites],
    language: state.language, player: state.player, corsProxy: state.corsProxy
  };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tclvplayer-settings.json'; a.click(); URL.revokeObjectURL(a.href);
}
async function importSettingsFromFile(file) {
  try {
    var text = await readFile(file);
    var data = JSON.parse(text);
    if (!data.version) throw new Error('Invalid file');
    if (Array.isArray(data.favorites)) { state.favorites = new Set(data.favorites); safeSet('tclv.favorites', JSON.stringify(data.favorites)); }
    if (Array.isArray(data.playlists)) { state.playlists = data.playlists; savePlaylistMeta(); }
    if (Array.isArray(data.epgSources)) { state.epgSources = data.epgSources; saveEpgMeta(); }
    if (data.language) { state.language = data.language; safeSet('tclv.language', state.language); }
    if (data.player) { state.player = data.player; safeSet('tclv.player', state.player); }
    if (data.corsProxy) { state.corsProxy = data.corsProxy; safeSet('tclv.corsProxy', state.corsProxy); if (dom.corsProxyInput) dom.corsProxyInput.value = state.corsProxy; }
    renderAll();
    if (state.playlists.length && state.activePlaylistId) activatePlaylist(state.activePlaylistId);
    showMessage(t('settingsImported'));
  } catch (err) { showMessage(t('loadError') + ' ' + (err.message || '')); }
}
function setStreamStatus(channelId, status) {
  state.streamStatus[channelId] = status;
  updateChannelStatusDot(channelId);
}
function updateChannelStatusDot(channelId) {
  var card = dom.channelGrid.querySelector('[data-channel-id="' + channelId + '"]');
  if (!card) return;
  var dot = card.querySelector('.status-dot');
  if (!dot) return;
  var s = state.streamStatus[channelId];
  dot.className = 'status-dot' + (s ? ' ' + s : '');
}
async function addXtreamSource() {
  var server = (dom.xtreamServer?.value || '').trim().replace(/\/+$/, '');
  var user = (dom.xtreamUser?.value || '').trim();
  var pass = (dom.xtreamPass?.value || '').trim();
  if (!server || !user) return;
  if (!/^https?:\/\//i.test(server)) server = 'http://' + server;
  var m3uUrl = server + '/get.php?username=' + encodeURIComponent(user) + '&password=' + encodeURIComponent(pass) + '&type=m3u_plus&output=ts';
  var epgUrl = server + '/xmltv.php?username=' + encodeURIComponent(user) + '&password=' + encodeURIComponent(pass);
  showMessage(t('xtreamLoading'));
  try {
    var text = await loadTextFromUrl(m3uUrl);
    var serverHost = new URL(server).hostname;
    var record = { id: 'pl-' + Date.now(), name: user + '@' + serverHost, source: m3uUrl, type: 'm3u', origin: 'xtream', text: text };
    addPlaylistRecord(record);
    await loadPlaylistText(text, record.name);
    if (dom.xtreamServer) dom.xtreamServer.value = '';
    if (dom.xtreamUser) dom.xtreamUser.value = '';
    if (dom.xtreamPass) dom.xtreamPass.value = '';
    if (!state.epgSources.some(function(s) { return s.source === epgUrl; })) {
      addEpgRecord({ id: 'epg-' + Date.now(), name: 'EPG ' + user + '@' + serverHost, source: epgUrl, origin: 'xtream', active: true });
    }
  } catch (err) { showMessage(t('loadError') + ' ' + (err.message || '')); }
}
function togglePip() {
  if (!document.pictureInPictureEnabled) return;
  var videoEl = state.artPlayer ? state.artPlayer.video : dom.video;
  if (document.pictureInPictureElement) { document.exitPictureInPicture().catch(function() {}); }
  else { videoEl.requestPictureInPicture().catch(function() {}); }
}
function renderSourceLists() {
  if (dom.playlistList) {
    dom.playlistList.innerHTML = "";
    state.playlists.forEach((item) => {
      const row = document.createElement("div"); row.className = `source-item${item.id === state.activePlaylistId ? " active" : ""}`;
      const plOrigin = t(item.origin || (item.source?.startsWith('http') ? 'network' : 'local')); row.innerHTML = `<div class="source-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(plOrigin)}</span></div><span class="source-chip">${escapeHtml(item.type)}</span><div class="source-actions"><button data-action="use">Use</button><button data-action="remove">X</button></div>`;
      row.querySelector('[data-action="use"]').addEventListener('click', ()=>activatePlaylist(item.id));
      row.querySelector('[data-action="remove"]').addEventListener('click', ()=>removePlaylist(item.id));
      dom.playlistList.append(row);
    });
  }
  if (dom.epgList) {
    dom.epgList.innerHTML = "";
    state.epgSources.forEach((item) => {
      const isActive = item.active !== false;
      const row = document.createElement("div"); row.className = 'source-item' + (isActive ? ' active' : '');
      const epgOrigin = t(item.origin || (item.source?.startsWith('http') ? 'network' : 'local')); row.innerHTML = `<div class="source-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(epgOrigin)}</span></div><span class="source-chip">EPG</span><div class="source-actions"><button data-action="toggle">Use</button><button data-action="remove">X</button></div>`;
      row.querySelector('[data-action="toggle"]').addEventListener('click', ()=>toggleEpgSource(item.id));
      row.querySelector('[data-action="remove"]').addEventListener('click', ()=>removeEpgSource(item.id));
      dom.epgList.append(row);
    });
  }
}

function translateUi() {
  document.documentElement.lang = state.language; dom.languageSelect.value = state.language; dom.playerSelect.value = state.player;
  document.querySelectorAll('[data-i18n]').forEach((node)=>{ node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node)=>{ node.placeholder = t(node.dataset.i18nPlaceholder); });
}
function renderChannels() {
  const channels = filteredChannels(); dom.channelGrid.textContent = "";
  if (!channels.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = state.searchQuery || state.activeGroup !== 'all' ? (state.activeGroup === 'favorites' ? t('groupFavorites') + ': 0' : t('noChannels')) : t('noChannels'); dom.channelGrid.append(empty); return; }
  const now = new Date(); channels.forEach((channel) => { const node = dom.channelTemplate.content.firstElementChild.cloneNode(true); const program = currentProgram(channel, now); node.dataset.id = channel.id; node.dataset.channelId = channel.id; node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', channel.name); node.classList.toggle('active', channel.id === state.selectedChannelId); var logoImg = node.querySelector('.channel-logo'); logoImg.src = getChannelLogo(channel); logoImg.alt = channel.name; logoImg.onerror = function() { this.onerror = null; this.src = placeholderLogo(channel.name); }; if (!safeGet('tclv.logo.' + channel.id) && !sanitizeLogoUrl(channel.logo)) resolveTvLogo(channel, logoImg); node.querySelector('h3').textContent = channel.name; node.querySelector('p').textContent = program?.title || t('noProgram'); node.querySelector('.progress-track span').style.width = `${progress(program, now)}%`; node.querySelector('.logo-action').title = t('logoTitle'); node.querySelector('.logo-action').addEventListener('click', (event) => { event.stopPropagation(); state.selectedLogoChannelId = channel.id; dom.logoFile.click(); }); var favBtn = node.querySelector('.fav-action'); if (favBtn) { favBtn.classList.toggle('active', isFavorite(channel.id)); favBtn.textContent = isFavorite(channel.id) ? '★' : '☆'; favBtn.title = isFavorite(channel.id) ? t('groupFavorites') : t('groupFavorites'); favBtn.addEventListener('click', function(event) { event.stopPropagation(); toggleFavorite(channel.id); }); } var dot = node.querySelector('.status-dot'); if (dot) { var s = state.streamStatus[channel.id]; dot.className = 'status-dot' + (s ? ' ' + s : ''); } if (channel.catchupDays > 0) { var catchupBtn = document.createElement('button'); catchupBtn.className = 'catchup-badge'; catchupBtn.title = t('catchupAvailable'); catchupBtn.textContent = '📅'; catchupBtn.addEventListener('click', function(ev) { ev.stopPropagation(); openCatchup(channel); }); node.querySelector('.channel-text').append(catchupBtn); } node.addEventListener('click', () => selectChannel(channel.id)); node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectChannel(channel.id); } }); dom.channelGrid.append(node); });
}
function toggleSidebar() {
  state.sidebarVisible = !state.sidebarVisible;
  safeSet('tclv.sidebarVisible', state.sidebarVisible);
  var workspace = document.querySelector('.workspace');
  workspace.classList.toggle('sidebar-hidden', !state.sidebarVisible);
  var btn = dom.sidebarToggle;
  if (btn) btn.innerHTML = state.sidebarVisible ? '&#x2039;' : '&#x203a;';
}
function toggleEpg() {
  state.epgVisible = !state.epgVisible;
  var workspace = document.querySelector('.workspace');
  workspace.classList.toggle('epg-active', state.epgVisible);
  if (dom.epgToggle) {
    dom.epgToggle.classList.toggle('active', state.epgVisible);
    dom.epgToggle.setAttribute('aria-pressed', String(state.epgVisible));
  }
  var panel = dom.guidePanel;
  if (panel) panel.hidden = !state.epgVisible;
  if (state.epgVisible) renderGuide();
}
function renderGuide() {
  var baseHours = 8 * state.epgZoom;
  var offsetMs = state.epgOffsetHours * 60 * 60 * 1000;
  const start = floorToHalfHour(new Date(Date.now() - 2 * 60 * 60 * 1000 + offsetMs)); const end = new Date(start.getTime() + baseHours * 60 * 60 * 1000); const duration = end - start; const epgQuery = dom.epgSearch?.value.trim().toLowerCase() || ''; const channels = state.channels.filter((ch) => { if (!epgQuery) return true; const programs = findPrograms(ch).filter((p) => p.stop > start && p.start < end); return ch.name.toLowerCase().includes(epgQuery) || programs.some((p) => p.title.toLowerCase().includes(epgQuery)); }); dom.guideRange.textContent = `${formatTime(start)} - ${formatTime(end)}`;
  if (!channels.length) { dom.epgGuide.innerHTML = `<div class="empty-state">${t('noChannels')}</div>`; return; }
  var baseWidth = Math.round(1280 / state.epgZoom); const width = baseWidth; const timeline = document.createElement('div'); timeline.className = 'timeline'; timeline.style.width = `${width + 170}px`;
  const header = document.createElement('div'); header.className = 'timeline-header'; header.innerHTML = `<div class="timeline-corner"></div><div class="time-slots"></div>`; header.querySelector('.time-slots').style.width = `${width}px`;
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 30 * 60 * 1000)) { const slot = document.createElement('div'); slot.className = 'time-slot'; slot.style.left = `${((cursor - start) / duration) * width}px`; slot.style.width = `${width / 16}px`; slot.textContent = formatTime(cursor); header.querySelector('.time-slots').append(slot); }
  timeline.append(header);
  channels.forEach((channel) => { const row = document.createElement('div'); row.className = 'timeline-row'; row.innerHTML = `<div class="timeline-label"><img src="${getChannelLogo(channel)}" alt="" onerror="this.onerror=null;this.src='${placeholderLogo(channel.name).replace(/'/g, "\\'")}';"><span>${escapeHtml(channel.name)}</span></div><div class="program-track"></div>`; const track = row.querySelector('.program-track'); track.style.width = `${width}px`; const programs = findPrograms(channel).filter((program) => program.stop > start && program.start < end); if (!programs.length) { const empty = document.createElement('div'); empty.className = 'program'; empty.style.left = '8px'; empty.style.width = '160px'; empty.innerHTML = `<strong>${t('noEpg')}</strong>`; track.append(empty); } else { programs.forEach((program) => { const left = Math.max(0, ((program.start - start) / duration) * width); const right = Math.min(width, ((program.stop - start) / duration) * width); const node = document.createElement('div'); node.className = `program${program.start <= new Date() && program.stop > new Date() ? ' current' : ''}`; node.style.left = `${left}px`; node.style.width = `${Math.max(44, right - left - 4)}px`; node.title = `${program.title} ${formatTime(program.start)}-${formatTime(program.stop)}`; node.innerHTML = `<strong>${escapeHtml(program.title)}</strong><span>${formatTime(program.start)} - ${formatTime(program.stop)}</span>`; track.append(node); }); }
    const nowLine = document.createElement('div'); nowLine.className = 'now-line'; nowLine.style.left = `${Math.max(0, Math.min(width, ((Date.now() - start.getTime()) / duration) * width))}px`; track.append(nowLine);
    timeline.append(row);
  });
  dom.epgGuide.replaceChildren(timeline);
}
function renderAll() { translateUi(); renderSourceLists(); renderGroupTabs(); renderChannels(); if (state.epgVisible) renderGuide(); }

function stopVideoJs() { if (state.videoJsPlayer) { state.videoJsPlayer.pause(); try { state.videoJsPlayer.reset(); } catch {} } }
function stopArtPlayer() { if (state.artPlayer) { try { state.artPlayer.destroy(); } catch {} state.artPlayer = null; } dom.artPlayerHost.style.display = 'none'; }
function destroyHls() { if (state.hls) { try { state.hls.destroy(); } catch {} state.hls = null; } if (state.mpegtsPlayer) { try { state.mpegtsPlayer.destroy(); } catch {} state.mpegtsPlayer = null; } }
function stopInternalPlayers() { stopVideoJs(); stopArtPlayer(); destroyHls(); dom.video.pause(); if (dom.qualityControl) dom.qualityControl.hidden = true; }
function showHtmlVideo() { dom.video.style.display = 'block'; dom.artPlayerHost.style.display = 'none'; }
function getStreamType(url) {
  var raw = String(url || '');
  if (/^rtmps?:\/\//i.test(raw)) return 'rtmp';
  if (/^rtsps?:/i.test(raw)) return 'rtsp';
  var clean = raw.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'hls';
  if (clean.endsWith('.ts')) return 'ts';
  if (clean.endsWith('.mp4') || clean.endsWith('.mpv')) return 'mp4';
  if (clean.endsWith('.webm')) return 'webm';
  var hasExt = /\.[a-z0-9]{2,5}$/i.test(clean.split('/').pop() || '');
  if (!hasExt) return 'ts';
  return 'hls';
}
function guessMimeType(url) { var t = getStreamType(url); if (t === 'hls') return 'application/x-mpegURL'; if (t === 'mp4') return 'video/mp4'; if (t === 'webm') return 'video/webm'; return 'application/x-mpegURL'; }
async function ensureScript(id, sources) { if (document.querySelector(`script[data-loader-id="${id}"]`)) return; for (const source of sources) { try { await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = source; script.dataset.loaderId = id; script.onload = resolve; script.onerror = reject; document.head.append(script); }); return; } catch {} } throw new Error('Asset could not be loaded.'); }
async function ensureStyle(id, sources) { if (document.querySelector(`link[data-loader-id="${id}"]`)) return; for (const source of sources) { try { await new Promise((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = source; link.dataset.loaderId = id; link.onload = resolve; link.onerror = reject; document.head.append(link); }); return; } catch {} } throw new Error('Asset could not be loaded.'); }
async function ensureVideoJs() { if (window.videojs) return; await ensureStyle('videojs-css', ['./vendor/video.js/video-js.min.css','https://vjs.zencdn.net/8.21.1/video-js.min.css']); await ensureScript('videojs-js', ['./vendor/video.js/video.min.js','https://vjs.zencdn.net/8.21.1/video.min.js']); }
async function ensureArtPlayer() { if (window.Artplayer) return; await ensureScript('artplayer-js', ['./vendor/artplayer/artplayer.js','https://cdn.jsdelivr.net/npm/artplayer@5/dist/artplayer.js']); }
async function ensureHls() { if (window.Hls) return; await ensureScript('hls-js', ['./vendor/hls.js/hls.min.js', 'https://cdn.jsdelivr.net/npm/hls.js@latest']); }
async function ensureMpegts() { if (window.mpegts) return; await ensureScript('mpegts-js', ['./vendor/mpegts.js/mpegts.min.js', 'https://cdn.jsdelivr.net/npm/mpegts.js@latest/dist/mpegts.min.js']); }
function showMessage(message) { dom.playerMessage.textContent = message; dom.playerMessage.style.display = 'block'; }
function hideMessage() { dom.playerMessage.style.display = 'none'; dom.playerMessage.textContent = ''; }
function streamUrl(url) {
  if (needsProxy(url)) return proxyUrl(url);
  return url;
}
function hlsConfig(url) {
  if (isNativePlatform()) return {};
  var cfg = {
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 30,
    maxBufferLength: 30,
    maxMaxBufferLength: 120,
    maxBufferHole: 0.5,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    manifestLoadingTimeOut: 15000,
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 1000,
    levelLoadingTimeOut: 15000,
    levelLoadingMaxRetry: 4,
  };
  if (needsProxy(url)) {
    cfg.xhrSetup = function(xhr, u) {
      xhr.open('GET', proxyUrl(u), true);
      Object.defineProperty(xhr, 'responseURL', { get: function() { return u; } });
    };
  }
  return cfg;
}
function tryHlsPlayback(url) {
  destroyHls();
  var hls = new window.Hls(hlsConfig(url));
  var reconnectTimer = null;
  var reconnects = 0;
  state.hls = hls;
  hls.on(window.Hls.Events.ERROR, function(_e, data) {
    if (!data.fatal) return;
    if (state.hls !== hls) return;
    if (data.type === 'networkError' && reconnects < 3) {
      reconnects++;
      showMessage(t('reconnecting'));
      reconnectTimer = setTimeout(function() {
        if (state.hls === hls) { try { hls.startLoad(); } catch {} }
      }, 2000 * reconnects);
      return;
    }
    clearTimeout(reconnectTimer);
    destroyHls();
    setStreamStatus(state.selectedChannelId, 'error');
    showMessage(data.type === 'networkError' ? t('streamUnavailable') : t('html5Notice'));
  });
  hls.loadSource(url);
  hls.attachMedia(dom.video);
  hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
    reconnects = 0;
    safeAutoplay(dom.video);
    buildQualityMenu();
  });
}
function tryMpegtsPlayback(url) {
  destroyHls();
  if (!window.mpegts?.isSupported()) { showMessage(t('html5Notice')); return; }
  state.mpegtsPlayer = window.mpegts.createPlayer({ type: 'mpegts', isLive: true, url: streamUrl(url) });
  state.mpegtsPlayer.attachMediaElement(dom.video);
  state.mpegtsPlayer.load();
  safeAutoplay(dom.video);
}
function buildQualityMenu() {
  if (!dom.qualityControl || !dom.qualitySelect) return;
  if (!state.hls || !window.Hls) { dom.qualityControl.hidden = true; return; }
  var levels = state.hls.levels;
  if (!levels || !levels.length) { dom.qualityControl.hidden = true; return; }
  dom.qualitySelect.innerHTML = '';
  function addOpt(val, lbl) { var o = document.createElement('option'); o.value = val; o.textContent = lbl; dom.qualitySelect.appendChild(o); }
  addOpt('-1', t('qualityNative'));
  if (levels.length > 1) {
    var hasH = levels.some(function(l) { return l.height > 0; });
    if (hasH) {
      var used = new Set();
      [['qualityLow', 360], ['qualityMedium', 720], ['qualityHigh', 1080]].forEach(function(pair) {
        var best = -1, bestD = Infinity;
        levels.forEach(function(lv, i) { var d = Math.abs((lv.height || 0) - pair[1]); if (d < bestD) { bestD = d; best = i; } });
        if (best >= 0 && !used.has(best)) { used.add(best); addOpt(best, t(pair[0])); }
      });
    } else {
      addOpt(0, t('qualityLow'));
      if (levels.length > 2) addOpt(Math.floor(levels.length / 2), t('qualityMedium'));
      addOpt(levels.length - 1, t('qualityHigh'));
    }
  }
  dom.qualitySelect.value = '-1';
  dom.qualityControl.hidden = false;
}
function safeAutoplay(videoEl) {
  videoEl.muted = true;
  var p = videoEl.play();
  if (p && p.then) p.then(function() {
    setTimeout(function() { videoEl.muted = false; }, 200);
  }).catch(function() {
    showMessage(t('clickToPlay'));
    function onGesture() { videoEl.play().catch(function() {}); document.removeEventListener('click', onGesture); document.removeEventListener('touchstart', onGesture); }
    document.addEventListener('click', onGesture, { once: true });
    document.addEventListener('touchstart', onGesture, { once: true });
  });
}
async function playExternalAndroid(channel) {
  if (!window.Capacitor?.Plugins?.TCLVPlayer) { showMessage(t('optionalMissing')); return; }
  try {
    await window.Capacitor.Plugins.TCLVPlayer.openExternalPlayer({ player: state.player, url: channel.url });
  } catch (e) { showMessage(e.message || t('streamUnavailable')); }
}
function playExternalDesktop(channel) {
  if (!window.TCLVNative?.openExternal) { showMessage(t('optionalMissing')); return; }
  try {
    window.TCLVNative.openExternal(state.player, channel.url);
  } catch (e) { showMessage(e.message || t('streamUnavailable')); }
}
async function playHtml5(channel) {
  stopInternalPlayers(); showHtmlVideo(); dom.video.removeAttribute('src'); dom.video.load();
  var type = getStreamType(channel.url);
  if (type === 'rtmp' || type === 'rtsp') { showMessage(t('rtmpUnsupported')); return; }
  try {
    if (type === 'ts') {
      await ensureMpegts();
      if (window.mpegts?.isSupported()) { tryMpegtsPlayback(channel.url); return; }
    }
    if (type === 'hls') {
      if (dom.video.canPlayType('application/vnd.apple.mpegurl') && !needsProxy(channel.url)) {
        dom.video.src = channel.url; safeAutoplay(dom.video); return;
      }
      await ensureHls();
      if (window.Hls?.isSupported()) { tryHlsPlayback(channel.url); return; }
    }
    dom.video.src = streamUrl(channel.url);
    dom.video.addEventListener('canplay', function() { safeAutoplay(dom.video); }, { once: true });
    dom.video.addEventListener('error', function() { showMessage(t('streamUnavailable')); }, { once: true });
  } catch { showMessage(t('html5Notice')); }
}
async function playVideoJs(channel) {
  var type = getStreamType(channel.url);
  if (type === 'rtmp' || type === 'rtsp') { showMessage(t('rtmpUnsupported')); return; }
  try {
    stopArtPlayer(); showHtmlVideo(); await ensureVideoJs();
    if (type === 'hls' && !dom.video.canPlayType('application/vnd.apple.mpegurl')) await ensureHls();
    state.videoJsPlayer = state.videoJsPlayer || window.videojs(dom.video, { autoplay: true, controls: true, liveui: true, fluid: false });
    if (type === 'hls' && window.Hls?.isSupported() && !dom.video.canPlayType('application/vnd.apple.mpegurl')) {
      destroyHls();
      var hls = new window.Hls(hlsConfig(channel.url));
      state.hls = hls;
      hls.on(window.Hls.Events.ERROR, function(_e, data) { if (data.fatal) { if (state.hls === hls) destroyHls(); setStreamStatus(channel.id, 'error'); showMessage(t('streamUnavailable')); } });
      hls.loadSource(channel.url);
      hls.attachMedia(state.videoJsPlayer.tech({ IWillNotUseThisInPlugins: true }).el());
      hls.on(window.Hls.Events.MANIFEST_PARSED, function() { state.videoJsPlayer.play()?.catch?.(function() {}); buildQualityMenu(); });
    } else {
      state.videoJsPlayer.src({ src: streamUrl(channel.url), type: guessMimeType(channel.url) });
      state.videoJsPlayer.play()?.catch?.(() => showMessage(t('html5Notice')));
    }
  } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); }
}
async function playArtPlayer(channel) {
  var type = getStreamType(channel.url);
  if (type === 'rtmp' || type === 'rtsp') { showMessage(t('rtmpUnsupported')); return; }
  try {
    stopVideoJs(); await ensureArtPlayer();
    if (type === 'hls') await ensureHls();
    dom.video.pause(); dom.video.removeAttribute('src'); dom.video.load();
    dom.video.style.display = 'none'; dom.artPlayerHost.style.display = 'block';
    var customType = (type === 'hls' && window.Hls?.isSupported()) ? {
      m3u8: function(videoEl) {
        destroyHls();
        var hls = new window.Hls(hlsConfig(channel.url));
        state.hls = hls;
        hls.on(window.Hls.Events.ERROR, function(_e, data) { if (data.fatal) { if (state.hls === hls) destroyHls(); setStreamStatus(channel.id, 'error'); showMessage(t('streamUnavailable')); } });
        hls.loadSource(channel.url);
        hls.attachMedia(videoEl);
        hls.on(window.Hls.Events.MANIFEST_PARSED, function() { buildQualityMenu(); });
      }
    } : undefined;
    if (state.artPlayer) { try { state.artPlayer.destroy(); } catch {} state.artPlayer = null; }
    state.artPlayer = new window.Artplayer({ container: dom.artPlayerHost, url: streamUrl(channel.url), type: type === 'hls' ? 'm3u8' : '', customType: customType, autoplay: true, isLive: true, muted: true, setting: true, fullscreen: true, fullscreenWeb: true });
  } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); }
}
function setPlayerActive(active) {
  var stage = document.querySelector('.player-stage');
  if (stage) stage.classList.toggle('no-video', !active);
}
function playChannel(channel) {
  hideMessage(); safeSet('tclv.lastChannel', channel.id); setPlayerActive(true);
  delete state.streamStatus[channel.id]; updateChannelStatusDot(channel.id);
  var expectedId = channel.id;
  dom.video.addEventListener('playing', function() { if (state.selectedChannelId === expectedId) setStreamStatus(expectedId, 'ok'); }, { once: true });
  dom.video.addEventListener('error', function() { if (state.selectedChannelId === expectedId) setStreamStatus(expectedId, 'error'); }, { once: true });
  if (state.player === 'mpv' || state.player === 'vlc') {
    if (getPlatform() === 'android') return playExternalAndroid(channel);
    if (getPlatform() === 'electron') return playExternalDesktop(channel);
    state.player = 'html5'; safeSet('tclv.player', 'html5'); dom.playerSelect.value = 'html5';
  }
  if (state.player === 'videojs') return playVideoJs(channel);
  if (state.player === 'artplayer') return playArtPlayer(channel);
  return playHtml5(channel);
}
function showSwitchOverlay(channel) { const now = currentProgram(channel); const next = nextProgram(channel); dom.switchOverlay.innerHTML = `<img src="${getChannelLogo(channel)}" alt="" onerror="this.onerror=null;this.src='${placeholderLogo(channel.name).replace(/'/g, "\\'")}';"><div><h2>${escapeHtml(channel.name)}</h2><p><strong>${t('now')}:</strong> ${escapeHtml(now?.title || t('noProgram'))}</p><p><strong>${t('next')}:</strong> ${escapeHtml(next?.title || t('noProgram'))}</p></div>`; dom.switchOverlay.classList.add('show'); clearTimeout(state.overlayTimer); state.overlayTimer = setTimeout(() => dom.switchOverlay.classList.remove('show'), 5200); }
function selectChannel(id) { const channel = state.channels.find((item) => item.id === id); if (!channel) return; if (state.multiview && state.mvSlot === 1) { state.mvChannel1 = channel; playInSlot1(channel); renderChannels(); return; } state.selectedChannelId = id; playChannel(channel); showSwitchOverlay(channel); renderChannels(); requestAnimationFrame(() => { const active = dom.channelGrid.querySelector('.channel-card.active'); active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); }
function isNativePlatform() { return !!(window.TCLVNative || window.Capacitor); }
function getPlatform() {
  if (window.TCLVNative) return 'electron';
  if (window.Capacitor) return 'android';
  if (location.protocol === 'https:') return 'web-https';
  return 'web-http';
}
function needsProxy(url) {
  var platform = getPlatform();
  if (platform === 'electron' || platform === 'android' || platform === 'web-http') return false;
  return state.corsProxy && isMixedContent(url);
}
function isMixedContent(url) { return location.protocol === 'https:' && String(url || '').startsWith('http://'); }
function proxyUrl(url) { if (isNativePlatform() || !state.corsProxy) return url; return state.corsProxy + encodeURIComponent(url); }
async function loadTextFromUrl(url) {
  function decode(r, u) { if (u.endsWith('.gz') && typeof DecompressionStream !== 'undefined') return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text(); return r.text(); }
  if (isNativePlatform() || (!state.corsProxy && !isMixedContent(url))) {
    var response; try { response = await fetch(url); } catch (err) { if (!isNativePlatform()) throw new Error(t('corsNeeded'), { cause: err }); throw err; }
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    return decode(response, url);
  }
  if (!state.corsProxy) throw new Error(t('corsNeeded'));
  var encodedUrl = state.corsProxy + encodeURIComponent(url);
  var resp;
  try { resp = await fetch(encodedUrl); } catch { resp = null; }
  if (resp && resp.ok) return decode(resp, url);
  var rawUrl = state.corsProxy + url;
  var resp2;
  try { resp2 = await fetch(rawUrl); } catch { resp2 = null; }
  if (resp2 && resp2.ok) return decode(resp2, url);
  var status = resp?.status || resp2?.status || 0;
  if (status === 403) throw new Error('Proxy 403 — ' + t('proxyBlocked'));
  throw new Error((status || 'Network error') + ' — ' + (url.split('/').pop() || url));
}
async function loadPlaylistText(text, sourceName = '') { try { const isXspf = sourceName.toLowerCase().endsWith('.xspf') || text.includes('<playlist'); const channels = isXspf ? parseXspf(text) : parseM3U(text); state.channels = channels; state.selectedChannelId = safeGet('tclv.lastChannel') || channels[0]?.id || null; renderAll(); if (state.selectedChannelId) showSwitchOverlay(selectedChannel()); showMessage(`${t('playlistLoaded')}: ${channels.length}`); if (!state.epgSources.length) autoLoadEpgFromPlaylist(text); } catch (error) { showMessage(`${t('loadError')} ${error.message || ''}`); } }
async function loadEpgText(text) { try { state.epg = parseXmlTv(text); renderAll(); showMessage(`${t('epgLoaded')}: ${state.epg.size}`); } catch (error) { showMessage(`${t('loadError')} ${error.message || ''}`); } }
function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsText(file); }); }
function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function xmlTvDate(date) { const pad = (value) => String(value).padStart(2, '0'); const offsetMinutes = -date.getTimezoneOffset(); const sign = offsetMinutes >= 0 ? '+' : '-'; const absolute = Math.abs(offsetMinutes); const offset = `${sign}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`; return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())} ${offset}`; }
function estimateStorageSize(obj) { try { return JSON.stringify(obj).length; } catch { return 0; } }
function savePlaylistMeta() {
  var meta = state.playlists.map(function(p) {
    var entry = { id: p.id, name: p.name, source: p.source, type: p.type, origin: p.origin };
    if (p.origin === 'local') entry.text = p.text;
    return entry;
  });
  var size = estimateStorageSize(meta);
  if (size > 4 * 1024 * 1024) {
    meta = state.playlists.map(function(p) { return { id: p.id, name: p.name, source: p.source, type: p.type, origin: p.origin }; });
  }
  safeSetJson('tclv.playlists', meta);
}
function addPlaylistRecord(record) { state.playlists.unshift(record); savePlaylistMeta(); state.activePlaylistId = record.id; safeSet('tclv.activePlaylistId', record.id); renderSourceLists(); }
async function activatePlaylist(id) {
  var item = state.playlists.find(function(p) { return p.id === id; });
  if (!item) return;
  state.activePlaylistId = id; safeSet('tclv.activePlaylistId', id);
  if (!item.text && item.source && item.origin === 'network') {
    try { item.text = await loadTextFromUrl(item.source); } catch {}
  }
  if (item.text) loadPlaylistText(item.text, item.name);
  renderSourceLists();
}
function removePlaylist(id) { state.playlists = state.playlists.filter((p) => p.id !== id); savePlaylistMeta(); if (state.activePlaylistId === id) { state.activePlaylistId = state.playlists[0]?.id || null; safeSet('tclv.activePlaylistId', state.activePlaylistId || ''); if (state.playlists[0]) loadPlaylistText(state.playlists[0].text, state.playlists[0].name); else { state.channels = []; state.selectedChannelId = null; renderAll(); } } renderSourceLists(); }
function saveEpgMeta() {
  var meta = state.epgSources.map(function(s) { return { id: s.id, name: s.name, source: s.source, origin: s.origin, active: s.active }; });
  safeSetJson('tclv.epgSources', meta);
}
function removeEpgSource(id) { state.epgSources = state.epgSources.filter((e) => e.id !== id); saveEpgMeta(); rebuildMergedEpg(); }
function toggleEpgSource(id) { const item = state.epgSources.find(function(e) { return e.id === id; }); if (!item) return; item.active = item.active === false ? true : false; saveEpgMeta(); rebuildMergedEpg(); }
function addEpgRecord(record) { if (record.active === undefined) record.active = true; state.epgSources.unshift(record); saveEpgMeta(); renderSourceLists(); rebuildMergedEpg(); }
function rebuildMergedEpg() { const maps = []; for (const source of state.epgSources) { if (source.active === false) continue; try { maps.push(parseXmlTv(source.text)); } catch {} } state.epg = mergeEpgMaps(maps); renderAll(); showMessage(`${t('epgLoaded')}: ${state.epg.size}`); }
function epgMatchesChannels(epgText) {
  try {
    var map = parseXmlTv(epgText);
    if (!map.size) return 0;
    var hits = 0;
    for (var i = 0; i < state.channels.length; i++) {
      var ch = state.channels[i];
      var keys = [ch.tvgId, ch.id, ch.name].filter(Boolean);
      for (var j = 0; j < keys.length; j++) { if (map.has(keys[j])) { hits++; break; } }
      if (hits === 0) {
        var wanted = normalizeId(ch.name);
        for (var k of map.keys()) { if (normalizeId(k) === wanted) { hits++; break; } }
      }
    }
    return hits;
  } catch { return 0; }
}
async function fetchEpgWithFallback(url) {
  try { return await loadTextFromUrl(url); } catch {
    if (url.endsWith('.xml.gz')) { try { return await loadTextFromUrl(url.replace(/\.gz$/, '')); } catch {} }
    return null;
  }
}
async function autoLoadEpgFromPlaylist(text) {
  var urls = extractM3UEpgUrls(text);
  if (!urls.length) return;
  var countries = new Set();
  for (var c = 0; c < state.channels.length; c++) {
    var m = state.channels[c].tvgId?.match(/\.([a-z]{2})$/i);
    if (m) countries.add(m[1].toUpperCase());
  }
  var prioritized = urls;
  if (countries.size) {
    var matched = urls.filter(function(url) {
      var fn = (url.split('/').pop() || '').toUpperCase();
      return [...countries].some(function(c) { return fn.includes('_' + c) || fn.includes(c + '.'); });
    });
    if (matched.length) prioritized = matched.concat(urls.filter(function(u) { return matched.indexOf(u) === -1; }));
  }
  var loaded = 0;
  var maxAttempts = Math.min(prioritized.length, 12);
  for (var i = 0; i < maxAttempts && loaded < 3; i++) {
    var url = prioritized[i];
    if (state.epgSources.some(function(s) { return s.source === url; })) continue;
    var epgText = await fetchEpgWithFallback(url);
    if (!epgText) continue;
    var hits = epgMatchesChannels(epgText);
    if (hits === 0) continue;
    addEpgRecord({ id: 'epg-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: url.split('/').pop() || 'epg.xml', source: url, origin: 'network', active: true, text: epgText });
    loaded++;
  }
  if (loaded > 0) showMessage(t('epgAutoDetected'));
}
function openSettings() { dom.settingsPanel.hidden = false; dom.settingsOverlay.hidden = false; dom.menuToggle?.setAttribute('aria-expanded', 'true'); }
function closeSettings() { dom.settingsPanel.hidden = true; dom.settingsOverlay.hidden = true; dom.menuToggle?.setAttribute('aria-expanded', 'false'); }
function bindEvents() {
  dom.epgToggle?.addEventListener('click', toggleEpg);
  dom.sidebarToggle?.addEventListener('click', toggleSidebar);
  dom.qualitySelect?.addEventListener('change', function() { if (!state.hls) return; var v = parseInt(this.value, 10); state.hls.currentLevel = isNaN(v) ? -1 : v; });
  dom.epgBack?.addEventListener('click', function() { state.epgOffsetHours -= 3; renderGuide(); });
  dom.epgFwd?.addEventListener('click', function() { state.epgOffsetHours += 3; renderGuide(); });
  dom.epgZoomIn?.addEventListener('click', function() { if (state.epgZoom > 0.5) { state.epgZoom = Math.max(0.5, state.epgZoom / 1.5); renderGuide(); } });
  dom.epgZoomOut?.addEventListener('click', function() { if (state.epgZoom < 4) { state.epgZoom = Math.min(4, state.epgZoom * 1.5); renderGuide(); } });
  dom.menuToggle?.addEventListener('click', ()=> dom.settingsPanel.hidden ? openSettings() : closeSettings());
  dom.settingsClose?.addEventListener('click', closeSettings); dom.settingsOverlay?.addEventListener('click', closeSettings);
  dom.playlistFile.addEventListener('change', async () => { const file = dom.playlistFile.files?.[0]; if (!file) return; try { const text = await readFile(file); const record = { id: `pl-${Date.now()}`, name: file.name, source: file.name, type: file.name.toLowerCase().endsWith('.xspf') ? 'xspf' : 'm3u', origin: 'local', text }; addPlaylistRecord(record); await loadPlaylistText(text, file.name); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.epgFile.addEventListener('change', async () => { const file = dom.epgFile.files?.[0]; if (!file) return; try { const text = await readFile(file); addEpgRecord({ id: `epg-${Date.now()}`, name: file.name, source: file.name, origin: 'local', text }); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.addPlaylistUrl?.addEventListener('click', async () => { try { const url = dom.playlistUrl.value.trim(); if (!url) return; const text = await loadTextFromUrl(url); const record = { id: `pl-${Date.now()}`, name: url.split('/').pop() || 'playlist', source: url, type: url.toLowerCase().includes('.xspf') ? 'xspf' : 'm3u', origin: 'network', text }; addPlaylistRecord(record); await loadPlaylistText(text, url); dom.playlistUrl.value = ''; } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.addEpgUrl?.addEventListener('click', async () => { try { const url = dom.epgUrl.value.trim(); if (!url) return; const text = await loadTextFromUrl(url); addEpgRecord({ id: `epg-${Date.now()}`, name: url.split('/').pop() || 'epg.xml', source: url, origin: 'network', text }); dom.epgUrl.value = ''; } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.corsProxyInput?.addEventListener('change', async () => {
    state.corsProxy = dom.corsProxyInput.value.trim(); safeSet('tclv.corsProxy', state.corsProxy);
    if (!state.corsProxy) return;
    var needsReload = !state.epg.size || state.epgSources.some(function(s) { return s.origin === 'network' && !s.text; });
    if (needsReload && state.activePlaylistId) {
      showMessage(t('proxyChanged'));
      var pl = state.playlists.find(function(p) { return p.id === state.activePlaylistId; });
      if (pl) await autoLoadEpgFromPlaylist(pl.text);
    }
    var channel = selectedChannel();
    if (channel) playChannel(channel);
  });
  dom.epgSearch?.addEventListener('input', renderGuide);
  dom.channelSearch?.addEventListener('input', function() { state.searchQuery = this.value.trim(); renderChannels(); });
  dom.channelSearch?.addEventListener('search', function() { state.searchQuery = this.value.trim(); renderChannels(); });
  dom.addXtream?.addEventListener('click', addXtreamSource);
  dom.pipButton?.addEventListener('click', togglePip);
  document.addEventListener('enterpictureinpicture', function() { dom.pipButton?.classList.add('active'); });
  document.addEventListener('leavepictureinpicture', function() { dom.pipButton?.classList.remove('active'); });
  dom.mvToggle?.addEventListener('click', toggleMultiview);
  dom.mvSlot0?.addEventListener('click', function() { if (state.multiview && state.mvSlot !== 0) setMvFocus(0); });
  dom.mvSlot1?.addEventListener('click', function() { if (state.multiview && state.mvSlot !== 1) setMvFocus(1); });
  dom.exportSettings?.addEventListener('click', exportSettings);
  dom.importFile?.addEventListener('change', function() { var file = dom.importFile.files?.[0]; if (file) { importSettingsFromFile(file); dom.importFile.value = ''; } });
  dom.channelGrid.addEventListener('keydown', (event) => {
    const cards = [...dom.channelGrid.querySelectorAll('.channel-card')];
    const focused = document.activeElement;
    const index = cards.indexOf(focused);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); if (index < 0) { cards[0]?.focus(); return; } const next = event.key === 'ArrowDown' ? index + 1 : index - 1; if (next >= 0 && next < cards.length) cards[next].focus(); }
    if (event.key === 'Home') { event.preventDefault(); cards[0]?.focus(); }
    if (event.key === 'End') { event.preventDefault(); cards[cards.length - 1]?.focus(); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' || event.target.tagName === 'TEXTAREA') return;
    if (event.key === 'Escape') { if (!dom.settingsPanel.hidden) { closeSettings(); event.preventDefault(); return; } if (dom.switchOverlay.classList.contains('show')) { dom.switchOverlay.classList.remove('show'); clearTimeout(state.overlayTimer); event.preventDefault(); return; } }
    if (event.key === 'ArrowRight' && document.activeElement?.closest('.sidebar')) { event.preventDefault(); dom.epgSearch?.focus(); }
    if (event.key === 'ArrowLeft' && !document.activeElement?.closest('.sidebar')) { event.preventDefault(); const active = dom.channelGrid.querySelector('.channel-card.active') || dom.channelGrid.querySelector('.channel-card'); active?.focus(); }
    const channels = filteredChannels();
    if ((event.key === 'PageUp' || event.key === 'ChannelUp') && channels.length) { event.preventDefault(); const idx = channels.findIndex((ch) => ch.id === state.selectedChannelId); const prev = idx > 0 ? idx - 1 : channels.length - 1; selectChannel(channels[prev].id); const card = dom.channelGrid.querySelector(`[data-id="${channels[prev].id}"]`); card?.focus(); card?.scrollIntoView({ block: 'nearest' }); }
    if ((event.key === 'PageDown' || event.key === 'ChannelDown') && channels.length) { event.preventDefault(); const idx = channels.findIndex((ch) => ch.id === state.selectedChannelId); const next = idx < channels.length - 1 ? idx + 1 : 0; selectChannel(channels[next].id); const card = dom.channelGrid.querySelector(`[data-id="${channels[next].id}"]`); card?.focus(); card?.scrollIntoView({ block: 'nearest' }); }
  });
  dom.playerSelect.addEventListener('change', () => { state.player = dom.playerSelect.value; safeSet('tclv.player', state.player); const channel = selectedChannel(); if (channel) playChannel(channel); });
  dom.languageSelect.addEventListener('change', () => { state.language = dom.languageSelect.value; safeSet('tclv.language', state.language); renderAll(); });
  dom.logoFile.addEventListener('change', async () => { const file = dom.logoFile.files?.[0]; if (!file || !state.selectedLogoChannelId) return; const dataUrl = await readFileAsDataUrl(file); safeSet(`tclv.logo.${state.selectedLogoChannelId}`, dataUrl); dom.logoFile.value = ''; renderAll(); });
}
async function reloadEpgSources() {
  var sources = state.epgSources.filter(function(s) { return s.active !== false && s.source && !s.text; });
  for (var i = 0; i < sources.length; i++) {
    try {
      var text = await loadTextFromUrl(sources[i].source);
      if (text) sources[i].text = text;
    } catch {}
  }
  if (sources.some(function(s) { return s.text; })) rebuildMergedEpg();
}
function init() { initTvLogoCache(); bindEvents(); state.player = dom.playerSelect.value = state.player; state.language = translations[state.language] ? state.language : 'sk'; state.corsProxy = detectCorsProxy(); if (dom.corsProxyInput) dom.corsProxyInput.value = state.corsProxy; var platform = getPlatform(); if (platform === 'electron' || platform === 'android') { var netSection = dom.corsProxyInput?.closest('.settings-section'); if (netSection) netSection.style.display = 'none'; } else if (platform === 'web-http') { var corsHintEl = dom.corsProxyInput?.closest('.settings-section')?.querySelector('.settings-hint'); if (corsHintEl) corsHintEl.textContent = 'HTTP — priame prehrávanie bez proxy.'; } if (!isNativePlatform()) { dom.playerSelect.querySelectorAll('.native-only').forEach(function(opt) { opt.disabled = true; opt.hidden = true; }); } if (document.pictureInPictureEnabled && dom.pipButton) dom.pipButton.removeAttribute('hidden'); setPlayerActive(false); renderSourceLists(); if (state.playlists.length && state.activePlaylistId) activatePlaylist(state.activePlaylistId); else renderAll(); if (state.epgSources.length && !state.epgSources.some(function(s) { return s.text; })) reloadEpgSources(); if (!state.sidebarVisible) { document.querySelector('.workspace')?.classList.add('sidebar-hidden'); if (dom.sidebarToggle) dom.sidebarToggle.innerHTML = '&#x203a;'; } setInterval(() => { if (state.epgVisible) renderGuide(); document.querySelectorAll('.channel-card').forEach((card) => { const ch = state.channels.find((c) => c.id === card.dataset.channelId); if (!ch) return; const prog = currentProgram(ch); const bar = card.querySelector('.progress-track span'); if (bar) bar.style.width = progress(prog) + '%'; const txt = card.querySelector('.channel-text p'); if (txt) txt.textContent = prog?.title || ''; }); }, 60 * 1000); }
init();
