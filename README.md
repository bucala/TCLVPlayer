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
</p>

---

## Preco TCLVPlayer?

- **Jedno jadro, tri platformy** — rovnaky web kod bezi v Electron okne, Android WebView aj v prehliadaci
- **Ziadny framework** — cisty vanilla JS, ziadny build step, ziadny bundler
- **3 interne playery** — HTML5, Video.js, ArtPlayer (vsetky s HLS cez hls.js)
- **EPG s casovou osou** — XMLTV parsing, zoom a navigacia, fuzzy matching kanalov, live progress
- **Kvalita videa** — vyber HLS kvality (360p / 720p / 1080p / nativna)
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
- Vlastne logo kanala z lokalneho uloziska
- Ovladanie klavesnicou (sipky, PageUp/Down, Home/End)

### EPG — Elektronicky programovy sprievodca
- XMLTV format zo suboru alebo URL
- Automaticka detekcia EPG zdrojov z M3U hlavicky (`x-tvg-url`)
- Zlucovanie viacerych EPG zdrojov s validaciou zhody kanalov
- Casova os so zoomom (0.5x–4x) a navigaciou (±3 hodiny)
- Vyhladavanie v programe podla nazvu
- Overlay s aktualnym/nasledujucim programom pri prepnuti kanala

### Player system
- **HTML5** — automaticky HLS fallback cez hls.js, muted autoplay stratégia
- **Video.js** — lazy-load z vendor/ alebo CDN, HLS cez hls.js
- **ArtPlayer** — lazy-load, HLS cez customType
- **Kvalita videa** — floating dropdown s vyberom HLS kvality (360p/720p/1080p/nativna)
- CORS dual-fallback proxy (encoded URL → raw URL)

### Rozlozenie
- Prepinatelny sidebar (kanal list) s toggle tlacitkom
- EPG panel prepinatelny z topbaru
- Mobilne rozlozenie: player hore, kanaly dole, EPG na celu obrazovku
- Adaptivne pre TV (>1400px), tablet, telefon, landscape

### Nastavenia
- Prepinanie playerov za behu
- Jazyky: Slovencina (default), English
- Konfigurovatelny CORS proxy pre web verziu
- Metadata ulozene v localStorage, EPG sa refetchuje pri starte

### Pristupnost a navigacia
- Klavesova navigacia sipkami medzi kanalmi
- Focus-visible ring pre keyboard uzivatelov
- ARIA labely a live regiony
- Touch-friendly EPG ovladanie

---

## Platformy

### Windows 11

Desktop aplikacia cez Electron so sandbox izolovanou bezpecnostou.

```powershell
npm run windows
```

Electron automaticky:
- Nastavuje Chrome User-Agent a Referer hlavicky
- Odstrañuje Origin hlavicku z requestov
- Injektuje CORS hlavicky do odpovedi (`Access-Control-Allow-Origin: *`)
- Streamy ktore funguju v iptvnator budu fungovat aj tu

### Android a GoogleTV

Nativna aplikacia cez Capacitor.

```bash
npm run android:setup    # prvotna inicializacia
npm run android:sync     # synchronizacia po zmenach
npm run android:open     # otvorit v Android Studio
```

### Web

Doplnkova verzia na rychle testovanie. Pri nacitavani URL playlistov/EPG vo web verzii je nutne nastavit CORS proxy v Nastavenia > Siet.

```bash
npm run web
```

---

## Playery

| Player | HLS | Poznamka |
|--------|-----|----------|
| **HTML5** | hls.js auto-fallback | Bez zavislosti, funguje vsade |
| **Video.js** | hls.js integrovany | Lazy-load z vendor/ alebo CDN |
| **ArtPlayer** | hls.js cez customType | Lazy-load z vendor/ alebo CDN |

---

## Architektura

```
TCLVPlayer/
├── index.html                  # Jediny HTML vstupny bod
├── app.js                      # Cela aplikacna logika (~390 riadkov)
├── styles.css                  # Vsetky styly (responsive, dark theme)
├── favicon.svg                 # App ikona (SVG)
├── package.json                # Electron + Capacitor zavislosti
├── capacitor.config.json       # Capacitor konfiguracia
├── native/
│   ├── electron/
│   │   ├── main.js             # Electron hlavny proces (CORS bypass, UA override)
│   │   └── preload.js          # Platform detection → window.TCLVNative
│   └── android/
│       └── ...                 # Capacitor Android wrapper
├── assets/
│   ├── icon.png                # App ikona 512px
│   └── icon.svg                # App ikona vektorova
├── scripts/
│   ├── copy-web.mjs            # Build: kopirovanie web bundlu + vendor libs
│   └── apply-android-template.mjs
├── tests/
│   └── parsers.test.js         # Unit testy (vitest)
└── eslint.config.js            # ESLint konfiguracia
```

**Princip:** Jedna web vrstva (`index.html` + `app.js` + `styles.css`) zdielana napriec platformami. Nativne funkcie su dostupne cez:
- `window.TCLVNative` — Electron (preload.js) — detekcia platformy
- `window.Capacitor` — Android
- `null` — web fallback

---

## Bezpecnost

- `contextIsolation: true` — renderer nema pristup k Node.js API
- `nodeIntegration: false` — ziadne require() v renderer procese
- `sandbox: true` — renderer bezi v sandboxe OS
- HTML escaping — vsetky uzivatelske data su escapovane pred vlozenim do DOM
- Logo URL sanitizacia — povolene iba `https?://` a `data:image/` protokoly
- EPG text sa neuklada do localStorage (len metadata) — prevencia 5MB limitu

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
| `vitest` | MIT | Unit testy |
| `eslint` | MIT | Linting |

---
