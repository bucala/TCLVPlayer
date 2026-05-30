# Windows 11 shell

Windows uses Electron as the native shell. The app loads the shared `index.html` UI and exposes a small safe bridge as `window.TCLVNative`.

## Setup

```powershell
npm install
npm run windows
```

## Build

```powershell
npm run windows:dist
```

## MPV and VLC

TCLVPlayer starts external players with the stream URL as the first argument.

Default executable names:

- `mpv`
- `vlc`

If they are not on `PATH`, set:

```powershell
$env:TCLV_MPV_PATH="C:\Program Files\mpv\mpv.exe"
$env:TCLV_VLC_PATH="C:\Program Files\VideoLAN\VLC\vlc.exe"
npm run windows
```
