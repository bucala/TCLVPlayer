# 📋 Changelog — TCLVPlayer

Všetky významné zmeny v projekte sú dokumentované v tomto súbore.

> Formát je založený na [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
> Projekt používa [Sémantické verziovanie](https://semver.org/).

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

## [0.7.0] — 2026-06-01

### Faza 7 — Layout redesign, Electron opravy, Windows/Android build

#### Added
- **Sidebar toggle** — tlačidlo na skrytie/zobrazenie zoznamu kanálov
- **EPG toggle** — prepínanie EPG panelu z topbaru
- **Electron User-Agent** — Chrome UA override pre kompatibilitu so streamami
- **Electron Referer** — automatický Referer header pre všetky requesty
- **App ikona** — vlastná oranžová TV ikona (512px PNG + SVG)
- **Muted autoplay** — video sa spustí stlmené, po úspechu odtlmí

#### Changed
- **Layout** — z grid na flex, sidebar 280px s transition
- **Mobile** — flex-direction: column, player hore, kanály dole
- **Electron menu** — odstránený default menu bar
- **Electron CORS sekcia** — skrytá v nastaveniach (nepotrebná)

---

## [0.6.1] — 2026-06-01

### 🔧 Fáza 6.1 — Robustný CORS proxy a EPG retry

#### ➕ Added
- **Proxy fallback (encoded → raw)** — `loadTextFromUrl()` skúsi proxy s `encodeURIComponent(url)`, ak vráti chybu, skúsi s raw URL. Pokrýva rôzne formáty CORS proxy služieb.
- **HLS proxy fallback** — `tryHlsPlayback()` pri fatálnej chybe automaticky reštartuje s raw proxy URL formátom.
- **Auto EPG retry pri zmene proxy** — keď používateľ nastaví/zmení CORS proxy, automaticky sa znovu načítajú EPG zdroje z playlistu.
- **`proxyUrlRaw()`** — helper pre raw (nekódovaný) proxy URL formát.

#### 🔀 Changed
- **Proxy placeholder** — zmenený z `corsproxy.io` na `api.allorigins.win/raw?url=` (spoľahlivejší).
- **`loadTextFromUrl()`** — úplne prepísaná s dual-proxy stratégiou (encoded + raw fallback).
- **`tryHlsPlayback()`** — pridaný `useRawProxy` parameter s automatickým retry.
- **CORS proxy change handler** — pri zmene proxy sa znovu spustí `autoLoadEpgFromPlaylist()` a reštartuje prehrávanie.

#### 🐛 Fixed
- **Auto EPG bez proxy** — auto-detegované EPG sa pokúšalo načítať pred nastavením CORS proxy. Teraz sa retry spustí automaticky po uložení proxy.
- **Proxy 403** — `corsproxy.io` vracal 403 pre niektoré URL. Fallback na raw URL formát pokrýva alternatívne proxy služby.

---

## [0.6.0] — 2026-06-01

### 🔍 Fáza 6 — Opravy prehrávania, EPG a CORS (audit)

#### ➕ Added
- **Try-direct-first stratégia** — `loadTextFromUrl()` najprv skúsi priame pripojenie, až pri CORS chybe použije proxy. Eliminuje zbytočné proxy requesty pre servery s CORS hlavičkami.
- **HLS retry s proxy** — `tryHlsPlayback()` funkcia: hls.js najprv hrá priamo, pri fatálnej chybe automaticky reštartuje s CORS proxy (`xhrSetup`).
- **EPG active/inactive** — EPG zdroje majú `active` field s "Use" toggle tlačidlom. Neaktívne zdroje sa vynechajú z `rebuildMergedEpg()`.
- **EPG `.xml` fallback** — `autoLoadEpgFromPlaylist()` ak `.xml.gz` zlyhá, skúsi `.xml` verziu bez kompresie.
- **Auto-detekcia EPG z M3U** — `x-tvg-url` hlavička v M3U playlistoch je parsovaná. Relevantné EPG zdroje (podľa `tvg-id` krajiny) sa načítajú automaticky.
- **Podpora `.gz` EPG** — gzipované EPG súbory dekompresované cez `DecompressionStream` API.
- **Indikátor lokálny/sieťový** — zdroje playlistov aj EPG zobrazujú typ (lokálny súbor / sieťový URL).
- **SVG favicon** — oranžová ikona aplikácie (`favicon.svg`) s gradientom zhodným s brand-mark logom.
- **Oranžový `accent-color`** — formulárové prvky a `::selection` používajú `accent-color: var(--accent)`.

#### 🔀 Changed
- **`loadTextFromUrl()`** — prepísaná s try-direct-first logikou a `.gz` dekompresnou podporou.
- **`playHtml5()`** — deleguje na `tryHlsPlayback()` s automatickým retry cez proxy.
- **`rebuildMergedEpg()`** — filtruje len aktívne (`active !== false`) EPG zdroje.
- **`autoLoadEpgFromPlaylist()`** — robustnejšia s `.xml` fallbackom a viditeľnými chybovými hláškami.

#### 🐛 Fixed
- **HLS prehrávanie** — priame pripojenie pre servery s CORS → proxy retry pre ostatné. Predtým sa vždy proxovalo, čo zlyhávalo s rate-limitovanými verejnými proxy.
- **EPG načítanie** — chyby sa už ticho nezahlcujú, zobrazujú sa v UI. Fallback z `.gz` na `.xml`.

---

## [0.5.0] — 2026-05-31

### 🎨 Fáza 5 — Vizuálny redizajn a opravy UX

#### ➕ Added
- **Warm Orange téma** — kompletne prepísaný `styles.css` s novým vizuálom. Čierne pozadie (`#000`) s teplým oranžovým akcentom (`#e87442`), iOS-style dark povrchy (`#1c1c1e`, `#2c2c2e`), `backdrop-filter: blur` frosted glass efekty, veľké zaoblenia (16px default).
- **DM Sans font** — Google Fonts import s fallbackom na Inter/system-ui. Lepšie kerning a čitateľnosť.
- **Frosted glass efekty** — topbar, settings panel header a switch overlay používajú `backdrop-filter: blur(18px)` s polopriehľadným pozadím.
- **Adaptívny layout** — breakpointy pre TV (>1400px), tablet (701–1024px), mobil portrait (<700px), mobil landscape (<900px landscape), malý telefón (<400px). Optimalizované pre Smart TV, mobilné zariadenia aj webový prehliadač.
- **Animované EPG** — programy v timeline majú hover efekty (`scaleY`, `border-color` transition), `current` programy majú accent glow. Now-line má `box-shadow` žiarenie.
- **Animovaný switch overlay** — `@keyframes switchSlideUp` animácia pri zobrazení notifikácie.
- **HLS error handling** — `Hls.Events.ERROR` listener pre fatálne chyby. Non-HLS obsah používa `canplay` + `error` eventy namiesto okamžitého `play()`.

#### 🔀 Changed
- **Switch overlay** — presunutá z `position:absolute;inset:0` (celá plocha) na kompaktnú notifikáciu v spodnej časti playera s `border-radius`, `backdrop-filter` a slide-up animáciou.
- **Farebná paleta** — `--accent` zmenený na `#e87442` (warm orange), `--bg` na `#000000`, `--surface` na `#1c1c1e`. Aktívny kanál s ľavým orange accent barom. Pill-shaped prvky, väčšie zaoblenia.
- **Channel karty** — väčšie logo (52px), lepšie medzery, gradient progress bar, `color-mix` active state s inset glow. Podtitulok zobrazuje len názov programu (bez skupiny).
- **Ikony a spacing** — brand mark 42px s gradient pozadím a `box-shadow`, väčšie `icon-button` (42px).
- **Settings panel** — `<details>/<summary>` nahradené plochými `<div>/<h3>` sekciami (TV ovládač friendly). Sticky glass header, väčšie padding.
- **Scrollbar** — jemnejší scrollbar s hover stavom.
- **Player message** — presunutá na `bottom: 54px` aby neprekrývala ovládacie prvky videa.

#### ❌ Removed
- **Demo funkcionalita** — `loadDemo()` funkcia, `#sampleButton`, demo sekcia v nastaveniach a príslušné preklady (`sample`, `settingsDemo`) boli kompletne odstránené.
- **Sidebar search & group filter** — `#searchInput`, `#groupFilter`, `getGroups()`, `renderGroupFilter()`, `state.selectedGroup` odstránené. Sidebar teraz zobrazuje priamo zoznam kanálov.
- **Skupinový text v kartách** — kanál ukazuje len názov programu, nie názov skupiny.
- **Nepotrebné preklady** — `search`, `allGroups` odstránené.

#### 🐛 Fixed
- **Nastavenia sa nedali zatvoriť** — CSS `display: flex` na `.settings-panel` prepisoval `hidden` atribút. Opravené pridaním `.settings-panel[hidden] { display: none !important; }`.
- **Text selection** — pridaný `user-select: none` na `body` (s výnimkou `input`, `textarea`, `select`).
- **HTML5 prehrávanie** — pridaný `canplay` event listener pre non-HLS obsah, `error` listener pre chyby, HLS fatal error handling.
- **Select dropdown farby** — `color-scheme: dark` na `html/body` opravuje biely dropdown s nečitateľným textom.
- **EPG CORS chyba** — pri zlyhaní fetch bez CORS proxy sa zobrazí hláška s navedením na Nastavenia › Sieť (`corsNeeded` preklad).

---

## [0.4.0] — 2026-05-31

### 🧪 Fáza 4 — CI/CD a kvalita kódu

#### ➕ Added
- **ESLint konfigurácia** — `eslint.config.js` s flat config formátom. Separátne nastavenia pre `app.js` (script/browser globals), `native/electron/` (CommonJS/Node globals), `scripts/` (ESM) a `tests/` (ESM). Prázdne catch bloky povolené (`allowEmptyCatch`).
- **Unit testy** — 31 testov v `tests/parsers.test.js` cez Vitest. Pokryté funkcie: `normalizeId`, `uniqueId`, `attr`, `parseM3U` (7 testov vrátane BOM, CRLF, bare URLs, komentárov), `parseXmlTvDate` (UTC offsety), `sanitizeLogoUrl` (XSS prevencia), `hashCode`.
- **Testovateľný modul** — `lib/parsers.js` exportuje čisté funkcie bez DOM závislostí, zrkadliace logiku z `app.js`.
- **Dependabot** — `.github/dependabot.yml` pre npm (týždenne, zoskupené podľa capacitor/electron/players) a GitHub Actions (mesačne).
- **npm skripty** — `npm run lint` a `npm test` pridané do `package.json`.

#### 🔀 Changed
- **CI workflow** — rozdelený na dva joby: `lint-and-test` (Ubuntu) a `validate` (Windows). Lint a testy bežia na Ubuntu, syntax check a web bundle build na Windows.

#### 📦 Dependencies
- `eslint` a `@eslint/js` pridané ako devDependencies
- `vitest` pridaný ako devDependency

---

## [0.3.0] — 2026-05-31

### 📱 Fáza 3 — Platform UX

#### ➕ Added
- **TV / Leanback layout** (>1400px) — väčšie karty kanálov (56px/64px logo), väčšie fonty, zväčšený EPG timeline, širšie channel labels. Pre `pointer:coarse` zariadenia (dotykové TV) ešte väčší padding a ovládacie prvky.
- **Tablet breakpoint** (701–1024px) — užší sidebar (240px), kompaktnejšie EPG labely pre stredne veľké obrazovky.
- **Mobile portrait** (<700px) — vertikálny layout, sidebar hore (max 45vh), skrytý brand tagline, kompaktnejší topbar, EPG search na plnú šírku.
- **Mobile landscape** (<700px, landscape) — 2-stĺpcový layout zachovaný (sidebar vľavo 200px), player s fixnou výškou, skrytý now-panel text a EPG guide pre maximalizovanie video priestoru.
- **Malý telefón** (<420px) — ešte kompaktnejšie karty (40px logo), menší group filter, sidebar max 35vh.
- **D-pad navigácia** — ArrowLeft/ArrowRight prepína fokus medzi sidebar a content oblasťou. PageUp/PageDown (aj ChannelUp/ChannelDown) prepína kanály s auto-scroll a wrap-around.
- **Home/End klávesy** — skok na prvý/posledný kanál v zozname.
- **Escape klávesa** — zatvorí nastavenia alebo switch overlay.
- **Auto-scroll** — pri prepnutí kanála sa aktívna karta automaticky scrollne do viditeľnosti (smooth behavior).

#### 🔀 Changed
- **Existujúci 700px breakpoint** — kompletne prepísaný s detailnejšími úpravami pre topbar, brand, section-title, now-panel, timeline labels.

---

## [0.2.0] — 2026-05-31

### ⚡ Fáza 2 — Kľúčové funkcie

#### ➕ Added
- **Skupinový filter kanálov** — dropdown v sidebari filtruje kanály podľa `group-title` z M3U playlistu. Filter sa aplikuje aj na EPG guide.
- **CORS proxy pre web verziu** — konfigurovateľný URL prefix v Nastavenia › Sieť. Automaticky sa prepends iba vo web verzii (Electron a Android ho ignorujú). Uložený v localStorage.
- **Vyhľadávanie v EPG** — search input v hlavičke EPG guide panelu. Filtruje kanály a programy podľa názvu.
- **Klávesová navigácia** — ArrowUp/ArrowDown medzi channel kartami v sidebari.
- **Focus-visible ring** — vizuálny focus indikátor pre keyboard používateľov na channel kartách.
- **Preklady** — nové SK/EN preklady pre všetky pridané UI prvky (`allGroups`, `settingsNetwork`, `labelCorsProxy`, `corsHint`, `searchEpg`).

#### 🔀 Changed
- **EPG guide** — odstránený hardcoded limit 80 kanálov. Zobrazujú sa všetky kanály, filtrované podľa skupiny a EPG vyhľadávania.
- **`renderChannels()`** — refaktorovaný na použitie zdieľanej `filteredChannels()` funkcie.

---

## [0.1.2] — 2026-05-31

### 🔨 Fáza 1.2 — Okamžité opravy (audit)

#### ➕ Added
- **MIT LICENSE súbor** — projekt je teraz oficiálny open-source pod MIT licenciou.
- **hls.js bundlovaný do `vendor/`** — `copy-web.mjs` teraz kopíruje `hls.min.js` do `dist/web/vendor/hls.js/` pre offline fallback.
- **HLS podpora pre Video.js** — priama integrácia cez hls.js keď VHS plugin nie je dostupný. Pripája sa na Video.js tech element.
- **HLS podpora pre ArtPlayer** — `customType.m3u8` handler vytvára hls.js inštanciu pre každý HLS stream. ArtPlayer sa teraz pri zmene kanálu destroyuje a rekonštruuje.
- **Error handling pre parsing** — `loadPlaylistText()` a `loadEpgText()` sú teraz obalené v try/catch. Poškodený XML/M3U už nespôsobí pád aplikácie.
- **localStorage varovanie** — pri ukladaní playlistov alebo EPG textov väčších ako 4 MB sa vypíše warning do konzoly.

#### 🔀 Changed
- **`ensureHls()`** — teraz skúša najprv lokálny `./vendor/hls.js/hls.min.js`, potom CDN fallback.
- **ArtPlayer** — pri prepínaní kanálov sa inštancia destroyuje a vytvára nová (nutné kvôli `customType`).

#### 🐛 Fixed
- **`.gitignore`** — pridaný `android/` adresár (generovaný Capacitorom, nepatrí do repa).

---

## [0.1.1] — 2026-05-31

### 🔨 Fáza 1.1 — Predauditové opravy

#### ➕ Added
- **`sanitizeLogoUrl()`** — validácia logo URL (XSS prevencia), povolené iba `https?://` a `data:image/`.
- **`safeGet` / `safeSet` / `safeGetJson` / `safeSetJson`** — localStorage operácie obalené v try/catch pre sandboxované prostredia.
- **Správa playlistov** — drawer s pridávaním, odoberaním a prepínaním viacerých playlistov.
- **Správa EPG zdrojov** — zlučovanie viacerých EPG zdrojov s deduplikáciou.
- **Android intent bridge** — `TCLVPlayerPlugin.kt` plne implementovaný s `Intent.ACTION_VIEW`, URL schema validáciou a fallbackom na generického playera.

#### 🐛 Fixed
- **Demo URL** — nahradené nefunkčné `example.com` URL skutočnými HLS testovacími streamami (mux.dev, unified-streaming, bitdash, akamaihd).
- **`setInterval`** — partial refresh namiesto plného `renderAll()` — aktualizuje iba EPG, progress barky a texty kanálov.

---

## [0.1.0] — 2026-05-31

### 🎉 Iniciálna verzia

#### ➕ Added
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
