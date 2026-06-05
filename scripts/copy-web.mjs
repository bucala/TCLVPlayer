import { cp, mkdir, copyFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const outDir = join("dist", "web");
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

const optionalCopies = [
  ["node_modules/video.js/dist/video.min.js", "vendor/video.js/video.min.js"],
  ["node_modules/video.js/dist/video-js.min.css", "vendor/video.js/video-js.min.css"],
  ["node_modules/artplayer/dist/artplayer.js", "vendor/artplayer/artplayer.js"],
  ["node_modules/hls.js/dist/hls.min.js", "vendor/hls.js/hls.min.js"],
  ["node_modules/mpegts.js/dist/mpegts.min.js", "vendor/mpegts.js/mpegts.min.js"],
];

for (const [source, target] of optionalCopies) {
  try {
    const destination = join(outDir, target);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { force: true });
  } catch {
    // Dependencies may not be installed yet; CDN fallback remains available.
  }
}
