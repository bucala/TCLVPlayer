<p align="center">
  <strong>TCLVPlayer</strong><br>
  Multiplatformovy IPTV prehravac pre Windows, Android, GoogleTV a web
</p>

<p align="center">
  <a href="#rychly-start">Rychly start</a> &bull;
  <a href="#funkcie">Funkcie</a> &bull;
  <a href="#platformy">Platformy</a> &bull;
  <a href="#playery">Playery</a> &bull;
  <a href="#architektura">Architektura</a> &bull;
  <a href="CHANGELOG.md">Changelog</a> &bull;
  <a href="LICENSE">Licencia</a>
</p>

---

## Preco TCLVPlayer?

- **Jedno jadro, tri platformy** — rovnaky web kod bezi v Electron okne, Android WebView aj v prehliadaci
- **Ziadny framework** — cisty vanilla JS, ziadny build step, ziadny bundler
- **5 player rezimov** — HTML5, Video.js, ArtPlayer, MPV, VLC
- **EPG s casovou osou** — XMLTV parsing, fuzzy matching kanalov, live progress
- **Privatne a offline** — ziadny backend, ziadne ucty, vsetky data zostavaju lokalne

---

## Rychly start

```bash
npm install
```

| Platforma | Prikaz | Vystup |
|-----------|--------|--------|
| **Web** | `npm run web` | `http://127.0.0.1:3000` |
| **Windows** | `npm run windows` | Electron okno |
| **Windows installer** | `npm run windows:dist` | `.exe` NSIS + portable |
| **Android** | `npm run android:setup` | Capacitor projekt |

---

## Funkcie

### Playlisty a kanaly
- Import zo suboru alebo URL — `*.m3u`, `*.m3u8`, `*.xspf`
- Sprava viacerych playlistov v draweri (pridat, odstranit, prepnut)
- Skupinovy filter podla `group-title`
- Vyhladavanie kanalov podla nazvu
- Vlastne logo kanala z lokalneho uloziska

### EPG — Elektronicky programovy sprievodca
- XMLTV format zo suboru alebo URL
- Zlucovanie viacerych EPG zdrojov
- Casova os s 8-hodinovym oknom a live indikatorom
- Vyhladavanie v programe podla nazvu
- Overlay s aktualnym/nasledujucim programom pri prepnuti kanala

### Player system
- HTML5 video s automatickym HLS fallbackom cez hls.js
- Video.js s HLS podporou
- ArtPlayer s HLS podporou cez customType
- MPV/VLC — nativne spustenie cez Electron bridge alebo Android intent
- Web fallback pre externe playery — prikaz sa skopiruje do schranky

### Nastavenia
- Prepinanie playerov za behu
- Jazyky: Slovencina (default), English
- Konfigurovatelny CORS proxy pre web verziu
- Vsetko ulozene lokalne v localStorage

### Pristupnost a navigacia
- Klavesova navigacia sipkami medzi kanalmi
- Focus-visible ring pre keyboard uzivatelov
- ARIA labely a live regiony

---

## Platformy

### Windows 11

Desktop aplikacia cez Electron so sandbox izolovanou bezpecnostou.

```powershell
npm run windows
```

Pre vlastne cesty k MPV/VLC:

```powershell
$env:TCLV_MPV_PATH="C:\Program Files\mpv\mpv.exe"
$env:TCLV_VLC_PATH="C:\Program Files\VideoLAN\VLC\vlc.exe"
npm run windows
```

### Android a GoogleTV

Nativna aplikacia cez Capacitor s Kotlin bridge pluginom.

```bash
npm run android:setup    # prvotna inicializacia
npm run android:sync     # synchronizacia po zmenach
npm run android:open     # otvorit v Android Studio
```

Plugin `TCLVPlayerPlugin.kt` spusta MPV/VLC cez `Intent.ACTION_VIEW`. GoogleTV manifest obsahuje `LEANBACK_LAUNCHER` kategoriu a nevyzaduje touchscreen.

### Web

Doplnkova verzia na rychle testovanie. Pri nacitavani URL playlistov/EPG vo web verzii je nutne nastavit CORS proxy v Nastavenia > Siet.

```bash
npm run web
```

---

## Playery

| Player | Typ | HLS | Poznamka |
|--------|-----|-----|----------|
| **HTML5** | Interny | hls.js auto-fallback | Bez zavislosti, funguje vsade |
| **Video.js** | Interny | hls.js integrovany | Lazy-load z vendor/ alebo CDN |
| **ArtPlayer** | Interny | hls.js cez customType | Lazy-load z vendor/ alebo CDN |
| **MPV** | Externy nativny | nativne | Electron: spawn, Android: intent, Web: clipboard |
| **VLC** | Externy nativny | nativne | Rovnaky princip ako MPV |

---

## Architektura

```
TCLVPlayer/
├── index.html                  # Jediny HTML vstupny bod
├── app.js                      # Cela aplikacna logika
├── styles.css                  # Vsetky styly
├── package.json                # Electron + Capacitor zavislosti
├── capacitor.config.json       # Capacitor konfiguracia
├── native/
│   ├── electron/
│   │   ├── main.js             # Electron hlavny proces (sandbox)
│   │   └── preload.js          # IPC bridge → window.TCLVNative
│   └── android/
│       ├── TCLVPlayerPlugin.kt # Capacitor plugin (intent bridge)
│       ├── MainActivity.kt     # Registracia pluginu
│       └── AndroidManifest.additions.xml
├── scripts/
│   ├── copy-web.mjs            # Build: kopirovanie web bundlu + vendor libs
│   └── apply-android-template.mjs  # Build: patching Android manifestu
└── .github/workflows/
    ├── ci.yml                  # Syntax validacia + web bundle artifact
    ├── windows.yml             # NSIS + portable .exe
    └── android.yml             # Debug APK
```

**Princip:** Jedna web vrstva (`index.html` + `app.js` + `styles.css`) zdielana napriec platformami. Nativne funkcie su dostupne cez:
- `window.TCLVNative` — Electron (preload.js)
- `window.Capacitor.Plugins.TCLVPlayer` — Android (Kotlin plugin)
- `null` — web fallback

---

## Bezpecnost

Electron konfiguracia dodrzuje vsetky odporucane bezpecnostne postupy:

- `contextIsolation: true` — renderer nema pristup k Node.js API
- `nodeIntegration: false` — ziadne require() v renderer procese
- `sandbox: true` — renderer bezi v sandboxe OS
- URL validacia — pred spustenim externeho playera sa overuje schema (`http/https/rtsp/rtmp/file`)
- HTML escaping — vsetky uzivatelske data su escapovane pred vlozenim do DOM
- Logo URL sanitizacia — povolene iba `https?://` a `data:image/` protokoly

---

## CI/CD

| Workflow | Spustac | Runner | Vystup |
|----------|---------|--------|--------|
| `ci.yml` | Push na `main`, PR | `windows-latest` | Web bundle artifact |
| `windows.yml` | Manualne, tag `v*` | `windows-latest` | `.exe` NSIS + portable |
| `android.yml` | Manualne, tag `v*` | `ubuntu-latest` | Debug `.apk` |

---

## Zavislosti

| Balicek | Licencia | Ucel |
|---------|----------|------|
| `electron` | MIT | Windows desktop shell |
| `electron-builder` | MIT | Windows build/packaging |
| `@capacitor/core` + `android` + `cli` | MIT | Android/GoogleTV bridge |
| `video.js` | Apache-2.0 | Alternativny web player |
| `artplayer` | MIT | Alternativny web player |
| `hls.js` | Apache-2.0 | HLS streaming pre vsetky interne playery |
| `http-server` | MIT | Dev web server |

---

## Licencia

MIT — pozri [LICENSE](LICENSE).
