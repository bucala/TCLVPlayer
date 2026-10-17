# Android / Android TV

Use `npm run android:generate`, `npm run android:studio`, or `npm run android:apk`.
Requires Node >=22.19, JDK 21, SDK 36. `android/` is generated and ignored.

For current GitHub artifacts, open Actions → Android and GoogleTV → Run workflow and select **Branch: main**. Re-running an older job or selecting `v1.3.0` rebuilds the older commit and does not include subsequent Android artwork/EPG changes. Download `tclvplayer-android-debug` from the new run's Artifacts.

`PlaybackService` owns the Media3 ExoPlayer and foreground MediaSession. `TCLVPlayerPlugin` attaches the native video surface to the web UI, maintains the in-memory channel queue, handles export via SAF, media controls and PiP. `MainActivity` routes each remote direction exactly once. This avoids decoding video in a WebView on weak TV hardware.

`ChannelArtworkLoader` fits channel logos onto a padded 512px square for system media cards. EPG metadata is updated without reopening the stream; the service advances through the cached programme schedule every 30 seconds even while WebView is paused. Schedule data stays in memory and is bounded to 24 hours, 48 programmes per channel and 16000 queued programmes. Expired or missing programme data falls back to the app name. Physical device verification remains necessary for manufacturer-specific media card presentation.

Templates (Java and resources) live here; the generator also injects media3 dependencies, private-data backup policy, foreground permissions/service, app version and optional release signing. No channel list, credentials or signing key belongs here.

Release environment variables and device verification instructions are in the root README. Keep an existing signing key to support upgrades. Debug APK is for local testing and uses the Android debug certificate.

`FileExports` receives bounded UTF-8 chunks into private temporary files, then copies to a SAF destination on a dedicated I/O executor. A PluginCall never retains an entire settings backup; the main thread only opens the picker. Two pending exports and 256 MiB per export are allowed; cancellation/failure removes temporary data.

`SourceCache` downloads/decompresses/transcodes XMLTV to private disk on a separate executor (one source at a time). It detects gzip by magic bytes, supports XML encoding declarations and UTF-8/UTF-16 BOM, caps input/decoded/output at 64 MiB and committed cache at 256 MiB. The WebView worker fetches only the converted local file URL and streams SAX parsing. A candidate replaces the previous file only after complete valid XMLTV is accepted. IndexedDB stores a validated opaque cache key, never an exported device path. All source entry points, including URL, playlist autodetection and source-list import, use this path.

`tests/android-data.test.js` compiles the production helpers with minimal Android I/O stubs when a JDK is available, then exercises real local HTTP/file operations under `-Xmx64m`. Physical Redmi Pad 2 / Android 16 SAF, lifecycle and firmware behaviour still require device validation.
