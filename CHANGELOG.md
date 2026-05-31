# Changelog

Vsetky vyznamne zmeny v projekte TCLVPlayer su dokumentovane v tomto subore.

Format je zalozeny na [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt pouziva [Semanticke verziovanie](https://semver.org/).

---

## [0.5.0] — 2026-05-31

### Faza 5 — Vizualny redizajn a opravy UX

#### Added
- **Dark Graphite tema** — kompletne prepisany `styles.css` s novym vizualom inspirovanym IPTVnator. Tmavo-sivy vizual s priesvitnymi prvkami (`backdrop-filter: blur`), `color-mix()` povrchy, viacvrstvove graphite odtiene (#0d0f14 → #13161e → #1a1e2a → #222838).
- **DM Sans font** — Google Fonts import s fallbackom na Inter/system-ui. Lepsie kerning a citatelnost.
- **Frosted glass efekty** — topbar, settings panel header a switch overlay pouzivaju `backdrop-filter: blur(18px)` s polopriehladnym pozadim.
- **Animovane EPG** — programy v timeline maju hover efekty (`scaleY`, `border-color` transition), `current` programy maju accent glow. Now-line ma `box-shadow` ziarenie.
- **Animovany switch overlay** — `@keyframes switchSlideUp` animacia pri zobrazeni notifikacie.
- **HLS error handling** — `Hls.Events.ERROR` listener pre fatalne chyby. Non-HLS obsah pouziva `canplay` + `error` eventy namiesto okamziteho `play()`.

#### Changed
- **Switch overlay** — presunuta z `position:absolute;inset:0` (cela plocha) na kompaktnu notifikaciu v spodnej casti playera s `border-radius`, `backdrop-filter` a slide-up animaciou.
- **Farebna paleta** — `--accent` zmeneny na `#5b8def` (azure blue), novy `--accent-glow` pre selection efekty, `--text-bright` pre nadpisy, `--glass-bg` pre frosted glass povrchy.
- **Channel karty** — vacsie logo (52px), lepsie medzery, gradient progress bar, `color-mix` active state s inset glow.
- **Ikony a spacing** — brand mark 42px s gradient pozadim a `box-shadow`, vacsie `icon-button` (42px).
- **Settings panel** — sticky glass header, vacsie padding, lepsie hover stavy na sekciach.
- **Scrollbar** — jemnejsi scrollbar s hover stavom.

#### Removed
- **Demo funkcionalita** — `loadDemo()` funkcia, `#sampleButton`, demo sekcia v nastaveniach a prislusne preklady (`sample`, `settingsDemo`) boli kompletne odstranene.

#### Fixed
- **Nastavenia sa nedali zatvori** — CSS `display: flex` na `.settings-panel` prepisoval `hidden` atribut. Opravene pridanim `.settings-panel[hidden] { display: none !important; }`.
- **Text selection** — pridany `user-select: none` na `body` (s vynimkou `input`, `textarea`, `select`).
- **HTML5 prehravanie** — pridany `canplay` event listener pre non-HLS obsah, `error` listener pre chyby, HLS fatal error handling.

---

## [0.4.0] — 2026-05-31

### Faza 4 — CI/CD a kvalita kodu

#### Added
- **ESLint konfiguracia** — `eslint.config.js` s flat config formatom. Separatne nastavenia pre `app.js` (script/browser globals), `native/electron/` (CommonJS/Node globals), `scripts/` (ESM) a `tests/` (ESM). Prazdne catch bloky povolene (`allowEmptyCatch`).
- **Unit testy** — 31 testov v `tests/parsers.test.js` cez Vitest. Pokryte funkcie: `normalizeId`, `uniqueId`, `attr`, `parseM3U` (7 testov vrátane BOM, CRLF, bare URLs, komentarov), `parseXmlTvDate` (UTC offsety), `sanitizeLogoUrl` (XSS prevencia), `hashCode`.
- **Testovatelny modul** — `lib/parsers.js` exportuje ciste funkcie bez DOM zavislosti, zrkadliace logiku z `app.js`.
- **Dependabot** — `.github/dependabot.yml` pre npm (tyzdenne, zoskupene podla capacitor/electron/players) a GitHub Actions (mesacne).
- **npm scripty** — `npm run lint` a `npm test` pridane do `package.json`.

#### Changed
- **CI workflow** — rozdeleny na dva joby: `lint-and-test` (Ubuntu) a `validate` (Windows). Lint a testy bezia na Ubuntu, syntax check a web bundle build na Windows.

#### Dependencies
- `eslint` a `@eslint/js` pridane ako devDependencies
- `vitest` pridany ako devDependency

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
