"use strict";
// User sources stay in this device storage; only explicit file exports leave the app.

function sanitizeLogoUrl(url) { return globalThis.TCLVParsers.sanitizeLogoUrl(url); }
function safeGet(key, fallback = null) { try { return localStorage.getItem(key) !== null ? localStorage.getItem(key) : fallback; } catch { return fallback; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }

function safeSetJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function exportableSourceRecord(item) {
  const record = { id: item.id, name: item.name, source: item.source, type: item.type, origin: item.origin, active: item.active };
  if (typeof item.text === 'string') record.text = item.text;
  if (Number.isFinite(item.fetchedAt)) record.fetchedAt = item.fetchedAt;
  return record;
}

const translations = {
  sk: {
    playlistInvalid: "Zdroj neobsahuje platné stanice M3U/XSPF. Skontrolujte, či odkaz vracia playlist, nie prihlasovaciu HTML stránku.",
    epgSourceLoading: "Načítavam…", epgSourceReady: "Načítané", epgSourceUnmatched: "EPG načítané, ale stanice sa nezhodujú s playlistom", epgSourceOutdated: "Zdroj obsahuje iba starý program — skontrolujte zdroj a čas zariadenia", epgSourceFuture: "Zdroj obsahuje iba budúci program — skontrolujte čas zariadenia", epgSourceNoCurrent: "Stanice spárované, ale chýba aktuálny program — skontrolujte zdroj a čas zariadenia", epgSourceEmpty: "XMLTV neobsahuje programy", epgSourceError: "Chyba", epgRefreshNeedsAttention: "EPG načítané; niektoré zdroje nemajú zodpovedajúci aktuálny program. Pozrite podrobnosti pri zdrojoch.",
    includeEpgCache: "Pridať aj stiahnutú EPG cache (veľký súbor)", backupPreparing: "Pripravujem zálohu…", backupSaving: "Pripravujem súbor; potom vyberte miesto uloženia…", backupDone: "Záloha bola uložená.", backupCancelled: "Ukladanie bolo zrušené.", backupFailed: "Zálohu sa nepodarilo uložiť. Pôvodné dáta zostali zachované.",
    reloadEpg: "Obnoviť EPG teraz", epgRefreshing: "Obnovujem EPG…", epgRefreshDone: "EPG obnovené", epgRefreshPartial: "Niektoré zdroje EPG sa nepodarilo obnoviť; ponechané posledné dostupné dáta.", epgNoSources: "Nie sú zapnuté žiadne zdroje EPG.",
    webNetworkHint: "Video ide priamo od poskytovateľa, nikdy cez Vercel. Proxy slúži len pre playlisty a EPG. Pre HTTP/CORS streamy použite lokálny proxy alebo Windows/Android aplikáciu.",
    webStreamHint: "Web neposiela video cez Vercel. Tento stream potrebuje HTTPS/CORS alebo lokálny proxy (npm run proxy). Použite prípadne Windows/Android aplikáciu.",
    sourceTooLarge: "Zdroj prekračuje 3 MiB limit Vercel proxy. Načítajte ho priamo, zo súboru, cez lokálny proxy alebo v natívnej aplikácii.",
    tagline: "Jednoduchy IPTV prehravac", openPlaylist: "Playlist", openEpg: "EPG", load: "Nacitat", loadEpg: "Nacitat EPG", guide: "Program", noChannels: "Nacitajte M3U/M3U8 alebo XSPF playlist v Nastaveniach.", noEpg: "EPG este nie je nacitane.", noProgram: "Program nie je dostupny", now: "Teraz", next: "Nasleduje", html5Notice: "HTML5 video prehravac je aktivny. Niektore HLS streamy (.m3u8) potrebuju nativnu podporu prehliadaca.", optionalMissing: "Tento player nie je pribaleny. Nacitajte jeho kniznicu alebo pouzite HTML5.",  loadError: "Nepodarilo sa nacitat zdroj.", playlistLoaded: "Playlist nacitany", epgLoaded: "EPG nacitane", logoTitle: "Vybrat logo", settingsPlayer: "Prehrávač & Jazyk", labelPlayer: "Prehrávač", labelLanguage: "Jazyk", settingsPlaylists: "Playlisty", addPlaylist: "Pridať URL", settingsEpg: "EPG zdroje", weakTvPlayerHint: "Na starších/pomalších Android TV odporúčame prehrávač \"Natívny\" — používa hardvérové dekódovanie Media3 priamo v aplikácii. Podporuje prehrávanie na pozadí a systémové ovládanie.", addEpg: "Pridať EPG", importEpgList: "Import EPG", exportEpgList: "Export EPG", epgListImported: "EPG zdroje importované", epgListExported: "Zoznam EPG exportovaný", epgListEmpty: "Súbor neobsahuje žiadne platné EPG riadky (Nazov = URL).", epgHint: "Všetky zdroje sa načítajú a zlúčia.", settingsNetwork: "Sieť", labelCorsProxy: "CORS proxy (len web)", corsHint: "Voliteľný vzdialený proxy prijíma URL zdroja. Predvolene sa používajú len priame spojenia a lokálny bridge.", searchEpg: "Hladat v programe", corsNeeded: "CORS chyba — nastavte CORS proxy v Nastaveniach > Sieť.", proxyBlocked: "Proxy blokuje požiadavku. Skúste iný CORS proxy.", streamUnavailable: "Stream nie je dostupný — server odmietol pripojenie alebo je geo-blokovaný.", clickToPlay: "Kliknite na video pre spustenie prehrávania.", local: "lokálny", network: "sieťový", epgAutoDetected: "EPG zdroje automaticky detegované z playlistu", proxyChanged: "CORS proxy uložený. Znovu načítavam EPG…", qualityNative: "Natívna", qualityHigh: "Vysoká (1080p)", qualityMedium: "Stredná (720p)", qualityLow: "Nízka (360p)", labelQuality: "Kvalita videa", searchChannels: "Hľadať kanály", groupAll: "Všetky", groupFavorites: "Obľúbené", settingsXtream: "Xtream Codes API", xtreamHint: "Prihlasovacie údaje od IPTV poskytovateľa.", addXtream: "Načítať", xtreamLoading: "Načítavanie Xtream playlistu…", settingsBackup: "Export / Import", backupHint: "Úplná lokálna záloha vrátane playlistov a prístupových údajov. Súbor uchovajte v súkromí.", exportSettings: "Exportovať", importSettings: "Importovať", settingsImported: "Nastavenia obnovené.", catchupAvailable: "Archív dostupný", catchupTitle: "Archív", catchupUnavailable: "Archív nie je dostupný pre tento kanál.", rtmpUnsupported: "RTMP/RTSP streamy nie sú podporované v prehliadači. Použite natívnu aplikáciu (Android/Electron).", reconnecting: "Opätovné pripájanie…", localProxyFound: "Lokálny proxy nájdený — streamy pôjdu priamo bez Vercel proxy.", localProxyHint: "Tip: Spustite 'npm run proxy' na lokálnom PC — streamy pôjdu priamo cez vašu sieť.", locked: "Obrazovka zamknutá", unlocked: "Obrazovka odomknutá", autostartOn: "Automatický štart zapnutý", autostartOff: "Automatický štart vypnutý", backgroundPlaybackOn: "Prehrávanie na pozadí zapnuté", backgroundPlaybackOff: "Prehrávanie na pozadí vypnuté", holdLockHint: "Podržte zámok 2 sekundy",   },
  en: {
    playlistInvalid: "No valid M3U/XSPF stations. Check that the link returns a playlist rather than an HTML login page.",
    epgSourceLoading: "Loading…", epgSourceReady: "Loaded", epgSourceUnmatched: "EPG loaded, but channels do not match the playlist", epgSourceOutdated: "Only old programmes — check the source and device clock", epgSourceFuture: "Only future programmes — check the device clock", epgSourceNoCurrent: "Channels matched, but no current programme — check the source and device clock", epgSourceEmpty: "XMLTV contains no programmes", epgSourceError: "Error", epgRefreshNeedsAttention: "EPG loaded; some sources have no matching current programmes. See source details.",
    includeEpgCache: "Include downloaded EPG cache (large file)", backupPreparing: "Preparing backup…", backupSaving: "Preparing the file; then choose where to save it…", backupDone: "Backup saved.", backupCancelled: "Save cancelled.", backupFailed: "Could not save the backup. Original data is unchanged.",
    reloadEpg: "Refresh EPG now", epgRefreshing: "Refreshing EPG…", epgRefreshDone: "EPG refreshed", epgRefreshPartial: "Some EPG sources could not be refreshed; keeping the last available data.", epgNoSources: "No EPG sources are enabled.",
    webNetworkHint: "Video comes directly from the provider, never through Vercel. The proxy is only for playlists and EPG. For HTTP/CORS streams use the local proxy or Windows/Android app.",
    webStreamHint: "The web player never sends video through Vercel. This stream needs HTTPS/CORS or the local proxy (npm run proxy). Alternatively use the Windows/Android app.",
    sourceTooLarge: "The source exceeds the 3 MiB Vercel proxy limit. Load it directly, from a file, through the local proxy, or in the native app.",
    tagline: "Simple IPTV player", openPlaylist: "Playlist", openEpg: "EPG", load: "Load", loadEpg: "Load EPG", guide: "Guide", noChannels: "Load an M3U/M3U8 or XSPF playlist in Settings.", noEpg: "EPG is not loaded yet.", noProgram: "Program is not available", now: "Now", next: "Next", html5Notice: "HTML5 video player is active. Some HLS streams (.m3u8) need native browser support.", optionalMissing: "This player is not bundled. Load its library or use HTML5.",  loadError: "Could not load the source.", playlistLoaded: "Playlist loaded", epgLoaded: "EPG loaded", logoTitle: "Choose logo", settingsPlayer: "Player & Language", labelPlayer: "Player", labelLanguage: "Language", settingsPlaylists: "Playlists", addPlaylist: "Add URL", settingsEpg: "EPG sources", weakTvPlayerHint: "On older/slower Android TVs we recommend the \"Native\" player — it uses Media3 hardware decoding inside the app, with background playback and system media controls.", addEpg: "Add EPG", importEpgList: "Import EPG", exportEpgList: "Export EPG", epgListImported: "EPG sources imported", epgListExported: "EPG list exported", epgListEmpty: "The file has no valid EPG lines (Name = URL).", epgHint: "All sources are loaded and merged.", settingsNetwork: "Network", labelCorsProxy: "CORS proxy (web only)", corsHint: "An optional remote proxy receives the source URL. Direct connections and the local bridge are used by default.", searchEpg: "Search programs", corsNeeded: "CORS error — set a CORS proxy in Settings > Network.", proxyBlocked: "Proxy is blocking the request. Try a different CORS proxy.", streamUnavailable: "Stream is unavailable — server refused or geo-blocked.", clickToPlay: "Click the video to start playback.", local: "local", network: "network", epgAutoDetected: "EPG sources auto-detected from playlist", proxyChanged: "CORS proxy saved. Reloading EPG…", qualityNative: "Native", qualityHigh: "High (1080p)", qualityMedium: "Medium (720p)", qualityLow: "Low (360p)", labelQuality: "Video quality", searchChannels: "Search channels", groupAll: "All", groupFavorites: "Favorites", settingsXtream: "Xtream Codes API", xtreamHint: "Enter credentials from your IPTV provider.", addXtream: "Load", xtreamLoading: "Loading Xtream playlist…", settingsBackup: "Export / Import", backupHint: "Full local backup including playlists and access credentials. Keep the file private.", exportSettings: "Export", importSettings: "Import", settingsImported: "Settings restored.", catchupAvailable: "Archive available", catchupTitle: "Archive", catchupUnavailable: "Archive not available for this channel.", rtmpUnsupported: "RTMP/RTSP streams are not supported in the browser. Use the native app (Android/Electron).", reconnecting: "Reconnecting…", localProxyFound: "Local proxy found — streams will bypass Vercel proxy.", localProxyHint: "Tip: Run 'npm run proxy' on your local PC — streams will go directly through your network.", locked: "Screen locked", unlocked: "Screen unlocked", autostartOn: "Autostart enabled", autostartOff: "Autostart disabled", backgroundPlaybackOn: "Background playback enabled", backgroundPlaybackOff: "Background playback disabled", holdLockHint: "Hold lock for 2 seconds",   }
};

function migrateStoredSources(key, fallback) {
  var raw;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (!raw) return fallback;
  try {
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return fallback; arr = arr.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string');
    var cleaned = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].origin === 'xtream') arr[i].origin = 'network';
      if (arr[i].origin === 'local') continue;
      if (arr[i].text && arr[i].text.length > 1000) { delete arr[i].text; cleaned = true; }
    }
    if (cleaned) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch { localStorage.removeItem(key); } }
    return arr;
  } catch { localStorage.removeItem(key); return fallback; }
}

var LOCAL_PROXY_PORTS = [3939, 3940, 3941];
function detectCorsProxySync() {
  var platform = getPlatform();
  if (platform === 'electron' || platform === 'android' || platform === 'web-http') return '';
  if (platform === 'web-https') return safeGet("tclv.corsProxy", '');
  return safeGet("tclv.corsProxy", "");
}
async function detectLocalProxy() {
  if (getPlatform() !== 'web-https' || safeGet('tclv.corsProxy', null) === '') return;
  var configured = state.corsProxy;
  if (configured && !usingVercelProxy() && !canProxyStreams()) return;
  var results = await Promise.all(LOCAL_PROXY_PORTS.map(async function(port) {
    var base = 'http://127.0.0.1:' + port;
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 750);
    try {
      var resp = await fetch(base + '/ping', { signal: ctrl.signal });
      return resp.ok ? base + '/proxy?url=' : '';
    } catch { return ''; }
    finally { clearTimeout(timer); }
  }));
  if (state.corsProxy !== configured) return;
  var localProxy = results.find(Boolean) || '';
  safeSet('tclv.localProxy', localProxy);
  if (!localProxy) return;
  state.corsProxy = localProxy;
  if (dom.corsProxyInput) dom.corsProxyInput.value = localProxy;
  showMessage(t('localProxyFound'));
}

function platformPlayerKey(platform) {
  return 'tclv.player.' + (platform || getPlatform());
}
function fallbackPlayer(platform) {
  if (platform === 'android') return 'native';
  if (platform === 'electron') return 'html5';
  return 'html5';
}
function saveCurrentPlayer() {
  safeSet(platformPlayerKey(), state.player);
}
function platformPlayersSnapshot() {
  return {
    web: safeGet('tclv.player.web-https', safeGet('tclv.player.web-http', 'html5')),
    webHttp: safeGet('tclv.player.web-http', ''),
    webHttps: safeGet('tclv.player.web-https', ''),
    windows: safeGet('tclv.player.electron', 'html5'),
    android: safeGet('tclv.player.android', 'html5')
  };
}
function safeGetJsonArray(key) { try { const value = JSON.parse(safeGet(key, '[]')); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; } catch { return []; } }
function safeGetJsonObject(key) {
  try {
    var value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function defaultPlayer() {
  var platform = getPlatform();
  var saved = safeGet(platformPlayerKey(platform), "");
  if (platform === 'android' && safeGet('tclv.media3Migrated') !== 'true') { if (!saved || ['native', 'html5'].includes(saved)) { saved = 'native'; safeSet(platformPlayerKey(platform), saved); } safeSet('tclv.media3Migrated', 'true'); }
  if (saved) return saved;
  var legacy = safeGet("tclv.player", "");
  if (legacy) { safeSet(platformPlayerKey(platform), legacy); return legacy; }
  return fallbackPlayer(platform);
}
function defaultSidebarMode() {
  var mode = safeGet('tclv.sidebarMode', '');
  if (['full', 'rail', 'hidden'].includes(mode)) return mode;
  return safeGet("tclv.sidebarVisible", "true") === "false" ? "hidden" : "full";
}
const state = {
  language: safeGet("tclv.language", "sk"), channels: [], epg: new Map(), selectedChannelId: null, player: defaultPlayer(), overlayTimer: 0, videoJsPlayer: null, artPlayer: null, hls: null, mpegtsPlayer: null, flvPlayer: null, jPlayerReady: false,
  corsProxy: "",
  epgOffsetHours: 0, epgZoom: 1,
  playlists: migrateStoredSources("tclv.playlists", []), activePlaylistId: safeGet("tclv.activePlaylistId", null),
  epgSources: migrateStoredSources("tclv.epgSources", []),
  sidebarMode: defaultSidebarMode(),
  epgVisible: false,
  favorites: new Set(safeGetJsonArray('tclv.favorites')),
  logoIndexes: [],
  logoResolved: safeGetJsonObject('tclv.logoResolved'),
  logoFailures: new Set(),
  searchQuery: "",
  activeGroup: "all",
  streamStatus: Object.create(null),
  multiview: false,
  mvSlot: 0,
  mvChannel1: null,
  hls2: null,
  mpegts2: null,
  locked: false,
  lockTapCount: 0,
  lockTapTimer: 0,
  lockHoldTimer: 0,
  lockHoldStarted: false,
  lockHoldTriggered: false,
  lockButtonHoldTimer: 0,
  autostart: safeGet('tclv.autostart', 'false') === 'true',
  backgroundPlayback: safeGet('tclv.backgroundPlayback', 'true') === 'true'
};

const dom = {
  playlistFile: document.querySelector("#playlistFile"), epgFile: document.querySelector("#epgFile"), epgListFile: document.querySelector("#epgListFile"), exportEpgList: document.querySelector("#exportEpgList"), playlistUrl: document.querySelector("#playlistUrl"), epgUrl: document.querySelector("#epgUrl"), addPlaylistUrl: document.querySelector("#addPlaylistUrl"), addEpgUrl: document.querySelector("#addEpgUrl"), playerSelect: document.querySelector("#playerSelect"), languageSelect: document.querySelector("#languageSelect"), channelGrid: document.querySelector("#channelGrid"), channelTemplate: document.querySelector("#channelTemplate"), video: document.querySelector("#videoPlayer"), artPlayerHost: document.querySelector("#artPlayerHost"), jPlayerHost: document.querySelector("#jPlayerHost"), playerMessage: document.querySelector("#playerMessage"), switchOverlay: document.querySelector("#switchOverlay"), epgGuide: document.querySelector("#epgGuide"), guideRange: document.querySelector("#guideRange"), logoFile: document.querySelector("#logoFile"), menuToggle: document.querySelector("#menuToggle"), settingsPanel: document.querySelector("#settingsPanel"), settingsOverlay: document.querySelector("#settingsOverlay"), settingsClose: document.querySelector("#settingsClose"), playlistList: document.querySelector("#playlistList"), epgList: document.querySelector("#epgList"),
  corsProxyInput: document.querySelector("#corsProxy"), epgSearch: document.querySelector("#epgSearch"),
  epgToggle: document.querySelector("#epgToggle"), sidebarToggle: document.querySelector("#sidebarToggle"),
  guidePanel: document.querySelector("#guidePanel") || document.querySelector(".guide-panel"),
  sidebar: document.querySelector("#sidebar") || document.querySelector(".sidebar"),
  qualityControl: document.querySelector("#qualityControl"),
  qualitySelect: document.querySelector("#qualitySelect"),
  reloadEpg: document.querySelector("#reloadEpg"),
  epgRefreshStatus: document.querySelector("#epgRefreshStatus"),
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
  chToggle: document.querySelector("#chToggle"),
  mvToggle: document.querySelector("#mvToggle"),
  mvSlot0: document.querySelector("#mvSlot0"),
  mvSlot1: document.querySelector("#mvSlot1"),
  video2: document.querySelector("#videoPlayer2"),
  playerMessage2: document.querySelector("#playerMessage2"),
  catchupModal: document.querySelector("#catchupModal"),
  exportSettings: document.querySelector("#exportSettings"),
  includeEpgCache: document.querySelector("#includeEpgCache"), backupStatus: document.querySelector("#backupStatus"),
  importFile: document.querySelector("#importFile"),
  programDetailModal: document.querySelector("#programDetailModal"),
  lockButton: document.querySelector("#lockButton"),
  lockOverlay: document.querySelector("#lockOverlay"),
  lockUnlock: document.querySelector("#lockUnlock"),
  autostartToggle: document.querySelector("#autostartToggle"),
  autostartCheck: document.querySelector("#autostartCheck"),
  backgroundPlaybackToggle: document.querySelector("#backgroundPlaybackToggle"),
  backgroundPlaybackCheck: document.querySelector("#backgroundPlaybackCheck")
};

function t(key) { return translations[state.language]?.[key] || translations.en[key] || key; }
function hashCode(value) { return globalThis.TCLVParsers.hashCode(value); }
function escapeXml(value) { return String(value).replace(/[<>&"']/g, (char) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;"})[char]); }
function normalizeId(value) { return globalThis.TCLVParsers.normalizeId(value); }
function placeholderLogo(name) { const initials = (name || "TV").split(/\s+/).map((part) => part[0]).join("").slice(0,3).toUpperCase(); const hue = Math.abs(hashCode(name || "TV")) % 360; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="hsl(${hue} 72% 46%)"/><text x="80" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="white">${escapeXml(initials)}</text></svg>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
const EPG_STEP_HOURS = 1.5;
const EPG_ZOOM_FACTOR = 1.25;

// ── Logo sources ─────────────────────────────────────────────────────────────
// Ordered fallbacks requested by the project:
// 1. iptv-org API, 2. tv-logo/tv-logos, 3. Free-TV/IPTV lists,
// 4. BKPepe/czech-channels-icons, 5. Free-TV/IPTV lists as final retry.
const LOGO_SOURCES = [
  {
    id: 'iptv-org-api',
    label: 'iptv-org API',
    type: 'iptv-org-api',
    channelsUrl: 'https://iptv-org.github.io/api/channels.json',
    logosUrl: 'https://iptv-org.github.io/api/logos.json'
  },
  {
    id: 'tv-logo-tv-logos',
    label: 'tv-logo/tv-logos',
    type: 'candidate'
  },
  {
    id: 'free-tv-iptv-lists',
    label: 'Free-TV/IPTV lists',
    type: 'markdown',
    urls: [
      'https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/slovakia.md',
      'https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/czech_republic.md'
    ]
  },
  {
    id: 'bkpepe-czech-channels-icons',
    label: 'BKPepe/czech-channels-icons',
    type: 'github-directory',
    apiUrl: 'https://api.github.com/repos/BKPepe/czech-channels-icons/contents/'
  },
  {
    id: 'free-tv-iptv-lists-final',
    label: 'Free-TV/IPTV lists final fallback',
    type: 'markdown',
    urls: [
      'https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/slovakia.md',
      'https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/czech_republic.md'
    ]
  }
];

const TV_LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/';
const TV_LOGO_COUNTRIES = ['slovakia', 'czech-republic', 'international', 'hungary', 'poland', 'austria', 'germany', 'united-kingdom', 'france', 'italy', 'spain', 'united-states'];
const TV_LOGO_COUNTRY_SUFFIX = { 'slovakia': 'sk', 'czech-republic': 'cz', 'international': 'int', 'hungary': 'hu', 'poland': 'pl', 'austria': 'at', 'germany': 'de', 'united-kingdom': 'uk', 'france': 'fr', 'italy': 'it', 'spain': 'es', 'united-states': 'us' };

function logoKey(value) {
  return normalizeId(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')).replace(/-/g, '');
}
function cleanLogoName(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[ⒼⓈ]/g, '')
    .replace(/^:+/, '')
    .trim();
}
const LOGO_ALIASES = {
  '1': ['Jednotka', 'Jednotka.sk'],
  'jednotka': ['Jednotka.sk'],
  '2': ['Dvojka', 'Dvojka.sk'],
  'dvojka': ['Dvojka.sk'],
  '24': ['RTVS 24', '24.sk'],
  'rtvs24': ['RTVS 24', '24.sk'],
  'markiza': ['Markíza', 'Markiza.sk'],
  'markizakrimi': ['Markíza Krimi', 'MarkizaKrimi.sk'],
  'markizaklasik': ['Markíza Klasik', 'MarkizaKlasik.sk'],
  'doma': ['Doma.sk'],
  'dajto': ['DajTO', 'Dajto.sk'],
  'joj': ['TVJOJ.sk'],
  'jojplus': ['JOJ Plus', 'JOJPlus.sk'],
  'jojcinema': ['JOJ Cinema', 'JOJCinema.sk'],
  'jojsvet': ['JOJ Svet', 'JOJSvet.sk'],
  'wau': ['WAU', 'JOJWAU.sk'],
  'jojko': ['Jojko.sk'],
  'riktv': ['RiK TV', 'RiKTV.sk'],
  'disneychannel': ['Disney Channel Slovakia', 'DisneyChannel.cz', 'DisneyChannel.hu'],
  'disneyjunior': ['Disney Junior Slovakia', 'DisneyJunior.cz', 'DisneyJunior.hu'],
  'minimax': ['Minimax.sk', 'Minimax.cz'],
  'jimjam': ['JimJam.sk', 'JimJam.cz']
};
function channelLogoAliases(channel) {
  var values = [channel.tvgId, channel.tvgName, channel.name, channel.id].filter(Boolean);
  var out = [];
  values.forEach(function(value) {
    out.push(value);
    var key = logoKey(value);
    if (LOGO_ALIASES[key]) out.push(...LOGO_ALIASES[key]);
    var noCountry = String(value).replace(/\.[a-z]{2}$/i, '');
    if (noCountry !== value) out.push(noCountry);
  });
  return [...new Set(out.filter(Boolean))];
}
function channelLogoCacheKey(channel) {
  return logoKey(channel.tvgId || channel.name || channel.id || '');
}
function registerLogo(map, key, url) {
  var cleanKey = logoKey(cleanLogoName(key));
  var cleanUrl = sanitizeLogoUrl(url);
  if (!cleanKey || !cleanUrl || map[cleanKey]) return;
  map[cleanKey] = cleanUrl;
}
function registerLogoAliases(map, aliases, url) {
  aliases.filter(Boolean).forEach(function(alias) { registerLogo(map, alias, url); });
}
function extractLogoUrl(value) {
  var text = String(value || '');
  var htmlImg = text.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (htmlImg) return htmlImg[1];
  var markdown = text.match(/!?\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  if (markdown) return markdown[1];
  var bare = text.match(/https?:\/\/[^\s|"'<>)]*/i);
  return bare ? bare[0] : text;
}
function parseMarkdownLogoIndex(text) {
  var map = {};
  String(text || '').split(/\r?\n/).forEach(function(line) {
    var row = line.trim();
    if (!row || row.startsWith('#') || /^[-|:\s]+$/.test(row)) return;
    var cells = row.startsWith('|') ? row.split('|').map(function(cell) { return cell.trim(); }).filter(Boolean) : [];
    var name = '';
    var url = extractLogoUrl(row);
    var epgId = '';
    if (cells.length >= 4 && /^#$/i.test(cells[0])) return;
    if (cells.length >= 4 && /^\d+$/.test(cells[0])) {
      name = cells[1];
      epgId = cells[3];
    } else if (cells.length >= 2) {
      name = cells[0];
      url = extractLogoUrl(cells[cells.length - 1]) || url;
    }
    if (!name || /^channel$/i.test(name) || /^logo$/i.test(url)) {
      var match = row.match(/^\s*[-*]\s*([^:|]+)\s*[:|]\s*(https?:\/\/\S+)/i);
      if (match) { name = match[1].trim(); url = match[2].trim(); }
    }
    name = cleanLogoName(name);
    epgId = cleanLogoName(epgId);
    url = sanitizeLogoUrl(url);
    if (!name || !url) return;
    registerLogo(map, name, url);
    if (epgId) registerLogo(map, epgId, url);
  });
  return map;
}
function parseIptvOrgLogoIndex(channels, logos) {
  var map = {};
  var channelById = {};
  (Array.isArray(channels) ? channels : []).forEach(function(channel) {
    if (channel?.id) channelById[channel.id] = channel;
  });
  (Array.isArray(logos) ? logos : [])
    .filter(function(logo) { return logo?.url && logo?.channel; })
    .sort(function(a, b) { return Number(b.in_use === true) - Number(a.in_use === true); })
    .forEach(function(logo) {
      var channel = channelById[logo.channel] || {};
      registerLogoAliases(map, [
        logo.channel,
        logo.channel?.replace(/\.[a-z]{2}$/i, ''),
        channel.name,
        ...(Array.isArray(channel.alt_names) ? channel.alt_names : [])
      ], logo.url);
    });
  return map;
}
function parseGitHubDirectoryLogoIndex(items) {
  var map = {};
  (Array.isArray(items) ? items : []).forEach(function(item) {
    if (item?.type !== 'file' || !/\.(png|jpe?g|svg|webp)$/i.test(item.name || '')) return;
    var name = String(item.name).replace(/\.(png|jpe?g|svg|webp)$/i, '');
    registerLogo(map, name, item.download_url || item.html_url);
  });
  return map;
}
async function fetchJson(url) {
  var response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  return response.json();
}
async function fetchTextSource(url) {
  var response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  return response.text();
}
async function loadLogoSource(source) {
  if (source.type === 'candidate') return { id: source.id, label: source.label, map: {}, candidate: true };
  if (source.type === 'iptv-org-api') {
    var data = await Promise.all([fetchJson(source.channelsUrl), fetchJson(source.logosUrl)]);
    return { id: source.id, label: source.label, map: parseIptvOrgLogoIndex(data[0], data[1]) };
  }
  if (source.type === 'markdown') {
    var text = await Promise.all(source.urls.map(fetchTextSource));
    return { id: source.id, label: source.label, map: parseMarkdownLogoIndex(text.join('\n')) };
  }
  if (source.type === 'github-directory') {
    return { id: source.id, label: source.label, map: parseGitHubDirectoryLogoIndex(await fetchJson(source.apiUrl)) };
  }
  return { id: source.id, label: source.label, map: {} };
}
let logoIndexStarted = false;
async function initLogoIndex() {
  if (logoIndexStarted || !state.channels.some(ch => !sanitizeLogoUrl(ch.logo) && !state.logoResolved[channelLogoCacheKey(ch)])) return;
  logoIndexStarted = true;
  var indexes = [];
  for (var i = 0; i < LOGO_SOURCES.length; i++) {
    try { indexes.push(await loadLogoSource(LOGO_SOURCES[i])); } catch {}
  }
  state.logoIndexes = indexes;
  renderChannels();
  if (state.epgVisible) renderGuide();
}
function indexedLogoCandidates(channel, source) {
  var keys = channelLogoAliases(channel);
  var hits = [];
  for (var i = 0; i < keys.length; i++) {
    var hit = source.map?.[logoKey(keys[i])];
    if (hit && !hits.includes(hit)) hits.push(hit);
  }
  return hits;
}
function tvLogoSlug(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '-and-')
    .replace(/\+/g, '-plus')
    .replace(/[()[\]{}'":;!?,.*#@]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function tvLogoCandidates(channel) {
  var slugs = channelLogoAliases(channel).map(tvLogoSlug).filter(Boolean);
  slugs = [...new Set(slugs)];
  return slugs.flatMap(function(slug) {
    return TV_LOGO_COUNTRIES.map(function(country) {
      return TV_LOGO_BASE + country + '/' + slug + '-' + TV_LOGO_COUNTRY_SUFFIX[country] + '.png';
    });
  });
}
function normalizeLogoUrl(url) {
  if (url && location.protocol === 'https:' && url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}
function logoCandidates(channel) {
  var urls = [];
  function add(url) {
    url = normalizeLogoUrl(sanitizeLogoUrl(url));
    if (url && !urls.includes(url)) urls.push(url);
  }
  var cached = state.logoResolved[channelLogoCacheKey(channel)];
  add(cached); add(channel.logo);
  for (var i = 0; i < LOGO_SOURCES.length; i++) {
    var source = LOGO_SOURCES[i];
    if (source.type === 'candidate') {
      continue;
    }
    var loaded = state.logoIndexes.find(function(item) { return item.id === source.id; });
    if (loaded) indexedLogoCandidates(channel, loaded).forEach(add);
  }
  tvLogoCandidates(channel).slice(0, 4).forEach(add);
  urls = urls.filter(function(url) {
    var resolved = state.logoResolved[channelLogoCacheKey(channel)];
    return url === resolved || !state.logoFailures.has(url);
  });
  urls = urls.slice(0, 8);
  urls.push(placeholderLogo(channel.name));
  return urls;
}
let logoCacheTimer;
function scheduleLogoCache() { clearTimeout(logoCacheTimer); logoCacheTimer = setTimeout(() => safeSetJson('tclv.logoResolved', Object.fromEntries(Object.entries(state.logoResolved).slice(-2000))), 1500); }
function setLogoImage(imgEl, channel) {
  var candidates = logoCandidates(channel);
  const signature = candidates.join('\n');
  if (imgEl._logoSignature === signature) return;
  imgEl._logoSignature = signature; imgEl.loading = 'lazy'; imgEl.decoding = 'async';
  var idx = 0;
  var current = imgEl.getAttribute('src') || '';
  if (current && !current.startsWith('data:image/') && candidates.includes(current)) return;
  imgEl.onerror = function() {
    if (candidates[idx] && !candidates[idx].startsWith('data:image/')) state.logoFailures.add(candidates[idx]);
    idx += 1;
    imgEl.src = candidates[idx] || placeholderLogo(channel.name);
  };
  imgEl.onload = function() {
    var src = imgEl.getAttribute('src') || '';
    if (src && !src.startsWith('data:image/')) {
      state.logoResolved[channelLogoCacheKey(channel)] = src;
      state.logoFailures.delete(src);
      scheduleLogoCache();
    }
  };
  imgEl.src = candidates[0] || placeholderLogo(channel.name);
  imgEl.alt = channel.name;
}
function uniqueId(seed, existing) { return globalThis.TCLVParsers.uniqueId(seed, existing); }
function channelEpgKeys(channel) { return [...new Set([channel.tvgId, channel.id, channel.name, channel.tvgName, ...channelLogoAliases(channel)].flatMap(globalThis.TCLVParsers.epgKeys))]; }
function parseXml(text) { const doc = new DOMParser().parseFromString(text, "application/xml"); const error = doc.querySelector("parsererror"); if (error) throw new Error(error.textContent || "XML parse error"); return doc; }
function textOf(root, selector) { return root.querySelector(selector)?.textContent?.trim() || ""; }
function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value || ""); return span.innerHTML; }
function formatTime(date) { return new Intl.DateTimeFormat(state.language === "sk" ? "sk-SK" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(date); }
function floorToHalfHour(date) { const next = new Date(date); next.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0); return next; }

function parseM3U(text) { return globalThis.TCLVParsers.parseM3U(text); }
function parseXspf(text) {
  const doc = parseXml(text);
  if (doc.documentElement.localName !== 'playlist') throw new Error(t('playlistInvalid'));
  const tracks = [...doc.getElementsByTagNameNS('*', 'track')], channels = [], ids = new Set();
  for (const [index, track] of tracks.entries()) {
    const value = tag => [...track.getElementsByTagNameNS('*', tag)][0]?.textContent?.trim() || '';
    const metadata = new Map([...track.getElementsByTagNameNS('*', 'meta')].map(node => [node.getAttribute('rel'), node.textContent.trim()]));
    const meta = key => metadata.get(key) || '';
    const name = value('title') || meta('tvg-name') || value('annotation') || `Channel ${index + 1}`;
    const url = value('location');
    if (!globalThis.TCLVParsers.streamUrl(url)) continue;
    const legacyId = value('identifier') || track.getAttribute('tvg-id') || track.getAttribute('id') || '';
    const tvgId = meta('tvg-id') || legacyId;
    channels.push({ id: uniqueId(legacyId || name, ids), tvgId, name, url,
      tvgName: meta('tvg-name'), tvgUrl: meta('tvg-url'), tvgCountry: meta('tvg-country'),
      logo: value('image') || meta('tvg-logo'), group: meta('group-title') || value('creator') || value('annotation'),
      catchup: meta('catchup'), catchupSource: meta('catchup-source'), catchupDays: Math.max(0, Math.min(30, parseInt(meta('catchup-days'), 10) || 0)) });
  }
  return channels;
}
function playlistChannels(text, name = '') {
  const channels = /\.xspf(?:\.gz)?(?:$|[?#])/i.test(name) || /<(?:[\w.-]+:)?playlist\b/.test(text) ? parseXspf(text) : parseM3U(text);
  if (!channels.length) throw new Error(t('playlistInvalid'));
  return channels;
}
function parseXmlTvDate(value) { return globalThis.TCLVParsers.parseXmlTvDate(value); }
function parseXmlTv(text) {
  const doc = parseXml(text);
  const epg = new Map();
  const displayNames = new Map();
  for (const item of doc.querySelectorAll("channel")) {
    const id = item.getAttribute("id") || "";
    const name = textOf(item, "display-name");
    if (id && name) displayNames.set(id, name);
  }
  for (const item of doc.querySelectorAll("programme")) {
    const channelId = item.getAttribute("channel") || "";
    const program = {
      channelId,
      channelName: displayNames.get(channelId) || "",
      start: parseXmlTvDate(item.getAttribute("start")),
      stop: parseXmlTvDate(item.getAttribute("stop")),
      title: textOf(item, "title") || t("noProgram"),
      subTitle: textOf(item, "sub-title"),
      desc: textOf(item, "desc"),
      category: textOf(item, "category"),
      episode: textOf(item, "episode-num"),
      date: textOf(item, "date")
    };
    if (!program.start || !program.stop || program.stop <= program.start) continue;
    if (!epg.has(channelId)) epg.set(channelId, []);
    epg.get(channelId).push(program);
  }
  for (const entries of epg.values()) entries.sort((a,b)=>a.start-b.start);
  return epg;
}
function mergeEpgMaps(maps) {
  const merged = new Map(), seen = new Set();
  for (const map of maps) {
    const source = globalThis.TCLVEpg.sourceKey(map.sourceUrl);
    for (const [channelId, programs] of map) {
      if (!merged.has(channelId)) merged.set(channelId, []);
      for (const program of programs) {
        const key = `${source}|${channelId}|${+program.start}|${+program.stop}|${program.title}`;
        if (seen.has(key)) continue;
        seen.add(key); merged.get(channelId).push(source ? { ...program, epgSource: source } : program);
      }
    }
  }
  for (const entries of merged.values()) entries.sort((a, b) => a.start - b.start);
  return merged;
}
const epgProgramCache = new Map();
let epgNameIndex = globalThis.TCLVEpg.buildIndex(new Map());
function reindexEpg() { epgNameIndex = globalThis.TCLVEpg.buildIndex(state.epg); epgProgramCache.clear(); }
function findPrograms(channel) {
  if (!epgProgramCache.has(channel.id)) epgProgramCache.set(channel.id, globalThis.TCLVEpg.programsFor(epgNameIndex, channel, channelLogoAliases(channel)));
  return epgProgramCache.get(channel.id);
}
function nextProgramIndex(programs, now) {
  let lo = 0, hi = programs.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (programs[mid].start <= now) lo = mid + 1; else hi = mid; }
  return lo;
}
function currentProgram(channel, now = new Date()) { return globalThis.TCLVEpg.activeProgram(findPrograms(channel), +now); }
function nextProgram(channel, now = new Date()) { const programs = findPrograms(channel); return programs[nextProgramIndex(programs, now)] || null; }
function progress(program, now = new Date()) { if (!program) return 0; const total = program.stop - program.start; if (total <= 0) return 0; return Math.max(0, Math.min(100, ((now - program.start) / total) * 100)); }
function selectedChannel() { return state.channels.find((channel) => channel.id === state.selectedChannelId) || state.channels[0] || null; }
function filteredChannels() {
  return state.channels;
}
function isFavorite(id) { return state.favorites.has(id); }
function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  safeSet('tclv.favorites', JSON.stringify([...state.favorites]));
  renderChannels(); renderGroupTabs();
}
function renderGroupTabs() {
  if (dom.groupTabs) dom.groupTabs.innerHTML = '';
}
function extractM3UEpgUrls(text) {
  const first = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
  const header = first.startsWith('#EXTM3U') ? ['x-tvg-url', 'url-tvg', 'tvg-url'].flatMap(key => globalThis.TCLVParsers.attr(first, key).split(',')) : [];
  return [...new Set([...header, ...state.channels.map(channel => channel.tvgUrl)].map(url => String(url || '').trim()).filter(url => /^https?:\/\//i.test(url)))];
}

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
let slot1Generation = 0;
function destroySlot1() {
  slot1Generation++;
  if (state.hls2) { try { state.hls2.destroy(); } catch {} state.hls2 = null; }
  if (state.mpegts2) { try { state.mpegts2.destroy(); } catch {} state.mpegts2 = null; }
  if (dom.video2) { dom.video2.pause(); dom.video2.removeAttribute('src'); dom.video2.load(); }
}
function stopSlot1Media() {
  if (state.hls2) { try { state.hls2.destroy(); } catch {} state.hls2 = null; }
  if (state.mpegts2) { try { state.mpegts2.destroy(); } catch {} state.mpegts2 = null; }
  if (dom.video2) { dom.video2.pause(); dom.video2.removeAttribute('src'); dom.video2.load(); }
}
async function playInSlot1(channel) {
  const run = ++slot1Generation;
  stopSlot1Media();
  if (!dom.video2) return;
  var url = channel.url;
  if (dom.playerMessage2) dom.playerMessage2.style.display = 'none';
  if (isBlockedWebStream(url)) {
    if (dom.playerMessage2) {
      dom.playerMessage2.textContent = t('webStreamHint');
      dom.playerMessage2.style.display = 'block';
    }
    return;
  }
  var type = getStreamType(url);
  try {
    if (type === 'hls') {
      await ensureHls();
      if (run !== slot1Generation) return;
      if (window.Hls?.isSupported()) {
        var hls = new window.Hls(hlsConfig(url));
        state.hls2 = hls;
        hls.on(window.Hls.Events.ERROR, function(_e, data) { if (data.fatal && state.hls2 === hls) { stopSlot1Media(); if (dom.playerMessage2) { dom.playerMessage2.textContent = t('streamUnavailable'); dom.playerMessage2.style.display = 'block'; } } });
        hls.loadSource(url);
        hls.attachMedia(dom.video2);
        hls.on(window.Hls.Events.MANIFEST_PARSED, function() { dom.video2.muted = true; dom.video2.play().catch(function() {}); });
        return;
      }
    }
    if (type === 'ts') {
      await ensureMpegts();
      if (run !== slot1Generation) return;
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
  catchupReturnFocus = document.activeElement;
  document.querySelector('.topbar')?.setAttribute('inert', ''); dom.sidebar?.setAttribute('inert', '');
  dom.catchupModal.setAttribute('role', 'dialog'); dom.catchupModal.setAttribute('aria-modal', 'true');
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
    var dayHeader = document.createElement('button'); dayHeader.type = 'button'; dayHeader.className = 'catchup-day-header';
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
  dom.catchupModal.hidden = false; closeBtn.focus();
}
let catchupReturnFocus;
function closeCatchupModal() {
  if (dom.catchupModal) dom.catchupModal.hidden = true;
  document.querySelector('.topbar')?.removeAttribute('inert'); dom.sidebar?.removeAttribute('inert');
  if (catchupReturnFocus?.isConnected) catchupReturnFocus.focus();
}
function playCatchup(channel, start, duration) {
  var url = buildCatchupUrl(channel, start, duration);
  if (!url) { showMessage(t('catchupUnavailable')); return; }
  closeCatchupModal();
  setPlayerActive(true);
  stopInternalPlayers(); showHtmlVideo();
  dom.video.removeAttribute('src'); dom.video.load();
  const archive = Object.assign({}, channel, { url: url });
  playChannel(archive);
}
// ── Export / Import ───────────────────────────────────────────────────────────
function fallbackExportFile(content, filename, mime) {
  var blob = new Blob([content], { type: mime || 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
async function saveExportedFile(content, filename, mime, successMessage) {
  // Android WebViews don't handle <a download> blob URLs on their own — there's
  // no DownloadListener wired up, so the fallback below silently does nothing.
  // Route through a native SAF "Save As" dialog instead so the user actually
  // gets a picker and a file lands where they chose it to.
  var TCLVPlayer = window.Capacitor?.Plugins?.TCLVPlayer;
  async function* pieces() {
    if (typeof content !== 'string') { yield* content; return; }
    for (let i = 0; i < content.length;) {
      let end = Math.min(content.length, i + 32768);
      if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1])) end++;
      yield content.slice(i, end); i = end;
    }
  }
  if (getPlatform() === 'android' && TCLVPlayer?.beginTextExport) {
    const { id } = await TCLVPlayer.beginTextExport();
    try {
      for await (const part of pieces()) await TCLVPlayer.appendTextExport({ id, content: part });
      await TCLVPlayer.finishTextExport({ id, filename, mimeType: mime || 'text/plain' });
    } catch (error) { await TCLVPlayer.cancelTextExport({ id }).catch(() => {}); throw error; }
  } else if (getPlatform() === 'android' && TCLVPlayer?.saveTextFile && typeof content === 'string') {
    try {
      await TCLVPlayer.saveTextFile({ filename: filename, content: content, mimeType: mime || 'text/plain' });
      if (successMessage) showMessage(successMessage);
    } catch (error) {
      if (!/cancelled|canceled/i.test(error.message || '')) showMessage(t('loadError') + ' (export)');
    }
    return;
  } else {
    const parts = []; let bytes = 0;
    for await (const part of pieces()) {
      bytes += new globalThis.TextEncoder().encode(part).length;
      if (bytes > 256 * 1024 * 1024) throw new Error('Backup exceeds 256 MiB');
      parts.push(part);
    }
    fallbackExportFile(new Blob(parts, { type: mime || 'text/plain' }), filename, mime);
  }
  if (successMessage) showMessage(successMessage);
}
async function exportSettings() {
  if (dom.exportSettings.disabled) return;
  dom.exportSettings.disabled = true; dom.exportSettings.setAttribute('aria-busy', 'true');
  dom.backupStatus.textContent = t('backupPreparing');
  try {
  var data = {
    version: 2, activePlaylistId: state.activePlaylistId,
    playlists: state.playlists.map(function(p) {
      var item = exportableSourceRecord(p);
      delete item.active;
      return item;
    }),
    epgSources: state.epgSources.map(function(s) {
      var item = exportableSourceRecord(s);
      delete item.type;
      if (s.origin === 'network' && !dom.includeEpgCache.checked) { delete item.text; delete item.fetchedAt; }
      else if (s.nativeCache && !item.text) item.text = globalThis.TCLVBackup.textSource(() => nativeEpgText(s.nativeCache));
      return item;
    }),
    favorites: [...state.favorites],
    language: state.language, player: state.player, players: platformPlayersSnapshot(), corsProxy: state.corsProxy
  };
  dom.backupStatus.textContent = t('backupSaving');
  await saveExportedFile(globalThis.TCLVBackup.chunks(data), 'tclvplayer-settings.json', 'application/json', t('exportSettings'));
  dom.backupStatus.textContent = t('backupDone');
  } catch (error) { dom.backupStatus.textContent = t(/cancelled|canceled/i.test(error.message || '') ? 'backupCancelled' : 'backupFailed'); }
  finally { dom.exportSettings.disabled = false; dom.exportSettings.removeAttribute('aria-busy'); }
}
function epgListTemplateText() {
  var lines = state.epgSources
    .filter(function(s) { return s.source && /^https?:\/\//i.test(s.source); })
    .map(function(s) { return (s.name || sourceNameFromUrl(s.source, 'epg.xml')) + ' = ' + s.source; });
  return '# TCLVPlayer — zoznam EPG zdrojov (export)\n'
    + '# Formát: Nazov = URL. Riadky zacinajuce # su komentare.\n'
    + '# Uprav a naimportuj cez Nastavenia -> EPG zdroje -> "Import EPG".\n\n'
    + lines.join('\n') + (lines.length ? '\n' : '');
}
async function exportEpgListFile() {
  var text = epgListTemplateText();
  try { await saveExportedFile(text, 'tclvplayer-epg-list.txt', 'text/plain', t('epgListExported')); }
  catch (error) { if (!/cancelled|canceled/i.test(error.message || '')) showMessage(t('backupFailed')); }
}
async function importSettingsFromFile(file) {
  try {
    const data = globalThis.TCLVStorage.validateBackup(JSON.parse(await readFile(file)));
    // Validate everything first and commit durable state atomically before touching UI.
    await persistSourcesPending.catch(function() {});
    await globalThis.TCLVStorage.saveSnapshot(data);
    state.playlists = data.playlists; state.epgSources = data.epgSources;
    state.activePlaylistId = data.activePlaylistId;
    state.favorites = new Set(data.favorites); state.language = data.language;
    safeSetJson('tclv.favorites', data.favorites); safeSet('tclv.language', data.language);
    for (const [key, value] of Object.entries(data.players)) safeSet('tclv.player.' + key, value);
    state.player = data.player || defaultPlayer(); saveCurrentPlayer();
    state.corsProxy = data.corsProxy; safeSet('tclv.corsProxy', data.corsProxy);
    safeSet('tclv.activePlaylistId', state.activePlaylistId || '');
    if (dom.corsProxyInput) dom.corsProxyInput.value = data.corsProxy;
    state.epg = new Map(); epgProgramCache.clear();
    renderAll();
    if (state.activePlaylistId) await activatePlaylist(state.activePlaylistId);
    else { state.channels = []; renderAll(); }
    await reloadEpgSources();
    showMessage(t('settingsImported'));
  } catch (err) { showMessage(t('loadError') + ' ' + (err.message || '')); }
}
function setStreamStatus(channelId, status) {
  state.streamStatus[channelId] = status;
  updateChannelStatusDot(channelId);
}
function updateChannelStatusDot(channelId) {
  var card = dom.channelGrid.querySelector('[data-id="' + channelId + '"]');
  if (!card) return;
  var dot = card.querySelector('.status-dot');
  if (!dot) return;
  var s = state.streamStatus[channelId];
  dot.className = 'status-dot' + (s ? ' ' + s : '');
}
function syncAndroidPlaybackActive(active) {
  if (getPlatform() !== 'android') return;
  window.Capacitor?.Plugins?.TCLVPlayer?.setPlaybackActive({ active: !!active }).catch(function() {});
}
function bindVideoStatusEvents(videoEl, expectedId) {
  var markOk = function() {
    if (state.selectedChannelId === expectedId) setStreamStatus(expectedId, 'ok');
  };
  var markError = function() {
    if (state.selectedChannelId === expectedId) {
      setStreamStatus(expectedId, 'error');
      syncAndroidPlaybackActive(false);
    }
  };
  ['playing', 'canplay', 'loadeddata'].forEach(function(eventName) {
    videoEl.addEventListener(eventName, markOk, { once: true });
  });
  videoEl.addEventListener('timeupdate', function onTimeUpdate() {
    if (state.selectedChannelId === expectedId && videoEl.currentTime > 0) setStreamStatus(expectedId, 'ok');
    videoEl.removeEventListener('timeupdate', onTimeUpdate);
  });
  videoEl.addEventListener('error', markError, { once: true });
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
    var record = { id: 'pl-' + Date.now(), name: user + '@' + serverHost, source: m3uUrl, type: 'm3u', origin: 'network', text: text };
    addPlaylistRecord(record);
    await loadPlaylistText(text, record.name);
    if (dom.xtreamServer) dom.xtreamServer.value = '';
    if (dom.xtreamUser) dom.xtreamUser.value = '';
    if (dom.xtreamPass) dom.xtreamPass.value = '';
    if (!state.epgSources.some(function(s) { return s.source === epgUrl; })) {
      addEpgRecord({ id: 'epg-' + Date.now(), name: 'EPG ' + user + '@' + serverHost, source: epgUrl, origin: 'network', active: true });
    }
  } catch (err) { showMessage(t('loadError') + ' ' + (err.message || '')); }
}
function togglePip() {
  if (getPlatform() === 'android') {
    if (window.Capacitor?.Plugins?.TCLVPlayer) {
      window.Capacitor.Plugins.TCLVPlayer.enterPip({}).catch(function() { showMessage(t('optionalMissing')); });
    }
    return;
  }
  if (!document.pictureInPictureEnabled) return;
  var videoEl = state.artPlayer ? state.artPlayer.video : dom.video;
  if (document.pictureInPictureElement) { document.exitPictureInPicture().catch(function() {}); }
  else { videoEl.requestPictureInPicture().catch(function() {}); }
}
function renderSourceLists() {
  const focused = document.activeElement;
  const focusSource = focused?.closest('.source-item')?.dataset.sourceId;
  const focusAction = focused?.dataset.action;

  if (dom.playlistList) {
    dom.playlistList.innerHTML = "";
    state.playlists.forEach((item) => {
      const row = document.createElement("div"); row.dataset.sourceId = item.id; row.className = `source-item${item.id === state.activePlaylistId ? " active" : ""}`;
      const plOrigin = t(item.origin || (item.source?.startsWith('http') ? 'network' : 'local')); row.innerHTML = `<div class="source-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(plOrigin)}</span></div><span class="source-chip">${escapeHtml(item.type)}</span><div class="source-actions"><button data-action="use">Use</button><button data-action="remove">X</button></div>`;
      row.querySelector('[data-action="use"]').addEventListener('click', ()=>activatePlaylist(item.id, { forceReload: item.id === state.activePlaylistId && item.origin !== 'local' }));
      row.querySelector('[data-action="remove"]').addEventListener('click', ()=>removePlaylist(item.id));
      dom.playlistList.append(row);
    });
  }
  if (dom.epgList) {
    dom.epgList.innerHTML = "";
    state.epgSources.forEach((item) => {
      const isActive = item.active !== false;
      const row = document.createElement("div"); row.dataset.sourceId = item.id; row.className = 'source-item' + (isActive ? ' active' : '');
      const epgOrigin = t(item.origin || (item.source?.startsWith('http') ? 'network' : 'local')); row.innerHTML = `<div class="source-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(epgOrigin)}</span></div><span class="source-chip">EPG</span><div class="source-actions"><button data-action="toggle">Use</button><button data-action="remove">X</button></div>`;
      if (item.status) {
        const detail = document.createElement('small'); detail.className = 'source-status';
        const labels = { loading: 'epgSourceLoading', ready: 'epgSourceReady', unmatched: 'epgSourceUnmatched', outdated: 'epgSourceOutdated', future: 'epgSourceFuture', noCurrent: 'epgSourceNoCurrent', empty: 'epgSourceEmpty', error: 'epgSourceError' };
        detail.textContent = t(labels[item.status] || 'epgSourceError') + (item.error ? ': ' + item.error : '');
        if (item.status === 'ready' && item.stats) detail.textContent += ' · ' + item.stats.kept + ' ' + (state.language === 'sk' ? 'programov' : 'programmes') + ' · ' + (item.stats.current || 0) + ' ' + t('now').toLowerCase();
        row.querySelector('.source-main').append(detail); row.dataset.status = item.status;
      }
      row.querySelector('[data-action="toggle"]').addEventListener('click', ()=>toggleEpgSource(item.id));
      row.querySelector('[data-action="remove"]').addEventListener('click', ()=>removeEpgSource(item.id));
      dom.epgList.append(row);
    });
  }
  if (focusSource && focusAction) {
    const row = [...dom.settingsPanel.querySelectorAll('.source-item')].find(node => node.dataset.sourceId === focusSource);
    row?.querySelector('[data-action="' + focusAction + '"]')?.focus({ preventScroll: true });
  }
}

function translateUi() {
  document.documentElement.lang = state.language; dom.languageSelect.value = state.language; dom.playerSelect.value = state.player;
  document.querySelectorAll('[data-i18n]').forEach((node)=>{ node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node)=>{ node.placeholder = t(node.dataset.i18nPlaceholder); });
  syncCustomSelects();
}
function customSelectOptions(select) {
  return Array.from(select.options).filter(function(option) {
    return !option.disabled && !option.hidden && option.style.display !== 'none';
  });
}
function nativeSelectForCustom(custom) {
  return document.getElementById(custom.dataset.for || '');
}
function closeCustomSelect(custom) {
  if (!custom) return;
  custom.classList.remove('open');
  custom.querySelector('.custom-select-button')?.setAttribute('aria-expanded', 'false');
  var menu = custom.querySelector('.custom-select-menu');
  if (menu) menu.hidden = true;
}
function closeCustomSelects(except) {
  document.querySelectorAll('.custom-select').forEach(function(custom) {
    if (custom !== except) closeCustomSelect(custom);
  });
}
function syncCustomSelect(custom) {
  var select = nativeSelectForCustom(custom);
  if (!custom || !select) return;
  var button = custom.querySelector('.custom-select-button');
  var menu = custom.querySelector('.custom-select-menu');
  if (!button || !menu) return;
  var selected = select.selectedOptions[0] || customSelectOptions(select)[0];
  button.textContent = selected?.textContent || '';
  menu.querySelectorAll('.custom-select-option').forEach(function(option) {
    option.setAttribute('aria-selected', String(option.dataset.value === select.value));
  });
}
function syncCustomSelects() {
  document.querySelectorAll('.custom-select').forEach(syncCustomSelect);
}
function renderCustomSelectOptions(custom) {
  var select = nativeSelectForCustom(custom);
  if (!custom || !select) return;
  var menu = custom.querySelector('.custom-select-menu');
  if (!menu) return;
  menu.replaceChildren();
  customSelectOptions(select).forEach(function(option) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.dataset.value = option.value;
    item.setAttribute('role', 'option');
    item.textContent = option.textContent;
    item.addEventListener('click', function() {
      select.value = option.value;
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      closeCustomSelect(custom); custom.querySelector('.custom-select-button')?.focus();
    });
    menu.append(item);
  });
  syncCustomSelect(custom);
}
function initCustomSelect(custom) {
  if (!custom || custom.dataset.ready === 'true') return;
  var button = custom.querySelector('.custom-select-button');
  var menu = custom.querySelector('.custom-select-menu');
  if (!button || !menu) return;
  button.addEventListener('click', function() {
    closeCustomSelects(custom);
    var open = custom.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (open) menu.querySelector('[aria-selected="true"]')?.focus();
  });
  custom.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCustomSelect(custom);
      button.focus();
    }
  });
  document.addEventListener('click', function(event) {
    if (!custom.contains(event.target)) closeCustomSelect(custom);
  });
  custom.dataset.ready = 'true';
  renderCustomSelectOptions(custom);
}
function initCustomSelects() {
  document.querySelectorAll('.custom-select').forEach(initCustomSelect);
}
const channelWindow = { start: 0, rowHeight: 76, source: null };
const CHANNEL_WINDOW_SIZE = 70;
function channelWindowStart(index) {
  return Math.max(0, Math.min(index - 12, filteredChannels().length - CHANNEL_WINDOW_SIZE));
}
function focusChannelIndex(index) {
  index = Math.max(0, Math.min(state.channels.length - 1, index));
  if (state.channels.length > 150 && (index < channelWindow.start || index >= channelWindow.start + CHANNEL_WINDOW_SIZE)) {
    channelWindow.start = channelWindowStart(index);
    renderChannels();
  }
  const card = [...dom.channelGrid.querySelectorAll('.channel-card')].find(node => node.dataset.channelId === state.channels[index]?.id);
  card?.focus({ preventScroll: true }); card?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function renderChannels() {
  const measured = dom.channelGrid.querySelector('.channel-card')?.getBoundingClientRect().height;
  if (measured) channelWindow.rowHeight = measured + 4;
  const allChannels = filteredChannels();
  const focused = document.activeElement?.closest('.channel-card');
  const focusId = focused?.dataset.channelId;
  const focusClass = document.activeElement?.className;
  if (channelWindow.source !== allChannels) { channelWindow.source = allChannels; channelWindow.start = 0; dom.channelGrid.replaceChildren(); dom.channelGrid.scrollTop = 0; }
  const virtual = allChannels.length > 150;
  const start = virtual ? Math.max(0, Math.min(channelWindow.start, allChannels.length - CHANNEL_WINDOW_SIZE)) : 0;
  channelWindow.start = start;
  const channels = virtual ? allChannels.slice(start, start + CHANNEL_WINDOW_SIZE) : allChannels;
  const scrollTop = dom.channelGrid.scrollTop;
  const existing = new Map([...dom.channelGrid.querySelectorAll('.channel-card')].map(node => [node.dataset.channelId, node]));
  for (const node of dom.channelGrid.querySelectorAll('.channel-card')) if (!channels.some(ch => ch.id === node.dataset.channelId)) node.remove();
  let top = dom.channelGrid.querySelector('.channel-spacer-top'), bottom = dom.channelGrid.querySelector('.channel-spacer-bottom');
  if (!top) { top = document.createElement('div'); top.className = 'channel-spacer-top'; top.setAttribute('aria-hidden', 'true'); dom.channelGrid.prepend(top); }
  if (!bottom) { bottom = document.createElement('div'); bottom.className = 'channel-spacer-bottom'; bottom.setAttribute('aria-hidden', 'true'); dom.channelGrid.append(bottom); }
  top.style.height = virtual ? start * channelWindow.rowHeight + 'px' : '0px';
  bottom.style.height = virtual ? Math.max(0, allChannels.length - start - channels.length) * channelWindow.rowHeight + 'px' : '0px';
  dom.channelGrid.querySelector('.empty-state')?.remove();
  if (!channels.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = t('noChannels');
    dom.channelGrid.append(empty);
    return;
  }
  const now = new Date();
  let nextNode = top.nextElementSibling;
  channels.forEach((channel, position) => {
    const reused = existing.get(channel.id);
    const node = reused || dom.channelTemplate.content.firstElementChild.cloneNode(true);
    const program = currentProgram(channel, now);
    node.dataset.id = channel.id;
    node.dataset.channelId = channel.id;
    node.tabIndex = 0;
    node.setAttribute('role', 'listitem');
    node.setAttribute('aria-setsize', String(allChannels.length)); node.setAttribute('aria-posinset', String(start + position + 1));
    node.setAttribute('aria-label', channel.name);
    node.classList.toggle('active', channel.id === state.selectedChannelId);
    setLogoImage(node.querySelector('.channel-logo'), channel);
    node.querySelector('h3').textContent = channel.name;
    node.querySelector('p').textContent = program?.title || t('noProgram');
    node.querySelector('.progress-track span').style.width = `${progress(program, now)}%`;
    var favBtn = node.querySelector('.fav-action');
    if (favBtn) {
      favBtn.classList.toggle('active', isFavorite(channel.id));
      favBtn.textContent = isFavorite(channel.id) ? '★' : '☆';
      favBtn.title = t('groupFavorites');
      if (!reused) favBtn.addEventListener('click', function(event) { event.stopPropagation(); toggleFavorite(channel.id); });
    }
    var dot = node.querySelector('.status-dot');
    if (dot) {
      var s = state.streamStatus[channel.id];
      dot.className = 'status-dot' + (s ? ' ' + s : '');
    }
    if (channel.catchupDays > 0 && !reused) {
      var catchupBtn = document.createElement('button');
      catchupBtn.className = 'catchup-badge';
      catchupBtn.title = t('catchupAvailable');
      catchupBtn.textContent = '📅';
      catchupBtn.addEventListener('click', function(ev) { ev.stopPropagation(); openCatchup(channel); });
      node.querySelector('.channel-text').append(catchupBtn);
    }
    if (!reused) {
    node.addEventListener('click', () => selectChannel(channel.id));
    node.addEventListener('keydown', (event) => {
      if (isSelectKey(event) && event.target === node) {
        event.preventDefault();
        selectChannel(channel.id);
      }
    });
    }
    // Prepend earlier rows before retained cards; appending them reorders the list
    // and lets browser scroll anchoring repeatedly shift the virtual window.
    if (node !== nextNode) dom.channelGrid.insertBefore(node, nextNode);
    nextNode = node.nextElementSibling;
  });
  const first = dom.channelGrid.querySelector('.channel-card');
  if (first) channelWindow.rowHeight = first.getBoundingClientRect().height + 4;
  dom.channelGrid.scrollTop = scrollTop;
  if (focusId && !document.activeElement?.closest('.channel-card')) {
    const card = [...dom.channelGrid.querySelectorAll('.channel-card')].find(node => node.dataset.channelId === focusId);
    const child = card && focusClass && [...card.querySelectorAll('button')].find(node => node.className === focusClass);
    (child || card)?.focus({ preventScroll: true });
  }
}
function updateChannelSelectionUi() {
  dom.channelGrid.querySelectorAll('.channel-card').forEach(function(card) {
    card.classList.toggle('active', card.dataset.channelId === state.selectedChannelId);
  });
}
function setSidebarMode(mode, persist) {
  state.sidebarMode = ['full', 'rail', 'hidden'].includes(mode) ? mode : 'full';
  if (persist) {
    safeSet('tclv.sidebarMode', state.sidebarMode);
    safeSet('tclv.sidebarVisible', state.sidebarMode === 'hidden' ? 'false' : 'true');
  }
  var workspace = document.querySelector('.workspace');
  workspace?.classList.toggle('sidebar-rail', state.sidebarMode === 'rail');
  workspace?.classList.toggle('sidebar-hidden', state.sidebarMode === 'hidden');
  var btn = dom.sidebarToggle;
  if (btn) {
    btn.innerHTML = state.sidebarMode === 'hidden' ? '&#x203a;' : '&#x2039;';
    btn.setAttribute('aria-label', state.sidebarMode === 'full' ? 'Collapse channel names' : state.sidebarMode === 'rail' ? 'Hide channels' : 'Show channels');
  }
}
function toggleSidebar() {
  var next = state.sidebarMode === 'full' ? 'rail' : state.sidebarMode === 'rail' ? 'hidden' : 'full';
  setSidebarMode(next, true);
}
async function ensureEpgLoadedForActivePlaylist() {
  var playlist = state.playlists.find(function(p) { return p.id === state.activePlaylistId; });
  if (state.epgSources.length) {
    await reloadEpgSources({ showOnLoad: false });
  }
  if (!state.epg.size && playlist?.text) {
    await autoLoadEpgFromPlaylist(playlist.text);
  }
  if (state.epgVisible) renderGuide();
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
  if (state.epgVisible) {
    renderGuide();
    if (getPlatform() === 'android') ensureEpgLoadedForActivePlaylist();
  }
}
function setEpgVisible(visible) {
  if (state.epgVisible !== !!visible) toggleEpg();
}
let guideFocusKey;
const guideWindow = { start: 0, rowHeight: 48, channels: [] };
function renderGuide() {
  guideFocusKey = document.activeElement?.closest('.program')?.dataset.programKey;
  var baseHours = 8 * state.epgZoom;
  var offsetMs = state.epgOffsetHours * 60 * 60 * 1000;
  const start = floorToHalfHour(new Date(Date.now() - 2 * 60 * 60 * 1000 + offsetMs)); const end = new Date(start.getTime() + baseHours * 60 * 60 * 1000); const duration = end - start; const epgQuery = dom.epgSearch?.value.trim().toLowerCase() || ''; const allGuideChannels = state.channels.filter((ch) => { if (!epgQuery) return true; const programs = findPrograms(ch).filter((p) => p.stop > start && p.start < end); return ch.name.toLowerCase().includes(epgQuery) || programs.some((p) => p.title.toLowerCase().includes(epgQuery)); }); dom.guideRange.textContent = `${formatTime(start)} - ${formatTime(end)}`;
  const virtual = allGuideChannels.length > 150;
  guideWindow.channels = allGuideChannels;
  const rowStart = virtual ? Math.max(0, Math.min(guideWindow.start, allGuideChannels.length - 1)) : 0;
  const channels = virtual ? allGuideChannels.slice(rowStart, rowStart + 70) : allGuideChannels;
  if (!channels.length) { dom.epgGuide.innerHTML = `<div class="empty-state">${t('noChannels')}</div>`; return; }
  var baseWidth = Math.round(1280 / state.epgZoom); const width = baseWidth; const timeline = document.createElement('div'); timeline.className = 'timeline'; timeline.style.width = `${width + 170}px`;
  const header = document.createElement('div'); header.className = 'timeline-header'; header.innerHTML = `<div class="timeline-corner"></div><div class="time-slots"></div>`; header.querySelector('.time-slots').style.width = `${width}px`;
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 30 * 60 * 1000)) { const slot = document.createElement('div'); slot.className = 'time-slot'; slot.style.left = `${((cursor - start) / duration) * width}px`; slot.style.width = `${width / 16}px`; slot.textContent = formatTime(cursor); header.querySelector('.time-slots').append(slot); }
  timeline.append(header);
  if (virtual) { const spacer = document.createElement('div'); spacer.style.height = rowStart * guideWindow.rowHeight + 'px'; spacer.setAttribute('aria-hidden', 'true'); timeline.append(spacer); }
  channels.forEach((channel) => { const row = document.createElement('div'); row.className = 'timeline-row'; row.dataset.channelId = channel.id; row.innerHTML = `<div class="timeline-label"><img alt=""><span>${escapeHtml(channel.name)}</span></div><div class="program-track"></div>`; setLogoImage(row.querySelector('.timeline-label img'), channel); const track = row.querySelector('.program-track'); track.style.width = `${width}px`; const programs = findPrograms(channel).filter((program) => program.stop > start && program.start < end); if (!programs.length) { const empty = document.createElement('div'); empty.className = 'program'; empty.tabIndex = 0; empty.setAttribute('aria-label', channel.name + ': ' + t('noEpg')); empty.style.left = '8px'; empty.style.width = '160px'; empty.innerHTML = `<strong>${t('noEpg')}</strong>`; track.append(empty); } else { programs.forEach((program) => { const left = Math.max(0, ((program.start - start) / duration) * width); const right = Math.min(width, ((program.stop - start) / duration) * width); const node = document.createElement('div'); node.className = `program${program.start <= new Date() && program.stop > new Date() ? ' current' : ''}`; node.style.left = `${left}px`; node.style.width = `${Math.max(44, right - left)}px`; node.title = `${program.title} ${formatTime(program.start)}-${formatTime(program.stop)}`; node.dataset.programKey = channel.id + ':' + +program.start; node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', program.title); node.innerHTML = `<strong>${escapeHtml(program.title)}</strong><span>${formatTime(program.start)} - ${formatTime(program.stop)}</span>`; node.addEventListener('click', function() { openProgramDetail(program, channel); }); node.addEventListener('keydown', function(event) { if (isSelectKey(event)) { event.preventDefault(); openProgramDetail(program, channel); } }); track.append(node); }); }
    const nowLine = document.createElement('div'); nowLine.className = 'now-line'; nowLine.style.left = `${Math.max(0, Math.min(width, ((Date.now() - start.getTime()) / duration) * width))}px`; track.append(nowLine);
    timeline.append(row);
  });
  if (virtual) { const spacer = document.createElement('div'); spacer.style.height = Math.max(0, allGuideChannels.length - rowStart - channels.length) * guideWindow.rowHeight + 'px'; spacer.setAttribute('aria-hidden', 'true'); timeline.append(spacer); }
  dom.epgGuide.replaceChildren(timeline);
  const firstRow = timeline.querySelector('.timeline-row'); if (firstRow) guideWindow.rowHeight = firstRow.getBoundingClientRect().height;
  if (guideFocusKey) [...dom.epgGuide.querySelectorAll('.program')].find(node => node.dataset.programKey === guideFocusKey)?.focus({ preventScroll: true });
}
function programDurationLabel(program) {
  var minutes = Math.max(1, Math.round((program.stop - program.start) / 60000));
  if (minutes < 60) return minutes + ' min';
  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;
  return rest ? hours + 'h ' + rest + 'm' : hours + 'h';
}
function programDateLabel(program) {
  return new Intl.DateTimeFormat(state.language === 'sk' ? 'sk-SK' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(program.start);
}
function programDetailText(key) {
  const labels = {
    sk: { close: 'Zatvoriť', duration: 'Trvanie', episode: 'Epizóda', category: 'Kategória', date: 'Dátum' },
    en: { close: 'Close', duration: 'Duration', episode: 'Episode', category: 'Category', date: 'Date' }
  };
  return (labels[state.language] || labels.en)[key] || key;
}
let detailReturnFocus;
function closeProgramDetail() {
  if (!dom.programDetailModal) return;
  dom.programDetailModal.hidden = true;
  dom.programDetailModal.replaceChildren();
  document.querySelector('.content')?.classList.remove('program-detail-active');
  document.querySelectorAll('[data-detail-inert]').forEach(node => { node.removeAttribute('inert'); node.removeAttribute('data-detail-inert'); });
  if (detailReturnFocus?.isConnected) detailReturnFocus.focus(); else focusGuideItem();
}
function openProgramDetail(program, channel) {
  if (!dom.programDetailModal || !program) return;
  detailReturnFocus = document.activeElement;
  for (const node of [document.querySelector('.topbar'), dom.sidebar, dom.sidebarToggle, document.querySelector('.player-stage'), dom.guidePanel]) { if (node && !node.inert) { node.setAttribute('inert', ''); node.setAttribute('data-detail-inert', ''); } }
  var modal = dom.programDetailModal;
  var card = document.createElement('article');
  card.className = 'program-detail-card';
  var header = document.createElement('header');
  header.className = 'program-detail-header';
  var time = document.createElement('div');
  time.className = 'program-detail-time';
  time.innerHTML = `<strong>${formatTime(program.start)}</strong><span>–</span><strong>${formatTime(program.stop)}</strong>`;
  var closeBtn = document.createElement('button');
  closeBtn.className = 'program-detail-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', programDetailText('close'));
  closeBtn.addEventListener('click', closeProgramDetail);
  var date = document.createElement('p');
  date.className = 'program-detail-date';
  date.textContent = programDateLabel(program);
  var title = document.createElement('h3');
  title.textContent = program.title;
  var channelLine = document.createElement('p');
  channelLine.className = 'program-detail-channel';
  channelLine.textContent = channel?.name || program.channelName || '';
  header.append(time, closeBtn, date, title, channelLine);
  var body = document.createElement('div');
  body.className = 'program-detail-body';
  var desc = document.createElement('p');
  desc.textContent = program.desc || t('noProgram');
  body.append(desc);
  var meta = document.createElement('dl');
  meta.className = 'program-detail-meta';
  [
    [programDetailText('duration'), programDurationLabel(program)],
    [programDetailText('episode'), program.episode],
    [programDetailText('category'), program.category],
    [programDetailText('date'), program.date]
  ].forEach(function(pair) {
    if (!pair[1]) return;
    var item = document.createElement('div');
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    dt.textContent = pair[0];
    dd.textContent = pair[1];
    item.append(dt, dd);
    meta.append(item);
  });
  card.append(header, body);
  if (meta.children.length) card.append(meta);
  modal.replaceChildren(card);
  modal.hidden = false;
  document.querySelector('.content')?.classList.add('program-detail-active');
  closeBtn.focus();
}
function openCurrentProgramDetail() {
  var channel = selectedChannel();
  if (!channel) return;
  var program = currentProgram(channel);
  if (program) openProgramDetail(program, channel);
}
function renderAll() { translateUi(); renderSourceLists(); renderGroupTabs(); renderChannels(); if (state.epgVisible) renderGuide(); }

function stopVideoJs() { if (state.videoJsPlayer) { state.videoJsPlayer.pause(); try { state.videoJsPlayer.reset(); } catch {} } }
function stopArtPlayer() { if (state.artPlayer) { try { state.artPlayer.destroy(); } catch {} state.artPlayer = null; } dom.artPlayerHost.style.display = 'none'; }
function stopJPlayer() {
  if (!dom.jPlayerHost) return;
  try { if (state.jPlayerReady && window.jQuery) window.jQuery(dom.jPlayerHost).jPlayer('destroy'); } catch {}
  state.jPlayerReady = false;
  dom.jPlayerHost.innerHTML = '';
  dom.jPlayerHost.style.display = 'none';
}
function destroyHls() {
  if (state.hls) { try { state.hls.destroy(); } catch {} state.hls = null; }
  if (state.mpegtsPlayer) { try { state.mpegtsPlayer.destroy(); } catch {} state.mpegtsPlayer = null; }
  if (state.flvPlayer) { try { state.flvPlayer.destroy(); } catch {} state.flvPlayer = null; }
}
function stopInternalPlayers() { window.TCLVNative?.stopExternal?.().catch(() => {}); globalThis.TCLVAndroidPlayer?.stop(); stopVideoJs(); stopArtPlayer(); stopJPlayer(); destroyHls(); dom.video.pause(); if (dom.qualityControl) dom.qualityControl.hidden = true; }
function showHtmlVideo() { dom.video.style.display = 'block'; dom.artPlayerHost.style.display = 'none'; if (dom.jPlayerHost) dom.jPlayerHost.style.display = 'none'; }
function getStreamType(url) {
  var raw = String(url || '');
  if (/^rtmps?:\/\//i.test(raw)) return 'rtmp';
  if (/^rtsps?:/i.test(raw)) return 'rtsp';
  var clean = raw.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'hls';
  if (clean.endsWith('.flv')) return 'flv';
  if (clean.endsWith('.ts')) return 'ts';
  if (clean.endsWith('.mp4') || clean.endsWith('.mpv')) return 'mp4';
  if (clean.endsWith('.webm')) return 'webm';
  return 'hls';
}
function guessMimeType(url) { var t = getStreamType(url); if (t === 'hls') return 'application/x-mpegURL'; if (t === 'mp4') return 'video/mp4'; if (t === 'webm') return 'video/webm'; if (t === 'flv') return 'video/x-flv'; return 'application/x-mpegURL'; }
const assetLoads = new Map();
function ensureAsset(id, sources, style) {
  if (assetLoads.has(id)) return assetLoads.get(id);
  const pending = (async function() {
    for (const source of sources) {
      try {
        await new Promise((resolve, reject) => {
          const element = document.createElement(style ? 'link' : 'script');
          if (style) { element.rel = 'stylesheet'; element.href = source; } else element.src = source;
          element.dataset.loaderId = id;
          element.onload = resolve;
          element.onerror = () => { element.remove(); reject(new Error('Asset unavailable')); };
          document.head.append(element);
        });
        return;
      } catch { /* Try the next bundled source. */ }
    }
    throw new Error('Asset could not be loaded');
  })();
  assetLoads.set(id, pending); pending.catch(() => assetLoads.delete(id)); return pending;
}
function ensureScript(id, sources) { return ensureAsset(id, sources, false); }
function ensureStyle(id, sources) { return ensureAsset(id, sources, true); }
function assetOrder(local) { return [local]; }
async function ensureVideoJs() { if (window.videojs) return; await ensureStyle('videojs-css', assetOrder('./vendor/video.js/video-js.min.css','https://vjs.zencdn.net/8.21.1/video-js.min.css')); await ensureScript('videojs-js', assetOrder('./vendor/video.js/video.min.js','https://vjs.zencdn.net/8.21.1/video.min.js')); }
async function ensureArtPlayer() { if (window.Artplayer) return; await ensureScript('artplayer-js', assetOrder('./vendor/artplayer/artplayer.js','https://cdn.jsdelivr.net/npm/artplayer@5/dist/artplayer.js')); }
async function ensureHls() { if (window.Hls) return; await ensureScript('hls-js', assetOrder('./vendor/hls.js/hls.min.js', 'https://cdn.jsdelivr.net/npm/hls.js@latest')); }
async function ensureMpegts() { if (window.mpegts) return; await ensureScript('mpegts-js', assetOrder('./vendor/mpegts.js/mpegts.min.js', 'https://cdn.jsdelivr.net/npm/mpegts.js@latest/dist/mpegts.min.js')); }
async function ensureFlvJs() { if (window.flvjs) return; await ensureScript('flvjs-js', assetOrder('./vendor/flv.js/flv.min.js', 'https://cdn.jsdelivr.net/npm/flv.js@1.6.2/dist/flv.min.js')); }
async function ensureJPlayer() {
  if (!window.jQuery) await ensureScript('jquery-js', assetOrder('./vendor/jquery/jquery.min.js', 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js'));
  if (window.jQuery?.fn?.jPlayer) return;
  await ensureScript('jplayer-js', assetOrder('./vendor/jplayer/jquery.jplayer.min.js', 'https://cdn.jsdelivr.net/npm/jplayer@2.9.2/dist/jplayer/jquery.jplayer.min.js'));
}
var _messageTimer = 0;
function showMessage(message, duration) {
  dom.playerMessage.textContent = message;
  dom.playerMessage.style.display = 'block';
  clearTimeout(_messageTimer);
  var ms = duration != null ? duration : 6000;
  if (ms > 0) _messageTimer = setTimeout(hideMessage, ms);
}
function hideMessage() { clearTimeout(_messageTimer); dom.playerMessage.style.display = 'none'; dom.playerMessage.textContent = ''; }
function streamUrl(url) {
  if (needsProxy(url)) return proxyUrl(url);
  if (isBlockedWebStream(url)) throw new Error(t('webStreamHint'));
  return url;
}
function hlsConfig(url, forceProxy) {
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
  if (getPlatform() === 'android') {
    // Lower memory/CPU pressure for weak/older Android TV SoCs: a 120s max
    // buffer holds a lot of decoded/queued segment data on a 1GB-RAM box,
    // and low-latency mode's part-manifest bookkeeping isn't useful for
    // typical IPTV restreams anyway.
    cfg.maxMaxBufferLength = 60;
    cfg.maxBufferLength = 20;
    cfg.lowLatencyMode = false;
  }
  if ((forceProxy && canProxyStreams()) || needsProxy(url) || getPlatform() === 'web-https') {
    cfg.xhrSetup = function(xhr, u) {
      if (isBlockedWebStream(u)) throw new Error(t('webStreamHint'));
      if ((forceProxy && canProxyStreams()) || needsProxy(u)) {
        xhr.open('GET', proxyUrl(u), true);
        Object.defineProperty(xhr, 'responseURL', { get: function() { return u; } });
      }
    };
  }
  return cfg;
}
function canUseProxyFallback(url, forceProxy) {
  return !forceProxy && getPlatform() === 'web-https' && canProxyStreams() && /^https?:\/\//i.test(String(url || ''));
}
function tryHlsPlayback(url, forceProxy) {
  destroyHls();
  var hls = new window.Hls(hlsConfig(url, forceProxy));
  var reconnectTimer = null;
  var reconnects = 0;
  state.hls = hls;
  hls.on(window.Hls.Events.ERROR, function(_e, data) {
    if (!data.fatal) return;
    if (state.hls !== hls) return;
    if (data.type === 'networkError' && canUseProxyFallback(url, forceProxy)) {
      clearTimeout(reconnectTimer);
      destroyHls();
      showMessage(t('reconnecting'));
      tryHlsPlayback(url, true);
      return;
    }
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
    dom.video.removeAttribute('src'); dom.video.load();
    setStreamStatus(state.selectedChannelId, 'error');
    showMessage(data.type === 'networkError' ? streamErrorMsg() : t('html5Notice'), 0);
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
function tryFlvPlayback(url) {
  destroyHls();
  if (!window.flvjs?.isSupported()) { showMessage(t('html5Notice')); return; }
  state.flvPlayer = window.flvjs.createPlayer({
    type: 'flv',
    isLive: true,
    url: streamUrl(url)
  });
  state.flvPlayer.attachMediaElement(dom.video);
  state.flvPlayer.load();
  safeAutoplay(dom.video);
}
function buildQualityMenu() {
  if (!dom.qualitySelect || !dom.qualityControl) return;
  const native = globalThis.TCLVAndroidPlayer?.active;
  const parent = dom.playerSelect.closest('.settings-body');
  if (parent && dom.qualityControl.parentElement !== parent) parent.append(dom.qualityControl);
  dom.qualityControl.classList.add('settings-quality');
  dom.qualityControl.dataset.label = t('labelQuality'); dom.qualitySelect.setAttribute('aria-label', t('labelQuality'));
  const levels = native ? (state.nativeQualities || []).map(height => ({ height })) : state.hls?.levels || [];
  dom.qualitySelect.replaceChildren();
  if (!levels.length) { dom.qualityControl.hidden = true; return; }
  const auto = document.createElement('option'); auto.value = '-1'; auto.textContent = t('qualityNative'); dom.qualitySelect.append(auto);
  levels.forEach((level, index) => { const option = document.createElement('option'); option.value = String(native ? level.height : index); option.textContent = level.height ? level.height + 'p' : Math.round(level.bitrate / 1000) + ' kbps'; dom.qualitySelect.append(option); });
  dom.qualitySelect.value = String(native ? state.nativeQuality || -1 : state.hls.currentLevel ?? -1); dom.qualityControl.hidden = false;
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
let nativeQueueVersion = null, nativeQueue = [];
function nativeChannelMetadata(channel, maximum = 48) {
  const now = Date.now();
  const programmes = (maximum > 0 ? findPrograms(channel).filter(p => p.stop > now && p.start < now + 86400000).slice(0, maximum) : [])
    .map(p => ({ title: p.title.slice(0, 512), start: +p.start, stop: +p.stop }));
  return { id: channel.id, name: channel.name, programme: currentProgram(channel)?.title || 'TCLVPlayer', programmes,
    logo: sanitizeLogoUrl(channel.logo) || state.logoResolved[channelLogoCacheKey(channel)] || '' };
}
function refreshNativeMetadata() {
  if (getPlatform() !== 'android' || !globalThis.TCLVAndroidPlayer?.active || nativeQueueVersion?.startsWith('catchup:')) return;
  const channel = selectedChannel();
  if (channel) void globalThis.TCLVAndroidPlayer.metadata(nativeChannelMetadata(channel)).catch(() => {});
}
async function playNativeAndroid(channel) {
  stopVideoJs(); stopArtPlayer(); stopJPlayer(); destroyHls(); dom.video.pause(); dom.video.removeAttribute('src'); dom.video.load();
  dom.video.style.display = 'none';
  const isLiveChannel = state.channels.some(ch => ch.id === channel.id && ch.url === channel.url);
  const queue = isLiveChannel ? state.channels : [channel];
  try {
    const version = isLiveChannel ? state.activePlaylistId + ':' + playlistGeneration : 'catchup:' + hashCode(channel.url);
    if (nativeQueueVersion !== version) {
      // Bound background programme metadata even for unusually large playlists.
      let budget = 16000;
      const selected = nativeChannelMetadata(channel); budget -= selected.programmes.length;
      nativeQueue = queue.map(ch => {
        const metadata = ch.id === channel.id ? selected : nativeChannelMetadata(ch, Math.max(0, Math.min(48, budget)));
        if (ch.id !== channel.id) budget -= metadata.programmes.length;
        return { ...metadata, url: ch.url, type: getStreamType(ch.url) };
      }); nativeQueueVersion = version;
    }
    await globalThis.TCLVAndroidPlayer.start(channel, nativeQueue, version);
    refreshNativeMetadata();
    buildQualityMenu(); hideMessage();
  } catch { setStreamStatus(channel.id, 'error'); showMessage(t('streamUnavailable')); }
}
async function playExternalAndroid(channel) {
  if (!window.Capacitor?.Plugins?.TCLVPlayer) { playHtml5(channel); return; }
  stopInternalPlayers();
  var playerName = state.player;
  try {
    setStreamStatus(channel.id, 'ok');
    await window.Capacitor.Plugins.TCLVPlayer.openExternalPlayer({ player: playerName, url: channel.url });
  } catch {
    setStreamStatus(channel.id, 'error');
    syncAndroidPlaybackActive(false);
    playHtml5(channel);
  }
}
async function playExternalDesktop(channel) {
  if (!window.TCLVNative?.openExternal) { showMessage(t('optionalMissing')); return; }
  try {
    stopInternalPlayers();
    await window.TCLVNative.openExternal(state.player, channel.url);
    setStreamStatus(channel.id, 'ok');
  } catch (e) { showMessage(e.message || streamErrorMsg()); }
}
async function playHtml5(channel) {
  stopInternalPlayers(); showHtmlVideo();
  dom.video.removeAttribute('src'); dom.video.load();
  dom.video.muted = false; dom.video.volume = 1;
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
    var finalUrl = streamUrl(channel.url);
    dom.video.src = finalUrl;
    dom.video.addEventListener('canplay', function() { safeAutoplay(dom.video); }, { once: true });
    dom.video.addEventListener('error', function() { showMessage(streamErrorMsg()); }, { once: true });
    dom.video.load();
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
      var startVideoJsHls = function(forceProxy) {
        destroyHls();
        var hls = new window.Hls(hlsConfig(channel.url, forceProxy));
        state.hls = hls;
        hls.on(window.Hls.Events.ERROR, function(_e, data) {
          if (!data.fatal) return;
          if (state.hls === hls) destroyHls();
          if (data.type === 'networkError' && canUseProxyFallback(channel.url, forceProxy)) { showMessage(t('reconnecting')); startVideoJsHls(true); return; }
          dom.video.removeAttribute('src'); dom.video.load(); setStreamStatus(channel.id, 'error'); showMessage(streamErrorMsg());
        });
        hls.loadSource(channel.url);
        hls.attachMedia(state.videoJsPlayer.tech({ IWillNotUseThisInPlugins: true }).el());
        hls.on(window.Hls.Events.MANIFEST_PARSED, function() { state.videoJsPlayer.play()?.catch?.(function() {}); buildQualityMenu(); });
      };
      startVideoJsHls(false);
    } else {
      state.videoJsPlayer.src({ src: streamUrl(channel.url), type: guessMimeType(channel.url) });
      state.videoJsPlayer.play()?.catch?.(() => showMessage(t('html5Notice')));
    }
  } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); }
}
async function playFlvJs(channel) {
  var type = getStreamType(channel.url);
  if (type === 'rtmp' || type === 'rtsp') { showMessage(t('rtmpUnsupported')); return; }
  try {
    stopInternalPlayers(); showHtmlVideo();
    dom.video.removeAttribute('src'); dom.video.load();
    dom.video.muted = false; dom.video.volume = 1;
    if (type === 'hls') { await playHtml5(channel); return; }
    if (type === 'ts') { await ensureMpegts(); if (window.mpegts?.isSupported()) { tryMpegtsPlayback(channel.url); return; } }
    if (type === 'flv') { await ensureFlvJs(); tryFlvPlayback(channel.url); return; }
    dom.video.src = streamUrl(channel.url);
    dom.video.addEventListener('canplay', function() { safeAutoplay(dom.video); }, { once: true });
    dom.video.load();
  } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); }
}
async function playJPlayer(channel) {
  var type = getStreamType(channel.url);
  if (type === 'rtmp' || type === 'rtsp') { showMessage(t('rtmpUnsupported')); return; }
  if (type === 'hls' || type === 'ts' || type === 'flv') { await playHtml5(channel); return; }
  try {
    stopInternalPlayers();
    await ensureJPlayer();
    dom.video.removeAttribute('src'); dom.video.load();
    dom.video.style.display = 'none';
    dom.artPlayerHost.style.display = 'none';
    dom.jPlayerHost.style.display = 'block';
    var $host = window.jQuery(dom.jPlayerHost);
    $host.jPlayer({
      ready: function() {
        state.jPlayerReady = true;
        var media = {};
        var finalUrl = streamUrl(channel.url);
        if (type === 'webm') { media.webmv = finalUrl; }
        else { media.m4v = finalUrl; }
        $host.jPlayer('setMedia', media).jPlayer('play');
        setStreamStatus(channel.id, 'ok');
      },
      error: function() {
        setStreamStatus(channel.id, 'error');
        showMessage(streamErrorMsg());
      },
      supplied: 'm4v, webmv, m3u8v',
      solution: 'html',
      cssSelectorAncestor: '',
      size: { width: '100%', height: '100%' },
      useStateClassSkin: false,
      autoBlur: false,
      smoothPlayBar: true,
      keyEnabled: false
    });
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
        var startArtHls = function(forceProxy) {
          destroyHls();
          var hls = new window.Hls(hlsConfig(channel.url, forceProxy));
          state.hls = hls;
          hls.on(window.Hls.Events.ERROR, function(_e, data) {
            if (!data.fatal) return;
            if (state.hls === hls) destroyHls();
            if (data.type === 'networkError' && canUseProxyFallback(channel.url, forceProxy)) { showMessage(t('reconnecting')); startArtHls(true); return; }
            stopArtPlayer(); showHtmlVideo(); setStreamStatus(channel.id, 'error'); showMessage(streamErrorMsg());
          });
          hls.loadSource(channel.url);
          hls.attachMedia(videoEl);
          hls.on(window.Hls.Events.MANIFEST_PARSED, function() { buildQualityMenu(); });
        };
        startArtHls(false);
      }
    } : undefined;
    if (state.artPlayer) { try { state.artPlayer.destroy(); } catch {} state.artPlayer = null; }
    state.artPlayer = new window.Artplayer({ container: dom.artPlayerHost, url: streamUrl(channel.url), type: type === 'hls' ? 'm3u8' : '', customType: customType, autoplay: true, isLive: true, muted: false, volume: 1, setting: true, fullscreen: true, fullscreenWeb: true });
    if (state.artPlayer?.on) {
      ['ready', 'play', 'playing', 'video:playing', 'video:loadeddata', 'video:canplay'].forEach(function(eventName) {
        state.artPlayer.on(eventName, function() {
          if (state.selectedChannelId === channel.id) setStreamStatus(channel.id, 'ok');
        });
      });
      ['error', 'video:error'].forEach(function(eventName) {
        state.artPlayer.on(eventName, function() {
          if (state.selectedChannelId === channel.id) setStreamStatus(channel.id, 'error');
        });
      });
      state.artPlayer.on('ready', function() {
        if (state.artPlayer) {
          state.artPlayer.muted = false;
          state.artPlayer.volume = 1;
        }
      });
    }
  } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); }
}
function setPlayerActive(active) {
  var stage = document.querySelector('.player-stage');
  if (stage) stage.classList.toggle('no-video', !active);
  syncAndroidPlaybackActive(active);
}
let playbackGeneration = 0;
async function playChannel(channel) {
  const run = ++playbackGeneration;
  const player = state.player;
  if (!['native', 'vlc', 'mpv'].includes(player)) {
    try {
      if (player === 'videojs') await ensureVideoJs();
      if (player === 'artplayer') await ensureArtPlayer();
      if (player === 'jplayer') await ensureJPlayer();
      const type = getStreamType(channel.url);
      if (type === 'hls') await ensureHls();
      if (type === 'ts') await ensureMpegts();
      if (type === 'flv' && player === 'flvjs') await ensureFlvJs();
    } catch { if (run === playbackGeneration) showMessage(t('optionalMissing')); return; }
    if (run !== playbackGeneration) return;
  }
  if (isBlockedWebStream(channel.url)) {
    stopInternalPlayers();
    dom.video.removeAttribute('src'); dom.video.load();
    setPlayerActive(false);
    setStreamStatus(channel.id, 'error');
    showMessage(t('webStreamHint'), 0);
    return;
  }
  hideMessage(); safeSet('tclv.lastChannel', channel.id); safeSet('tclv.lastChannel.' + state.activePlaylistId, channel.id); setPlayerActive(true);
  delete state.streamStatus[channel.id]; updateChannelStatusDot(channel.id);
  var expectedId = channel.id;
  bindVideoStatusEvents(dom.video, expectedId);
  if (state.player === 'native') {
    if (getPlatform() === 'android') return playNativeAndroid(channel);
    return playHtml5(channel);
  }
  if (state.player === 'mpv' || state.player === 'vlc') {
    if (getPlatform() === 'android') return playExternalAndroid(channel);
    if (getPlatform() === 'electron') return playExternalDesktop(channel);
    state.player = fallbackPlayer(getPlatform()); saveCurrentPlayer(); dom.playerSelect.value = state.player; syncCustomSelects();
  }
  if (state.player === 'videojs') return playVideoJs(channel);
  if (state.player === 'artplayer') return playArtPlayer(channel);
  if (state.player === 'flvjs') return playFlvJs(channel);
  if (state.player === 'jplayer') return playJPlayer(channel);
  return playHtml5(channel);
}
function showSwitchOverlay(channel) {
  const now = currentProgram(channel);
  const next = nextProgram(channel);
  const img = document.createElement('img');
  setLogoImage(img, channel);
  const details = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = channel.name;
  const nowLine = document.createElement('p');
  nowLine.innerHTML = `<strong>${t('now')}:</strong> ${escapeHtml(now?.title || t('noProgram'))}`;
  const nextLine = document.createElement('p');
  nextLine.innerHTML = `<strong>${t('next')}:</strong> ${escapeHtml(next?.title || t('noProgram'))}`;
  details.append(title, nowLine, nextLine);
  const infoButton = document.createElement('button');
  infoButton.className = 'program-info-button';
  infoButton.type = 'button';
  infoButton.textContent = 'i';
  infoButton.title = 'Info';
  infoButton.setAttribute('aria-label', 'Info');
  infoButton.addEventListener('click', function(event) {
    event.stopPropagation();
    openCurrentProgramDetail();
  });
  dom.switchOverlay.replaceChildren(img, details, infoButton);
  dom.switchOverlay.classList.add('show');
  clearTimeout(state.overlayTimer);
  state.overlayTimer = setTimeout(() => dom.switchOverlay.classList.remove('show'), 5200);
}
function selectChannel(id) { const channel = state.channels.find((item) => item.id === id); if (!channel) return; if (state.multiview && state.mvSlot === 1) { state.mvChannel1 = channel; playInSlot1(channel); updateChannelSelectionUi(); return; } state.selectedChannelId = id; playChannel(channel); showSwitchOverlay(channel); updateChannelSelectionUi(); requestAnimationFrame(() => { const active = dom.channelGrid.querySelector('.channel-card.active'); active?.scrollIntoView({ block: 'nearest', behavior: getPlatform() === 'android' ? 'instant' : 'smooth' }); }); }
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
  return canProxyStreams() && isMixedContent(url);
}
function isMixedContent(url) { return location.protocol === 'https:' && String(url || '').startsWith('http://'); }
function usingVercelProxy() {
  if (isNativePlatform() || !state.corsProxy) return false;
  try { return new URL(state.corsProxy, location.origin).pathname === '/api/proxy'; } catch { return false; }
}
function canProxyStreams() {
  if (isNativePlatform() || !state.corsProxy) return false;
  try {
    var url = new URL(state.corsProxy, location.origin);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname === '/proxy';
  } catch { return false; }
}
function isBlockedWebStream(url) {
  if (isNativePlatform()) return false;
  try {
    var parsed = new URL(url, location.origin);
    if (parsed.origin === location.origin && parsed.pathname === '/api/proxy') return true;
  } catch {}
  return getPlatform() === 'web-https' && isMixedContent(url) && !canProxyStreams();
}
function streamErrorMsg() { return t('streamUnavailable') + (!isNativePlatform() ? ' ' + t('webStreamHint') : ''); }
function proxyUrl(url) { if (isNativePlatform() || !state.corsProxy) return url; return state.corsProxy + encodeURIComponent(url); }
function normalizeDownloadUrl(url) {
  var raw = String(url || '').trim();
  try {
    var parsed = new URL(raw);
    var host = parsed.hostname.toLowerCase();
    if (host === 'drive.google.com') {
      var fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      var id = fileMatch?.[1] || parsed.searchParams.get('id');
      if (id) return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
    }
    if (host === 'www.dropbox.com' || host === 'dropbox.com') {
      parsed.hostname = 'dl.dropboxusercontent.com';
      parsed.searchParams.delete('dl');
      parsed.searchParams.delete('raw');
      return parsed.toString();
    }
  } catch {}
  return raw;
}
function sourceNameFromUrl(url, fallback) {
  try {
    var parsed = new URL(url);
    var driveId = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || parsed.searchParams.get('id');
    if (parsed.hostname.includes('drive.google.com') && driveId) return 'Google Drive ' + driveId.slice(0, 8);
    var name = decodeURIComponent((parsed.pathname.split('/').pop() || '').trim());
    return name || fallback;
  } catch { return fallback; }
}
function playlistTypeFromSource(source, text) {
  var lowered = String(source || '').toLowerCase();
  if (lowered.includes('.xspf') || /<(?:[\w.-]+:)?playlist\b/.test(String(text || ''))) return 'xspf';
  return 'm3u';
}
async function decodeGzipBase64(base64) {
  var binary = globalThis.atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new globalThis.TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'undefined') throw new Error('Update Android System WebView to read gzip sources');
  var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new globalThis.TextDecoder().decode(await sourceBytes(new Response(stream)));
}
async function fetchViaCapacitorHttp(url, options = {}) {
  var isGz = /\.gz$/i.test(new URL(url).pathname);
  var response = await window.Capacitor.Plugins.CapacitorHttp.request({
    url: url,
    method: 'GET',
    responseType: isGz ? 'blob' : 'text', connectTimeout: 15000, readTimeout: 45000,
    headers: options.forceReload ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}
  });
  if (response.status && (response.status < 200 || response.status >= 400)) {
    throw new Error(response.status + ' ' + (response.url || url));
  }
  if (typeof response.data === 'string' && response.data.length > 64 * 1024 * 1024) throw new Error('Source exceeds 64 MiB');
  if (isGz) return decodeGzipBase64(response.data);
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}
var WEB_SOURCE_CACHE = 'tclv.sources.v1';
var MAX_WEB_SOURCE_CACHE_BYTES = 8 * 1024 * 1024;
var MAX_WEB_SOURCE_CACHE_ENTRIES = 8;
var webSourceMemory = new Map();
var pendingWebSources = new Map();
async function sourceCacheKey(url) {
  if (!window.caches || !window.crypto?.subtle) return null;
  var digest = await window.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(url));
  var hash = Array.from(new Uint8Array(digest)).map(function(byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  return location.origin + '/.tclv-source-cache/' + hash;
}
async function readWebSourceCache(url) {
  var cached = webSourceMemory.get(url);
  if (cached && cached.expires > Date.now()) return cached.text;
  webSourceMemory.delete(url);
  try {
    var key = await sourceCacheKey(url);
    if (!key) return null;
    var cache = await window.caches.open(WEB_SOURCE_CACHE);
    var response = await cache.match(key);
    if (!response) return null;
    var expires = Number(response.headers.get('X-TCLV-Expires'));
    if (expires <= Date.now() || !expires) { await cache.delete(key); return null; }
    var text = await response.text();
    rememberWebSource(url, { text: text, expires: expires });
    return text;
  } catch { return null; }
}
function rememberWebSource(url, entry) {
  webSourceMemory.delete(url);
  webSourceMemory.set(url, entry);
  if (webSourceMemory.size > MAX_WEB_SOURCE_CACHE_ENTRIES) webSourceMemory.delete(webSourceMemory.keys().next().value);
}
async function writeWebSourceCache(url, text) {
  if (!text || text.length > MAX_WEB_SOURCE_CACHE_BYTES || new Blob([text]).size > MAX_WEB_SOURCE_CACHE_BYTES) return;
  var epg = /<tv(?:\s|>)/i.test(text.slice(0, 2048));
  var expires = Date.now() + (epg ? 6 * 60 * 60 * 1000 : 15 * 60 * 1000);
  rememberWebSource(url, { text: text, expires: expires });
  try {
    var key = await sourceCacheKey(url);
    if (!key) return;
    var cache = await window.caches.open(WEB_SOURCE_CACHE);
    await cache.delete(key);
    await cache.put(key, new Response(text, { headers: { 'X-TCLV-Expires': String(expires) } }));
    var keys = await cache.keys();
    for (var i = 0; i < keys.length - MAX_WEB_SOURCE_CACHE_ENTRIES; i++) await cache.delete(keys[i]);
  } catch {}
}
const MAX_SOURCE_DOWNLOAD = 64 * 1024 * 1024;
async function sourceBytes(response, maximum = MAX_SOURCE_DOWNLOAD) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('Source exceeds 64 MiB');
      chunks.push(value);
    }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
async function decodeWebSourceResponse(response, maximum = MAX_SOURCE_DOWNLOAD) {
  let bytes = await sourceBytes(response, maximum);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error(t('loadError'));
    bytes = await sourceBytes(new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))), maximum);
  }
  return new globalThis.TextDecoder().decode(bytes);
}
async function fetchWebSource(url, options) {
  if (!isMixedContent(url)) {
    var direct;
    try { direct = await fetch(url, { signal: globalThis.AbortSignal?.timeout?.(45000), cache: options.forceReload ? 'reload' : 'no-cache' }); } catch {}
    if (direct) {
      if (!direct.ok) throw new Error(direct.status + ' ' + direct.statusText);
      return decodeWebSourceResponse(direct);
    }
  }
  if (!state.corsProxy) throw new Error(t('corsNeeded'));
  var target = proxyUrl(url);
  if (usingVercelProxy()) {
    var parsed = new URL(target, location.origin);
    parsed.searchParams.set('resource', 'source');
    if (options.forceReload) parsed.searchParams.set('refresh', '1');
    target = parsed.href;
  }
  var response;
  try { response = await fetch(target, { signal: globalThis.AbortSignal?.timeout?.(45000), cache: options.forceReload ? 'reload' : 'default' }); } catch {}
  if (response?.ok) return decodeWebSourceResponse(response);
  if (!usingVercelProxy() && !canProxyStreams()) {
    try { response = await fetch(state.corsProxy + url, { signal: globalThis.AbortSignal?.timeout?.(45000) }); } catch {}
    if (response?.ok) return decodeWebSourceResponse(response);
  }
  if (response?.status === 413) throw new Error(t('sourceTooLarge'));
  if (response?.status === 403 || response?.status === 415) throw new Error(t('proxyBlocked'));
  throw new Error(t('loadError') + ' (' + (response?.status || 'network') + ')');
}
async function loadTextFromUrl(url, options = {}) {
  url = normalizeDownloadUrl(String(url || '').trim());
  if (getPlatform() === 'android' && window.Capacitor?.Plugins?.CapacitorHttp) {
    // Android's WebView still enforces CORS on fetch()/XHR even though this
    // is a "native" platform — unlike Electron (which strips CORS headers
    // via a session interceptor), nothing here bypasses it. Many EPG/playlist
    // hosts don't send Access-Control-Allow-Origin, so a direct fetch() just
    // fails with an opaque "Failed to fetch". Capacitor's native HTTP bridge
    // performs the request outside the WebView and isn't subject to CORS.
    return await fetchViaCapacitorHttp(url, options);
  }
  if (isNativePlatform()) {
    var response = await fetch(url, { signal: globalThis.AbortSignal?.timeout?.(45000), cache: options.forceReload ? 'reload' : 'no-cache' });
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    return decodeWebSourceResponse(response);
  }
  var pendingKey = url + (options.forceReload ? ':refresh' : '');
  if (pendingWebSources.has(pendingKey)) return pendingWebSources.get(pendingKey);
  var pending = (async function() {
    if (!options.forceReload) {
      var cached = await readWebSourceCache(url);
      if (cached !== null) return cached;
    }
    var text = await fetchWebSource(url, options);
    await writeWebSourceCache(url, text);
    return text;
  })();
  pendingWebSources.set(pendingKey, pending);
  try { return await pending; } finally { pendingWebSources.delete(pendingKey); }
}
async function loadPlaylistText(text, sourceName = '') { try { const channels = playlistChannels(text, sourceName); state.channels = channels; ++epgChannelsGeneration; const saved = safeGet('tclv.lastChannel.' + state.activePlaylistId, safeGet('tclv.lastChannel')); state.selectedChannelId = channels.some(ch => ch.id === saved) ? saved : channels[0]?.id || null; epgProgramCache.clear(); renderAll(); if (state.epgSources.length) await rebuildMergedEpg(); if (globalThis.TCLVAndroidPlayer?.active) globalThis.TCLVAndroidPlayer.refresh(); setTimeout(initLogoIndex, 1000); if (state.selectedChannelId) showSwitchOverlay(selectedChannel()); showMessage(`${t('playlistLoaded')}: ${channels.length}`); } catch (error) { showMessage(`${t('loadError')} ${error.message || ''}`); } }
async function loadEpgText(text) { try { state.epg = parseXmlTv(text); reindexEpg(); renderAll(); showMessage(`${t('epgLoaded')}: ${state.epg.size}`); } catch (error) { showMessage(`${t('loadError')} ${error.message || ''}`); } }
async function readFile(file) {
  const maximum = /\.json$/i.test(file.name) ? 256 * 1024 * 1024 : MAX_SOURCE_DOWNLOAD;
  if (file.size > maximum) throw new Error('File exceeds the supported size');
  return decodeWebSourceResponse(new Response(file), maximum);
}
function xmlTvDate(date) { const pad = (value) => String(value).padStart(2, '0'); const offsetMinutes = -date.getTimezoneOffset(); const sign = offsetMinutes >= 0 ? '+' : '-'; const absolute = Math.abs(offsetMinutes); const offset = `${sign}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`; return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())} ${offset}`; }
let persistSourcesPending = Promise.resolve();
function persistSources() {
  const snapshot = { playlists: state.playlists.map(exportableSourceRecord), epgSources: state.epgSources.map(source => ({ ...exportableSourceRecord(source), nativeCache: source.nativeCache })) };
  persistSourcesPending = persistSourcesPending.catch(function() {}).then(() => globalThis.TCLVStorage.saveSnapshot(snapshot));
  persistSourcesPending.catch(() => showMessage(state.language === 'sk' ? 'Úložisko je plné alebo nedostupné. Exportujte dáta do súboru.' : 'Storage unavailable or full. Export your data to a file.', 0));
  return persistSourcesPending;
}
function savePlaylistMeta() { return persistSources(); }
function saveEpgMeta() { return persistSources(); }
function addPlaylistRecord(record) {
  if (record.text) playlistChannels(record.text, record.name);
  state.playlists.unshift(record); state.activePlaylistId = record.id;
  savePlaylistMeta(); safeSet('tclv.activePlaylistId', record.id); renderSourceLists();
}
let playlistGeneration = 0;
let epgChannelsGeneration = 0;
async function activatePlaylist(id, options = {}) {
  const item = state.playlists.find(p => p.id === id);
  if (!item) return;
  const run = ++playlistGeneration;
  const previousActiveId = state.activePlaylistId;
  state.activePlaylistId = id; safeSet('tclv.activePlaylistId', id);
  try {
    if (item.origin !== 'local' && (!item.text || options.forceReload || !item.fetchedAt || Date.now() - item.fetchedAt > 15 * 60 * 1000)) {
      try {
        const text = await loadTextFromUrl(item.source, { forceReload: options.forceReload });
        if (run !== playlistGeneration) return;
        playlistChannels(text, item.name);
        item.text = text; item.fetchedAt = Date.now(); item.type = playlistTypeFromSource(item.source, text); savePlaylistMeta();
      } catch (error) { if (!item.text) throw error; }
    }
    if (run !== playlistGeneration) return;
    if (!item.text) throw new Error(state.language === 'sk' ? 'Vyberte pôvodný lokálny súbor.' : 'Select the original local file.');
    playlistChannels(item.text, item.name);
    await loadPlaylistText(item.text, item.name);
    if (run !== playlistGeneration) return;
    if (state.epgSources.length) await reloadEpgSources();
    await autoLoadEpgFromPlaylist(item.text, run);
  } catch (error) { if (run === playlistGeneration) { state.activePlaylistId = state.playlists.some(p => p.id === previousActiveId) ? previousActiveId : null; safeSet('tclv.activePlaylistId', state.activePlaylistId || ''); showMessage(error.message === t('playlistInvalid') ? error.message : t('loadError')); } }
  if (run === playlistGeneration) renderSourceLists();
}
async function removePlaylist(id) {
  state.playlists = state.playlists.filter(p => p.id !== id);
  if (state.activePlaylistId === id) {
    ++playlistGeneration;
    state.activePlaylistId = state.playlists[0]?.id || null;
    safeSet('tclv.activePlaylistId', state.activePlaylistId || '');
    state.channels = []; state.selectedChannelId = null;
    stopInternalPlayers(); destroySlot1(); setPlayerActive(false); renderAll();
    if (state.activePlaylistId) await activatePlaylist(state.activePlaylistId);
  }
  savePlaylistMeta(); renderSourceLists();
}
function removeEpgSource(id) { state.epgSources = state.epgSources.filter(e => e.id !== id); saveEpgMeta(); rebuildMergedEpg(); }
async function toggleEpgSource(id) {
  const item = state.epgSources.find(e => e.id === id);
  if (!item) return;
  item.active = item.active === false;
  if (item.active) await reloadEpgSources();
  saveEpgMeta(); await rebuildMergedEpg();
}
function addEpgRecord(record) {
  if (record.active === undefined) record.active = true;
  if (record.text) record.fetchedAt = Date.now();
  state.epgSources.unshift(record); saveEpgMeta(); renderSourceLists(); rebuildMergedEpg();
}
function parseEpgListTemplate(text) {
  var entries = [];
  String(text || '').split(/\r?\n/).forEach(function(rawLine) {
    var line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    var eqIndex = line.indexOf('=');
    var name, url;
    if (eqIndex > -1) {
      name = line.slice(0, eqIndex).trim();
      url = line.slice(eqIndex + 1).trim();
    } else {
      name = '';
      url = line;
    }
    if (!/^https?:\/\//i.test(url)) return;
    entries.push({ name: name || sourceNameFromUrl(url, 'epg.xml'), url: url });
  });
  return entries;
}
async function importEpgListFile(file) {
  var text = await readFile(file);
  var entries = parseEpgListTemplate(text);
  if (!entries.length) { showMessage(t('epgListEmpty')); return; }
  var added = 0;
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (state.epgSources.some(function(s) { return globalThis.TCLVEpg.sourceKey(s.source) === globalThis.TCLVEpg.sourceKey(entry.url); })) continue;
    addEpgRecord({ id: 'epg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: entry.name, source: entry.url, origin: 'network', active: true });
    added++;
  }
  await reloadEpgSources({ showOnLoad: false });
  showMessage(t('epgListImported') + ': ' + added + '/' + entries.length);
}
function yieldToMain() { return new Promise(function(resolve) { setTimeout(resolve, 0); }); }
let epgGeneration = 0;
let epgWorker;
let epgRequestId = 0;
const epgJobs = new Map();
function parseEpgOffThread(text) {
  if (typeof Worker === 'undefined') return typeof text === 'string' ? Promise.resolve(parseXmlTv(text)) : Promise.reject(new Error('EPG worker unavailable'));
  if (!epgWorker) {
    epgWorker = new Worker('./lib/epg-worker.js');
    epgWorker.onmessage = event => {
      const job = epgJobs.get(event.data.id); if (!job) return;
      epgJobs.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else { const map = new Map(event.data.entries.map(([key, programs]) => [key, programs.map(p => ({ ...p, start: new Date(p.start), stop: new Date(p.stop) }))])); map.stats = event.data.stats; job.resolve(map); }
    };
    epgWorker.onerror = () => { for (const job of epgJobs.values()) job.reject(new Error('EPG worker failed')); epgJobs.clear(); epgWorker.terminate(); epgWorker = null; };
  }
  const id = ++epgRequestId, wanted = new Map();
  for (const channel of state.channels) {
    const country = globalThis.TCLVEpg.country(channel.tvgId) || String(channel.tvgCountry || '').toLowerCase() || globalThis.TCLVEpg.country(channel.tvgName);
    for (const key of channelEpgKeys(channel)) { if (!wanted.has(key)) wanted.set(key, new Set()); wanted.get(key).add(country); }
  }
  return new Promise((resolve, reject) => { epgJobs.set(id, { resolve, reject }); epgWorker.postMessage({ id, ...(typeof text === 'string' ? { text } : { url: text.url }), wanted: [...wanted.keys()], countries: [...wanted].map(([key, countries]) => [key, [...countries]]), pastDays: Math.max(2, ...state.channels.map(ch => Math.min(30, ch.catchupDays || 0))) }); });
}
function epgSourceVersion(source) { return source.nativeCache ? source.nativeCache + ':' + source.fetchedAt : source.text; }
async function epgSourceInput(source) {
  if (!source.nativeCache) return source.text;
  const { path } = await window.Capacitor.Plugins.TCLVPlayer.getEpgCache({ key: source.nativeCache });
  return { url: window.Capacitor.convertFileSrc(path) };
}
async function* nativeEpgText(key) {
  const { path } = await window.Capacitor.Plugins.TCLVPlayer.getEpgCache({ key });
  const response = await fetch(window.Capacitor.convertFileSrc(path));
  if (!response.ok) throw new Error('Cached EPG unavailable');
  const reader = response.body.getReader(), decoder = new globalThis.TextDecoder();
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; yield decoder.decode(value, { stream: true }); }
    const rest = decoder.decode(); if (rest) yield rest;
  } finally { await reader.cancel().catch(() => {}); }
}
function epgSourceStatus(source, parsed) {
  const stats = parsed.stats;
  if (!stats) return;
  source.stats = stats;
  source.status = !stats.programmes ? 'empty' : stats.last < Date.now() ? 'outdated' : stats.first > Date.now() ? 'future' : !parsed.size ? 'unmatched' : !stats.current ? 'noCurrent' : 'ready';
  delete source.error;
}
function epgFailure(error) {
  const message = String(error?.message || '');
  const http = message.match(/\bHTTP (\d{3})\b|^(\d{3})\b/);
  if (http) return 'HTTP ' + (http[1] || http[2]);
  if (message === t('sourceTooLarge')) return '3 MiB (proxy)';
  if (/XMLTV|XML|parser/i.test(message)) return 'XML';
  if (/64 MiB|too large|size limit/i.test(message)) return '64 MiB';
  if (/timed out|timeout|abort/i.test(message)) return 'timeout';
  if (/TLS|certificate|SSL/i.test(message)) return 'TLS';
  if (/cache/i.test(message)) return 'cache';
  return 'network';
}
async function rebuildMergedEpg() {
  const run = ++epgGeneration;
  const playlist = epgChannelsGeneration;
  const active = state.epgSources.filter(source => source.active !== false && (source.text || source.nativeCache));
  const maps = [];
  for (const source of active) {
    if (run !== epgGeneration || playlist !== epgChannelsGeneration) return;
    try {
      const text = epgSourceVersion(source);
      if (!source.parsed || source.parsedText !== text || source.parsedPlaylist !== playlist) {
        if (!source.parsePending || source.pendingText !== text || source.pendingPlaylist !== playlist) {
          source.pendingText = text; source.pendingPlaylist = playlist;
          source.parsePending = epgSourceInput(source).then(parseEpgOffThread);
        }
        const pending = source.parsePending;
        const parsed = await pending;
        if (source.parsePending === pending) source.parsePending = null;
        if (run !== epgGeneration || playlist !== epgChannelsGeneration || epgSourceVersion(source) !== text) return;
        source.parsed = parsed; source.parsedText = text; source.parsedPlaylist = playlist;
        if (source.status !== 'error') epgSourceStatus(source, parsed);
      }
      source.parsed.sourceUrl = source.source; maps.push(source.parsed);
    } catch (error) { source.parsePending = null; source.status = 'error'; source.error = epgFailure(error); }
    await yieldToMain();
  }
  if (run !== epgGeneration || playlist !== epgChannelsGeneration) return;
  state.epg = mergeEpgMaps(maps); reindexEpg(); renderAll(); refreshNativeMetadata();
}
async function autoLoadEpgFromPlaylist(text, generation = playlistGeneration) {
  var urls = extractM3UEpgUrls(text);
  if (!urls.length) return;
  var countries = new Set();
  for (var c = 0; c < state.channels.length; c++) {
    var m = state.channels[c].tvgId?.match(/\.([a-z]{2})$/i);
    if (m) countries.add(m[1].toUpperCase());
  }
  const assigned = new Set(state.channels.map(channel => channel.tvgUrl).filter(Boolean));
  var prioritized = urls;
  if (countries.size) {
    var matched = urls.filter(function(url) {
      var fn = (url.split('/').pop() || '').toUpperCase();
      return [...countries].some(function(c) { return fn.includes('_' + c) || fn.includes(c + '.'); });
    });
    if (matched.length) prioritized = matched.concat(urls.filter(function(u) { return matched.indexOf(u) === -1; }));
  }
  prioritized = [...prioritized.filter(url => assigned.has(url)), ...prioritized.filter(url => !assigned.has(url))];
  var loaded = 0;
  var maxAttempts = Math.min(prioritized.length, 12);
  for (var i = 0; i < maxAttempts; i++) {
    if (generation !== playlistGeneration) return;
    var url = prioritized[i];
    if (loaded >= 3 && !assigned.has(url)) continue;
    if (state.epgSources.some(function(s) { return globalThis.TCLVEpg.sourceKey(s.source) === globalThis.TCLVEpg.sourceKey(url); })) continue;
    const record = { id: 'epg-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: sourceNameFromUrl(url, 'epg.xml'), source: url, origin: 'network', active: true };
    addEpgRecord(record);
    await reloadEpgSources({ onlyId: record.id, showOnLoad: false });
    if (generation !== playlistGeneration) return;
    if (record.parsed?.size) loaded++;
  }
  if (loaded > 0) showMessage(t('epgAutoDetected'));
}
function lockScreen() {
  state.locked = true; globalThis.TCLVAndroidPlayer?.scheduleBounds();
  state.lockTapCount = 0;
  state.lockHoldStarted = false;
  state.lockHoldTriggered = false;
  clearTimeout(state.lockTapTimer);
  clearTimeout(state.lockHoldTimer);
  clearTimeout(state.lockButtonHoldTimer);
  if (dom.lockOverlay) { dom.lockOverlay.hidden = false; dom.lockOverlay.classList.remove('show-unlock'); }
  if (dom.lockButton) dom.lockButton.classList.add('active');
  showMessage(t('locked'));
}
function unlockScreen() {
  state.locked = false; globalThis.TCLVAndroidPlayer?.scheduleBounds();
  state.lockTapCount = 0;
  state.lockHoldStarted = false;
  state.lockHoldTriggered = false;
  clearTimeout(state.lockTapTimer);
  clearTimeout(state.lockHoldTimer);
  clearTimeout(state.lockButtonHoldTimer);
  if (dom.lockOverlay) { dom.lockOverlay.hidden = true; dom.lockOverlay.classList.remove('show-unlock'); }
  if (dom.lockButton) dom.lockButton.classList.remove('active');
  showMessage(t('unlocked'));
}
function revealLockUnlock() {
  if (!state.locked) return;
  dom.lockOverlay?.classList.add('show-unlock');
  clearTimeout(state.lockTapTimer);
  state.lockTapTimer = setTimeout(function() {
    state.lockTapCount = 0;
    dom.lockOverlay?.classList.remove('show-unlock');
  }, 2200);
}
function startLockHold() {
  if (!state.locked) return;
  revealLockUnlock();
  state.lockHoldStarted = true;
  state.lockHoldTriggered = false;
  clearTimeout(state.lockHoldTimer);
  state.lockHoldTimer = setTimeout(function() {
    state.lockHoldTriggered = true;
    unlockScreen();
  }, 2000);
}
function cancelLockHold() {
  clearTimeout(state.lockHoldTimer);
  state.lockHoldStarted = false;
}
function startTopLockHold() {
  clearTimeout(state.lockButtonHoldTimer);
  state.lockHoldTriggered = false;
  state.lockButtonHoldTimer = setTimeout(function() {
    state.lockHoldTriggered = true;
    if (!state.locked) lockScreen();
  }, 2000);
}
function cancelTopLockHold() {
  clearTimeout(state.lockButtonHoldTimer);
  if (!state.lockHoldTriggered && !state.locked) showMessage(t('holdLockHint'), 1800);
}
function isTextEntryTarget(target) {
  var tag = target?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable;
}
function isSelectKey(event) {
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Select' || event.keyCode === 23 || event.keyCode === 66;
}
function isBackKey(event) {
  return event.key === 'Escape' || event.key === 'Backspace' || event.key === 'BrowserBack' || event.key === 'GoBack' || event.key === 'Back' || event.keyCode === 4 || event.keyCode === 461;
}
function isGuideKey(event) {
  return event.key === 'Guide' || event.key === 'TVGuide' || event.key === 'ProgramGuide' || event.keyCode === 172;
}
function isChannelUpKey(event) {
  return event.key === 'PageUp' || event.key === 'ChannelUp' || event.keyCode === 166;
}
function isChannelDownKey(event) {
  return event.key === 'PageDown' || event.key === 'ChannelDown' || event.keyCode === 167;
}
function focusSelectedChannel() {
  const index = state.channels.findIndex(ch => ch.id === state.selectedChannelId);
  if (state.channels.length > 150) { focusChannelIndex(index < 0 ? 0 : index); return; }
  const active = dom.channelGrid.querySelector('.channel-card.active') || dom.channelGrid.querySelector('.channel-card');
  active?.focus();
  active?.scrollIntoView({ block: 'nearest' });
}
function focusGuideItem() {
  if (!state.epgVisible) return;
  requestAnimationFrame(function() {
    const current = dom.epgGuide?.querySelector('.program.current') || dom.epgGuide?.querySelector('.program');
    current?.focus();
  });
}
function selectRelativeChannel(delta) {
  const channels = filteredChannels();
  if (!channels.length) return;
  const idx = channels.findIndex((ch) => ch.id === state.selectedChannelId);
  const base = idx >= 0 ? idx : 0;
  const next = (base + delta + channels.length) % channels.length;
  selectChannel(channels[next].id);
  focusSelectedChannel();
}
function handleBackStep() {
  if (state.locked) {
    revealLockUnlock();
    return true;
  }
  if (dom.catchupModal && !dom.catchupModal.hidden) { closeCatchupModal(); return true; }
  if (dom.programDetailModal && !dom.programDetailModal.hidden) {
    closeProgramDetail();
    return true;
  }
  if (!dom.settingsPanel.hidden) {
    closeSettings();
    return true;
  }
  if (dom.switchOverlay.classList.contains('show')) {
    dom.switchOverlay.classList.remove('show');
    clearTimeout(state.overlayTimer);
    return true;
  }
  if (state.epgVisible) {
    setEpgVisible(false);
    focusSelectedChannel();
    return true;
  }
  if (state.sidebarMode === 'hidden') {
    setSidebarMode('rail', true);
    focusSelectedChannel();
    return true;
  }
  if (state.sidebarMode === 'rail') {
    setSidebarMode('full', true);
    focusSelectedChannel();
    return true;
  }
  return false;
}
function toggleAutostart() {
  state.autostart = !state.autostart;
  safeSet('tclv.autostart', String(state.autostart));
  if (dom.autostartCheck) dom.autostartCheck.checked = state.autostart;
  if (dom.autostartToggle) { dom.autostartToggle.classList.toggle('active', state.autostart); dom.autostartToggle.setAttribute('aria-checked', String(state.autostart)); }
  showMessage(state.autostart ? t('autostartOn') : t('autostartOff'));
  if (window.Capacitor?.Plugins?.TCLVPlayer) {
    window.Capacitor.Plugins.TCLVPlayer.setAutostart({ enabled: state.autostart }).catch(function() {});
  }
}
function syncBackgroundPlaybackNative() {
  if (window.Capacitor?.Plugins?.TCLVPlayer) {
    window.Capacitor.Plugins.TCLVPlayer.setBackgroundPlayback({ enabled: state.backgroundPlayback }).catch(function() {});
  }
}
function toggleBackgroundPlayback() {
  state.backgroundPlayback = !state.backgroundPlayback;
  safeSet('tclv.backgroundPlayback', String(state.backgroundPlayback));
  if (dom.backgroundPlaybackCheck) dom.backgroundPlaybackCheck.checked = state.backgroundPlayback;
  if (dom.backgroundPlaybackToggle) { dom.backgroundPlaybackToggle.classList.toggle('active', state.backgroundPlayback); dom.backgroundPlaybackToggle.setAttribute('aria-checked', String(state.backgroundPlayback)); }
  syncBackgroundPlaybackNative();
  showMessage(state.backgroundPlayback ? t('backgroundPlaybackOn') : t('backgroundPlaybackOff'));
}
function settingsFocusables() {
  if (!dom.settingsPanel) return [];
  return [...dom.settingsPanel.querySelectorAll('button, input, select, a[href], [tabindex]')].filter(function(el) {
    return !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null;
  });
}
function topbarFocusables() {
  return [dom.lockButton, dom.chToggle, dom.epgToggle, dom.menuToggle].filter(function(el) {
    return el && !el.hidden && el.offsetParent !== null;
  });
}
function focusTopbar(fromEnd) {
  var list = topbarFocusables();
  var target = fromEnd ? list[list.length - 1] : list[0];
  target?.focus();
}
function openSettings() {
  dom.settingsPanel.hidden = false; dom.settingsOverlay.hidden = false; dom.menuToggle?.setAttribute('aria-expanded', 'true');
  // Trap D-pad/Tab navigation inside the panel — otherwise focus stays on
  // whatever channel card was selected behind the overlay and arrow keys
  // keep scrolling the (invisible) channel grid instead of the settings UI.
  document.querySelector('.topbar')?.setAttribute('inert', '');
  document.querySelector('.workspace')?.setAttribute('inert', '');
  requestAnimationFrame(function() { settingsFocusables()[0]?.focus(); });
}
function closeSettings() {
  dom.settingsPanel.hidden = true; dom.settingsOverlay.hidden = true; dom.menuToggle?.setAttribute('aria-expanded', 'false');
  document.querySelector('.topbar')?.removeAttribute('inert');
  document.querySelector('.workspace')?.removeAttribute('inert');
  dom.menuToggle?.focus();
}
function visibleFocusables(root) {
  return [...root.querySelectorAll('button, input, select, a[href], [tabindex]')].filter(node => !node.disabled && node.tabIndex !== -1 && node.offsetParent !== null && !node.closest('[inert]'));
}
function handleRemoteKey(event) {
  const key = event.key;
  const arrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  const target = document.activeElement || event.target;
  const consume = () => { event.preventDefault(); event.stopImmediatePropagation(); };
  const move = (list, delta, wrap = false) => {
    const index = list.indexOf(target); let next = index < 0 ? 0 : index + delta;
    if (wrap && list.length) next = (next + list.length) % list.length;
    list[Math.max(0, Math.min(list.length - 1, next))]?.focus();
  };
  if (state.locked) { consume(); if (isBackKey(event)) revealLockUnlock(); if (isSelectKey(event)) unlockScreen(); return; }
  if (isBackKey(event)) {
    const custom = target.closest?.('.custom-select.open');
    if (custom) { consume(); closeCustomSelect(custom); custom.querySelector('button')?.focus(); return; }
    if (isTextEntryTarget(target) && key === 'Backspace') return;
    if (handleBackStep()) consume(); return;
  }
  const modal = !dom.programDetailModal.hidden ? dom.programDetailModal : !dom.catchupModal.hidden ? dom.catchupModal : !dom.settingsPanel.hidden ? dom.settingsPanel : null;
  if (modal) {
    if (isChannelUpKey(event) || isChannelDownKey(event) || isGuideKey(event)) { consume(); return; }
    if (key === 'Tab') { consume(); move(visibleFocusables(modal), event.shiftKey ? -1 : 1, true); return; }
    if (arrow) {
      // Real keyboards retain cursor editing in text fields; synthetic remote arrows navigate controls.
      if (isTextEntryTarget(target) && event.isTrusted && ['ArrowLeft', 'ArrowRight'].includes(key)) return;
      consume(); const custom = target.closest?.('.custom-select.open');
      move(custom ? visibleFocusables(custom.querySelector('.custom-select-menu')) : visibleFocusables(modal), ['ArrowUp', 'ArrowLeft'].includes(key) ? -1 : 1); return;
    }
    if (isSelectKey(event) && !isTextEntryTarget(target)) { consume(); if (!event.repeat) target.click(); return; }
    return;
  }
  if (isTextEntryTarget(target)) return;
  if (key === 'MediaPlayPause' || key === 'MediaPlay' || key === 'MediaPause') { consume(); if (globalThis.TCLVAndroidPlayer?.active) globalThis.TCLVAndroidPlayer.control(key === 'MediaPlayPause' ? 'toggle' : key === 'MediaPlay' ? 'play' : 'pause'); else if (dom.video.paused) dom.video.play().catch(() => {}); else dom.video.pause(); return; }
  if (isGuideKey(event)) { consume(); setEpgVisible(!state.epgVisible); if (state.epgVisible) focusGuideItem(); else focusSelectedChannel(); return; }
  if (['Info', 'MediaInfo', 'ContextMenu'].includes(key)) { consume(); openCurrentProgramDetail(); return; }
  if (isChannelUpKey(event) || isChannelDownKey(event)) { consume(); selectRelativeChannel(isChannelUpKey(event) ? -1 : 1); return; }
  const card = target.closest?.('.channel-card');
  if (card) {
    const index = state.channels.findIndex(ch => ch.id === card.dataset.channelId);
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) { consume(); focusChannelIndex(key === 'Home' ? 0 : key === 'End' ? state.channels.length - 1 : index + (key === 'ArrowDown' ? 1 : -1)); return; }
    if (key === 'ArrowRight') { consume(); focusTopbar(); return; }
    if (isSelectKey(event)) { consume(); if (!event.repeat) { if (target === card) selectChannel(card.dataset.channelId); else target.click(); } return; }
  }
  if (target.closest?.('.top-actions')) {
    if (key === 'ArrowDown') { consume(); focusSelectedChannel(); return; }
    if (key === 'ArrowLeft' || key === 'ArrowRight') { consume(); const list = topbarFocusables(); if (key === 'ArrowLeft' && target === list[0]) focusSelectedChannel(); else move(list, key === 'ArrowLeft' ? -1 : 1); return; }
  }
  if (arrow && target.closest?.('.guide-panel')) {
    consume();
    const row = target.closest('.timeline-row');
    if (row && ['ArrowUp', 'ArrowDown'].includes(key)) {
      const index = guideWindow.channels.findIndex(ch => ch.id === row.dataset.channelId);
      const next = index + (key === 'ArrowUp' ? -1 : 1);
      if (next < 0) { dom.epgBack.focus(); return; }
      const channel = guideWindow.channels[next]; if (!channel) return;
      if (guideWindow.channels.length > 150) { guideWindow.start = Math.max(0, next - 12); dom.epgGuide.scrollTop = Math.max(0, next * guideWindow.rowHeight - dom.epgGuide.clientHeight / 2); renderGuide(); }
      const nextRow = [...dom.epgGuide.querySelectorAll('.timeline-row')].find(node => node.dataset.channelId === channel.id);
      nextRow?.querySelector('.program')?.focus(); return;
    }
    move(visibleFocusables(dom.guidePanel), ['ArrowUp', 'ArrowLeft'].includes(key) ? -1 : 1); return;
  }
  if (arrow) { consume(); if (key === 'ArrowLeft' || key === 'ArrowDown') focusSelectedChannel(); else focusTopbar(); return; }
  if (isSelectKey(event) && target.tagName !== 'VIDEO') { consume(); if (!event.repeat) target.click(); }
}
function bindEvents() {
  dom.epgToggle?.addEventListener('click', toggleEpg);
  dom.sidebarToggle?.addEventListener('click', toggleSidebar);
  dom.chToggle?.addEventListener('click', toggleSidebar);
  dom.qualitySelect?.addEventListener('change', function() { if (globalThis.TCLVAndroidPlayer?.active) { state.nativeQuality = parseInt(this.value, 10); globalThis.TCLVAndroidPlayer.quality(state.nativeQuality); return; } if (!state.hls) return; var v = parseInt(this.value, 10); state.hls.currentLevel = isNaN(v) ? -1 : v; });
  dom.epgBack?.addEventListener('click', function() { state.epgOffsetHours -= EPG_STEP_HOURS; renderGuide(); });
  dom.epgFwd?.addEventListener('click', function() { state.epgOffsetHours += EPG_STEP_HOURS; renderGuide(); });
  dom.epgZoomIn?.addEventListener('click', function() { if (state.epgZoom > 0.5) { state.epgZoom = Math.max(0.5, state.epgZoom / EPG_ZOOM_FACTOR); renderGuide(); } });
  dom.epgZoomOut?.addEventListener('click', function() { if (state.epgZoom < 4) { state.epgZoom = Math.min(4, state.epgZoom * EPG_ZOOM_FACTOR); renderGuide(); } });
  dom.menuToggle?.addEventListener('click', ()=> dom.settingsPanel.hidden ? openSettings() : closeSettings());
  dom.settingsClose?.addEventListener('click', closeSettings); dom.settingsOverlay?.addEventListener('click', closeSettings);
  dom.playlistFile.addEventListener('change', async () => { const file = dom.playlistFile.files?.[0]; if (!file) return; try { const text = await readFile(file); const record = { id: `pl-${Date.now()}`, name: file.name, source: file.name, type: playlistTypeFromSource(file.name, text), origin: 'local', text }; addPlaylistRecord(record); await activatePlaylist(record.id); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } finally { dom.playlistFile.value = ''; } });
  dom.epgFile.addEventListener('change', async () => { const file = dom.epgFile.files?.[0]; if (!file) return; try { const text = await readFile(file); addEpgRecord({ id: `epg-${Date.now()}`, name: file.name, source: file.name, origin: 'local', text }); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.epgListFile?.addEventListener('change', async () => { const file = dom.epgListFile.files?.[0]; if (!file) return; try { await importEpgListFile(file); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } dom.epgListFile.value = ''; });
  dom.exportEpgList?.addEventListener('click', exportEpgListFile);
  dom.reloadEpg?.addEventListener('click', forceRefreshEpg);
  dom.addPlaylistUrl?.addEventListener('click', async () => { try { const url = dom.playlistUrl.value.trim(); if (!url) return; const text = await loadTextFromUrl(url); const name = sourceNameFromUrl(url, 'playlist'); const record = { id: `pl-${Date.now()}`, name, source: url, type: playlistTypeFromSource(url, text), origin: 'network', text }; addPlaylistRecord(record); dom.playlistUrl.value = ''; await activatePlaylist(record.id); } catch (error) { showMessage(`${t('loadError')} ${error.message}`); } });
  dom.addEpgUrl?.addEventListener('click', async () => { try { const url = dom.epgUrl.value.trim(); if (!url) return; if (!/^https?:$/i.test(new URL(url).protocol)) throw new Error('HTTP(S) required'); const record = { id: `epg-${Date.now()}`, name: sourceNameFromUrl(url, 'epg.xml'), source: url, origin: 'network' }; addEpgRecord(record); dom.epgUrl.value = ''; await reloadEpgSources({ onlyId: record.id, showOnLoad: false }); } catch (error) { showMessage(`${t('loadError')} ${epgFailure(error)}`); } });
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
  dom.epgSearch?.addEventListener('input', () => { guideWindow.start = 0; dom.epgGuide.scrollTop = 0; renderGuide(); });
  let guideScrollFrame;
  dom.epgGuide.addEventListener('scroll', () => { if (guideWindow.channels.length <= 150) return; cancelAnimationFrame(guideScrollFrame); guideScrollFrame = requestAnimationFrame(() => { const start = Math.max(0, Math.floor(dom.epgGuide.scrollTop / guideWindow.rowHeight) - 12); if (Math.abs(start - guideWindow.start) > 8) { guideWindow.start = start; renderGuide(); } }); }, { passive: true });
  let channelScrollFrame;
  dom.channelGrid.addEventListener('scroll', () => { if (state.channels.length <= 150) return; cancelAnimationFrame(channelScrollFrame); channelScrollFrame = requestAnimationFrame(() => { const start = channelWindowStart(Math.floor(dom.channelGrid.scrollTop / channelWindow.rowHeight)); if (Math.abs(start - channelWindow.start) > 8) { channelWindow.start = start; renderChannels(); } }); }, { passive: true });
  dom.channelSearch?.addEventListener('input', function() { state.searchQuery = this.value.trim(); renderChannels(); });
  dom.channelSearch?.addEventListener('search', function() { state.searchQuery = this.value.trim(); renderChannels(); });
  dom.addXtream?.addEventListener('click', addXtreamSource);
  dom.pipButton?.addEventListener('click', togglePip);
  document.addEventListener('enterpictureinpicture', function() { dom.pipButton?.classList.add('active'); });
  document.addEventListener('leavepictureinpicture', function() { dom.pipButton?.classList.remove('active'); });
  dom.mvToggle?.addEventListener('click', toggleMultiview);
  dom.mvSlot0?.addEventListener('click', function() { if (state.multiview && state.mvSlot !== 0) setMvFocus(0); });
  dom.mvSlot1?.addEventListener('click', function() { if (state.multiview && state.mvSlot !== 1) setMvFocus(1); });
  dom.lockButton?.addEventListener('pointerdown', function(e) { e.preventDefault(); startTopLockHold(); }, { passive: false });
  dom.lockButton?.addEventListener('pointerup', function(e) { e.preventDefault(); cancelTopLockHold(); }, { passive: false });
  dom.lockButton?.addEventListener('pointercancel', cancelTopLockHold);
  dom.lockButton?.addEventListener('pointerleave', cancelTopLockHold);
  dom.lockButton?.addEventListener('click', function(e) { e.preventDefault(); });
  dom.lockUnlock?.addEventListener('pointerdown', function(e) {
    e.stopPropagation();
    e.preventDefault();
    startLockHold();
  }, { passive: false });
  dom.lockUnlock?.addEventListener('pointerup', function(e) {
    e.stopPropagation();
    e.preventDefault();
    cancelLockHold();
  }, { passive: false });
  dom.lockUnlock?.addEventListener('pointercancel', function(e) {
    e.stopPropagation();
    e.preventDefault();
    cancelLockHold();
  }, { passive: false });
  dom.lockUnlock?.addEventListener('click', function(e) { e.stopPropagation(); e.preventDefault(); });
  if (dom.lockOverlay) {
    dom.lockOverlay.addEventListener('pointerdown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (e.target === dom.lockOverlay) revealLockUnlock();
    }, { passive: false });
    dom.lockOverlay.addEventListener('pointerup', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });
    dom.lockOverlay.addEventListener('pointercancel', function(e) {
      e.stopPropagation();
      e.preventDefault();
      cancelLockHold();
    }, { passive: false });
    dom.lockOverlay.addEventListener('pointerleave', cancelLockHold);
    dom.lockOverlay.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });
    dom.lockOverlay.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });
    dom.lockOverlay.addEventListener('contextmenu', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });
    if (!window.PointerEvent) {
      dom.lockOverlay.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();
        if (e.target === dom.lockOverlay) revealLockUnlock();
      }, { passive: false });
      dom.lockOverlay.addEventListener('touchend', function(e) {
        e.stopPropagation();
        e.preventDefault();
      }, { passive: false });
      dom.lockOverlay.addEventListener('touchcancel', function(e) {
        e.stopPropagation();
        e.preventDefault();
        cancelLockHold();
      }, { passive: false });
    }
  }
  dom.autostartToggle?.addEventListener('click', function(e) { e.preventDefault(); toggleAutostart(); });
  dom.backgroundPlaybackToggle?.addEventListener('click', function(e) { e.preventDefault(); toggleBackgroundPlayback(); });
  dom.exportSettings?.addEventListener('click', exportSettings);
  dom.importFile?.addEventListener('change', function() { var file = dom.importFile.files?.[0]; if (file) { importSettingsFromFile(file); dom.importFile.value = ''; } });
  document.addEventListener('keydown', handleRemoteKey, true);
  dom.playerSelect.addEventListener('change', () => { state.player = dom.playerSelect.value; if (getPlatform() === 'android') { dom.mvToggle.hidden = state.player === 'native'; if (state.player === 'native' && state.multiview) toggleMultiview(); } syncCustomSelects(); saveCurrentPlayer(); const channel = selectedChannel(); if (channel) playChannel(channel); });
  dom.languageSelect.addEventListener('change', () => { state.language = dom.languageSelect.value; safeSet('tclv.language', state.language); renderAll(); });
}
let epgReloadPending;
async function forceRefreshEpg() {
  if (dom.reloadEpg.disabled) return;
  const report = (key, duration) => { dom.epgRefreshStatus.textContent = t(key); showMessage(t(key), duration); };
  if (!state.epgSources.some(source => source.active !== false)) { report('epgNoSources'); return; }
  const focused = document.activeElement === dom.reloadEpg;
  dom.reloadEpg.disabled = true; dom.reloadEpg.setAttribute('aria-busy', 'true');
  report('epgRefreshing', 0);
  try {
    // A forced request must run after an existing automatic refresh, not join it.
    if (epgReloadPending) await epgReloadPending;
    for (const source of state.epgSources) if (source.active !== false && source.origin === 'local') source.parsed = null;
    const result = await reloadEpgSources({ forceReload: true, showOnLoad: false });
    await persistSources();
    report(result.failures ? 'epgRefreshPartial' : result.unavailable ? 'epgRefreshNeedsAttention' : 'epgRefreshDone');
  } catch { report('loadError'); }
  finally {
    dom.reloadEpg.disabled = false; dom.reloadEpg.removeAttribute('aria-busy');
    if (focused && !dom.settingsPanel.hidden && document.activeElement === document.body) dom.reloadEpg.focus({ preventScroll: true });
  }
}
async function reloadEpgSources(options = {}) {
  if (epgReloadPending) { if (options.onlyId) { await epgReloadPending; return reloadEpgSources(options); } return epgReloadPending; }
  epgReloadPending = (async function() {
    const native = getPlatform() === 'android' && window.Capacitor?.Plugins?.TCLVPlayer?.fetchEpgSource;
    const plugin = window.Capacitor?.Plugins?.TCLVPlayer;
    const sources = state.epgSources.filter(s => s.active !== false && s.origin !== 'local' && s.source &&
      (!options.onlyId || s.id === options.onlyId) &&
      (options.forceReload || ((!s.retryAt || Date.now() >= s.retryAt) && ((!s.text && !s.nativeCache) || s.error === 'cache' || !s.fetchedAt || Date.now() - s.fetchedAt >= 6 * 60 * 60 * 1000))));
    let failures = 0;
    // Two simultaneous sources bound peak RAM on small TV devices.
    const parallel = native ? 1 : 2;
    for (let i = 0; i < sources.length; i += parallel) {
      await Promise.all(sources.slice(i, i + parallel).map(async source => {
        let download;
        source.status = 'loading'; delete source.error; renderSourceLists();
        try {
          let text;
          const addresses = globalThis.TCLVEpg.downloadUrls(normalizeDownloadUrl(source.source));
          for (let attempt = 0; attempt < addresses.length; attempt++) {
            try {
              if (native) { download = await plugin.fetchEpgSource({ url: addresses[attempt] }); text = { url: window.Capacitor.convertFileSrc(download.path) }; }
              else text = await loadTextFromUrl(addresses[attempt], { forceReload: !!options.forceReload || !!source.text });
              break;
            } catch (error) { if (attempt === addresses.length - 1) throw error; }
          }
          const parsedPlaylist = epgChannelsGeneration;
          const parsed = await parseEpgOffThread(text);
          if (!state.epgSources.includes(source)) { if (download) await plugin.discardEpgSource({ id: download.id }); return; }
          if (download) { await plugin.commitEpgSource({ id: download.id }); source.nativeCache = download.key; delete source.text; }
          else { source.text = text; delete source.nativeCache; }
          source.fetchedAt = Date.now(); source.parsed = parsed;
          source.parsedText = epgSourceVersion(source); source.parsedPlaylist = parsedPlaylist;
          source.failures = 0; delete source.retryAt; epgSourceStatus(source, parsed);
        } catch (error) {
          if (download) await plugin.discardEpgSource({ id: download.id }).catch(() => {});
          failures++; source.status = 'error'; source.error = epgFailure(error);
          source.failures = (source.failures || 0) + 1; source.retryAt = Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(source.failures - 1, 6));
        }
      }));
    }
    await rebuildMergedEpg();
    if (sources.length) await persistSources();
    if (failures && failures === sources.length && options.showOnLoad !== false) showMessage(t('loadError') + ' (EPG)');
    if (state.epg.size && !state.epgVisible && options.showOnLoad === true) toggleEpg();
    const unavailable = state.epgSources.filter(source => source.active !== false && ['empty', 'outdated', 'future', 'unmatched', 'noCurrent'].includes(source.status)).length;
    return { failures, unavailable };
  })();
  try { return await epgReloadPending; } finally { epgReloadPending = null; }
}
async function init() {
  if (getPlatform() === 'android') {
    await globalThis.TCLVAndroidPlayer.install({ slot: dom.mvSlot0, settings: dom.settingsPanel, detail: dom.programDetailModal,
      locked: () => state.locked, nativeChosen: () => state.player === 'native', onUnlock: () => unlockScreen(),
      onState: event => {
        const channel = state.channels.find(ch => ch.id === event.id);
        if (channel && state.selectedChannelId !== channel.id) { state.selectedChannelId = channel.id; updateChannelSelectionUi(); showSwitchOverlay(channel); refreshNativeMetadata(); }
        syncAndroidPlaybackActive(!!event.playWhenReady || !!event.buffering);
        if (event.qualities) { const changed = JSON.stringify(state.nativeQualities) !== JSON.stringify(event.qualities); state.nativeQualities = event.qualities; if (changed) buildQualityMenu(); }
        if (event.error) showMessage(t('streamUnavailable'));
        else if (event.playing) { hideMessage(); if (channel) setStreamStatus(channel.id, 'ok'); }
      }
    });
  }
  const savedSources = await globalThis.TCLVStorage.loadSnapshot();
  if (savedSources) { state.playlists = savedSources.playlists; state.epgSources = savedSources.epgSources; }
  else if (state.playlists.length || state.epgSources.length) {
    try { await persistSources(); localStorage.removeItem('tclv.playlists'); localStorage.removeItem('tclv.epgSources'); } catch { /* Keep legacy data until migration succeeds. */ }
  }
  if (!state.playlists.some(p => p.id === state.activePlaylistId)) state.activePlaylistId = state.playlists[0]?.id || null;
  bindEvents();
  state.player = dom.playerSelect.value = state.player;
  if (getPlatform() === 'android') { dom.mvToggle.hidden = state.player === 'native'; }
  state.language = translations[state.language] ? state.language : 'sk';
  state.corsProxy = detectCorsProxySync();
  if (dom.corsProxyInput) dom.corsProxyInput.value = state.corsProxy;
  var platform = getPlatform();
  document.documentElement.dataset.platform = platform;
  if (platform === 'android') {
    try { if (window.screen?.orientation?.lock) window.screen.orientation.lock('any').catch(function() {}); } catch {}
  }
  if (platform === 'electron' || platform === 'android') {
    var netSection = dom.corsProxyInput?.closest('.settings-section');
    if (netSection) netSection.style.display = 'none';
  } else if (platform === 'web-http') {
    var corsHintEl = dom.corsProxyInput?.closest('.settings-section')?.querySelector('.settings-hint');
    if (corsHintEl) corsHintEl.textContent = 'HTTP — priame prehrávanie bez proxy.';
  }
  if (!isNativePlatform()) {
    dom.playerSelect.querySelectorAll('.native-only').forEach(function(opt) { opt.disabled = true; opt.hidden = true; });
  }
  initCustomSelects();
  if (dom.pipButton && (document.pictureInPictureEnabled || platform === 'android')) dom.pipButton.removeAttribute('hidden');
  if (dom.lockButton && (platform === 'android')) dom.lockButton.removeAttribute('hidden');
  if (dom.autostartCheck) dom.autostartCheck.checked = state.autostart;
  if (dom.autostartToggle) { dom.autostartToggle.classList.toggle('active', state.autostart); dom.autostartToggle.setAttribute('aria-checked', String(state.autostart)); }
  if (dom.backgroundPlaybackCheck) dom.backgroundPlaybackCheck.checked = state.backgroundPlayback;
  if (dom.backgroundPlaybackToggle) { dom.backgroundPlaybackToggle.classList.toggle('active', state.backgroundPlayback); dom.backgroundPlaybackToggle.setAttribute('aria-checked', String(state.backgroundPlayback)); }
  if (platform === 'android') syncBackgroundPlaybackNative();
  setPlayerActive(false); renderSourceLists();
  await detectLocalProxy();
  if (state.playlists.length && state.activePlaylistId) {
    activatePlaylist(state.activePlaylistId).then(function() {
      if (!state.channels.length && state.playlists.length) {
        setTimeout(function() {
          activatePlaylist(state.activePlaylistId, { forceReload: true }).then(function() {
            if (platform === 'android') ensureEpgLoadedForActivePlaylist();
          });
        }, 3000);
      }
      if (platform === 'android') ensureEpgLoadedForActivePlaylist();
    });
  } else if (state.playlists.length && !state.activePlaylistId) {
    state.activePlaylistId = state.playlists[0].id;
    safeSet('tclv.activePlaylistId', state.activePlaylistId);
    activatePlaylist(state.activePlaylistId).then(function() {
      if (platform === 'android') ensureEpgLoadedForActivePlaylist();
    });
  } else {
    renderAll();
    if (state.epgSources.length) reloadEpgSources(platform === 'android' ? { showOnLoad: false } : {});
  }
  setSidebarMode(state.sidebarMode);
  setInterval(function() { if (!document.hidden) refreshChannelProgress(); void reloadEpgSources({ showOnLoad: false }); }, 60 * 1000);
}
function refreshChannelProgress() {
  epgProgramCache.clear();
  refreshNativeMetadata();
  if (state.epgVisible && dom.programDetailModal.hidden && dom.settingsPanel.hidden) renderGuide();
  var byId = new Map();
  for (var i = 0; i < state.channels.length; i++) byId.set(state.channels[i].id, state.channels[i]);
  dom.channelGrid.querySelectorAll('.channel-card').forEach(function(card) {
    var ch = byId.get(card.dataset.channelId);
    if (!ch) return;
    var prog = currentProgram(ch);
    var bar = card.querySelector('.progress-track span');
    if (bar) bar.style.width = progress(prog) + '%';
    var txt = card.querySelector('.channel-text p');
    if (txt) txt.textContent = prog?.title || '';
  });
}
init();
