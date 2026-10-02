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
[![Version](https://img.shields.io/badge/version-1.2.0-orange)](#changelog)
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
- **Jednoduche UI** — kanalovy panel bez hladania/skupin, 2-krokovy sidebar `full -> logo -> hidden`
- **Logo zdroje** — fallback poradie: iptv-org API, tv-logo/tv-logos, Free-TV/IPTV, BKPepe icons, final Free-TV retry
- **Direct link import** — URL playlisty z Google Drive a Dropbox sa prevedu na download link
- **Samostatný TCLV Bridge pre web** — Auto: priamo → spárovaný bridge na rovnakom počítači, bez video prenosu cez Vercel
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
| 🌐 **Web + bridge** | dvojklik `bridge/Start TCLV Bridge.cmd` | Lokálny bridge, párovanie v Nastavenia › Sieť |
| 📦 **Windows Bridge ZIP** | `npm run bridge:portable` | `dist/bridge/TCLV-Bridge-Windows-portable.zip`, vrátane Node.js |
| 📦 **Bridge zdrojový ZIP** | `npm run bridge:package` | `dist/bridge/TCLV-Bridge.zip`, pre vývojárov s Node.js 22+ |
| 🖥️ **Windows** | `npm run windows` | Electron okno |
| 📦 **Windows `.exe`** | `npm run windows:dist` | `dist/` — NSIS + portable |
| 🤖 **Android setup** | `npm run android:setup` | Capacitor projekt |
| 🔄 **Android sync** | `npm run android:sync` | Aktualizuje natívny projekt |
| 🧩 **Android Studio generate** | `npm run android:generate` | Vygeneruje/zosynchronizuje `android/` pre Android Studio |
| 📂 **Android Studio** | `npm run android:studio` | Vygeneruje a otvorí Android Studio |
| 📦 **Android debug APK** | `npm run android:apk` | `android/app/build/outputs/apk/debug/` |

> **Tip:** Pre HTTP/CORS streamy na webe spustite TCLV Bridge na tom istom počítači a spárujte ho v Nastavenia › Sieť. Existujúce Windows a Android aplikácie ho nepotrebujú.

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
# Výstup: dist\TCLVPlayer Setup 1.1.9.exe
#          dist\TCLVPlayer 1.1.9.exe
```

**Update existujúcej inštalácie:**
```powershell
.\scripts\update-windows.ps1            # len aktualizovanie
.\scripts\update-windows.ps1 -BuildExe  # + build .exe
.\scripts\update-windows.ps1 -RunAfter  # + okamžité spustenie
.\scripts\update-windows.ps1 -ForceReset # vynútený reset na origin/main
```

Štandardný update nezahodí lokálne zmeny. Ak skript nájde neuprataný working tree, zastaví sa a vypíše čo treba spraviť.

> Ak PowerShell hlási `execution policy`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

</details>

### 🤖 Android / GoogleTV — Capacitor

<details>
<summary><strong>Zobraziť inštrukcie pre Android</strong></summary>

**Požiadavky:** Node.js ≥ 18, Android Studio, Java JDK

```powershell
# Prvé spustenie — inicializácia projektu
npm install
npm run android:generate
npm run android:studio   # otvor Android Studio → Build APK

# Každý ďalší update
npm run android:generate
npm run android:studio

# Debug APK bez ručného otvorenia Android Studio
npm run android:apk
```

`android:generate` je odporúčaný príkaz pre Android Studio. Pripraví `dist/web`, vytvorí alebo aktualizuje Capacitor `android/` projekt, skopíruje Java natívne šablóny, doplní `android/local.properties` so SDK cestou a spraví `cap sync android`.

**Pomocný PowerShell skript:**
```powershell
.\scripts\update-android.ps1                      # štandardný update
.\scripts\update-android.ps1 -OpenStudio          # + otvoriť Android Studio
.\scripts\update-android.ps1 -BuildDebug          # + zostaviť debug APK
.\scripts\update-android.ps1 -BuildDebug -OpenStudio
.\scripts\update-android.ps1 -ForceReset          # vynútený reset na origin/main
```

**Prostredie — prepísať env premenné (raz, trvalo):**
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

Web prehráva video **priamo od poskytovateľa alebo cez tvoj počítač, nikdy cez
Vercel proxy**. V Nastavenia › Sieť má samostatnú voľbu webového videa:

- **Auto: priamo → lokálny bridge** (predvolené): HTTPS skúsi priamo; pri
  sieťovej/CORS chybe prepne na spárovaný bridge. HTTP na HTTPS stránke pošle
  rovno cez bridge, pretože ho prehliadač priamo blokuje.
- **Iba priamo**: bez lokálneho fallbacku.
- **Iba lokálny bridge**: všetko video cez spárovaný bridge.

**Jednoduché spustenie na Windows:**
1. Na webe klikni **Stiahnuť TCLV Bridge pre Windows (ZIP)** v Nastavenia › Sieť.
2. Klikni pravým tlačidlom na ZIP a zvoľ **Rozbaliť všetko**.
   Až v rozbalenom priečinku `TCLV-Bridge` dvojklikom spusti **Start TCLV Bridge.cmd**,
   nie priamo v archíve. Všetky rozbalené súbory nechaj spolu.
3. Klikni **Nájsť bridge**, zadaj kód z jeho okna a klikni **Spárovať bridge**.
4. Povoľ prístup k lokálnej sieti, ak ho prehliadač vyžiada. Po zamietnutí ho
   treba povoliť v nastaveniach stránky; stránka ho nevie sama obísť.
5. Nechaj okno bridge otvorené. Čakajúci stream sa po párovaní skúsi automaticky.

Webový ZIP pre **64-bitový Windows obsahuje Node.js**, jeho licenciu a verziu.
Netreba inštalovať Node.js, Git ani spúšťať `npm install`.
Build stiahne pevne určenú oficiálnu Windows verziu Node.js a pred zabalením
overí SHA-256 podľa manifestu vydania; funguje aj na Linuxe/Verceli.
`npm run bridge:portable` vytvorí rovnaký samostatný Windows balík lokálne.
Menší `npm run bridge:package` vytvára zdrojový balík pre vývojárov s **Node.js 22+**.
V repozitári funguje aj `bridge/Start TCLV Bridge.cmd` alebo pôvodný alias
`npm run proxy`. Bridge nevyžaduje inštaláciu ani nemení štart systému.

Bridge a prehliadač musia bežať **na rovnakom počítači**, nie na inom zariadení
v LAN. Pomocník počúva len na `127.0.0.1`, štandardne na prvom voľnom porte
3939–3941. Povolené sú len presné origins produkčného webu a lokálneho vývoja
na porte 3000. Pre testovací web môžeš explicitne doplniť
`TCLV_BRIDGE_ORIGINS`; nepovoľuj nedôveryhodné stránky.

Párovanie vytvorí origin-bound session na najviac 12 hodín, uloženú len
v `sessionStorage` tejto karty. Reštart bridge vyžaduje nové párovanie.
Video používa nepriehľadné lokálne media tickets namiesto URL s prihlasovacími
údajmi; bridge neposiela svoj token, cookies ani browser Authorization
poskytovateľovi. HLS varianty, segmenty, kľúče a init segmenty sa prepíšu na
lokálne tickets, pričom relatívne cesty vychádzajú z posledného presmerovania.
Každá destinácia má DNS/private-network kontrolu a pripnutú DNS odpoveď.
Bridge podporuje byte ranges a zruší upstream, keď prehliadač ukončí sťahovanie.
HLS manifesty majú limit 2 MiB, aj po rozbalení gzip/deflate/brotli.
**Neprekóduje video**, neodstraňuje DRM ani geo-blokovanie. Manifesty s HLS
premennými sú odmietnuté namiesto posielania segmentov nesprávnou cestou.

Playlisty a EPG sa najprv načítajú priamo. Pri CORS/mixed-content chybe môže
web použiť spárovaný lokálny bridge, prípadne source proxy nastavený v
Nastavenia › Sieť. Nastavenie zdrojového proxy ostáva oddelené od videa,
vlastný proxy ani jeho vypnutie sa párovaním neprepíše. Vstavaný Vercel proxy prijíma
iba M3U/XSPF playlisty a XMLTV EPG, nie HLS manifesty ani video segmenty.
Limit je **3 MiB pred aj po rozbalení gzip**, časový limit sťahovania 15 sekúnd.
Väčšie zdroje načítaj priamo, zo súboru, cez lokálny bridge alebo v natívnej aplikácii.

Web ukladá zdroje do súkromnej cache prehliadača: EPG na 6 hodín, playlisty
na 15 minút (najviac 8 zdrojov, každý do 8 MiB). Kliknutie na aktiváciu už
aktívneho sieťového playlistu vynúti nové stiahnutie. Vlastné nastavenie proxy
vrátane vypnutia zostáva zachované pri ďalšom otvorení webu.

**Vercel:** build command `npm run prepare:vercel`, output directory
`dist/vercel`. Iba tento browser build obsahuje bridge integráciu a
samostatný Windows ZIP s runtime. Testovací prepínač `--source-bridge` vynechá
sťahovanie runtime; bežný produkčný build ho vždy zahŕňa.
`app.js`, `index.html`, `styles.css` aj štandardný `dist/web`
pre natívne aplikácie zostávajú nezmenené. Nasadí sa iba webový bundle a obmedzený `/api/proxy`;
natívne šablóny, testy a ďalšie zdrojové súbory sa verejne neservujú.
Inštalácia `npm ci --omit=dev --ignore-scripts` vynecháva Electron,
Android CLI a ostatné vývojové závislosti, ktoré webový hosting nepotrebuje.
Proxy vyžaduje same-origin požiadavky a parameter `resource=source`.
Spoločná CDN cache je povolená len pre verejné HTTPS zdroje bez query
na `raw.githubusercontent.com` a `iptv-org.github.io`; súkromné/provider
URL a odpovede so session cookies sa do spoločnej cache neukladajú.

> Electron a Android CORS proxy ignorujú — každý má vlastný natívny bypass (Electron: `onHeadersReceived` injektuje `Access-Control-Allow-Origin`; Android: textové zdroje — EPG/playlisty — idú cez natívny `CapacitorHttp` bridge mimo WebView, kde CORS vôbec neplatí).

</details>

---

## ✨ Funkcie

### 📋 Playlisty a kanály

- 📁 Import zo súboru alebo URL — `*.m3u`, `*.m3u8`, `*.xspf`
- 🗂️ Správa viacerých playlistov — pridať, odstrániť, prepnúť v draweri
- 🖼️ Logá kanálov z GitHub zdrojov v poradí: `iptv-org/api` → `tv-logo/tv-logos` → `Free-TV/IPTV` → `BKPepe/czech-channels-icons` → `Free-TV/IPTV`
- 🔀 Sidebar toggle — 1. krok zobrazí iba logá, 2. krok skryje panel kompletne
- 🔗 Online import — `*.m3u`, `*.m3u8`, `*.xspf`, Google Drive file linky a Dropbox share linky

### 📺 EPG — Elektronický programový sprievodca

- 📡 XMLTV formát — súbor, URL, alebo `.gz` kompresia (cez `DecompressionStream`)
- 🔀 Zlučovanie viacerých EPG zdrojov s deduplikáciou
- ⏱️ Časová os — posun `◄ −3h` / `+3h ►`, zoom `−` / `+` (0.5× – 4×)
- ✅ Toggle aktívnych/neaktívnych EPG zdrojov
- 🤖 Auto-detekcia EPG z M3U `x-tvg-url` hlavičky
- 💬 Overlay s aktuálnym/nasledujúcim programom pri prepnutí kanála
- 🔎 Vyhľadávanie v EPG podľa názvu programu
- 💾 EPG text sa neukladá do `localStorage` (prevencia 5 MB crashu); web používa 6-hodinovú Cache Storage, natívne aplikácie naďalej načítajú zdroje pri štarte
- 📤📥 **Import/export zoznamu EPG zdrojov** — textová šablóna `Nazov = URL` (Nastavenia › EPG zdroje › Export/Import EPG), editovateľná v ľubovoľnom textovom editore

### ▶️ Player systém

- 🎬 **HTML5** — s automatickým HLS fallbackom cez `hls.js`
- 🎞️ **Video.js** — s HLS podporou, lazy-load
- 🖥️ **ArtPlayer** — s HLS + MPEG-TS podporou cez `mpegts.js`, lazy-load
- 📼 **flv.js** — samostatna volba pre FLV/MPEG-TS streamy, lazy-load
- 🎧 **jPlayer** — samostatna HTML5 media volba cez jQuery plugin, lazy-load
- 🎥 **HLS kvalita** — floating dropdown pre výber kvality (Natívna / 360p / 720p / 1080p)
- 🖼️ **Picture-in-Picture** — ovládanie v hornom menu nad videom
- 🔄 **Try-direct-first** — playlist/EPG proxy len pri CORS chybe; video proxy iba cez lokálny bridge, nikdy cez Vercel
- 🔇 **Muted autoplay** — video sa spustí stlmené, po úspechu odtlmí

### 🛡️ Bezpečnosť a CORS

- **Electron** — `onHeadersReceived` injektuje `Access-Control-Allow-Origin: *`, žiadny proxy potrebný
- **Web** — priame video, lokálny bridge pre nekompatibilné streamy, obmedzený a cachovaný playlist/EPG proxy
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- HTML escaping, logo URL sanitizácia (`https?://` a `data:image/` iba)
- Logo metadata cez `iptv-org/api` endpointy `channels.json` a `logos.json`, plus GitHub fallback indexy

### ♠️ Nastavenia

- 🔀 Prepínanie playerov za behu
- 🌍 Jazyky: **Slovenčina** (default) · **English**
- 💾 Všetko lokálne v `localStorage` — žiadny účet, žiadny cloud
- Xtream Codes panel je skrytý; aplikácia je zameraná na súbor/URL playlisty a EPG

### ♿ Prístupnosť

- ⌨️ Klávesová navigácia: `↑↓` kanály, `←→` sidebar↔topbar (zámok/CH/EPG/nastavenia), `PageUp/Down` prepnutie kanála
- 📺 D-pad pre Smart TV / Leanback, `Home/End` skok na prvý/posledný
- 🔒 Focus trap v Nastaveniach — Tab/Shift+Tab neopustí panel, pozadie je `inert` kým je otvorený
- 🎮 Natívne preposielanie tlačidiel diaľkového ovládania (Späť/Info/Guide/Channel Up/Down) z Android natívnej vrstvy do WebView
- 🏷️ ARIA labely a live regióny
- 🔍 Focus-visible ring pre keyboard používateľov

### ⚡ Výkon na slabšom Android TV/tablet hardvéri

- Softvérové WebView renderovanie sa aplikuje iba na emulátoroch (detekcia cez `Build.FINGERPRINT`) — na reálnom hardvéri beží plná GPU akcelerácia
- `backdrop-filter`/blur efekty a animácia šírky sidebar-u sú na Android platforme vypnuté (layout reflow a GPU blur sú pri stovkách kanálových kariet nákladné)
- EPG zdroje sa sťahujú paralelne (`Promise.allSettled`), parsovanie viacerých XMLTV súborov uvoľňuje hlavné vlákno medzi jednotlivými zdrojmi
- Pre staré/slabé Android TV odporúčaný "Natívny" prehrávač — hardvérové dekódovanie mimo WebView cez systémovú video appku (MX Player, VLC)

---

## 📱 Platformy

| Platforma | Shell | CORS | Externý player |
|:----------|:------|:----:|:---------------|
| 🖥️ **Windows 11** | Electron | ✅ Bypass | — |
| 🤖 **Android** | Capacitor + Java | ✅ Natívne | `Intent.ACTION_VIEW` |
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
| **flv.js** | Web/Windows | HTML5 fallback | FLV/MPEG-TS lazy-load z vendor/ alebo CDN |
| **jPlayer** | Web/Windows | HTML5/jQuery plugin | Alternativny HTML5 wrapper, lazy-load |
| **VLC/mpv** | Android/Windows | Externe | Volitelne externe playery |

---

## 🏗️ Architektúra

```
TCLVPlayer/
├── index.html                  # Jediny HTML vstupny bod
├── app.js                      # Cela aplikacna logika (~2200 riadkov)
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
│   └── proxy.js                # Obmedzený playlist/EPG proxy (bez videa, SSRF ochrana)
├── scripts/
│   ├── copy-web.mjs            # Build: kopirovanie web bundlu + vendor libs
│   ├── local-proxy.mjs         # Lokalny HTTP proxy pre Vercel HTTPS bridge
│   └── apply-android-template.mjs
├── tests/
│   ├── parsers.test.js         # Parser unit testy (vitest)
│   ├── proxy.test.js           # Serverové limity, cache a blokovanie videa
│   └── web-network.test.js     # Web routing, lokálny bridge a cache zdrojov
└── eslint.config.js            # ESLint konfiguracia
```

**Natívny most medzi platformami:**

| Prostredie | Rozhranie | CORS riešenie |
|:-----------|:----------|:--------------|
| Electron (Windows) | `window.TCLVNative` | `onHeadersReceived` bypass |
| Android / GoogleTV | `Capacitor.Plugins.TCLVPlayer` + `CapacitorHttp` | Natívny HTTP bridge (mimo WebView) |
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
| `electron` | ^43 | MIT | Windows desktop shell |
| `electron-builder` | ^26 | MIT | Windows build/packaging |
| `@capacitor/core` + `android` + `cli` | ^8 | MIT | Android/GoogleTV bridge |
| `hls.js` | ^1.5 | Apache-2.0 | HLS streaming |
| `mpegts.js` | ^1.8 | Apache-2.0 | MPEG-TS streaming (ArtPlayer) |
| `flv.js` | ^1.6 | Apache-2.0 | FLV/MPEG-TS streaming |
| `video.js` | ^8 | Apache-2.0 | Alternatívny web player |
| `artplayer` | ^5 | MIT | Alternatívny web player |
| `jplayer` | ^2.9 | MIT | Alternativny HTML5 web player |
| `jquery` | ^3.7 | MIT | jPlayer runtime dependency |
| `http-server` | ^14 | MIT | Dev web server |
| `eslint` | ^10 | MIT | Linting |
| `vitest` | ^4 | MIT | Unit testy |

---

## 🙏 Third-party credits

TCLVPlayer pouziva permisivne open-source kniznice a verejne IPTV metadata. Plne licencne texty su v [THIRDPARTY.md](THIRDPARTY.md).

| Projekt | Repozitar | Licencia | Pouzitie |
|:--------|:----------|:---------|:--------|
| ArtPlayer | <https://github.com/zhw2590582/ArtPlayer> | MIT | Alternativny web player |
| flv.js | <https://github.com/bilibili/flv.js> | Apache-2.0 | FLV/MPEG-TS prehravanie |
| jPlayer | <https://github.com/jplayer/jPlayer> | MIT | Alternativny HTML5 media wrapper |
| Video.js | <https://github.com/videojs/video.js> | Apache-2.0 | Alternativny web player |
| iptv-org/iptv | <https://github.com/iptv-org/iptv> | Unlicense | Verejne IPTV playlist metadata |

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

## ⚖️ Legal

TCLVPlayer neukladá žiadne video súbory a nehostuje televízne streamy. Aplikácia iba načítava používateľom zadané playlisty, EPG zdroje a verejne dostupné metadata/logá z otvorených repozitárov.

Ak playlist alebo externý zdroj obsahuje odkaz na obsah, ktorý porušuje vaše autorské práva, je potrebné kontaktovať prevádzkovateľa daného zdroja alebo webhostingu, kde sa obsah skutočne nachádza. Odstránenie odkazu z playlistu alebo z tejto aplikácie neodstráni samotný obsah z internetu.

Samotné odkazovanie na verejne dostupné URL nevytvára kópiu diela v tejto aplikácii. TCLVPlayer preto nenahrádza právny kontakt na prevádzkovateľov pôvodných streamov, playlistov alebo hostingových služieb.

---

<div align="center">

**[⬆ Späť nahor](#tcLVplayer)**

MIT License · © 2026 [bucala](https://github.com/bucala)

</div>
