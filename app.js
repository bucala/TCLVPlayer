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
function safeGetJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function safeSetJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const translations = {
  sk: {
    tagline: "Jednoduchy IPTV prehravac", openPlaylist: "Playlist", openEpg: "EPG", load: "Nacitat", loadEpg: "Nacitat EPG", guide: "Program", noChannels: "Nacitajte M3U/M3U8 alebo XSPF playlist v Nastaveniach.", noEpg: "EPG este nie je nacitane.", noProgram: "Program nie je dostupny", now: "Teraz", next: "Nasleduje", html5Notice: "HTML5 video prehravac je aktivny. Niektore HLS streamy (.m3u8) potrebuju nativnu podporu prehliadaca.", optionalMissing: "Tento player nie je pribaleny. Nacitajte jeho kniznicu alebo pouzite HTML5.", externalPlayer: "Externy player nemoze spustit obycajna web stranka priamo. Prikaz bol pripraveny na kopirovanie.", externalLaunch: "Otvaram externy player", externalFailed: "Externy player sa nepodarilo spustit.", copied: "Prikaz je pripraveny v schranke.", loadError: "Nepodarilo sa nacitat zdroj.", playlistLoaded: "Playlist nacitany", epgLoaded: "EPG nacitane", logoTitle: "Vybrat logo", settingsPlayer: "Prehrávač & Jazyk", labelPlayer: "Prehrávač", labelLanguage: "Jazyk", settingsPlaylists: "Playlisty", addPlaylist: "Pridať URL", settingsEpg: "EPG zdroje", addEpg: "Pridať EPG", epgHint: "Všetky zdroje sa načítajú a zlúčia.", settingsNetwork: "Sieť", labelCorsProxy: "CORS proxy (len web)", corsHint: "URL prefix s &url= na konci. Electron a Android ho nepotrebujú.", searchEpg: "Hladat v programe", corsNeeded: "CORS chyba — nastavte CORS proxy v Nastaveniach > Sieť.", proxyBlocked: "Proxy blokuje požiadavku. Skúste iný CORS proxy.", local: "lokálny", network: "sieťový", epgAutoDetected: "EPG zdroje automaticky detegované z playlistu", proxyChanged: "CORS proxy uložený. Znovu načítavam EPG…"
  },
  en: {
    tagline: "Simple IPTV player", openPlaylist: "Playlist", openEpg: "EPG", load: "Load", loadEpg: "Load EPG", guide: "Guide", noChannels: "Load an M3U/M3U8 or XSPF playlist in Settings.", noEpg: "EPG is not loaded yet.", noProgram: "Program is not available", now: "Now", next: "Next", html5Notice: "HTML5 video player is active. Some HLS streams (.m3u8) need native browser support.", optionalMissing: "This player is not bundled. Load its library or use HTML5.", externalPlayer: "A plain web page cannot start an external player directly. A command was prepared for copying.", externalLaunch: "Opening external player", externalFailed: "Could not start the external player.", copied: "Command is ready in the clipboard.", loadError: "Could not load the source.", playlistLoaded: "Playlist loaded", epgLoaded: "EPG loaded", logoTitle: "Choose logo", settingsPlayer: "Player & Language", labelPlayer: "Player", labelLanguage: "Language", settingsPlaylists: "Playlists", addPlaylist: "Add URL", settingsEpg: "EPG sources", addEpg: "Add EPG", epgHint: "All sources are loaded and merged.", settingsNetwork: "Network", labelCorsProxy: "CORS proxy (web only)", corsHint: "URL prefix ending with &url=. Electron and Android do not need it.", searchEpg: "Search programs", corsNeeded: "CORS error — set a CORS proxy in Settings > Network.", proxyBlocked: "Proxy is blocking the request. Try a different CORS proxy.", local: "local", network: "network", epgAutoDetected: "EPG sources auto-detected from playlist", proxyChanged: "CORS proxy saved. Reloading EPG…"
  }
};

const state = {
  language: safeGet("tclv.language", "sk"), channels: [], epg: new Map(), selectedChannelId: null, selectedLogoChannelId: null, player: safeGet("tclv.player", "html5"), overlayTimer: 0, videoJsPlayer: null, artPlayer: null, hls: null,
  corsProxy: safeGet("tclv.corsProxy", ""),
  playlists: safeGetJson("tclv.playlists", []), activePlaylistId: safeGet("tclv.activePlaylistId", null),
  epgSources: safeGetJson("tclv.epgSources", [])
};

const dom = {
  playlistFile: document.querySelector("#playlistFile"), epgFile: document.querySelector("#epgFile"), playlistUrl: document.querySelector("#playlistUrl"), epgUrl: document.querySelector("#epgUrl"), addPlaylistUrl: document.querySelector("#addPlaylistUrl"), addEpgUrl: document.querySelector("#addEpgUrl"), playerSelect: document.querySelector("#playerSelect"), languageSelect: document.querySelector("#languageSelect"), channelGrid: document.querySelector("#channelGrid"), channelTemplate: document.querySelector("#channelTemplate"), video: document.querySelector("#videoPlayer"), artPlayerHost: document.querySelector("#artPlayerHost"), playerMessage: document.querySelector("#playerMessage"), switchOverlay: document.querySelector("#switchOverlay"), nowPanel: document.querySelector("#nowPanel"), epgGuide: document.querySelector("#epgGuide"), guideRange: document.querySelector("#guideRange"), logoFile: document.querySelector("#logoFile"), menuToggle: document.querySelector("#menuToggle"), settingsPanel: document.querySelector("#settingsPanel"), settingsOverlay: document.querySelector("#settingsOverlay"), settingsClose: document.querySelector("#settingsClose"), playlistList: document.querySelector("#playlistList"), epgList: document.querySelector("#epgList"),
  corsProxyInput: document.querySelector("#corsProxy"), epgSearch: document.querySelector("#epgSearch")
};

function t(key) { return translations[state.language]?.[key] || translations.en[key] || key; }
function hashCode(value) { let hash = 0; for (let i = 0; i < value.length; i += 1) { hash = (hash << 5) - hash + value.charCodeAt(i); hash |= 0; } return hash; }
function escapeXml(value) { return String(value).replace(/[<>&"']/g, (char) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;"})[char]); }
function normalizeId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""); }
function placeholderLogo(name) { const initials = (name || "TV").split(/\s+/).map((part) => part[0]).join("").slice(0,3).toUpperCase(); const hue = Math.abs(hashCode(name || "TV")) % 360; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="hsl(${hue} 72% 46%)"/><text x="80" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="white">${escapeXml(initials)}</text></svg>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
function getChannelLogo(channel) { return safeGet(`tclv.logo.${channel.id}`) || sanitizeLogoUrl(channel.logo) || placeholderLogo(channel.name); }
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
    if (line.startsWith("#EXTINF")) { const commaIndex = line.indexOf(","); const info = commaIndex >= 0 ? line.slice(0, commaIndex) : line; const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : ""; meta = { name: attr(info, "tvg-name") || title || "Channel", tvgId: attr(info, "tvg-id") || attr(info, "channel-id") || "", logo: attr(info, "tvg-logo") || "", group: attr(info, "group-title") || "" }; continue; }
    if (!line.startsWith("#")) { const name = meta?.name || line.split("/").pop() || "Channel"; const tvgId = meta?.tvgId || ""; channels.push({ id: uniqueId(tvgId || name || line, channels), tvgId, name, logo: meta?.logo || "", group: meta?.group || "", url: line }); meta = null; }
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
function filteredChannels() { return state.channels; }
function extractM3UEpgUrls(text) { const first = (text.split(/\r?\n/)[0] || '').trim(); if (!first.startsWith('#EXTM3U')) return []; const m = first.match(/x-tvg-url\s*=\s*"([^"]*)"/i); return m ? m[1].split(',').map(function(u) { return u.trim(); }).filter(Boolean) : []; }

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
  if (!channels.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = t('noChannels'); dom.channelGrid.append(empty); return; }
  const now = new Date(); channels.forEach((channel) => { const node = dom.channelTemplate.content.firstElementChild.cloneNode(true); const program = currentProgram(channel, now); node.dataset.id = channel.id; node.dataset.channelId = channel.id; node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', channel.name); node.classList.toggle('active', channel.id === state.selectedChannelId); node.querySelector('.channel-logo').src = getChannelLogo(channel); node.querySelector('.channel-logo').alt = channel.name; node.querySelector('h3').textContent = channel.name; node.querySelector('p').textContent = program?.title || t('noProgram'); node.querySelector('.progress-track span').style.width = `${progress(program, now)}%`; node.querySelector('.logo-action').title = t('logoTitle'); node.querySelector('.logo-action').addEventListener('click', (event) => { event.stopPropagation(); state.selectedLogoChannelId = channel.id; dom.logoFile.click(); }); node.addEventListener('click', () => selectChannel(channel.id)); node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectChannel(channel.id); } }); dom.channelGrid.append(node); });
}
function renderNow() {
  const channel = selectedChannel(); if (!channel) { dom.nowPanel.innerHTML = `<div class="empty-state">${t('noChannels')}</div>`; return; }
  const now = currentProgram(channel); const next = nextProgram(channel); dom.nowPanel.innerHTML = `<div class="now-layout"><div><h2>${escapeHtml(channel.name)}</h2><p><strong>${t('now')}:</strong> ${escapeHtml(now?.title || t('noProgram'))}</p><p><strong>${t('next')}:</strong> ${escapeHtml(next?.title || t('noProgram'))}</p></div><div class="status-pill">${escapeHtml(state.player.toUpperCase())}</div></div>`;
}
function renderGuide() {
  const start = floorToHalfHour(new Date(Date.now() - 2 * 60 * 60 * 1000)); const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); const duration = end - start; const epgQuery = dom.epgSearch?.value.trim().toLowerCase() || ''; const channels = state.channels.filter((ch) => { if (!epgQuery) return true; const programs = findPrograms(ch).filter((p) => p.stop > start && p.start < end); return ch.name.toLowerCase().includes(epgQuery) || programs.some((p) => p.title.toLowerCase().includes(epgQuery)); }); dom.guideRange.textContent = `${formatTime(start)} - ${formatTime(end)}`;
  if (!channels.length) { dom.epgGuide.innerHTML = `<div class="empty-state">${t('noChannels')}</div>`; return; }
  const width = 1280; const timeline = document.createElement('div'); timeline.className = 'timeline'; timeline.style.width = `${width + 170}px`;
  const header = document.createElement('div'); header.className = 'timeline-header'; header.innerHTML = `<div class="timeline-corner"></div><div class="time-slots"></div>`; header.querySelector('.time-slots').style.width = `${width}px`;
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 30 * 60 * 1000)) { const slot = document.createElement('div'); slot.className = 'time-slot'; slot.style.left = `${((cursor - start) / duration) * width}px`; slot.style.width = `${width / 16}px`; slot.textContent = formatTime(cursor); header.querySelector('.time-slots').append(slot); }
  timeline.append(header);
  channels.forEach((channel) => { const row = document.createElement('div'); row.className = 'timeline-row'; row.innerHTML = `<div class="timeline-label"><img src="${getChannelLogo(channel)}" alt=""><span>${escapeHtml(channel.name)}</span></div><div class="program-track"></div>`; const track = row.querySelector('.program-track'); track.style.width = `${width}px`; const programs = findPrograms(channel).filter((program) => program.stop > start && program.start < end); if (!programs.length) { const empty = document.createElement('div'); empty.className = 'program'; empty.style.left = '8px'; empty.style.width = '160px'; empty.innerHTML = `<strong>${t('noEpg')}</strong>`; track.append(empty); } else { programs.forEach((program) => { const left = Math.max(0, ((program.start - start) / duration) * width); const right = Math.min(width, ((program.stop - start) / duration) * width); const node = document.createElement('div'); node.className = `program${program.start <= new Date() && program.stop > new Date() ? ' current' : ''}`; node.style.left = `${left}px`; node.style.width = `${Math.max(44, right - left - 4)}px`; node.title = `${program.title} ${formatTime(program.start)}-${formatTime(program.stop)}`; node.innerHTML = `<strong>${escapeHtml(program.title)}</strong><span>${formatTime(program.start)} - ${formatTime(program.stop)}</span>`; track.append(node); }); }
    const nowLine = document.createElement('div'); nowLine.className = 'now-line'; nowLine.style.left = `${Math.max(0, Math.min(width, ((Date.now() - start.getTime()) / duration) * width))}px`; track.append(nowLine);
    timeline.append(row);
  });
  dom.epgGuide.replaceChildren(timeline);
}
function renderAll() { translateUi(); renderSourceLists(); renderChannels(); renderNow(); renderGuide(); }

function stopVideoJs() { if (state.videoJsPlayer) state.videoJsPlayer.pause(); }
function stopArtPlayer() { if (state.artPlayer) state.artPlayer.pause?.(); dom.artPlayerHost.style.display = 'none'; }
function stopInternalPlayers() { stopVideoJs(); stopArtPlayer(); if (state.hls) { try { state.hls.destroy(); } catch {} state.hls = null; } dom.video.pause(); }
function showHtmlVideo() { dom.video.style.display = 'block'; dom.artPlayerHost.style.display = 'none'; }
function guessMimeType(url) { const clean = String(url || '').split('?')[0].toLowerCase(); if (clean.endsWith('.m3u8')) return 'application/x-mpegURL'; if (clean.endsWith('.mp4')) return 'video/mp4'; if (clean.endsWith('.webm')) return 'video/webm'; return 'application/x-mpegURL'; }
async function ensureScript(id, sources) { if (document.querySelector(`script[data-loader-id="${id}"]`)) return; for (const source of sources) { try { await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = source; script.dataset.loaderId = id; script.onload = resolve; script.onerror = reject; document.head.append(script); }); return; } catch {} } throw new Error('Asset could not be loaded.'); }
async function ensureStyle(id, sources) { if (document.querySelector(`link[data-loader-id="${id}"]`)) return; for (const source of sources) { try { await new Promise((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = source; link.dataset.loaderId = id; link.onload = resolve; link.onerror = reject; document.head.append(link); }); return; } catch {} } throw new Error('Asset could not be loaded.'); }
async function ensureVideoJs() { if (window.videojs) return; await ensureStyle('videojs-css', ['./vendor/video.js/video-js.min.css','https://vjs.zencdn.net/8.21.1/video-js.min.css']); await ensureScript('videojs-js', ['./vendor/video.js/video.min.js','https://vjs.zencdn.net/8.21.1/video.min.js']); }
async function ensureArtPlayer() { if (window.Artplayer) return; await ensureScript('artplayer-js', ['./vendor/artplayer/artplayer.js','https://cdn.jsdelivr.net/npm/artplayer@5/dist/artplayer.js']); }
async function ensureHls() { if (window.Hls) return; await ensureScript('hls-js', ['./vendor/hls.js/hls.min.js', 'https://cdn.jsdelivr.net/npm/hls.js@latest']); }
function showMessage(message) { dom.playerMessage.textContent = message; dom.playerMessage.style.display = 'block'; }
function hideMessage() { dom.playerMessage.style.display = 'none'; dom.playerMessage.textContent = ''; }
function tryHlsPlayback(url, useRawProxy) { var hlsCfg = (!isNativePlatform() && state.corsProxy) ? { xhrSetup: function(xhr, u) { xhr.open('GET', useRawProxy ? proxyUrlRaw(u) : proxyUrl(u), true); } } : {}; state.hls = new window.Hls(hlsCfg); state.hls.on(window.Hls.Events.ERROR, function(_e, data) { if (data.fatal) { if (!useRawProxy && state.corsProxy && !isNativePlatform()) { state.hls.destroy(); state.hls = null; tryHlsPlayback(url, true); return; } if (!state.corsProxy && !isNativePlatform()) showMessage(t('corsNeeded')); else showMessage(t('proxyBlocked')); } }); state.hls.loadSource(url); state.hls.attachMedia(dom.video); state.hls.on(window.Hls.Events.MANIFEST_PARSED, function() { dom.video.play().catch(function() { showMessage(t('html5Notice')); }); }); }
async function playHtml5(channel) { stopInternalPlayers(); showHtmlVideo(); dom.video.removeAttribute('src'); dom.video.load(); const isHls = guessMimeType(channel.url) === 'application/x-mpegURL'; try { if (isHls) { if (dom.video.canPlayType('application/vnd.apple.mpegurl')) { dom.video.src = proxyUrl(channel.url); dom.video.play().catch(function() { showMessage(t('html5Notice')); }); return; } await ensureHls(); if (window.Hls?.isSupported()) { tryHlsPlayback(channel.url); return; } } dom.video.src = proxyUrl(channel.url); dom.video.addEventListener('canplay', function() { dom.video.play().catch(function() { showMessage(t('html5Notice')); }); }, { once: true }); dom.video.addEventListener('error', function() { showMessage(t('html5Notice')); }, { once: true }); } catch { showMessage(t('html5Notice')); } }
async function playVideoJs(channel) { try { stopArtPlayer(); showHtmlVideo(); await ensureVideoJs(); const isHls = guessMimeType(channel.url) === 'application/x-mpegURL'; if (isHls && !dom.video.canPlayType('application/vnd.apple.mpegurl')) { await ensureHls(); } state.videoJsPlayer = state.videoJsPlayer || window.videojs(dom.video, { autoplay: true, controls: true, liveui: true, fluid: false }); if (isHls && window.Hls?.isSupported() && !dom.video.canPlayType('application/vnd.apple.mpegurl')) { if (state.hls) { try { state.hls.destroy(); } catch {} } const vjsHlsCfg = (!isNativePlatform() && state.corsProxy) ? { xhrSetup: function(xhr, u) { xhr.open('GET', proxyUrl(u), true); } } : {}; state.hls = new window.Hls(vjsHlsCfg); state.hls.loadSource(channel.url); state.hls.attachMedia(state.videoJsPlayer.tech({ IWillNotUseThisInPlugins: true }).el()); state.hls.on(window.Hls.Events.MANIFEST_PARSED, () => state.videoJsPlayer.play()?.catch?.(() => {})); } else { state.videoJsPlayer.src({ src: proxyUrl(channel.url), type: guessMimeType(channel.url) }); state.videoJsPlayer.play()?.catch?.(() => showMessage(t('html5Notice'))); } } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); } }
async function playArtPlayer(channel) { try { stopVideoJs(); await ensureArtPlayer(); const isHls = guessMimeType(channel.url) === 'application/x-mpegURL'; if (isHls) await ensureHls(); dom.video.pause(); dom.video.removeAttribute('src'); dom.video.load(); dom.video.style.display = 'none'; dom.artPlayerHost.style.display = 'block'; const customType = (isHls && window.Hls?.isSupported()) ? { m3u8: function (videoEl, url) { if (state.hls) { try { state.hls.destroy(); } catch {} } const artHlsCfg = (!isNativePlatform() && state.corsProxy) ? { xhrSetup: function(xhr, u) { xhr.open('GET', proxyUrl(u), true); } } : {}; state.hls = new window.Hls(artHlsCfg); state.hls.loadSource(url); state.hls.attachMedia(videoEl); } } : undefined; if (state.artPlayer) { state.artPlayer.destroy(); state.artPlayer = null; } state.artPlayer = new window.Artplayer({ container: dom.artPlayerHost, url: proxyUrl(channel.url), type: isHls ? 'm3u8' : '', customType, autoplay: true, isLive: true, muted: false, setting: true, fullscreen: true, fullscreenWeb: true }); } catch (error) { showMessage(`${t('optionalMissing')} ${error.message || ''}`.trim()); } }
function getNativeBridge() { if (window.TCLVNative?.openExternalPlayer) return window.TCLVNative; const capacitorPlugin = window.Capacitor?.Plugins?.TCLVPlayer; if (capacitorPlugin?.openExternalPlayer) return { openExternalPlayer: (payload) => capacitorPlugin.openExternalPlayer(payload) }; return null; }
async function prepareExternalCommand(channel) { const executable = state.player === 'vlc' ? 'vlc' : 'mpv'; const command = `${executable} "${channel.url}"`; const nativeBridge = getNativeBridge(); if (nativeBridge) { try { await nativeBridge.openExternalPlayer({ player: state.player, url: channel.url, title: channel.name }); showMessage(`${t('externalLaunch')}: ${state.player.toUpperCase()}`); return; } catch (error) { showMessage(`${t('externalFailed')} ${error.message || ''}`.trim()); return; } } try { await navigator.clipboard.writeText(command); showMessage(`${t('externalPlayer')} ${t('copied')} ${command}`); } catch { showMessage(`${t('externalPlayer')} ${command}`); } }
function playChannel(channel) { hideMessage(); safeSet('tclv.lastChannel', channel.id); if (state.player === 'html5') return playHtml5(channel); if (state.player === 'videojs') return playVideoJs(channel); if (state.player === 'artplayer') return playArtPlayer(channel); stopInternalPlayers(); prepareExternalCommand(channel); }
function showSwitchOverlay(channel) { const now = currentProgram(channel); const next = nextProgram(channel); dom.switchOverlay.innerHTML = `<img src="${getChannelLogo(channel)}" alt=""><div><h2>${escapeHtml(channel.name)}</h2><p><strong>${t('now')}:</strong> ${escapeHtml(now?.title || t('noProgram'))}</p><p><strong>${t('next')}:</strong> ${escapeHtml(next?.title || t('noProgram'))}</p></div>`; dom.switchOverlay.classList.add('show'); clearTimeout(state.overlayTimer); state.overlayTimer = setTimeout(() => dom.switchOverlay.classList.remove('show'), 5200); }
function selectChannel(id) { const channel = state.channels.find((item) => item.id === id); if (!channel) return; state.selectedChannelId = id; playChannel(channel); showSwitchOverlay(channel); renderChannels(); renderNow(); requestAnimationFrame(() => { const active = dom.channelGrid.querySelector('.channel-card.active'); active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); }
function isNativePlatform() { return !!(window.TCLVNative || window.Capacitor); }
function proxyUrl(url) { if (isNativePlatform() || !state.corsProxy) return url; return state.corsProxy + encodeURIComponent(url); }
function proxyUrlRaw(url) { if (isNativePlatform() || !state.corsProxy) return url; return state.corsProxy + url; }
async function loadTextFromUrl(url) {
  function decode(r, u) { if (u.endsWith('.gz') && typeof DecompressionStream !== 'undefined') return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text(); return r.text(); }
  if (isNativePlatform() || !state.corsProxy) {
    var response; try { response = await fetch(url); } catch (err) { if (!isNativePlatform()) throw new Error(t('corsNeeded'), { cause: err }); throw err; }
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    return decode(response, url);
  }
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
function addPlaylistRecord(record) { state.playlists.unshift(record); const size = estimateStorageSize(state.playlists); if (size > 4 * 1024 * 1024) { console.warn('Playlist storage exceeds 4 MB — localStorage may fail.'); } safeSetJson('tclv.playlists', state.playlists); state.activePlaylistId = record.id; safeSet('tclv.activePlaylistId', record.id); renderSourceLists(); }
function activatePlaylist(id) { const item = state.playlists.find((p) => p.id === id); if (!item) return; state.activePlaylistId = id; safeSet('tclv.activePlaylistId', id); loadPlaylistText(item.text, item.name); renderSourceLists(); }
function removePlaylist(id) { state.playlists = state.playlists.filter((p) => p.id !== id); safeSetJson('tclv.playlists', state.playlists); if (state.activePlaylistId === id) { state.activePlaylistId = state.playlists[0]?.id || null; safeSet('tclv.activePlaylistId', state.activePlaylistId || ''); if (state.playlists[0]) loadPlaylistText(state.playlists[0].text, state.playlists[0].name); else { state.channels = []; state.selectedChannelId = null; renderAll(); } } renderSourceLists(); }
function removeEpgSource(id) { state.epgSources = state.epgSources.filter((e) => e.id !== id); safeSetJson('tclv.epgSources', state.epgSources); rebuildMergedEpg(); }
function toggleEpgSource(id) { const item = state.epgSources.find(function(e) { return e.id === id; }); if (!item) return; item.active = item.active === false ? true : false; safeSetJson('tclv.epgSources', state.epgSources); rebuildMergedEpg(); }
function addEpgRecord(record) { if (record.active === undefined) record.active = true; state.epgSources.unshift(record); const size = estimateStorageSize(state.epgSources); if (size > 4 * 1024 * 1024) { console.warn('EPG storage exceeds 4 MB — localStorage may fail.'); } safeSetJson('tclv.epgSources', state.epgSources); renderSourceLists(); rebuildMergedEpg(); }
function rebuildMergedEpg() { const maps = []; for (const source of state.epgSources) { if (source.active === false) continue; try { maps.push(parseXmlTv(source.text)); } catch {} } state.epg = mergeEpgMaps(maps); renderAll(); showMessage(`${t('epgLoaded')}: ${state.epg.size}`); }
async function autoLoadEpgFromPlaylist(text) { const urls = extractM3UEpgUrls(text); if (!urls.length) return; const countries = new Set(); for (const ch of state.channels) { const m = ch.tvgId?.match(/\.([a-z]{2})$/i); if (m) countries.add(m[1].toUpperCase()); } if (!countries.size) return; const matched = urls.filter(function(url) { const fn = (url.split('/').pop() || '').toUpperCase(); return [...countries].some(function(c) { return fn.includes('_' + c); }); }); for (const url of matched) { if (state.epgSources.some(function(s) { return s.source === url; })) continue; var epgText = null; try { epgText = await loadTextFromUrl(url); } catch { if (url.endsWith('.xml.gz')) { try { epgText = await loadTextFromUrl(url.replace(/\.gz$/, '')); } catch (e2) { showMessage(t('loadError') + ' ' + (url.split('/').pop() || '') + ': ' + (e2.message || '')); } } else { showMessage(t('loadError') + ' ' + (url.split('/').pop() || '')); } } if (epgText) { addEpgRecord({ id: 'epg-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: url.split('/').pop() || 'epg.xml', source: url, origin: 'network', active: true, text: epgText }); } } if (state.epgSources.length) showMessage(t('epgAutoDetected')); }
function openSettings() { dom.settingsPanel.hidden = false; dom.settingsOverlay.hidden = false; dom.menuToggle?.setAttribute('aria-expanded', 'true'); }
function closeSettings() { dom.settingsPanel.hidden = true; dom.settingsOverlay.hidden = true; dom.menuToggle?.setAttribute('aria-expanded', 'false'); }
function bindEvents() {
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
  dom.playerSelect.addEventListener('change', () => { state.player = dom.playerSelect.value; safeSet('tclv.player', state.player); const channel = selectedChannel(); if (channel) playChannel(channel); renderNow(); });
  dom.languageSelect.addEventListener('change', () => { state.language = dom.languageSelect.value; safeSet('tclv.language', state.language); renderAll(); });
  dom.logoFile.addEventListener('change', async () => { const file = dom.logoFile.files?.[0]; if (!file || !state.selectedLogoChannelId) return; const dataUrl = await readFileAsDataUrl(file); safeSet(`tclv.logo.${state.selectedLogoChannelId}`, dataUrl); dom.logoFile.value = ''; renderAll(); });
}
function init() { bindEvents(); state.player = dom.playerSelect.value = state.player; state.language = translations[state.language] ? state.language : 'sk'; if (dom.corsProxyInput) dom.corsProxyInput.value = state.corsProxy; renderSourceLists(); if (state.playlists.length && state.activePlaylistId) activatePlaylist(state.activePlaylistId); else renderAll(); setInterval(() => { renderNow(); renderGuide(); document.querySelectorAll('.channel-card').forEach((card) => { const ch = state.channels.find((c) => c.id === card.dataset.channelId); if (!ch) return; const prog = currentProgram(ch); const bar = card.querySelector('.progress-track span'); if (bar) bar.style.width = progress(prog) + '%'; const txt = card.querySelector('.channel-text p'); if (txt) txt.textContent = prog?.title || ''; }); }, 60 * 1000); }
init();
