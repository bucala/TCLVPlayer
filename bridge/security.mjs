import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function bridgeError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export function parseTarget(raw) {
  if (typeof raw !== "string" || raw.length > 8192) throw bridgeError(400, "Invalid target URL");
  let url;
  try { url = new URL(raw); } catch { throw bridgeError(400, "Invalid target URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw bridgeError(400, "Only HTTP(S) URLs without URL userinfo are supported");
  }
  url.hash = "";
  return url;
}

function ipv6Groups(address) {
  const normalized = address.replace(/(\d+\.\d+\.\d+\.\d+)$/, value => {
    const bytes = value.split(".").map(Number);
    return ((bytes[0] << 8) | bytes[1]).toString(16) + ":" + ((bytes[2] << 8) | bytes[3]).toString(16);
  });
  const [left, right] = normalized.split("::");
  const first = left ? left.split(":").map(value => parseInt(value, 16)) : [];
  if (right === undefined) return first;
  const last = right ? right.split(":").map(value => parseInt(value, 16)) : [];
  return [...first, ...Array(8 - first.length - last.length).fill(0), ...last];
}

export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 192 && b === 2) ||
      (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version !== 6) return false;
  const groups = ipv6Groups(address.toLowerCase());
  if (groups.slice(0, 5).every(value => value === 0) && groups[5] === 0xffff) {
    return isPublicAddress([groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join("."));
  }
  return groups[0] >= 0x2000 && groups[0] <= 0x3fff && groups[0] !== 0x2002 &&
    !(groups[0] === 0x2001 && (groups[1] === 0 || groups[1] === 0xdb8));
}

export async function resolveTarget(url, resolve = lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || /\.(localhost|local|internal)$/.test(hostname)) {
    throw bridgeError(403, "Private network targets are not allowed");
  }
  let addresses;
  try {
    addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] :
      await resolve(hostname, { all: true, verbatim: true });
  } catch { throw bridgeError(502, "Could not resolve provider"); }
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
    throw bridgeError(403, "Private network targets are not allowed");
  }
  // Pin the vetted DNS answer for this request, including each redirect.
  return function checkedLookup(_host, options, callback) {
    if (typeof options === "function") { callback = options; options = {}; }
    const matches = options.family ? addresses.filter(entry => entry.family === options.family) : addresses;
    if (!matches.length) { callback(bridgeError(502, "No usable provider address")); return; }
    if (options.all) callback(null, matches);
    else callback(null, matches[0].address, matches[0].family);
  };
}
