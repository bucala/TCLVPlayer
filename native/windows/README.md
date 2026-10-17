# Windows

`npm ci`, then `npm run windows` or `npm run windows:dist`.

For the latest GitHub build, open Actions → Windows → Run workflow and select **Branch: main** under **Use workflow from**. Download `tclvplayer-windows` from that run's Artifacts. Re-running an old job rebuilds its original commit, not the latest branch. The historical `v1.3.0` tag points to `53a7e73`, before the Windows test fix in `cbeb650`; use `main` for that fix and subsequent changes.

Electron has sandbox/context isolation, verified sender IPC, restricted navigation and permissions. External VLC/mpv processes are launched with separate arguments, confirmed asynchronously and stopped when returning to embedded playback.

Optional per-process variables: `TCLV_VLC_PATH`, `TCLV_MPV_PATH`, pointing to the actual executable when it is not on PATH. Sources live in the device IndexedDB/Electron userData and leave only through explicit local file export. Do not copy userData, backups or provider playlists into this source tree.
