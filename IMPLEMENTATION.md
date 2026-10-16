# Implementované opravy auditu a natívne prehrávanie — 1.3.0

Tento dokument opisuje zmeny zdrojového kódu verzie 1.3.0 a ich overenie. Commit zdrojov nezahŕňa publikovanie binárneho release ani prenos používateľských playlistov. Testovacie kanály sa generujú v pamäti a používajú iba domény `.example`.

## Pokrytie auditu

| Nález | Implementácia |
| --- | --- |
| A01 závislosti | Aktualizované Capacitor 8.5.3, Electron 43.8, HLS/Video.js/testovacie nástroje a tranzitívne závislosti. Overrides pre kompatibilný opravený uuid a aktuálny Electron downloader. `npm audit`: 0 zraniteľností. |
| A02 SSRF | Server používa zdieľaný `resolveTarget` a Undici Agent s overeným pripnutým lookup pre každý redirect. |
| A03 zálohy | Úplný lokálny JSON export vrátane dostupného obsahu a pôvodných URL. Žiadne nahrádzanie hesiel za nepoužiteľný placeholder. Súbor sa neodosiela do repozitára. |
| A04 súbeh playlistov | Generácia aktivácie bráni staršej požiadavke prepísať novší výber. Overené browser testom s opačným poradím odpovedí. |
| A05 Android podpis | Release konfigurácia používa iba externý stabilný kľúč; CI vyžaduje signing Secrets a overí APK. Bez nich sa nepodpísaný release nevydá. Kľúč nebol vytvorený ani pridaný do Git. |
| A06 lokálne EPG | IndexedDB uchováva obsah lokálnych zdrojov, vrátane migrácie pôvodného úložiska. |
| A07 odstránenie playlistu | Nasledujúci zdroj sa aktivuje štandardnou cestou; odstránenie posledného zastaví prehrávanie a vyčistí kanály. |
| A08 multiview | Fyzické zničenie media objektu je oddelené od logického zrušenia slotu aj vo fatálnej chybovej vetve. Skutočný browser test overuje bridge pokus sekundárneho slotu. |
| A09 jPlayer | Zjednotený pribalený jQuery 3.7.1. |
| A10 kvalita | Naplnenie HLS level menu; natívny výber kvality je v Nastaveniach, aby ho neprekrýval OS video surface. |
| A11 import | Verziovaná schéma, typy, URL, unikátne ID, allowlist prehrávačov, validácia pred uložením. Opravené vypnuté proxy a neplatné active ID. |
| A12 EPG refresh | Expirácia aj dát v pamäti a pravidelná obnova počas relácie; posledný dobrý obsah ostáva pri chybe siete. |
| A13 výkon | Lineárne ID parsera, jeden produkčný parser, SAX worker, indexované/binarizované EPG vyhľadávanie, filtrovanie relevantných programov a virtualizované kanály/EPG. Obmedzený počet sťahovaní a veľkosť dekompresie. |
| A14 CSP/assets | CSP v HTML aj konfigurácii webu, iba lokálne player assets, žiadne `@latest` CDN spúšťanie. Licencie sa kopírujú do distribúcie. |
| A15 proxy zneužitie | 30 požiadaviek/minútu na klienta a 8 súbežných požiadaviek na proces. Pre distribuovaný rozpočet hostingu ostáva vhodná jeho vlastná kvóta. |
| A16 Android verzia | `versionName` a monotónny `versionCode` odvodené z package.json; kontrola zhody release tagu. |
| A17 PowerShell | Kontroly `$LASTEXITCODE` a `npm ci`, bez falošného pokračovania po chybe externého príkazu. |
| A18 výber kanála | Uložené ID sa overuje voči novému playlistu, voľba sa pamätá pre každý zdroj. |

Ďalšie opravy: zdieľané pending promises pre assets, zrušenie zastaraného štartu prehrávača, kontrola desktop IPC sendera, zákaz cudzích navigácií/popupov, návrat výsledku spustenia VLC/mpv, obsluha konfigurovanej exe cesty, potvrdenie modalov/focus trap, zachovanie fokusu pri obnove a pripojenie obsahu tretích strán k distribúcii.

## Android

Nový Media3 prehrávač dekóduje v natívnej vrstve. Foreground `MediaSessionService` pokračuje nezávisle od pauzy WebView a poskytuje štandardnú mediálnu notifikáciu s logom kanála, názvom, play/pause a predchádzajúcim/nasledujúcim kanálom. Rieši audio focus a odpojenie slúchadiel. PiP je manuálne dostupný z Nastavení na zariadeniach, ktoré ho podporujú.

Na low-RAM zariadení sa používa cieľový buffer 8 MiB a preferencia 720p variantu, inak buffer 16 MiB. Kvalitu možno prepnúť. Veľké zoznamy nevytvárajú naraz tisíce DOM kariet. Neznáme logá majú obmedzený fallback, preferuje sa provider/cached logo a indexy sa nezačínajú sťahovať na prázdnej úvodnej obrazovke.

Android systémové zálohovanie a automatický prenos dát sú v manifest/resources vylúčené. Prenos playlistov je explicitný súborový export/import. Po návrate z notifikácie aj po obnove Activity sa klient znovu pripojí k bežiacej mediálnej službe.

Natívny Media3 multiview sa na slabých zariadeniach nezapína; dva webové sloty zostávajú dostupné pri webových adapteroch.

Horná kapsula z referenčného obrázka je vlastnosť konkrétneho výrobcu systému. Implementované je štandardné Android mediálne rozhranie; aplikácia nevytvára jeho falošnú náhradu ani nevyžaduje overlay povolenie.

## Overenie

- `npm run check`: privacy guard, lint a 213 úspešných testov, 2 vynechané.
- Browser integrácia pre natívny web bundle aj browser/bridge bundle: D-pad, izolácia dialógov, obľúbené bez neúmyselného prehratia, perzistencia, export, neplatný import, opačné poradie aktivácií, worker, veľký virtualizovaný zoznam a fallback druhého slotu.
- Plný Vercel/browser build vrátane SHA-256 overeného Windows Node runtime bridge prešiel.
- Android `assembleDebug` a `lintDebug` prešli; vývojový podpis APK overený cez apksigner, metadáta 1.3.0 / 1003000 / minSdk 24 / targetSdk 36.
- Windows x64 unpacked aj portable EXE build prešli, vrátane zmenšeného app.asar bez duplicitných node_modules. Electron smoke test na Linuxe preveril štart UI, EPG worker a overené IPC. Prenosný EXE je nepodpísaný testovací build; pri krížovom zostavení nebola aplikovaná editácia Windows ikony/metadát, bežný Windows CI používa štandardnú konfiguráciu.
- Úplný NSIS Windows installer sa v tomto Linux prostredí nedal dokončiť pre chýbajúce Wine. Normálny Windows CI build zostáva nakonfigurovaný pre Windows runner.

Finálnu prevádzku na fyzickom Windows a konkrétnom Android TV treba overiť používateľským testom: živý stream, prepínanie, pozadie/zhasnutie, mediálna karta/logo/ovládanie, PiP, audio focus a návrat do aplikácie. Presný model slabšieho TV a jeho firmware neboli zadané. Produkčný Android release potrebuje existujúci súkromný podpisový kľúč; tento krok nebol simulovaný náhradným release kľúčom.
