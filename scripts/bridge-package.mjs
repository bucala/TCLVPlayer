import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
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

export async function createBridgePackage(destination, { runtime = false } = {}) {
  const files = ["start.mjs", "server.mjs", "security.mjs", "Start TCLV Bridge.cmd", "README.txt"];
  const entries = await Promise.all(files.map(async name => ({ name: "TCLV-Bridge/" + name, data: await readFile(resolve(root, "bridge", name)) })));
  entries.push({ name: "TCLV-Bridge/LICENSE", data: await readFile(resolve(root, "LICENSE")) });
  if (runtime) {
    if (process.platform !== "win32") throw new Error("Portable Windows runtime packaging must run on Windows");
    entries.push({ name: "TCLV-Bridge/node.exe", data: await readFile(process.execPath) });
    const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);
    if (!license.ok || Number(license.headers.get("content-length")) > 2 * 1024 * 1024) throw new Error("Could not obtain the matching Node.js license");
    const licenseData = Buffer.from(await license.arrayBuffer());
    if (licenseData.length > 2 * 1024 * 1024) throw new Error("Unexpected Node.js license size");
    entries.push({ name: "TCLV-Bridge/NODE-LICENSE", data: licenseData });
    entries.push({ name: "TCLV-Bridge/NODE-VERSION.txt", data: Buffer.from(process.version + "\n") });
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
