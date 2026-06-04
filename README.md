<div align="center">

<!-- Logo / brand -->
<img src="favicon.svg" alt="TCLVPlayer logo" width="96" height="96"/>

# TCLVPlayer

**Multiplatformový IPTV prehrávač**  
Windows · Android · GoogleTV · Web

[![CI](https://github.com/bucala/TCLVPlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/ci.yml)
[![Windows Build](https://github.com/bucala/TCLVPlayer/actions/workflows/windows.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/windows.yml)
[![Android Build](https://github.com/bucala/TCLVPlayer/actions/workflows/android.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-orange)](#changelog)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow?logo=javascript)](app.js)

---

[🚀 Rýchly štart](#-rýchly-štart) · [✨ Funkcie](#-funkcie) · [📱 Platformy](#-platformy) · [▶️ Playery](#-playery) · [🏗️ Architektúra](#-architektúra) · [📋 Changelog](CHANGELOG.md)

</div>

---

## 💡 Prečo TCLVPlayer?

- **Jedno jadro, tri platformy** — rovnaky web kod bezi v Electron okne, Android WebView aj v prehliadaci
- **Ziadny framework** — cisty vanilla JS, ziadny build step, ziadny bundler
- **Platformove playery** — Android: nativny system player (Intent), Windows: in-app s CORS bypass, Web: HTML5/Video.js/ArtPlayer
- **EPG s casovou osou** — XMLTV parsing, zoom a navigacia, fuzzy matching kanalov, live progress
- **Kvalita videa** — vyber HLS kvality (360p / 720p / 1080p / nativna)
- **Automaticke loga** — tv-logos repozitar s 10 000+ logami kanalov
- **Lokálny proxy bridge** — `npm run proxy` pre priame streamovanie cez lokalnu siet z Vercel HTTPS
- **Bezpecnostny audit** — CSP, XSS ochrana, SSRF blokovanie, import validacia
- **Privatne a offline** — ziadny backend, ziadne ucty, vsetky data zostavaju lokalne

---

## 🚀 Rýchly štart

```bash
git clone https://github.com/bucala/TCLVPlayer.git
cd TCLVPlayer
npm install
```

### Spustenie

| Platforma | Príkaz | Výstup |
|-----------|--------|--------|
| 🌐 **Web** | `npm run web` | `http://127.0.0.1:3000` |
| 🌐 **Web + proxy** | `npm run proxy` | Lokálny proxy na porte 3939 |
| 🖥️ **Windows** | `npm run windows` | Electron okno |
| 📦 **Windows installer** | `npm run windows:dist` | `.exe` NSIS + portable |
| 🤖 **Android** | `npm run android:setup` | Capacitor projekt |

> **Tip:** Pre Vercel/HTTPS: spustite `npm run proxy` na lokalnom PC — streamy pojdu priamo cez vasu siet.

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

## 📱 Platformy

<details>
<summary><strong>🖥️ Windows 11</strong></summary>

Desktop aplikácia cez Electron so sandbox izolovanou bezpečnosťou.

```powershell
npm run windows
```

Electron automaticky:
- Nastavuje Chrome User-Agent a Referer hlavicky
- Odstrañuje Origin hlavicku z requestov
- Injektuje CORS hlavicky do odpovedi (`Access-Control-Allow-Origin: *`)
- Streamy ktore funguju v iptvnator budu fungovat aj tu

</details>

<details>
<summary><strong>🤖 Android a GoogleTV</strong></summary>

Nativna aplikacia cez Capacitor.

```bash
npm run android:setup    # prvotná inicializácia
npm run android:sync     # synchronizácia po zmenách
npm run android:open     # otvoriť v Android Studio
```

### Web

Doplnková verzia na rýchle testovanie. Pri načítavaní URL playlistov/EPG vo web verzii je nutné nastaviť CORS proxy v **Nastavenia › Sieť**.

```bash
npm run web
```

</details>

---

## ▶️ Playery

| Player | Platforma | HLS | Poznamka |
|--------|-----------|-----|----------|
| **Nativny** | Android | System player | Predvoleny na Androide — Intent do VLC/system |
| **HTML5** | Vsetky | hls.js auto-fallback | Bez zavislosti, funguje vsade |
| **Video.js** | Web/Windows | hls.js integrovany | Lazy-load z vendor/ alebo CDN |
| **ArtPlayer** | Web/Windows | hls.js cez customType | Lazy-load z vendor/ alebo CDN |
| **VLC/mpv** | Android/Windows | Externe | Volitelne externe playery |

---

## 🏗️ Architektúra

```
TCLVPlayer/
├── index.html                  # Jediny HTML vstupny bod
├── app.js                      # Cela aplikacna logika (~940 riadkov)
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
├── api/
│   └── proxy.js                # Vercel serverless CORS proxy (streaming, SSRF ochrana)
├── scripts/
│   ├── copy-web.mjs            # Build: kopirovanie web bundlu + vendor libs
│   ├── local-proxy.mjs         # Lokalny HTTP proxy pre Vercel HTTPS bridge
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

## 🔒 Bezpečnosť

- `contextIsolation: true` — renderer nema pristup k Node.js API
- `nodeIntegration: false` — ziadne require() v renderer procese
- `sandbox: true` — renderer bezi v sandboxe OS
- **Content-Security-Policy** — CSP hlavicky na Verceli (script-src, img-src, connect-src)
- **XSS ochrana** — DOM API namiesto innerHTML pre uzivatelske data, `escapeHtml()` pre vsetky texty
- **SSRF blokovanie** — proxy odmieta IPv6, octal, decimal IP, privatne siete
- **Electron exec whitelist** — externy player len `mpv` alebo `vlc`
- **Import validacia** — JSON import sanitizuje vsetky polia s type checks a allowlists
- Logo URL sanitizacia — povolene iba `https?://` a `data:image/` protokoly
- EPG text sa neuklada do localStorage (len metadata) — prevencia 5MB limitu

---

## 📦 Závislosti

| Balíček | Licencia | Účel |
|---------|----------|------|
| `electron` | MIT | Windows desktop shell |
| `electron-builder` | MIT | Windows build/packaging |
| `@capacitor/core` + `android` + `cli` | MIT | Android/GoogleTV bridge |
| `video.js` | Apache-2.0 | Alternatívny web player |
| `artplayer` | MIT | Alternatívny web player |
| `hls.js` | Apache-2.0 | HLS streaming pre všetky interné playery |
| `http-server` | MIT | Dev web server |
| `vitest` | MIT | Unit testy |
| `eslint` | MIT | Linting |

---

## 🤝 Prispievanie

```bash
# 1. Fork + klon
git clone https://github.com/YOUR_USERNAME/TCLVPlayer.git

# 2. Nová branch
git checkout -b feature/moja-zmena

# 3. Lint + testy
npm run lint
npm test

# 4. Commit a PR
git commit -m "feat: popis zmeny"
git push origin feature/moja-zmena
```

> Pull requesty sú vítané! Pre väčšie zmeny prosím najprv otvor issue.

---

<div align="center">

**[⬆ Späť nahor](#tcLVplayer)**

MIT License · © 2026 bucala

</div>
