<div align="center">
<img src="assets/icon.png" alt="TCLVPlayer" width="108" />

# TCLVPlayer 1.3.0

IPTV prehrávač pre Windows, Android, Android TV a web.
</div>

Windows aplikácia používa izolovaný Electron runtime. Android predvolene prehráva cez natívny **Media3/ExoPlayer** s hardvérovým dekódovaním. HTML5, Video.js, ArtPlayer, flv.js, jPlayer a externé VLC/mpv zostávajú voliteľné.

Kompletné zmeny verzie 1.3.0 sú v [CHANGELOG.md](CHANGELOG.md). [IMPLEMENTATION.md](IMPLEMENTATION.md) mapuje všetkých 18 nálezov auditu na opravy, ich overenie a zostávajúce obmedzenia.

## Súkromné dáta

Playlisty, kanály, EPG a prístupové údaje sa ukladajú iba v lokálnej databáze zariadenia. Aplikácia ich nepublikuje na GitHub a neobsahuje poskytovateľské playlisty. Zálohovanie a prenos medzi zariadeniami prebieha cez **explicitný export/import súboru**. Úplná záloha obsahuje aj lokálny obsah a pôvodné prihlasovacie URL; uchovávajte ju v súkromí.

Na webe je vzdialený source proxy predvolene vypnutý. Zdroje sa načítajú od poskytovateľa alebo cez spárovaný bridge na rovnakom počítači. Voliteľný vzdialený proxy dostane URL a obsah požiadavky, ak ho používateľ sám nastaví. Video sa neposiela cez Vercel proxy. Verejné indexy log môžu byť načítané z ich pôvodných GitHub zdrojov; používateľské playlisty sa týmto zdrojom neposielajú.

Adresáre `private/`, `exports/`, `backups/`, `local-data/`, exporty, playlistové súbory, balíky a podpisové kľúče sú ignorované Gitom. `npm run privacy:check` kontroluje sledované a staged súbory. Osobné súbory nevkladajte do zdrojového stromu; screenshoty a testovacie výstupy ukladajte mimo neho. Testy používajú iba syntetické fixture dáta na doménach `.example`.

## Inštalácia a zostavenie

Požiadavky: **Node.js >=22.19** (odporúčané Node 24), Git. Android navyše **JDK 21**, Android SDK 36 a Android Studio. Podporované Android API: 24+; PiP podľa podpory zariadenia od Androidu 8.

```sh
npm ci
npm run windows          # desktop aplikácia
npm run windows:dist     # Windows NSIS + portable, dist/
npm run web              # browser build, http://127.0.0.1:3000
npm run android:generate # vytvorí a zosynchronizuje android/
npm run android:studio   # otvorí Android Studio
npm run android:apk      # podpísané vývojové APK
```

Pre web s HTTP/CORS streamami rozbaľte Windows TCLV Bridge ZIP dostupný v Nastavenia → Sieť a spustite `Start TCLV Bridge.cmd`. Spárujte ho kódom z okna. Bridge počúva len na `127.0.0.1:3939–3941`, musí bežať na rovnakom počítači a vyžaduje povolenie lokálnej siete v prehliadači. Produkčný ZIP obsahuje Node.js a jeho licenciu. `npm run bridge:portable` ho vytvorí samostatne.

V prostredí, ktoré vyžaduje HTTP proxy pre Node fetch, použite podporované nastavenie runtime, napríklad `NODE_USE_ENV_PROXY=1` na Node 24. Overovanie TLS nevypínajte.

## Android prehrávanie na pozadí a PiP

- Zvoľte prehrávač **Natívny**. Natívny obraz je súčasťou TCLVPlayera, neotvára externú aplikáciu.
- Prehrávanie vlastní `MediaSessionService` s typom `mediaPlayback`, nie životný cyklus WebView. Pri zapnutej voľbe **Prehrávanie na pozadí** pokračuje aj po odchode z aplikácie alebo zhasnutí displeja.
- Android zobrazuje systémový mediálny panel s názvom a logom kanála, play/pause a dostupným predchádzajúcim/nasledujúcim kanálom. Podporuje zamknutú obrazovku, Bluetooth ovládače, stratu audio focusu a odpojenie slúchadiel.
- **PiP** spustíte tlačidlom v Nastaveniach. Video pokračuje v malom systémovom okne. Dostupnosť závisí od zariadenia a jeho nastavení.
- Tvar mediálnej karty, ikona v stavovej lište a prípadná horná kapsula sú súčasťou systémového rozhrania výrobcu; aplikácia používa štandardné Android media API.
- Po vypnutí prehrávania na pozadí sa interný prehrávač pri opustení aplikácie pozastaví. Externé VLC/mpv spravujú vlastné prehrávanie aj notifikácie.
- Na slabých TV odporúčame jeden natívny obraz. Webový multiview sa pri natívnom prehrávači nezobrazuje; pre dva súbežné webové streamy zvoľte HTML5 alebo iný webový prehrávač.

Buffer natívneho prehrávača je obmedzený na cieľových 16 MiB (8 MiB na zariadeniach s malou RAM) a 5–20 sekúnd. XMLTV sa spracúva v samostatnom worker vlákne, relevantné EPG sa indexuje a veľké zoznamy kanálov aj EPG vykresľujú iba časť riadkov. Na low-RAM zariadeniach automatický výber preferuje najviac 720p, ak stream taký variant ponúka; kvalitu možno zmeniť ručne. Všetky player knižnice sú pribalené; za behu sa nenačítava pohyblivá CDN verzia.

## Diaľkový ovládač a klávesnica

| Tlačidlo | Akcia |
| --- | --- |
| ↑ / ↓ v kanáloch | Fokus predchádzajúceho/nasledujúceho kanála bez spustenia |
| OK / Enter | Aktivácia vybraného prvku; držanie neopakuje spúšťanie |
| → z kanálov | Horná lišta |
| ← / → v hornej lište | Pohyb medzi ovládačmi |
| ↓ z hornej lišty | Návrat k vybranému kanálu |
| Channel ± / PageUp / PageDown | Prepnutie kanála |
| Guide / EPG | Programový sprievodca |
| Info | Detail aktuálneho programu |
| Back / Escape | Zavrie otvorený výber, dialóg alebo nastavenia, potom ďalšia úroveň UI |
| Media Play/Pause | Pozastavenie/pokračovanie |
| Home / End v kanáloch | Prvý/posledný kanál vrátane virtualizovaného zoznamu |

Nastavenia a dialógy zachytávajú fokus a zabraňujú prepínaniu kanálov v pozadí. Android posiela smerové tlačidlá jedinou cestou a neaplikuje ďalší systémový posun. Skutočné potvrdenie OK ostáva hardvérovou browser udalosťou, aby fungovali vstupné polia a výber súborov.

## Zálohy, playlisty a EPG

Import M3U/M3U8/XSPF a XMLTV vrátane gzip. Formát zoznamu EPG zdrojov je `Názov = URL`; export zoznamu je lokálny TXT súbor. Úplná JSON záloha verzie 2 obnovuje obsah, pôvodné URL, obľúbené, jazyk a nastavenia proxy. Pred zmenou dát sa overí schéma, URL, ID aj povolené prehrávače. Staršie metadátové zálohy verzie 1 zostávajú importovateľné, ale chýbajúci pôvodný lokálny súbor alebo už nahradené heslo z nich nemožno spätne získať.

Sieťové playlisty sa obnovujú po 15 minútach, EPG po 6 hodinách aj počas dlhej relácie. Aktivácia už aktívneho sieťového playlistu vynúti refresh. Lokálne zdroje sa nenačítavajú z názvu súboru cez sieť. Pri chybe sťahovania zostáva posledný použiteľný obsah. Veľkosť jedného zdroja je obmedzená na 64 MiB pred aj po dekompresii; JSON záloha môže mať do 256 MiB.

Serverový `/api/proxy` je obmedzený na playlisty/EPG do 3 MiB a 15 sekúnd. Každé spojenie aj redirect používa overenú a pripnutú DNS adresu. Limity sú 30 požiadaviek/minútu na klienta a 8 súbežných požiadaviek na proces. Pre rozpočet celého nasadenia treba prípadne nastaviť aj limity hostingu; process limit nie je distribuovaná kvóta účtu.

## Windows externé prehrávače

VLC a mpv sa spúšťajú cez oddelené argumenty, bez shellu. Aplikácia overuje spustenie procesu a pri chybe zobrazí hlásenie. Ak nie sú v PATH, nastavte pre daný proces `TCLV_VLC_PATH` alebo `TCLV_MPV_PATH` na úplnú cestu k exe. Prechod späť na interný prehrávač ukončí externý proces spustený aplikáciou.

Desktop má sandbox, context isolation, zakázané nové okná a cudziu navigáciu, kontrolu pôvodu IPC a obmedzené permissions. CORS úprava je obmedzená na media/XHR požiadavky okna aplikácie.

## Vydávanie Androidu

`android/` je generovaný projekt. Šablóny natívneho kódu upravujte v `native/android/`. Verzia sa prenáša z `package.json`; versionCode je `major * 1000000 + minor * 1000 + patch` a rastie s vydaniami.

Release signing používa iba tieto lokálne environment premenné:

- `TCLV_ANDROID_KEYSTORE`: cesta k existujúcemu stabilnému kľúču mimo repozitára;
- `TCLV_ANDROID_STORE_PASSWORD`, `TCLV_ANDROID_KEY_ALIAS`, `TCLV_ANDROID_KEY_PASSWORD`.

GitHub release workflow očakáva Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Pred publikovaním overuje podpis; bez kľúča zlyhá a nevydá nepodpísané APK. Kľúč pre existujúcu aplikáciu nenahrádzajte novým, inak sa existujúca inštalácia nebude dať aktualizovať.

## Kontroly

```sh
npm run check            # zhoda verzie + ochrana súkromných dát + lint + unit testy
npm audit                # audit všetkých npm závislostí
npm run prepare:web
npx playwright install chromium
npm run test:browser     # skutočný browser, syntetické zdroje
```

Browser test používa Chromium nainštalované cez Playwright, aby sa jeho verzia zhodovala s CI; inú binárku možno explicitne zvoliť cez `CHROMIUM_PATH`. Regresný test 1000 kanálov preveruje opakovaný pohyb hore/dole aj Home/End, fokus po následných scroll/render udalostiach, poradie riadkov, viditeľnosť a limit 70 DOM kariet. Oprava nadväzujúca na CI logy odstránila stratu fokusu pri posune späť; podrobnosti sú v časti Unreleased v changelogu.

CI používa `npm ci`, akcie pripnuté na commit, privacy check, audit, unit a browser testy. Úplné `npm run check` sa spúšťa aj na Windows; tam sa vykonajú navyše dva Windows launcher testy, ktoré sú na Linuxe vynechané. Electron testy odvodzujú file URL z načítanej cesty na danej platforme, aby kontrola dôveryhodného IPC fungovala aj s Windows diskom. Release najprv vykoná kontroly. Browser testy neuploadujú screenshoty ani lokálne používateľské dáta. End-to-end test na fyzickom Android TV je potrebný pre konkrétny firmware, kodeky, správanie PiP a napájania.

Overenie verzie 1.3.0 k 16. 10. 2026:

- `npm run check`: 213 úspešných testov, 2 vynechané; kontrola verzie, privacy guard aj lint prešli. `npm audit` vykázal 0 zraniteľností vrátane vývojových závislostí.
- Chromium integračné testy prešli pre `dist/web` aj `dist/vercel`: D-pad, dialógy, obľúbené, lokálne uloženie/export, odmietnutie neplatného importu, súbeh playlistov, XMLTV worker, virtualizácia a bridge fallback druhého slotu.
- Vercel build vrátane Windows bridge runtime prešiel. Android `assembleDebug` a `lintDebug` prešli; podpis debug APK a verzia 1.3.0 / versionCode 1003000 boli overené.
- Windows x64 unpacked a portable build prešli; Electron smoke test na Linuxe overil UI, EPG worker a IPC. Distribučný `app.asar` obsahuje iba potrebné súbory, bez duplicitných `node_modules`.

Lokálne pripravený Windows portable EXE je nepodpísaný testovací build; pri krížovom zostavení nebola aplikovaná úprava Windows ikony/metadát. Android APK má vývojový podpis. Tieto binárne súbory sa necommitujú do repozitára a nejde o publikovaný produkčný release. Úplný NSIS installer nebol v Linux prostredí dokončený pre chýbajúce Wine; jeho build je nakonfigurovaný na Windows CI. Overenie na fyzickom Windows/Android TV a produkčný Android podpis existujúcim kľúčom zostávajú potrebné pred produkčným vydaním.

## Štruktúra

- `app.js`, `styles.css`, `index.html`: spoločné používateľské rozhranie;
- `lib/parsers.js`: jeden parser používaný aplikáciou aj testami;
- `lib/storage.js`: validácia a súkromná lokálna IndexedDB;
- `lib/epg-worker.js`: SAX XMLTV spracovanie mimo UI;
- `lib/android-player.js`: synchronizácia natívneho obrazu a ovládania;
- `native/android/`: Media3 service, Capacitor plugin a Activity;
- `native/electron/`: Windows shell a overené IPC;
- `bridge/`, `web/`: spárovaný lokálny bridge a browser integrácia;
- `api/proxy.js`: obmedzené serverové sťahovanie textových zdrojov;
- `scripts/`: zostavenie, generovanie a aktualizácie;
- `tests/`: jednotkové a integračné kontroly so syntetickými dátami.

MIT licencia aplikácie: [LICENSE](LICENSE). Licencie tretích strán: [THIRDPARTY.md](THIRDPARTY.md), plné podklady knižníc sa kopírujú do distribučného `vendor/licenses/`. Media3 je Apache-2.0, SAX parser Blue Oak Model License 1.0.0. Aplikácia neposkytuje televízny obsah; používajte vlastné oprávnené zdroje.
