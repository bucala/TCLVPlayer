import { cp, mkdir, copyFile, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createBridgePackage } from "./bridge-package.mjs";

const browserBuild = process.argv.includes("--vercel");
const outDir = join("dist", browserBuild ? "vercel" : "web");
const files = [
  ["index.html", "index.html"],
  ["styles.css", "styles.css"],
  ["app.js", "app.js"],
  ["favicon.svg", "favicon.svg"],
 ];

await rm(outDir, { recursive: true, force: true });

for (const [source, target] of files) {
  const destination = join(outDir, target);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

for (const name of ['LICENSE', 'THIRDPARTY.md']) await copyFile(new URL('../' + name, import.meta.url), join(outDir, name));
for (const file of ['parsers.js', 'storage.js', 'backup.js', 'epg-worker.js', 'android-player.js']) {
  await mkdir(join(outDir, 'lib'), { recursive: true });
  await copyFile(new URL('../lib/' + file, import.meta.url), join(outDir, 'lib', file));
}
const vendorCopies = [
  ["node_modules/sax/lib/sax.js", "vendor/sax/sax.js"],
  ["node_modules/video.js/dist/video.min.js", "vendor/video.js/video.min.js"],
  ["node_modules/video.js/dist/video-js.min.css", "vendor/video.js/video-js.min.css"],
  ["node_modules/artplayer/dist/artplayer.js", "vendor/artplayer/artplayer.js"],
  ["node_modules/hls.js/dist/hls.min.js", "vendor/hls.js/hls.min.js"],
  ["node_modules/mpegts.js/dist/mpegts.js", "vendor/mpegts.js/mpegts.min.js"],
  ["node_modules/flv.js/dist/flv.min.js", "vendor/flv.js/flv.min.js"],
  ["node_modules/jquery/dist/jquery.min.js", "vendor/jquery/jquery.min.js"],
  ["node_modules/jplayer/dist/jplayer/jquery.jplayer.min.js", "vendor/jplayer/jquery.jplayer.min.js"],
];

for (const [source, target] of vendorCopies) {
  const destination = join(outDir, target);
  await mkdir(dirname(destination), { recursive: true });
  // Every runtime asset is bundled; a missing dependency must fail the build.
  await cp(new URL('../' + source, import.meta.url), destination, { force: true });
}

for (const name of ['video.js', 'artplayer', 'hls.js', 'mpegts.js', 'flv.js', 'jquery', 'jplayer', 'sax']) {
  const folder = new URL('../node_modules/' + name + '/', import.meta.url);
  for (const file of await readdir(folder)) if (/licen[cs]e|^notice|^copying/i.test(file)) {
    const destination = join(outDir, 'vendor', 'licenses', name, file);
    await mkdir(dirname(destination), { recursive: true }); await cp(new URL(file, folder), destination);
  }
}

if (browserBuild) {
  for (const file of ["bridge-client.js", "bridge-player.js", "bridge.css"]) {
    await copyFile(join("web", file), join(outDir, file));
  }
  const hostNames = [
    "state", "dom", "translations", "safeGet", "safeSet", "t", "detectLocalProxy", "detectCorsProxySync",
    "canProxyStreams", "needsProxy", "isBlockedWebStream", "getStreamType", "playChannel", "playInSlot1",
    "destroySlot1", "fetchWebSource", "translateUi", "setStreamStatus", "stopInternalPlayers", "showMessage",
    "ensureVideoJs", "ensureArtPlayer", "ensureJPlayer", "ensureMpegts", "ensureFlvJs", "ensureHls",
    "openSettings", "isMixedContent", "decodeWebSourceResponse",
  ];
  const host = hostNames.map(name => `get ${name}() { return ${name}; }, set ${name}(value) { ${name} = value; }`).join(",\n");
  const app = await readFile("app.js", "utf8");
  if (!/init\(\);\s*$/.test(app)) throw new Error("Cannot attach browser-only bridge before init");
  await writeFile(join(outDir, "app.js"), app.replace(/init\(\);\s*$/, `window.TCLVWebPlayer({\n${host}\n});\ninit();\n`));
  const html = await readFile("index.html", "utf8");
  await writeFile(join(outDir, "index.html"), html
    .replace('<link rel="stylesheet" href="./styles.css" />', '<link rel="stylesheet" href="./styles.css" />\n    <link rel="stylesheet" href="./bridge.css" />')
    .replace('<script src="./app.js"></script>', '<script src="./bridge-client.js"></script>\n    <script src="./bridge-player.js"></script>\n    <script src="./app.js"></script>'));
  // Tests can omit the large download; the normal Vercel build is self-contained.
  await createBridgePackage(join(outDir, "downloads", "TCLV-Bridge.zip"), {
    runtime: !process.argv.includes("--source-bridge"),
  });
}
