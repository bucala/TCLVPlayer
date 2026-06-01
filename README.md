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
[![Version](https://img.shields.io/badge/version-0.6.1-orange)](#changelog)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow?logo=javascript)](app.js)

---

[🚀 Rýchly štart](#-rýchly-štart) · [✨ Funkcie](#-funkcie) · [📱 Platformy](#-platformy) · [▶️ Playery](#-playery) · [🏗️ Architektúra](#-architektúra) · [📋 Changelog](CHANGELOG.md)

</div>

---

## 💡 Prečo TCLVPlayer?

> **Jedno jadro, štyri prostredia** — rovnaký web kód beží v Electron okne, Android WebView, na GoogleTV aj v prehliadači.

| | |
|---|---|
| 🧩 **Žiadny framework** | Čistý vanilla JS, žiadny build step, žiadny bundler |
| ▶️ **5 player režimov** | HTML5, Video.js, ArtPlayer, MPV, VLC |
| 📺 **EPG s časovou osou** | XMLTV parsing, fuzzy matching kanálov, live progress |
| 🔒 **Súkromné & offline** | Žiadny backend, žiadne účty, všetky dáta zostávajú lokálne |
| 🎨 **Warm Orange dizajn** | Frosted glass UI, dark mode, adaptívny layout pre TV/tablet/mobil |

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
| 🖥️ **Windows** | `npm run windows` | Electron okno |
| 📦 **Windows installer** | `npm run windows:dist` | `.exe` NSIS + portable |
| 🤖 **Android** | `npm run android:setup` | Capacitor projekt |

> **Tip:** Pre vývoj odporúčame spustiť `npm run web` — žiadna inštalácia, okamžitý reload.

---

## ✨ Funkcie

### 📋 Playlisty a kanály

- 📁 Import zo súboru alebo URL — `*.m3u`, `*.m3u8`, `*.xspf`
- 🗂️ Správa viacerých playlistov v draweri (pridať, odstrániť, prepnúť)
- 🔍 Skupinový filter podľa `group-title`
- 🔎 Vyhľadávanie kanálov podľa názvu
- 🖼️ Vlastné logo kanála z lokálneho úložiska

### 📺 EPG — Elektronický programový sprievodca

- 📡 XMLTV formát zo súboru alebo URL (vrátane `.gz` kompresie)
- 🔀 Zlučovanie viacerých EPG zdrojov s deduplikáciou
- ⏱️ Časová os s 8-hodinovým oknom a live indikátorom
- 🔍 Vyhľadávanie v programe podľa názvu
- 💬 Overlay s aktuálnym/nasledujúcim programom pri prepnutí kanála
- ✅ Toggle aktívnych/neaktívnych EPG zdrojov

### ▶️ Player systém

- 🎬 HTML5 video s automatickým HLS fallbackom cez hls.js
- 🎞️ Video.js s HLS podporou
- 🖥️ ArtPlayer s HLS podporou cez `customType`
- 🖱️ MPV/VLC — natívne spustenie cez Electron bridge alebo Android intent
- 🔄 **Try-direct-first** stratégia — proxy len keď je nutné (CORS)
- 🔁 Automatický retry s CORS proxy pri HLS chybe

### ⚙️ Nastavenia

- 🔀 Prepínanie playerov za behu
- 🌍 Jazyky: Slovenčina (default), English
- 🌐 Konfigurovateľný CORS proxy pre web verziu (`api.allorigins.win/raw?url=`)
- 💾 Všetko uložené lokálne v `localStorage`

### ♿ Prístupnosť a navigácia

- ⌨️ Klávesová navigácia šípkami medzi kanálmi, D-pad pre TV
- 🎯 Focus-visible ring pre keyboard používateľov
- 🏷️ ARIA labely a live regióny
- 📺 Leanback layout optimalizovaný pre Smart TV (>1400px)

---

## 📱 Platformy

<details>
<summary><strong>🖥️ Windows 11</strong></summary>

Desktop aplikácia cez Electron so sandbox izolovanou bezpečnosťou.

```powershell
npm run windows
```

Pre vlastné cesty k MPV/VLC:

```powershell
$env:TCLV_MPV_PATH="C:\Program Files\mpv\mpv.exe"
$env:TCLV_VLC_PATH="C:\Program Files\VideoLAN\VLC\vlc.exe"
npm run windows
```

</details>

<details>
<summary><strong>🤖 Android a GoogleTV</strong></summary>

Natívna aplikácia cez Capacitor s Kotlin bridge pluginom.

```bash
npm run android:setup    # prvotná inicializácia
npm run android:sync     # synchronizácia po zmenách
npm run android:open     # otvoriť v Android Studio
```

Plugin `TCLVPlayerPlugin.kt` spúšťa MPV/VLC cez `Intent.ACTION_VIEW`.  
GoogleTV manifest obsahuje `LEANBACK_LAUNCHER` kategóriu a nevyžaduje touchscreen.

</details>

<details>
<summary><strong>🌐 Web</strong></summary>

Doplnková verzia na rýchle testovanie. Pri načítavaní URL playlistov/EPG vo web verzii je nutné nastaviť CORS proxy v **Nastavenia › Sieť**.

```bash
npm run web
```

</details>

---

## ▶️ Playery

| Player | Typ | HLS | Poznámka |
|--------|-----|:---:|---------|
| **HTML5** | Interný | ✅ hls.js auto-fallback | Bez závislostí, funguje všade |
| **Video.js** | Interný | ✅ hls.js integrovaný | Lazy-load z `vendor/` alebo CDN |
| **ArtPlayer** | Interný | ✅ hls.js cez customType | Lazy-load z `vendor/` alebo CDN |
| **MPV** | Externý natívny | ✅ natívne | Electron: spawn, Android: intent, Web: clipboard |
| **VLC** | Externý natívny | ✅ natívne | Rovnaký princíp ako MPV |

---

## 🏗️ Architektúra

```
TCLVPlayer/
├── 📄 index.html                  # Jediný HTML vstupný bod
├── 📜 app.js                      # Celá aplikačná logika (vanilla JS)
├── 🎨 styles.css                  # Všetky štýly (Warm Orange téma)
├── ⚙️  package.json                # Electron + Capacitor závislosti
├── 📱 capacitor.config.json       # Capacitor konfigurácia
├── 🖼️  favicon.svg                 # SVG ikona (oranžový gradient)
│
├── 📁 native/
│   ├── electron/
│   │   ├── main.js             # Electron hlavný proces (sandbox)
│   │   └── preload.js          # IPC bridge → window.TCLVNative
│   └── android/
│       ├── TCLVPlayerPlugin.kt # Capacitor plugin (intent bridge)
│       ├── MainActivity.kt     # Registrácia pluginu
│       └── AndroidManifest.additions.xml
│
├── 📁 lib/
│   └── parsers.js              # Čisté funkcie (testovateľné, bez DOM)
│
├── 📁 scripts/
│   ├── copy-web.mjs            # Build: kopírovanie web bundlu + vendor libs
│   └── apply-android-template.mjs  # Build: patching Android manifestu
│
├── 📁 tests/
│   └── parsers.test.js         # 31 Vitest unit testov
│
└── 📁 .github/workflows/
    ├── ci.yml                  # Lint + testy + web bundle artifact
    ├── windows.yml             # NSIS + portable .exe
    └── android.yml             # Debug APK
```

**Princíp:** Jedna web vrstva (`index.html` + `app.js` + `styles.css`) zdieľaná naprieč platformami. Natívne funkcie sú dostupné cez:

| Prostredie | Rozhranie |
|---|---|
| Electron (Windows) | `window.TCLVNative` |
| Android / GoogleTV | `window.Capacitor.Plugins.TCLVPlayer` |
| Web (prehliadač) | `null` — graceful fallback |

---

## 🔒 Bezpečnosť

Electron konfigurácia dodržuje všetky odporúčané bezpečnostné postupy:

| Nastavenie | Hodnota | Účel |
|---|---|---|
| `contextIsolation` | `true` | Renderer nemá prístup k Node.js API |
| `nodeIntegration` | `false` | Žiadne `require()` v renderer procese |
| `sandbox` | `true` | Renderer beží v sandboxe OS |
| URL validácia | schema whitelist | `http/https/rtsp/rtmp/file` |
| HTML escaping | vždy | Všetky používateľské dáta escapované pred DOM |
| Logo URL sanitizácia | regex | Povolené iba `https?://` a `data:image/` |

---

## 🔄 CI/CD

| Workflow | Spúšťač | Runner | Výstup |
|----------|---------|--------|--------|
| `ci.yml` | Push na `main`, PR | `ubuntu-latest` + `windows-latest` | Lint ✅ · Testy ✅ · Web bundle artifact |
| `windows.yml` | Manuálne, tag `v*` | `windows-latest` | `.exe` NSIS + portable |
| `android.yml` | Manuálne, tag `v*` | `ubuntu-latest` | Debug `.apk` |

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
| `eslint` | MIT | Linting |
| `vitest` | MIT | Unit testy |

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
