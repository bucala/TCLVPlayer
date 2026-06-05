# 📋 Changelog — TCLVPlayer

Všetky významné zmeny v projekte sú dokumentované v tomto súbore.

> Formát je založený na [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
> Projekt používa [Sémantické verziovanie](https://semver.org/).

---

## [1.1.0] — 2026-06-05

### Release 1.1 — Android fullscreen, simple UI, direct link import

#### Added
- **Android immersive fullscreen** — aplikácia skrýva status/navigation bary a používa čierne systémové plochy.
- **2-krokový sidebar** — šípka prepína `full -> logo rail -> hidden`.
- **Direct link import** — Google Drive file linky a Dropbox share linky sa normalizujú na download URL.
- **Lokálny logo index** — logá sa načítavajú z `lists/logos.md`.

#### Changed
- **PiP ovládanie** — Picture-in-Picture je v hornom menu nad prehrávaným videom.
- **Interaktívne vrstvy** — menu, overlaye, quality select a sidebar toggle sú nad video vrstvou.
- **Mobilný layout** — portrait aj landscape používajú rovnaký jednoduchý form factor pre web, Windows aj Android.
- **Playlist/EPG Use** — opätovné zapnutie alebo klik na aktívny sieťový zdroj vie zdroj znovu načítať.
- **README vizuál** — popis funkcií je zladený so zjednodušeným UI.

#### Removed
- **Xtream Codes panel v menu** — skrytý v používateľskom rozhraní.
- **Vyhľadávanie kanálov** — odstránené zo sidebaru; EPG vyhľadávanie zostáva.
- **Skupiny kanálov** — group taby nad zoznamom kanálov odstránené.
- **Ručná zmena loga stanice** — nahradené centrálnym `lists/logos.md`.

---

## [1.0.0] — 2026-06-04

### Release 1.0 — Tri platformy, bezpecnostny audit, stabilizacia

#### Added
- **Nativny Android player** — predvoleny systemovy prehravac cez Intent (ACTION_VIEW video/*), volitelne VLC/mpv
- **Lokálny proxy bridge** — `npm run proxy` spusti HTTP proxy na porte 3939, Vercel HTTPS stranka ho auto-deteguje
- **TV-logos integrácia** — automaticke nacitanie 10 000+ log kanalov z tv-logo/tv-logos GitHub repo
- **CDN-first loading** — na HTTPS sa player kniznice nacitavaju najprv z CDN, potom z vendor/
- **Geo-block hint** — pri chybe streamu na Verceli sa zobrazi tip o `npm run proxy`
- **CSP hlavicky** — Content-Security-Policy, X-Content-Type-Options, Referrer-Policy v vercel.json
- **Import validacia** — JSON import sanitizuje vsetky polia (type checks, allowlists, max dlzky)
- **Rate limiting** — tlacidla "Pridat URL" blokovane pocas nacitavania
- **Mobile FAB toggle** — floating tlacidlo na skrytie/zobrazenie zoznamu kanalov na mobile

#### Changed
- **HLS buffer tuning** — ExoPlayer-inspirovana konfiguracia (maxBufferLength=30s, retry=6x) na vsetkych platformach
- **ArtPlayer** — `muted: false` pri prepnuti kanala, rychlejsie auto-hide ovladacich prvkov
- **Proxy streaming** — api/proxy.js pouziva `pipeTo()` namiesto bufferingu, Content-Length passthrough
- **SSRF ochrana** — proxy blokuje IPv6, octal, decimal IP, fc00:/fe80: adresy
- **Electron exec whitelist** — `execFile()` akceptuje len `mpv` a `vlc`
- **Video reset** — `stopInternalPlayers()` cisti video src pre cistejsie prepnutie
- **Verzia** — bump na 1.0.0

#### Fixed
- **XSS v EPG timeline** — inline `onerror` handlery nahradene bezpecnym DOM API (`safeLogoImg()`)
- **Playlist reload** — sietove playlisty sa automaticky znovu stiahnu po reload stranky
- **ArtPlayer mute** — zvuk sa uz nestlmuje pri prepnuti kanala
- **ArtPlayer overlap** — PiP a quality tlacidla sa skryvaju ked je ArtPlayer aktivny
- **Spinner pri chybe** — ArtPlayer loading spinner sa zastavi pri chybe streamu
- **Mobile portrait layout** — sidebar sa da skryt, video sa roztiahne na celu obrazovku
- **HTML5 audio-only** — cistejsi video element reset medzi kanalmi

---

## [0.8.0] — 2026-06-02

### Faza 8 — Stabilizácia, EPG navigácia, CORS bypass

#### Added
- **EPG zoom a navigácia** — tlačidlá ◀ (−3h), ▶ (+3h) pre posúvanie časovej osi; + a − pre zoom (0.5x–4x rozsah)
- **HLS kvalita videa** — floating dropdown v prehrávači pre výber kvality (Natívna / 360p / 720p / 1080p)
- **Electron CORS bypass** — `onHeadersReceived` injektuje `Access-Control-Allow-Origin: *`, mazanie `Origin` z requestov (rovnaký prístup ako iptvnator)
- **EPG smart auto-load** — validácia stiahnutého EPG oproti kanálom v playliste, skip irelevantných zdrojov
- **EPG re-fetch pri štarte** — metadata v localStorage, plný text sa refetchuje pri každom štarte

#### Changed
- **Odstránené MPV/VLC** — len HTML5 / Video.js / ArtPlayer
- **Odstránený externý player kód** — spawn, intent://, IPC bridge, preload simplifikovaný
- **Video sizing** — `overflow: hidden` na player-stage, Video.js wrapper absolute positioning
- **Mobile layout** — player-stage max 30vh, kolapsuje keď neprehrváva
- **localStorage optimalizácia** — EPG text sa neukladá (len URL metadata), prevencia 5MB crashu

#### Fixed
- **STATUS_BREAKPOINT crash** — ukladanie plného EPG XML do localStorage prekročilo 5MB limit prehliadača
- **EPG načítavalo nesprávne zdroje** — albánske namiesto slovenských (chýbajúci filter)
- **Video overflow** — HTML5 a Video.js video pretekalo mimo player kontajnera

---

## [0.6.1] — 2026-06-01

### 🔧 Fáza 6.1 — Robustný CORS proxy a EPG retry

#### Added
- **Proxy fallback (encoded → raw)** — `loadTextFromUrl()` skúsi proxy s `encodeURIComponent(url)`, ak vráti chybu, skúsi s raw URL. Pokrýva rôzne formáty CORS proxy služieb.
- **HLS proxy fallback** — `tryHlsPlayback()` pri fatálnej chybe automaticky reštartuje s raw proxy URL formátom.
- **Auto EPG retry pri zmene proxy** — keď používateľ nastaví/zmení CORS proxy, automaticky sa znovu načítajú EPG zdroje z playlistu.
- **`proxyUrlRaw()`** — helper pre raw (nekódovaný) proxy URL formát.

#### Changed
- **Proxy placeholder** — zmenený z `corsproxy.io` na `api.allorigins.win/raw?url=` (spoľahlivejší).
- **`loadTextFromUrl()`** — úplne prepísaná s dual-proxy stratégiou (encoded + raw fallback).
- **`tryHlsPlayback()`** — pridaný `useRawProxy` parameter s automatickým retry.
- **CORS proxy change handler** — pri zmene proxy sa znovu spustí `autoLoadEpgFromPlaylist()` a reštartuje prehrávanie.

#### Fixed
- **Auto EPG bez proxy** — auto-detegované EPG sa pokúšalo načítať pred nastavením CORS proxy. Teraz sa retry spustí automaticky po uložení proxy.
- **Proxy 403** — `corsproxy.io` vracal 403 pre niektoré URL. Fallback na raw URL formát pokrýva alternatívne proxy služby.

---

## [0.6.0] — 2026-06-01

### 🔍 Fáza 6 — Opravy prehrávania, EPG a CORS (audit)

#### Added
- **Try-direct-first stratégia** — `loadTextFromUrl()` najprv skúsi priame pripojenie, až pri CORS chybe použije proxy.
- **HLS retry s proxy** — `tryHlsPlayback()` funkcia: hls.js najprv hrá priamo, pri fatálnej chybe automaticky reštartuje s CORS proxy (`xhrSetup`).
- **EPG active/inactive** — EPG zdroje majú `active` field s „Use" toggle tlačidlom. Neaktívne zdroje sa vynechajú z `rebuildMergedEpg()`.
- **EPG `.xml` fallback** — `autoLoadEpgFromPlaylist()` ak `.xml.gz` zlyhá, skúsi `.xml` verziu bez kompresie.
- **Auto-detekcia EPG z M3U** — `x-tvg-url` hlavička v M3U playlistoch je parsovaná. Relevantné EPG zdroje sa načítajú automaticky.
- **Podpora `.gz` EPG** — gzipované EPG súbory dekompresované cez `DecompressionStream` API.
- **Indikátor lokálny/sieťový** — zdroje playlistov aj EPG zobrazujú typ (lokálny súbor / sieťový URL).
- **SVG favicon** — oranžová ikona aplikácie (`favicon.svg`) s gradientom zhodným s brand-mark logom.
- **Oranžový `accent-color`** — formulárové prvky a `::selection` používajú `accent-color: var(--accent)`.

#### Changed
- **`loadTextFromUrl()`** — prepísaná s try-direct-first logikou a `.gz` dekompresnou podporou.
- **`playHtml5()`** — deleguje na `tryHlsPlayback()` s automatickým retry cez proxy.
- **`rebuildMergedEpg()`** — filtruje len aktívne (`active !== false`) EPG zdroje.
- **`autoLoadEpgFromPlaylist()`** — robustnejšia s `.xml` fallbackom a viditeľnými chybovými hláškami.

#### Fixed
- **HLS prehrávanie** — priame pripojenie pre servery s CORS → proxy retry pre ostatné.
- **EPG načítanie** — chyby sa už ticho nezahlcujú, zobrazujú sa v UI. Fallback z `.gz` na `.xml`.

---

## [0.5.0] — 2026-05-31

### 🎨 Fáza 5 — Vizuálny redizajn a opravy UX

#### Added
- **Warm Orange téma** — kompletne prepísaný `styles.css`. Čierne pozadie (`#000`) s teplým oranžovým akcentom (`#e87442`), iOS-style dark povrchy, `backdrop-filter: blur` frosted glass efekty.
- **DM Sans font** — Google Fonts import s fallbackom na Inter/system-ui.
- **Frosted glass efekty** — topbar, settings panel header a switch overlay.
- **Adaptívny layout** — breakpointy pre TV (>1400px), tablet (701–1024px), mobil portrait (<700px), mobil landscape (<900px landscape), malý telefón (<400px).
- **Animované EPG** — hover efekty, `current` programy majú accent glow.
- **HLS error handling** — `Hls.Events.ERROR` listener pre fatálne chyby.

#### Changed
- **Switch overlay** — kompaktná notifikácia v spodnej časti playera so slide-up animáciou.
- **Farebná paleta** — `--accent: #e87442`, `--bg: #000000`, `--surface: #1c1c1e`.
- **Channel karty** — väčšie logo (52px), gradient progress bar, `color-mix` active state.
- **Settings panel** — `<details>/<summary>` nahradené plochými `<div>/<h3>` sekciami (TV ovládač friendly).

#### Removed
- **Demo funkcionalita** — `loadDemo()` funkcia, `#sampleButton`, demo sekcia v nastaveniach.
- **Sidebar search & group filter** — presunuté do v0.8.0 v rozšírenej forme.

#### Fixed
- **Nastavenia sa nedali zatvoriť** — CSS `display: flex` prepisoval `hidden` atribút.
- **Select dropdown farby** — `color-scheme: dark` na `html/body`.
- **EPG CORS chyba** — zobrazí hláška s navedením na Nastavenia › Sieť.

---

## [0.4.0] — 2026-05-31

### 🧪 Fáza 4 — CI/CD a kvalita kódu

#### Added
- **ESLint konfigurácia** — `eslint.config.js` s flat config formátom.
- **Unit testy** — 31 testov v `tests/parsers.test.js` cez Vitest. Pokryté funkcie: `normalizeId`, `uniqueId`, `attr`, `parseM3U`, `parseXmlTvDate`, `sanitizeLogoUrl`, `hashCode`.
- **Testovateľný modul** — `lib/parsers.js` exportuje čisté funkcie bez DOM závislostí.
- **Dependabot** — `.github/dependabot.yml` pre npm (týždenne) a GitHub Actions (mesačne).
- **npm skripty** — `npm run lint` a `npm test` pridané do `package.json`.

#### Changed
- **CI workflow** — rozdelený na dva joby: `lint-and-test` (Ubuntu) a `validate` (Windows).

#### Dependencies
- `eslint` a `@eslint/js` pridané ako devDependencies
- `vitest` pridaný ako devDependency

---

## [0.3.0] — 2026-05-31

### 📱 Fáza 3 — Platform UX

#### Added
- **TV / Leanback layout** (>1400px) — väčšie karty kanálov, väčšie fonty, zväčšený EPG timeline.
- **Tablet breakpoint** (701–1024px) — užší sidebar (240px), kompaktnejšie EPG labely.
- **Mobile portrait** (<700px) — vertikálny layout, sidebar hore (max 45vh).
- **Mobile landscape** (<700px, landscape) — 2-stĺpcový layout zachovaný (sidebar vľavo 200px).
- **D-pad navigácia** — ArrowLeft/ArrowRight prepína fokus; PageUp/PageDown prepína kanály s auto-scroll a wrap-around.
- **Home/End klávesy** — skok na prvý/posledný kanál v zozname.
- **Escape klávesa** — zatvorí nastavenia alebo switch overlay.
- **Auto-scroll** — pri prepnutí kanála sa aktívna karta scrollne do viditeľnosti.

---

## [0.2.0] — 2026-05-31

### ⚡ Fáza 2 — Kľúčové funkcie

#### Added
- **Skupinový filter kanálov** — dropdown v sidebari filtruje kanály podľa `group-title`.
- **CORS proxy pre web verziu** — konfigurovateľný URL prefix v Nastavenia › Sieť.
- **Vyhľadávanie v EPG** — search input filtruje kanály a programy podľa názvu.
- **Klávesová navigácia** — ArrowUp/ArrowDown medzi channel kartami v sidebari.
- **Focus-visible ring** — vizuálny focus indikátor pre keyboard používateľov.

#### Changed
- **EPG guide** — odstránený hardcoded limit 80 kanálov. Zobrazujú sa všetky kanály.
- **`renderChannels()`** — refaktorovaný na použitie zdieľanej `filteredChannels()` funkcie.

---

## [0.1.2] — 2026-05-31

### 🔨 Fáza 1.2 — Okamžité opravy (audit)

#### Added
- **MIT LICENSE súbor** — projekt je teraz officiálny open-source pod MIT licenciou.
- **hls.js bundlovaný do `vendor/`** — `copy-web.mjs` teraz kopíruje `hls.min.js` do `dist/web/vendor/hls.js/`.
- **HLS podpora pre Video.js** — priama integrácia cez hls.js keď VHS plugin nie je dostupný.
- **HLS podpora pre ArtPlayer** — `customType.m3u8` handler vytvára hls.js inštanciu pre každý HLS stream.
- **Error handling pre parsing** — `loadPlaylistText()` a `loadEpgText()` obalené v try/catch.
- **localStorage varovanie** — pri ukladaní > 4 MB sa vypíše warning do konzoly.

#### Changed
- **`ensureHls()`** — teraz skúša najprv lokálny `./vendor/hls.js/hls.min.js`, potom CDN fallback.
- **ArtPlayer** — pri prepínaní kanálov sa inštancia destroyuje a vytvára nová.

#### Fixed
- **`.gitignore`** — pridaný `android/` adresár (generovaný Capacitorom).

---

## [0.1.1] — 2026-05-31

### 🔨 Fáza 1.1 — Predauditové opravy

#### Added
- **`sanitizeLogoUrl()`** — validácia logo URL (XSS prevencia), povolené iba `https?://` a `data:image/`.
- **`safeGet` / `safeSet` / `safeGetJson` / `safeSetJson`** — localStorage operácie obalené v try/catch pre sandboxované prostredia.
- **Správa playlistov** — drawer s pridávaním, odoberaním a prepínaním viacerých playlistov.
- **Správa EPG zdrojov** — zlučovanie viacerých EPG zdrojov s deduplikáciou.
- **Android intent bridge** — `TCLVPlayerPlugin.kt` plne implementovaný s `Intent.ACTION_VIEW`, URL schema validáciou a fallbackom na generického playera.

#### Fixed
- **Demo URL** — nahradené nefunkčné `example.com` URL skutočnými HLS testovacími streamami.
- **`setInterval`** — partial refresh namiesto plného `renderAll()`.

---

## [0.1.0] — 2026-05-31

### 🎉 Iniciálna verzia

#### Added
- Základná aplikácia s HTML5 video playerom
- M3U/M3U8 a XSPF parsing
- XMLTV EPG parsing s fuzzy matchingom kanálov
- EPG časová os a switch overlay
- Video.js a ArtPlayer ako alternatívne web playery
- MPV a VLC ako externé natívne playery
- Electron shell pre Windows (sandbox, contextIsolation)
- Capacitor shell pre Android/GoogleTV
- Dvojjazyčné rozhranie (SK/EN)
- CI/CD workflows pre web, Windows a Android buildy
- Placeholder logá s SVG inicálkami a HSL farbou

---

<div align="center">

[⬆ Späť nahor](#-changelog--tcLVplayer) · [📖 README](README.md)

</div>
