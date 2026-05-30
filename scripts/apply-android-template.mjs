import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
    if (/android:banner=/.test(attrs)) return match;
    return `<application${attrs} android:banner="@mipmap/ic_launcher">`;
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
