export function normalizeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function uniqueId(seed, existing) {
  const base = normalizeId(seed) || "channel";
  const ids = new Set(existing.map((item) => item.id));
  let value = base;
  let counter = 2;
  while (ids.has(value)) { value = `${base}-${counter}`; counter += 1; }
  return value;
}

export function attr(text, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(pattern);
  return match ? (match[2] || match[3] || match[4] || "").trim() : "";
}

export function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = [];
  let meta = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      const commaIndex = line.indexOf(",");
      const info = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      meta = {
        name: attr(info, "tvg-name") || title || "Channel",
        tvgId: attr(info, "tvg-id") || attr(info, "channel-id") || "",
        logo: attr(info, "tvg-logo") || "",
        group: attr(info, "group-title") || "",
      };
      continue;
    }
    if (!line.startsWith("#")) {
      const name = meta?.name || line.split("/").pop() || "Channel";
      const tvgId = meta?.tvgId || "";
      channels.push({
        id: uniqueId(tvgId || name || line, channels),
        tvgId, name, logo: meta?.logo || "", group: meta?.group || "", url: line,
      });
      meta = null;
    }
  }
  return channels;
}

export function parseXmlTvDate(value) {
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

export function sanitizeLogoUrl(url) {
  if (!url) return null;
  if (/^(https?:\/\/|data:image\/)/i.test(url)) return url;
  return null;
}

export function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
