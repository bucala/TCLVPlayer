# Windows

`npm ci`, then `npm run windows` or `npm run windows:dist`.

Electron has sandbox/context isolation, verified sender IPC, restricted navigation and permissions. External VLC/mpv processes are launched with separate arguments, confirmed asynchronously and stopped when returning to embedded playback.

Optional per-process variables: `TCLV_VLC_PATH`, `TCLV_MPV_PATH`, pointing to the actual executable when it is not on PATH. Sources live in the device IndexedDB/Electron userData and leave only through explicit local file export. Do not copy userData, backups or provider playlists into this source tree.
