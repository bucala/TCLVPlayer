import { readFile, mkdtemp, copyFile, cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createBridgePackage } from "../scripts/bridge-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
async function scratch(task) {
  const folder = await mkdtemp(join(tmpdir(), "tclv-bridge-build-"));
  try { await task(folder); } finally { await rm(folder, { recursive: true, force: true }); }
}

function unzip(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    expect(buffer.readUInt16LE(offset + 6)).toBe(0x800);
    const size = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const start = offset + 30;
    const name = buffer.subarray(start, start + nameSize).toString();
    const data = buffer.subarray(start + nameSize + extraSize, start + nameSize + extraSize + size);
    files.set(name, inflateRawSync(data));
    offset = start + nameSize + extraSize + size;
  }
  expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
  expect(buffer.readUInt32LE(buffer.length - 22)).toBe(0x06054b50);
  return files;
}

describe("web-only bridge delivery", () => {
  it("packages a standalone bridge with no npm dependencies or private configuration", async () => {
    await scratch(async folder => {
      const output = join(folder, "bridge.zip");
      await createBridgePackage(output);
      const files = unzip(await readFile(output));
      expect([...files.keys()]).toEqual(["TCLV-Bridge/start.mjs", "TCLV-Bridge/server.mjs", "TCLV-Bridge/security.mjs",
        "TCLV-Bridge/Start TCLV Bridge.cmd", "TCLV-Bridge/README.txt", "TCLV-Bridge/LICENSE"]);
      expect(files.get("TCLV-Bridge/server.mjs").toString()).toContain("randomBytes(6)");
      expect(files.get("TCLV-Bridge/Start TCLV Bridge.cmd").toString()).not.toContain("npm");
    });
  });
  it("preserves native web assets byte-for-byte and adds the bridge only to the Vercel build", async () => {
    await scratch(async folder => {
      for (const name of ["index.html", "app.js", "styles.css", "favicon.svg"]) await copyFile(join(root, name), join(folder, name));
      await cp(join(root, "web"), join(folder, "web"), { recursive: true });
      const script = join(root, "scripts/copy-web.mjs");
      execFileSync(process.execPath, [script], { cwd: folder });
      for (const name of ["index.html", "app.js", "styles.css", "favicon.svg"]) {
        expect(await readFile(join(folder, "dist/web", name))).toEqual(await readFile(join(root, name)));
      }
      execFileSync(process.execPath, [script, "--vercel"], { cwd: folder });
      const app = await readFile(join(folder, "dist/vercel/app.js"), "utf8");
      expect(app).toContain("window.TCLVWebPlayer({");
      expect(app.indexOf("window.TCLVWebPlayer({")).toBeLessThan(app.lastIndexOf("init();"));
      const html = await readFile(join(folder, "dist/vercel/index.html"), "utf8");
      expect(html).toContain("bridge-client.js");
      expect(html).toContain("bridge-player.js");
      expect(html).toContain("bridge.css");
      unzip(await readFile(join(folder, "dist/vercel/downloads/TCLV-Bridge.zip")));
      execFileSync(process.execPath, ["--check", join(folder, "dist/vercel/app.js")]);
    });
  });
});
