# Android and GoogleTV shell

This project uses Capacitor for Android and GoogleTV packaging. The shared UI lives in the repository root and is loaded by the Android WebView.

## Setup

Install dependencies first:

```powershell
npm install
```

Generate or update the Android Studio project:

```powershell
npm run android:generate
```

Open the generated project in Android Studio:

```powershell
npm run android:studio
```

Build a debug APK without opening Android Studio:

```powershell
npm run android:apk
```

The generator copies the Java native templates into the generated Android Studio project:

```text
android/app/src/main/java/sk/tclv/player/TCLVPlayerPlugin.java
android/app/src/main/java/sk/tclv/player/MainActivity.java
android/app/src/main/java/sk/tclv/player/BootReceiver.java
```

Templates are stored in this folder as `TCLVPlayerPlugin.java`, `MainActivity.java` and `BootReceiver.java`. Kotlin duplicates are removed during sync so Android Studio sees one native implementation that compiles in the default Capacitor project.

The `android/` folder is generated and ignored by Git. Commit source changes in the shared web files, `capacitor.config.json`, `scripts/`, or this `native/android/` template folder instead of committing Android Studio `.idea`, `.iml`, `build/`, or generated app files.

For GoogleTV, add leanback support to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
```

Add a separate Leanback launcher filter so TCLVPlayer appears on TV launchers without making Android Studio launch phone emulators through the TV category:

```xml
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
</intent-filter>
```

When debugging on a phone emulator, use the `app` run configuration. A log line that includes `-D --suspend` and then `Connected to the target VM` only means Android Studio started the app in debugger mode; it is not a crash by itself.

## External players

The Android bridge opens external playback via intents:

- VLC package: `org.videolan.vlc`
- MPV package: `is.xyz.mpv`

If the app is missing, TCLVPlayer shows an error and stays in the channel UI.
