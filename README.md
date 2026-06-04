<div align="center">

<img src="assets/icon.png" alt="TCLVPlayer" width="108"/>

# TCLVPlayer

### Multiplatformový IPTV prehrávač
**Windows · Android · GoogleTV · Web**

---

[![CI](https://github.com/bucala/TCLVPlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/ci.yml)
[![Windows Build](https://github.com/bucala/TCLVPlayer/actions/workflows/windows.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/windows.yml)
[![Android Build](https://github.com/bucala/TCLVPlayer/actions/workflows/android.yml/badge.svg)](https://github.com/bucala/TCLVPlayer/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-orange)](#changelog)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow?logo=javascript)](app.js)
[![No Framework](https://img.shields.io/badge/No%20Framework-zero%20build-lightgrey)](#)

---

[🚀 Rýchly štart](#-rýchly-štart) ·
[✨ Funkcie](#-funkcie) ·
[💻 Inštalácia](#-inštalácia) ·
[📱 Platformy](#-platformy) ·
[▶️ Playery](#-playery) ·
[🏗️ Architektúra](#-architektúra) ·
[📋 Changelog](CHANGELOG.md)

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

| Platforma | Príkaz | Výstup |
|:----------|:-------|:-------|
| 🌐 **Web** | `npm run web` | `http://127.0.0.1:3000` |
| 🌐 **Web + proxy** | `npm run proxy` | Lokálny proxy na porte 3939 |
| 🖥️ **Windows** | `npm run windows` | Electron okno |
| 📦 **Windows `.exe`** | `npm run windows:dist` | `dist/` — NSIS + portable |
| 🤖 **Android setup** | `npm run android:setup` | Capacitor projekt |
| 🔄 **Android sync** | `npm run android:sync` | Aktualizuje natívny projekt |
| 📂 **Android Studio** | `npm run android:open` | Otvorí Android Studio |

> **Tip:** Pre Vercel/HTTPS: spustite `npm run proxy` na lokalnom PC — streamy pojdu priamo cez vasu siet.

---

## 💻 Inštalácia

### 🖥️ Windows — Electron

<details>
<summary><strong>Zobraziť inštrukcie pre Windows</strong></summary>

**Požiadavky:** Node.js ≥ 18, Git

```powershell
# Klon + inštalácia
git clone https://github.com/bucala/TCLVPlayer.git
cd TCLVPlayer
npm install

# Spustiť vývojový režim
npm run windows

# Zbuildovať .exe distribúčiu (NSIS inštalátor + portable)
npm run windows:dist
# Výstup: dist\TCLVPlayer Setup 0.8.0.exe
#          dist\TCLVPlayer 0.8.0.exe
```

**Update existujúcej inštalácie:**
```powershell
.\scripts\update-windows.ps1            # len aktualizovanie
.\scripts\update-windows.ps1 -BuildExe  # + build .exe
.\scripts\update-windows.ps1 -RunAfter  # + okamžité spustenie
```

> Ak PowerShell hlási `execution policy`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

</details>

### 🤖 Android / GoogleTV — Capacitor

<details>
<summary><strong>Zobraziť inštrukcie pre Android</strong></summary>

**Požiadavky:** Node.js ≥ 18, Android Studio, Java JDK

```powershell
# Prvné spustenie — inicializácia projektu
npm install
npm run android:setup
npm run android:open   # otvor Android Studio → Build APK

# Každý ďalší update
npm run android:sync
npm run android:open
```

**Pomocný PowerShell skript:**
```powershell
.\scripts\update-android.ps1                      # štandardný update
.\scripts\update-android.ps1 -FirstTime           # prvé spustenie
.\scripts\update-android.ps1 -OpenStudio          # + otvoritť Android Studio
.\scripts\update-android.ps1 -FirstTime -OpenStudio
```

**Prostřediu prepéc env premenné (raz, trvalo):**
```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

> GoogleTV manifest obsahuje `LEANBACK_LAUNCHER` kategóriu a nevyžaduje touchscreen.

</details>

### 🌐 Web

<details>
<summary><strong>Zobraziť inštrukcie pre Web</strong></summary>

```bash
npm install
npm run web
# → http://127.0.0.1:3000
```

Pri načítavaní URL playlistov alebo EPG vo web verzii nastav **CORS proxy** v Nastavenia › Sieť:
```
https://api.allorigins.win/raw?url=
```

> Electron a Android CORS proxy ignorujú — majú natívny bypass cez `onHeadersReceived`.

</details>

---

## ✨ Funkcie

### 📋 Playlisty a kanály

- 📁 Import zo súboru alebo URL — `*.m3u`, `*.m3u8`, `*.xspf`
- 🗂️ Správa viacerých playlistov — pridať, odstrániť, prepnúť v draweri
- 🖼️ Vlastné logo kanála z lokálneho úložiska
- 🔀 Sidebar toggle — skryť/zobraziť zoznam kanálov

### 📺 EPG — Elektronický programový sprievodca

- 📡 XMLTV formát — súbor, URL, alebo `.gz` kompresia (cez `DecompressionStream`)
- 🔀 Zlučovanie viacerých EPG zdrojov s deduplikáciou
- ⏱️ Časová os — posun `◄ −3h` / `+3h ►`, zoom `−` / `+` (0.5× – 4×)
- ✅ Toggle aktívnych/neaktívnych EPG zdrojov
- 🤖 Auto-detekcia EPG z M3U `x-tvg-url` hlavičky
- 💬 Overlay s aktuálnym/nasledujúcim programom pri prepnutí kanála
- 🔎 Vyhľadávanie v EPG podľa názvu programu
- 💾 EPG text sa neuľkladá do `localStorage` (prevencia 5 MB crashu)

### ▶️ Player systém

- 🎬 **HTML5** — s automatickým HLS fallbackom cez `hls.js`
- 🎞️ **Video.js** — s HLS podporou, lazy-load
- 🖥️ **ArtPlayer** — s HLS + MPEG-TS podporou cez `mpegts.js`, lazy-load
- 🎥 **HLS kvalita** — floating dropdown pre výber kvality (Natívna / 360p / 720p / 1080p)
- 🔄 **Try-direct-first** — proxy len keď je nutné (CORS chyba)
- 🔇 **Muted autoplay** — video sa spustí stlmené, po úspechu odtlmí

### 🛡️ Bezpečnosť a CORS

- **Electron** — `onHeadersReceived` injektuje `Access-Control-Allow-Origin: *`, žiadny proxy potrebný
- **Web** — konfigurovateľný CORS proxy s dual-stratégiou (encoded + raw fallback)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- HTML escaping, logo URL sanitizácia (`https?://` a `data:image/` iba)

### ♠️ Nastavenia

- 🔀 Prepínanie playerov za behu
- 🌍 Jazyky: **Slovenčina** (default) · **English**
- 💾 Všetko lokálne v `localStorage` — žiadny účet, žiadny cloud

### ♿ Prístupnosť

- ⌨️ Klávesová navigácia: `↑↓` kanály, `←→` sidebar↔content, `PageUp/Down` prepnutie kanála
- 📺 D-pad pre Smart TV / Leanback, `Home/End` skok na prvý/posledný
- 🏷️ ARIA labely a live regióny
- 🔍 Focus-visible ring pre keyboard používateľov

---

## 📱 Platformy

| Platforma | Shell | CORS | Externý player |
|:----------|:------|:----:|:---------------|
| 🖥️ **Windows 11** | Electron | ✅ Bypass | — |
| 🤖 **Android** | Capacitor + Kotlin | ✅ Natívne | `Intent.ACTION_VIEW` |
| 📺 **GoogleTV** | Capacitor + Leanback | ✅ Natívne | `Intent.ACTION_VIEW` |
| 🌐 **Web** | http-server | ⚠️ Proxy | clipboard fallback |

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
│   │   ├── main.js               # Electron hlavný proces (sandbox, CORS bypass)
│   │   └── preload.js            # Zjednodušený IPC bridge → window.TCLVNative
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

**Natívny most medzi platformami:**

| Prostredie | Rozhranie | CORS riešenie |
|:-----------|:----------|:--------------|
| Electron (Windows) | `window.TCLVNative` | `onHeadersReceived` bypass |
| Android / GoogleTV | `Capacitor.Plugins.TCLVPlayer` | Natívne HTTP |
| Web (prehliadač) | `null` — graceful fallback | CORS proxy |

---

## 🔄 CI/CD

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

| Balíček | Verzia | Licencia | Účel |
|:--------|:-------|:---------|:-----|
| `electron` | ^42 | MIT | Windows desktop shell |
| `electron-builder` | ^26 | MIT | Windows build/packaging |
| `@capacitor/core` + `android` + `cli` | ^8 | MIT | Android/GoogleTV bridge |
| `hls.js` | ^1.5 | Apache-2.0 | HLS streaming |
| `mpegts.js` | ^1.8 | Apache-2.0 | MPEG-TS streaming (ArtPlayer) |
| `video.js` | ^8 | Apache-2.0 | Alternatívny web player |
| `artplayer` | ^5 | MIT | Alternatívny web player |
| `http-server` | ^14 | MIT | Dev web server |
| `eslint` | ^10 | MIT | Linting |
| `vitest` | ^4 | MIT | Unit testy |

---

## 🤝 Prispievanie

```bash
# 1. Fork + klon
git clone https://github.com/YOUR_USERNAME/TCLVPlayer.git
cd TCLVPlayer

# 2. Nová branch
git checkout -b feature/moja-zmena

# 3. Lint + testy (musí prejsť pred PR)
npm run lint
npm test

# 4. Commit a PR
git commit -m "feat: popis zmeny"
git push origin feature/moja-zmena
```

> Pull requesty sú vítané! Pre väčšie zmeny prosím najprv otvor **Issue**.

---

<div align="center">

**[⬆ Späť nahor](#tcLVplayer)**

MIT License · © 2026 [bucala](https://github.com/bucala)

</div>
