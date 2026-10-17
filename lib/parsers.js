"use strict";
(function(root) {
function normalizeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
function epgKeys(value) {
  const text = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!text) return [];
  const variants = [text, text.replace(/\.(sk|cz|hu|pl|at|de|uk|us|int)$/i, '')];
  for (const item of [...variants]) variants.push(item.replace(/\b(uhd|fhd|hd|sd|4k|8k)\b/gi, ''));
  return [...new Set(variants.map(item => item.replace(/[^\p{L}\p{N}]+/gu, '')).filter(Boolean))];
}

const idCounters = new WeakMap();
function uniqueId(seed, existing) {
  const base = normalizeId(seed) || "channel";
  const ids = existing instanceof Set ? existing : new Set(existing.map((item) => item.id));
  let value = base;
  let counters = idCounters.get(ids);
  if (!counters) { counters = new Map(); idCounters.set(ids, counters); }
  let counter = counters.get(base) || 2;
  while (ids.has(value)) { value = `${base}-${counter}`; counter += 1; }
  counters.set(base, counter);
  if (existing instanceof Set) existing.add(value);
  return value;
}

function decodeEntities(text) {
  return text.replace(/&(?:amp|quot|apos|lt|gt|#(?:x[0-9a-f]+|[0-9]+));/gi, entity => {
    const names = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (names[entity.toLowerCase()]) return names[entity.toLowerCase()];
    const code = parseInt(entity.slice(entity[2].toLowerCase() === 'x' ? 3 : 2, -1), entity[2].toLowerCase() === 'x' ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}
function streamUrl(value) { return /^(https?|rtsps?|rtmps?|udp|rtp):\/\//i.test(value || ''); }
function attributeEnd(text) {
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    if (quote) { if (text[i] === quote) quote = ''; }
    else if (text[i] === '"' || text[i] === "'") quote = text[i];
    else if (text[i] === ',') return i;
  }
  return -1;
}
function attr(text, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(pattern);
  return match ? decodeEntities((match[2] || match[3] || match[4] || "").trim()) : "";
}

function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = [];
  const ids = new Set();
  let meta = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      const commaIndex = attributeEnd(line);
      const info = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      meta = {
        name: attr(info, "tvg-name") || title || "Channel",
        tvgId: attr(info, "tvg-id") || attr(info, "channel-id") || "",
        tvgName: attr(info, "tvg-name"), tvgUrl: attr(info, "tvg-url"), tvgCountry: attr(info, "tvg-country"),
        logo: attr(info, "tvg-logo") || "",
        group: attr(info, "group-title") || "",
        catchup: attr(info, "catchup"), catchupSource: attr(info, "catchup-source") || attr(info, "catchup_source"),
        catchupDays: Math.max(0, Math.min(30, parseInt(attr(info, "catchup-days") || attr(info, "catchup_days") || "0", 10) || 0)),
      };
      continue;
    }
    if (!line.startsWith("#") && streamUrl(line)) {
      const name = meta?.name || line.split("/").pop() || "Channel";
      const tvgId = meta?.tvgId || "";
      channels.push({
        id: uniqueId(tvgId || name || line, ids),
        tvgId, name, tvgName: meta?.tvgName || "", tvgUrl: meta?.tvgUrl || "", tvgCountry: meta?.tvgCountry || "", logo: meta?.logo || "", group: meta?.group || "", url: line,
        catchup: meta?.catchup || "", catchupSource: meta?.catchupSource || "", catchupDays: meta?.catchupDays || 0,
      });
      meta = null;
    }
  }
  return channels;
}

function parseXmlTvDate(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  let timestamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  if (sign) {
    const offset = ((+offsetHour * 60) + +offsetMinute) * 60 * 1000;
    timestamp += sign === "+" ? -offset : offset;
  }
  return new Date(timestamp);
}

function sanitizeLogoUrl(url) {
  if (typeof url !== "string" || !url || url.length > 1024 * 1024) return null;
  if (/^(https?:\/\/|data:image\/)/i.test(url)) return url;
  return null;
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const parsers = { decodeEntities, streamUrl, normalizeId, epgKeys, uniqueId, attr, parseM3U, parseXmlTvDate, sanitizeLogoUrl, hashCode };
if (typeof module !== "undefined") module.exports = parsers;
else root.TCLVParsers = parsers;
})(globalThis);
