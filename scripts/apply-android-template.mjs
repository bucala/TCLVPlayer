import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const packagePath = join("android", "app", "src", "main", "java", "sk", "tclv", "player");
const manifestPath = join("android", "app", "src", "main", "AndroidManifest.xml");

const classes = ["TCLVPlayerPlugin", "MainActivity", "BootReceiver", "PlaybackService"];

try {
  await access(manifestPath);
} catch {
  console.error(
    "Android project is missing. Run `npm run android:setup` or `npm run android:sync` first so Capacitor can create android/.",
  );
  process.exit(1);
}

for (const cls of classes) {
  let source = join("native", "android", `${cls}.java`);
  let target = join(packagePath, `${cls}.java`);
  let other = join(packagePath, `${cls}.kt`);

  try {
    await access(source);
  } catch {
    source = join("native", "android", `${cls}.kt`);
    target = join(packagePath, `${cls}.kt`);
    other = join(packagePath, `${cls}.java`);
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  await rm(other, { force: true });
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
    '    <uses-permission android:name="android.permission.WAKE_LOCK" />',
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
    '    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
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
      attrs += ' android:banner="@drawable/tv_banner"';
    }
    if (!(/android:theme=/.test(attrs))) {
      attrs += ' android:theme="@style/AppTheme"';
    }
    return `<application${attrs}>`;
  },
);

manifest = removeGeneratedMainIntentFilters(manifest);

if (!manifest.includes("android.intent.category.LEANBACK_LAUNCHER")) {
  manifest = manifest.replace(
    /(<activity\b[\s\S]*?android:name="\.MainActivity"[\s\S]*?)(\s*<\/activity>)/,
    (match, activityBody, closeTag) =>
      `${activityBody}\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />\n            </intent-filter>\n${closeTag}`,
  );
}

if (!manifest.includes('android:supportsPictureInPicture')) {
  manifest = manifest.replace(
    /(android:name="\.MainActivity")/,
    (match) => `${match}\n            android:supportsPictureInPicture="true"`,
  );
}

if (manifest.includes('android:configChanges=') && !manifest.includes('smallestScreenSize')) {
  manifest = manifest.replace(
    /android:configChanges="([^"]*)"/,
    (match, val) => `android:configChanges="${val}|smallestScreenSize"`,
  );
}

if (!manifest.includes('BootReceiver')) {
  manifest = manifest.replace(
    /(\s*)<\/application>/,
    `\n        <receiver\n            android:name=".BootReceiver"\n            android:enabled="false"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.BOOT_COMPLETED" />\n            </intent-filter>\n        </receiver>\n$1</application>`,
  );
}

manifest = manifest.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!manifest.includes('android:dataExtractionRules=')) manifest = manifest.replace('<application', '<application android:dataExtractionRules="@xml/tclv_data_extraction_rules" android:fullBackupContent="@xml/tclv_backup_rules"');
// Capacitor appends INTERNET after application; keep all permissions at manifest root before application.
manifest = manifest.replace(/\s*<uses-permission android:name="android.permission.INTERNET"\s*\/>/g, '');
manifest = manifest.replace(/<manifest\b[^>]*>/, match => match + '\n    <uses-permission android:name="android.permission.INTERNET" />');
if (!manifest.includes('.PlaybackService')) manifest = manifest.replace('</application>', `
        <service android:name=".PlaybackService" android:exported="true" android:foregroundServiceType="mediaPlayback">
            <intent-filter><action android:name="androidx.media3.session.MediaSessionService" /></intent-filter>
        </service>
    </application>`);
await writeFile(manifestPath, manifest);
const gradlePath = join('android', 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const version = pkg.version.split('.').map(Number);
const versionCode = version[0] * 1000000 + version[1] * 1000 + version[2];
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + versionCode).replace(/versionName\s+"[^"]+"/, 'versionName "' + pkg.version + '"');
if (!gradle.includes('tclv-media3')) gradle += `
// tclv-media3: native hardware decoding + foreground MediaSession; no provider data here.
dependencies {
    implementation "androidx.media3:media3-exoplayer:1.11.1"
    implementation "androidx.media3:media3-exoplayer-hls:1.11.1"
    implementation "androidx.media3:media3-exoplayer-rtsp:1.11.1"
    implementation "androidx.media3:media3-session:1.11.1"
    implementation "androidx.media3:media3-ui:1.11.1"
}
// Release keys are supplied only through environment variables, never committed.
def tclvKey = System.getenv('TCLV_ANDROID_KEYSTORE')
if (tclvKey) {
    android.signingConfigs.create('tclvRelease') {
        storeFile file(tclvKey)
        storePassword System.getenv('TCLV_ANDROID_STORE_PASSWORD')
        keyAlias System.getenv('TCLV_ANDROID_KEY_ALIAS')
        keyPassword System.getenv('TCLV_ANDROID_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.tclvRelease
}
`;
await writeFile(gradlePath, gradle);

function addAfter(text, marker, additions) {
  const missing = additions.filter((line) => !text.includes(line.trim()));
  if (!missing.length) return text;
  return text.replace(marker, (match) => `${match}\n${missing.join("\n")}`);
}

function removeGeneratedMainIntentFilters(text) {
  return text
    .replace(
      /\n\s*<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<category android:name="android\.intent\.category\.LEANBACK_LAUNCHER"\s*\/>\s*<\/intent-filter>/g,
      "",
    )
    .replace(
      /\n\s*<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<\/intent-filter>/g,
      "",
    );
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
