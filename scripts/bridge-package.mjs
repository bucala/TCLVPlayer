import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
export const WINDOWS_NODE_VERSION = "v24.16.0";
const RELEASE_URL = `https://nodejs.org/dist/${WINDOWS_NODE_VERSION}/`;
const MAX_RUNTIME_BYTES = 120 * 1024 * 1024;

async function download(url, maximum, request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await request(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maximum) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Could not download the official Windows runtime");
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maximum) throw new Error("Official runtime download exceeded its size limit");
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks, size);
  } finally { clearTimeout(timer); }
}

export async function downloadWindowsRuntime({ request = fetch } = {}) {
  const [checksums, executable, license] = await Promise.all([
    download(RELEASE_URL + "SHASUMS256.txt", 128 * 1024, request),
    download(RELEASE_URL + "win-x64/node.exe", MAX_RUNTIME_BYTES, request),
    download(`https://raw.githubusercontent.com/nodejs/node/${WINDOWS_NODE_VERSION}/LICENSE`, 2 * 1024 * 1024, request),
  ]);
  const expected = checksums.toString("utf8").match(/^([a-f0-9]{64})\s+win-x64\/node\.exe\s*$/m)?.[1];
  const actual = createHash("sha256").update(executable).digest("hex");
  if (!expected || actual !== expected || executable.subarray(0, 2).toString() !== "MZ") {
    throw new Error("Official Windows runtime failed checksum verification");
  }
  return { executable, license, version: WINDOWS_NODE_VERSION };
}
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

export async function createBridgePackage(destination, { runtime = false, loadRuntime = downloadWindowsRuntime } = {}) {
  const files = ["start.mjs", "server.mjs", "security.mjs", "Start TCLV Bridge.cmd", "README.txt"];
  const entries = await Promise.all(files.map(async name => ({ name: "TCLV-Bridge/" + name, data: await readFile(resolve(root, "bridge", name)) })));
  entries.push({ name: "TCLV-Bridge/LICENSE", data: await readFile(resolve(root, "LICENSE")) });
  if (runtime) {
    const windows = await loadRuntime();
    entries.push({ name: "TCLV-Bridge/node.exe", data: windows.executable });
    entries.push({ name: "TCLV-Bridge/NODE-LICENSE", data: windows.license });
    entries.push({ name: "TCLV-Bridge/NODE-VERSION.txt", data: Buffer.from(windows.version + "\n") });
  }
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(33, 12); // stable 1980-01-01 date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.concat([...localParts, directory, end]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = process.argv.includes("--runtime");
  const destination = resolve(root, "dist/bridge", runtime ? "TCLV-Bridge-Windows-portable.zip" : "TCLV-Bridge.zip");
  await createBridgePackage(destination, { runtime });
  console.log("Bridge package:", destination);
}
