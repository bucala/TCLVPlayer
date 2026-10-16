# Android / Android TV

Use `npm run android:generate`, `npm run android:studio`, or `npm run android:apk`.
Requires Node >=22.19, JDK 21, SDK 36. `android/` is generated and ignored.

`PlaybackService` owns the Media3 ExoPlayer and foreground MediaSession. `TCLVPlayerPlugin` attaches the native video surface to the web UI, maintains the in-memory channel queue, handles export via SAF, media controls and PiP. `MainActivity` routes each remote direction exactly once. This avoids decoding video in a WebView on weak TV hardware.

Templates (Java and resources) live here; the generator also injects media3 dependencies, private-data backup policy, foreground permissions/service, app version and optional release signing. No channel list, credentials or signing key belongs here.

Release environment variables and device verification instructions are in the root README. Keep an existing signing key to support upgrades. Debug APK is for local testing and uses the Android debug certificate.
