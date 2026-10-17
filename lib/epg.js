/* global require */
"use strict";
(function(root) {
  const { epgKeys } = typeof module !== 'undefined' ? require('./parsers.js') : root.TCLVParsers;
  function country(value) { return String(value || '').match(/\.(sk|cz|hu|pl|at|de|uk|us|int)$/i)?.[1].toLowerCase() || ''; }
  function identity(value) {
    const keys = epgKeys(value);
    return country(value) + ':' + (keys[keys.length - 1] || '');
  }
  function sourceKey(value) {
    try { const url = new URL(value); url.pathname = url.pathname.replace(/\.xml\.gz$/i, '.xml'); return url.href; } catch { return String(value || ''); }
  }
  function downloadUrls(value) {
    const original = String(value); const url = new URL(original);
    // Only this public provider's advertised companion gzip URLs are verified.
    if (['www.open-epg.com', 'open-epg.com'].includes(url.hostname.toLowerCase()) && !url.search && !url.username && !url.password && !url.port && /^\/files\/[a-z0-9_-]+\.xml$/i.test(url.pathname)) {
      url.pathname += '.gz'; return [url.href, original];
    }
    if (/\.xml\.gz$/i.test(url.pathname)) { url.pathname = url.pathname.slice(0, -3); return [original, url.href]; }
    return [original];
  }
  function activeProgram(programs, now = Date.now()) {
    let lo = 0, hi = programs.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (+programs[mid].start <= now) lo = mid + 1; else hi = mid; }
    // Providers can publish overlapping entries. An expired short entry must not
    // hide a still-running programme that started earlier.
    for (let i = lo - 1; i >= 0; i--) if (+programs[i].stop > now) return programs[i];
    return null;
  }
  function buildIndex(epg) {
    const aliases = new Map(), ids = new Map(), normalizedIds = new Map();
    for (const [id, programs] of epg) {
      const sources = new Map();
      for (const program of programs) { const key = sourceKey(program.epgSource); if (!sources.has(key)) sources.set(key, []); sources.get(key).push(program); }
      for (const [source, items] of sources) {
        const row = { id, source, identity: identity(id), country: country(id), programs: items, last: items.reduce((latest, item) => Math.max(latest, +item.stop), 0) };
        if (!ids.has(id)) ids.set(id, []); ids.get(id).push(row);
        const normalizedId = epgKeys(id)[0];
        if (!normalizedIds.has(normalizedId)) normalizedIds.set(normalizedId, []); normalizedIds.get(normalizedId).push(row);
        const names = new Set((items[0]?.channelNames || [items[0]?.channelName]).filter(Boolean));
        if (!row.country) row.country = [...names].map(country).find(Boolean) || '';
        for (const key of new Set([id, ...names].flatMap(epgKeys))) {
          if (!aliases.has(key)) aliases.set(key, new Set()); aliases.get(key).add(row);
        }
      }
    }
    return { aliases, ids, normalizedIds };
  }
  function programsFor(index, channel, extraAliases = [], now = Date.now()) {
    const exact = index.ids.get(channel.tvgId) || index.normalizedIds.get(epgKeys(channel.tvgId)[0]) || index.ids.get(channel.id) || [];
    const wantedCountry = country(channel.tvgId) || String(channel.tvgCountry || '').toLowerCase() || country(channel.tvgName);
    const matches = new Set(exact);
    for (const key of [channel.tvgId, channel.id, channel.name, channel.tvgName, ...extraAliases].flatMap(epgKeys)) for (const row of index.aliases.get(key) || []) matches.add(row);
    let rows = [...matches].filter(row => !wantedCountry || !row.country || row.country === wantedCountry);
    // Same-country HD/SD IDs denote the same station; distinct station IDs or
    // different countries stay ambiguous unless an exact identifier resolves it.
    const exactIdentity = exact.find(row => !wantedCountry || !row.country || row.country === wantedCountry)?.identity;
    if (exactIdentity) rows = rows.filter(row => row.identity === exactIdentity);
    if (new Set(rows.map(row => row.identity)).size !== 1) return [];
    const preferred = sourceKey(channel.tvgUrl);
    const rank = row => activeProgram(row.programs, now) ? 2 : row.last > now ? 1 : 0;
    rows.sort((a, b) => rank(b) - rank(a) || Number(b.source === preferred) - Number(a.source === preferred) || b.last - a.last);
    return rows[0]?.programs || [];
  }
  const api = { country, identity, sourceKey, downloadUrls, buildIndex, programsFor, activeProgram };
  if (typeof module !== 'undefined') module.exports = api; else root.TCLVEpg = api;
})(globalThis);
