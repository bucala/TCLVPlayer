import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const packagePath = join("android", "app", "src", "main", "java", "sk", "tclv", "player");
const manifestPath = join("android", "app", "src", "main", "AndroidManifest.xml");

const files = [
  ["native/android/TCLVPlayerPlugin.kt", join(packagePath, "TCLVPlayerPlugin.kt")],
  ["native/android/MainActivity.kt", join(packagePath, "MainActivity.kt")],
];

for (const [source, target] of files) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

await copyDirectory(join("native", "android", "res"), join("android", "app", "src", "main", "res"));
await mkdir(join("android", "app", "src", "main", "res", "drawable"), { recursive: true });
await copyFile(
  join("assets", "icon.png"),
  join("android", "app", "src", "main", "res", "drawable", "tclv_icon.png"),
);

let manifest = await readFile(manifestPath, "utf8");

manifest = addAfter(
  manifest,
  /<manifest\b[^>]*>/,
  [
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-feature android:name="android.software.leanback" android:required="false" />',
    '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />',
  ],
);

manifest = manifest.replace(
  /<application\b([^>]*)>/,
  (match, attrs) => {
    if (!(/android:usesCleartextTraffic=/.test(attrs))) {
      attrs += ' android:usesCleartextTraffic="true"';
    }
    if (!(/android:banner=/.test(attrs))) {
      attrs += ' android:banner="@mipmap/ic_launcher"';
    }
    return `<application${attrs}>`;
  },
);

manifest = manifest.replace(
  /(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>)/,
  (match) => {
    if (manifest.includes("android.intent.category.LEANBACK_LAUNCHER")) return match;
    return `${match}\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />`;
  },
);

await writeFile(manifestPath, manifest);

function addAfter(text, marker, additions) {
  const missing = additions.filter((line) => !text.includes(line.trim()));
  if (!missing.length) return text;
  return text.replace(marker, (match) => `${match}\n${missing.join("\n")}`);
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}
