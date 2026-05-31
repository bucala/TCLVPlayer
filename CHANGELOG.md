# Changelog

Vsetky vyznamne zmeny v projekte TCLVPlayer su dokumentovane v tomto subore.

Format je zalozeny na [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt pouziva [Semanticke verziovanie](https://semver.org/).

---

## [0.3.0] — 2026-05-31

### Faza 3 — Platform UX

#### Added
- **TV / Leanback layout** (>1400px) — vacsie karty kanalov (56px/64px logo), vacsie fonty, zvaceny EPG timeline, sirsie channel labels. Pre `pointer:coarse` zariadenia (dotykove TV) este vacsi padding a ovladacie prvky.
- **Tablet breakpoint** (701–1024px) — uzsi sidebar (240px), kompaktnejsie EPG labely pre stredne velke obrazovky.
- **Mobile portrait** (<700px) — vertikalny layout, sidebar hore (max 45vh), skryty brand tagline, kompaktnejsi topbar, EPG search na plnu sirku.
- **Mobile landscape** (<700px, landscape) — 2-stlpcovy layout zachovany (sidebar vlavo 200px), player s fixnou vyskou, skryty now-panel text a EPG guide pre maximalizovanie video priestoru.
- **Maly telefon** (<420px) — este kompaktnejsie karty (40px logo), mensi group filter, sidebar max 35vh.
- **D-pad navigacia** — ArrowLeft/ArrowRight prepina fokus medzi sidebar a content oblastou. PageUp/PageDown (aj ChannelUp/ChannelDown) prepina kanaly s auto-scroll a wrap-around.
- **Home/End klavesy** — skok na prvy/posledny kanal v zozname.
- **Escape klavesa** — zatvori nastavenia alebo switch overlay.
- **Auto-scroll** — pri prepnuti kanala sa aktivna karta automaticky scrollne do viditelnosti (smooth behavior).

#### Changed
- **Existujuci 700px breakpoint** — kompletne prepisany s detailnejsimi upravami pre topbar, brand, section-title, now-panel, timeline labels.

---

## [0.2.0] — 2026-05-31

### Faza 2 — Klucove funkcie

#### Added
- **Skupinovy filter kanalov** — dropdown v sidebari filtruje kanaly podla `group-title` z M3U playlistu. Filter sa aplikuje aj na EPG guide.
- **CORS proxy pre web verziu** — konfigurovatelny URL prefix v Nastavenia > Siet. Automaticky sa prepends iba vo web verzii (Electron a Android ho ignoruju). Ulozeny v localStorage.
- **Vyhladavanie v EPG** — search input v hlavicke EPG guide panelu. Filtruje kanaly a programy podla nazvu.
- **Klavesova navigacia** — ArrowUp/ArrowDown medzi channel kartami v sidebari.
- **Focus-visible ring** — vizualny focus indikator pre keyboard uzivatelov na channel kartach.
- **Preklady** — nove SK/EN preklady pre vsetky pridane UI prvky (allGroups, settingsNetwork, labelCorsProxy, corsHint, searchEpg).

#### Changed
- **EPG guide** — odstraneny hardcoded limit 80 kanalov. Zobrazuju sa vsetky kanaly, filtrovane podla skupiny a EPG vyhladavania.
- **renderChannels()** — refaktorovany na pouzitie zdielanej `filteredChannels()` funkcie.

---

## [0.1.2] — 2026-05-31

### Faza 1 — Okamzite opravy (audit)

#### Added
- **MIT LICENSE subor** — projekt je teraz oficialny open-source pod MIT licenciou.
- **hls.js bundlovany do vendor/** — `copy-web.mjs` teraz kopiruje `hls.min.js` do `dist/web/vendor/hls.js/` pre offline fallback.
- **HLS podpora pre Video.js** — priama integracia cez hls.js ked VHS plugin nie je dostupny. Pripaja sa na Video.js tech element.
- **HLS podpora pre ArtPlayer** — `customType.m3u8` handler vytvara hls.js instanciu pre kazdy HLS stream. ArtPlayer sa teraz pri zmene kanalu destroyuje a rekonstruuje.
- **Error handling pre parsing** — `loadPlaylistText()` a `loadEpgText()` su teraz obalene v try/catch. Poskodeny XML/M3U uz nezpsobi pad aplikacie.
- **localStorage varovanie** — pri ukladani playlistov alebo EPG textov vacsich ako 4 MB sa vypise warning do konzoly.

#### Changed
- **ensureHls()** — teraz skusa najprv lokalny `./vendor/hls.js/hls.min.js`, potom CDN fallback.
- **ArtPlayer** — pri prepinani kanalov sa instancia destroyuje a vytvara nova (nutne kvoli customType).

#### Fixed
- **.gitignore** — pridany `android/` adresar (generovany Capacitorom, nepatri do repa).

---

## [0.1.1] — 2026-05-31

### Predauditove opravy

#### Added
- **sanitizeLogoUrl()** — validacia logo URL (XSS prevencia), povolene iba `https?://` a `data:image/`.
- **safeGet/safeSet/safeGetJson/safeSetJson** — localStorage operacie obalene v try/catch pre sandboxovane prostredia.
- **Sprava playlistov** — drawer s pridavanim, odoberanim a prepinanim viacerych playlistov.
- **Sprava EPG zdrojov** — zlucovanie viacerych EPG zdrojov s deduplikaciou.
- **Android intent bridge** — `TCLVPlayerPlugin.kt` plne implementovany s `Intent.ACTION_VIEW`, URL schema validaciou a fallbackom na generickyho playera.

#### Fixed
- **Demo URL** — nahradene nefunkcne `example.com` URL skutocnymi HLS testovacimi streamami (mux.dev, unified-streaming, bitdash, akamaihd).
- **setInterval** — partial refresh namiesto plneho `renderAll()` — aktualizuje iba EPG, progress barky a texty kanalov.

---

## [0.1.0] — 2026-05-31

### Inicialna verzia

#### Added
- Zakladna aplikacia s HTML5 video playerom
- M3U/M3U8 a XSPF parsing
- XMLTV EPG parsing s fuzzy matching kanalov
- EPG casova os a switch overlay
- Video.js a ArtPlayer ako alternativne web playery
- MPV a VLC ako externe nativne playery
- Electron shell pre Windows (sandbox, contextIsolation)
- Capacitor shell pre Android/GoogleTV
- Dvojjazycne rozhranie (SK/EN)
- CI/CD workflows pre web, Windows a Android buildy
- Placeholder loga s SVG inicialkami a HSL farbou
