# Android / Android TV

Use `npm run android:generate`, `npm run android:studio`, or `npm run android:apk`.
Requires Node >=22.19, JDK 21, SDK 36. `android/` is generated and ignored.

For current GitHub artifacts, open Actions → Android and GoogleTV → Run workflow and select **Branch: main**. Re-running an older job or selecting `v1.3.0` rebuilds the older commit and does not include subsequent Android artwork/EPG changes. Download `tclvplayer-android-debug` from the new run's Artifacts.

`PlaybackService` owns the Media3 ExoPlayer and foreground MediaSession. `TCLVPlayerPlugin` attaches the native video surface to the web UI, maintains the in-memory channel queue, handles export via SAF, media controls and PiP. `MainActivity` routes each remote direction exactly once. This avoids decoding video in a WebView on weak TV hardware.

`ChannelArtworkLoader` fits channel logos onto a padded 512px square for system media cards. EPG metadata is updated without reopening the stream; the service advances through the cached programme schedule every 30 seconds even while WebView is paused. Schedule data stays in memory and is bounded to 24 hours, 48 programmes per channel and 16000 queued programmes. Expired or missing programme data falls back to the app name. Physical device verification remains necessary for manufacturer-specific media card presentation.

Templates (Java and resources) live here; the generator also injects media3 dependencies, private-data backup policy, foreground permissions/service, app version and optional release signing. No channel list, credentials or signing key belongs here.

Release environment variables and device verification instructions are in the root README. Keep an existing signing key to support upgrades. Debug APK is for local testing and uses the Android debug certificate.
