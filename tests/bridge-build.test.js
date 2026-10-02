import { readFile, mkdtemp, copyFile, cp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { createBridgePackage, downloadWindowsRuntime, WINDOWS_NODE_VERSION } from "../scripts/bridge-package.mjs";

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
  it("includes the Windows executable and its matching license without depending on the build OS", async () => {
    await scratch(async folder => {
      const output = join(folder, "portable.zip");
      await createBridgePackage(output, {
        runtime: true, loadRuntime: async () => ({
          executable: Buffer.from("MZtest-runtime"), license: Buffer.from("Test Node license"), version: WINDOWS_NODE_VERSION,
        }),
      });
      const files = unzip(await readFile(output));
      expect(files.get("TCLV-Bridge/node.exe").toString()).toBe("MZtest-runtime");
      expect(files.get("TCLV-Bridge/NODE-LICENSE").toString()).toBe("Test Node license");
      expect(files.get("TCLV-Bridge/NODE-VERSION.txt").toString().trim()).toBe(WINDOWS_NODE_VERSION);
      expect(files.get("TCLV-Bridge/Start TCLV Bridge.cmd").toString()).toContain('if exist "node.exe"');
    });
  });
  it("verifies the official release checksum before bundling downloaded code", async () => {
    const executable = Buffer.from("MZtest-runtime");
    const checksum = createHash("sha256").update(executable).digest("hex");
    const request = vi.fn().mockImplementation(async url => {
      if (url.endsWith("SHASUMS256.txt")) return new Response(checksum + "  win-x64/node.exe\n");
      if (url.endsWith("node.exe")) return new Response(executable);
      return new Response("Test Node license");
    });
    expect(await downloadWindowsRuntime({ request })).toEqual({ executable, license: Buffer.from("Test Node license"), version: WINDOWS_NODE_VERSION });
    expect(request.mock.calls.every(([url, options]) => url.startsWith("https://") && options.redirect === "error")).toBe(true);
    request.mockImplementation(async url => url.endsWith("SHASUMS256.txt") ?
      new Response("0".repeat(64) + "  win-x64/node.exe\n") : new Response(executable));
    await expect(downloadWindowsRuntime({ request })).rejects.toThrow("checksum verification");
  });
  it("rejects missing or oversized official runtime downloads", async () => {
    await expect(downloadWindowsRuntime({ request: async () => new Response(null, { status: 404 }) })).rejects.toThrow();
    await expect(downloadWindowsRuntime({ request: async () => new Response(null) })).rejects.toThrow("Could not download");
    await expect(downloadWindowsRuntime({ request: async () => new Response("large", {
      headers: { "Content-Length": String(121 * 1024 * 1024) },
    }) })).rejects.toThrow();
  });
  it("rejects oversized streams without trusting Content-Length", async () => {
    let cancelled = false;
    const request = async url => {
      if (!url.endsWith("SHASUMS256.txt")) return new Response("test");
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(128 * 1024 + 1)); },
        cancel() { cancelled = true; },
      }));
    };
    await expect(downloadWindowsRuntime({ request })).rejects.toThrow("size limit");
    expect(cancelled).toBe(true);
  });
  it("rejects a missing checksum or a non-Windows executable", async () => {
    const executable = Buffer.from("not-a-Windows-runtime");
    const checksum = createHash("sha256").update(executable).digest("hex");
    const request = async url => new Response(url.endsWith("SHASUMS256.txt") ?
      checksum + "  win-x64/node.exe\n" : executable);
    await expect(downloadWindowsRuntime({ request })).rejects.toThrow("checksum verification");
    await expect(downloadWindowsRuntime({ request: async () => new Response("no checksum") })).rejects.toThrow("checksum verification");
  });
  it.runIf(process.platform === "win32")("runs the bundled Windows launcher without Node.js on PATH", async () => {
    await scratch(async folder => {
      await copyFile(join(root, "bridge/Start TCLV Bridge.cmd"), join(folder, "launch.cmd"));
      await copyFile(process.execPath, join(folder, "node.exe"));
      await writeFile(join(folder, "start.mjs"), 'console.log("Runtime:", process.execPath);\n');
      const output = execFileSync(process.env.ComSpec, ["/d", "/c", "launch.cmd"], {
        cwd: folder, env: { ...process.env, PATH: join(process.env.SystemRoot, "System32") },
        input: "\r\n", encoding: "utf8", timeout: 10000,
      });
      expect(output).toContain("Runtime: " + join(folder, "node.exe"));
    });
  });
  it.runIf(process.platform === "win32")("explains complete extraction when only the launcher was extracted", async () => {
    await scratch(async folder => {
      await copyFile(join(root, "bridge/Start TCLV Bridge.cmd"), join(folder, "launch.cmd"));
      let failure;
      try {
        execFileSync(process.env.ComSpec, ["/d", "/c", "launch.cmd"], {
          cwd: folder, input: "\r\n", encoding: "utf8", timeout: 10000,
        });
      } catch (error) { failure = error; }
      expect(failure?.status).toBe(1);
      expect(failure?.stdout).toContain("Extract the WHOLE ZIP first");
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
      execFileSync(process.execPath, [script, "--vercel", "--source-bridge"], { cwd: folder });
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
  it("includes the official Windows runtime in a normal Vercel build by default", async () => {
    await scratch(async folder => {
      for (const name of ["index.html", "app.js", "styles.css", "favicon.svg"]) await copyFile(join(root, name), join(folder, name));
      await cp(join(root, "web"), join(folder, "web"), { recursive: true });
      const executable = "MZtest-runtime";
      const checksum = createHash("sha256").update(executable).digest("hex");
      const preload = join(folder, "mock-runtime.mjs");
      await writeFile(preload, `globalThis.fetch = async url => new Response(url.endsWith("SHASUMS256.txt") ?
        "${checksum}  win-x64/node.exe\\n" : url.endsWith("node.exe") ? "${executable}" : "Test Node license");\n`);
      execFileSync(process.execPath, ["--import", pathToFileURL(preload).href, join(root, "scripts/copy-web.mjs"), "--vercel"], { cwd: folder });
      const files = unzip(await readFile(join(folder, "dist/vercel/downloads/TCLV-Bridge.zip")));
      expect(files.get("TCLV-Bridge/node.exe").toString()).toBe(executable);
      expect(files.get("TCLV-Bridge/NODE-LICENSE").toString()).toBe("Test Node license");
      expect(files.get("TCLV-Bridge/NODE-VERSION.txt").toString().trim()).toBe(WINDOWS_NODE_VERSION);
    });
  });
});
