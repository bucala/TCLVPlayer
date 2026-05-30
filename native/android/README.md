# Android and GoogleTV shell

This project uses Capacitor for Android and GoogleTV packaging. The shared UI lives in the repository root and is loaded by the Android WebView.

## Setup

Install dependencies first:

```powershell
npm install
```

Generate the Android project:

```powershell
npm run android:init
```

Copy these files:

```text
android/app/src/main/java/sk/tclv/player/TCLVPlayerPlugin.kt
android/app/src/main/java/sk/tclv/player/MainActivity.kt
```

Templates are stored in this folder as `TCLVPlayerPlugin.kt` and `MainActivity.kt`.

For GoogleTV, add leanback support to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
```

Add this category to the launcher activity intent filter so it appears on TV launchers:

```xml
<category android:name="android.intent.category.LEANBACK_LAUNCHER" />
```

## External players

The Android bridge opens external playback via intents:

- VLC package: `org.videolan.vlc`
- MPV package: `is.xyz.mpv`

If the app is missing, TCLVPlayer shows an error and stays in the channel UI.
