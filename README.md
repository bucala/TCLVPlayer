<div align="center">
<img src="assets/icon.png" alt="TCLVPlayer" width="108" />

# TCLVPlayer 1.3.0

IPTV prehrávač pre Windows, Android, Android TV a web.
</div>

Windows aplikácia používa izolovaný Electron runtime. Android predvolene prehráva cez natívny **Media3/ExoPlayer** s hardvérovým dekódovaním. HTML5, Video.js, ArtPlayer, flv.js, jPlayer a externé VLC/mpv zostávajú voliteľné.

Kompletné zmeny verzie 1.3.0 sú v [CHANGELOG.md](CHANGELOG.md). [IMPLEMENTATION.md](IMPLEMENTATION.md) mapuje všetkých 18 nálezov auditu na opravy, ich overenie a zostávajúce obmedzenia. Návrhy ďalšieho rozvoja po preskúmaní celej histórie sú v [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Súkromné dáta

Playlisty, kanály, EPG a prístupové údaje ostávajú v súkromnom úložisku zariadenia (IndexedDB a na Androide aj súkromná súborová EPG cache). Aplikácia ich nepublikuje na GitHub a neobsahuje poskytovateľské playlisty. Zálohovanie a prenos medzi zariadeniami prebieha cez **explicitný export/import súboru**. Úplná záloha obsahuje aj lokálny obsah a pôvodné prihlasovacie URL; uchovávajte ju v súkromí.

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

Pre aktuálny balík z GitHubu otvorte **Actions → Windows** alebo **Android and GoogleTV → Run workflow** a v **Use workflow from** vyberte **Branch: main**. Výstupy sú po dokončení v časti **Artifacts** daného behu. **Re-run jobs** opakuje pôvodný commit; nové opravy z `main` nepreberie. Tag označuje konkrétnu verziu a neposúva sa spolu s vetvou.

Tag `v1.3.0` ukazuje na historický commit `53a7e73`, ktorý ešte neobsahuje opravu Windows testov `cbeb650` ani následné Android/EPG úpravy `7761bb5`. Pre tieto zmeny zostavujte `main`; opakované zostavenie starého tagu znovu použije starý kód.

Pre web s HTTP/CORS streamami rozbaľte Windows TCLV Bridge ZIP dostupný v Nastavenia → Sieť a spustite `Start TCLV Bridge.cmd`. Spárujte ho kódom z okna. Bridge počúva len na `127.0.0.1:3939–3941`, musí bežať na rovnakom počítači a vyžaduje povolenie lokálnej siete v prehliadači. Produkčný ZIP obsahuje Node.js a jeho licenciu. `npm run bridge:portable` ho vytvorí samostatne.

**Web bez vzdialeného proxy:** v Nastavenia → Sieť stlačte **Vypnúť vzdialený proxy**. Video aj textové zdroje potom používajú iba priame spojenie alebo spárovaný lokálny bridge. Pre HTTP/CORS video zvoľte Auto alebo Iba lokálny bridge; samotný prehliadač nedokáže obísť tieto sieťové obmedzenia. Video neprechádza cez Vercel funkciu. Načítanie stránky, knižníc a stiahnutie bridge ZIP stále čerpajú hostingový prenos; voliteľné serverové sťahovanie EPG/playlistov ho čerpá, ak vzdialený proxy znovu zapnete.

V prostredí, ktoré vyžaduje HTTP proxy pre Node fetch, použite podporované nastavenie runtime, napríklad `NODE_USE_ENV_PROXY=1` na Node 24. Overovanie TLS nevypínajte.

## Android prehrávanie na pozadí a PiP

- Zvoľte prehrávač **Natívny**. Natívny obraz je súčasťou TCLVPlayera, neotvára externú aplikáciu.
- Prehrávanie vlastní `MediaSessionService` s typom `mediaPlayback`, nie životný cyklus WebView. Pri zapnutej voľbe **Prehrávanie na pozadí** pokračuje aj po odchode z aplikácie alebo zhasnutí displeja.
- Android zobrazuje systémový mediálny panel s názvom a logom kanála, play/pause a dostupným predchádzajúcim/nasledujúcim kanálom. Podporuje zamknutú obrazovku, Bluetooth ovládače, stratu audio focusu a odpojenie slúchadiel.
- Logo má štvorcový podklad s okrajom a zachovaným pomerom strán, aby sa široké logá v systémovej karte neorezávali. Druhý riadok zobrazuje aktuálny program z načítaného EPG; pri obnove EPG sa metadata aktualizujú bez opätovného spustenia streamu. Služba sleduje načítaný rozvrh aj na pozadí, najviac na ďalších 24 hodín; bez dostupného programu zobrazí TCLVPlayer.
- **PiP** spustíte tlačidlom v Nastaveniach. Video pokračuje v malom systémovom okne. Dostupnosť závisí od zariadenia a jeho nastavení.
- Tvar mediálnej karty, ikona v stavovej lište a prípadná horná kapsula sú súčasťou systémového rozhrania výrobcu; aplikácia používa štandardné Android media API.
- Po vypnutí prehrávania na pozadí sa interný prehrávač pri opustení aplikácie pozastaví. Externé VLC/mpv spravujú vlastné prehrávanie aj notifikácie.
- Na slabých TV odporúčame jeden natívny obraz. Webový multiview sa pri natívnom prehrávači nezobrazuje; pre dva súbežné webové streamy zvoľte HTML5 alebo iný webový prehrávač.

Buffer natívneho prehrávača je obmedzený na cieľových 16 MiB (8 MiB na zariadeniach s malou RAM) a 5–20 sekúnd. XMLTV sa spracúva v samostatnom worker vlákne, relevantné EPG sa indexuje a veľké zoznamy kanálov aj EPG vykresľujú iba časť riadkov. Na low-RAM zariadeniach automatický výber preferuje najviac 720p, ak stream taký variant ponúka; kvalitu možno zmeniť ručne. Všetky player knižnice sú pribalené; za behu sa nenačítava pohyblivá CDN verzia.

Výber kvality je na všetkých platformách v Nastavenia → Prehrávač & Jazyk, keď ho stream poskytuje. Označenie **Natívna** ani jeho výber už neprekrýva pravý dolný roh obrazu.

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

Import M3U/M3U8/XSPF a XMLTV vrátane gzip. Formát zoznamu EPG zdrojov je `Názov = URL`; export zoznamu je lokálny TXT súbor. JSON záloha verzie 2 obnovuje playlisty vrátane obsahu, lokálne EPG, pôvodné URL/prihlasovacie údaje, obľúbené, jazyk a nastavenia proxy. Predvolene vynecháva stiahnutý obsah sieťových EPG; po importe sa načíta z uložených adries. Voľba **Pridať aj stiahnutú EPG cache** vytvorí väčšiu zálohu aj s týmto obsahom. Interné odkazy na súbory zariadenia sa neexportujú. Pred zmenou dát sa overí schéma, URL, ID aj povolené prehrávače. Staršie metadátové zálohy verzie 1 zostávajú importovateľné, ale chýbajúci pôvodný lokálny súbor alebo už nahradené heslo z nich nemožno spätne získať.

Export vytvára JSON po menších častiach. Android ich zapisuje do súkromného dočasného súboru a cez systémové **Uložiť ako** kopíruje do zvoleného umiestnenia na pracovnom vlákne. Počas exportu je opakované spustenie blokované; zrušenie alebo chyba nemenia pôvodné dáta. Limit zálohy je 256 MiB. Import naďalej overuje celý JSON v pamäti; na malých zariadeniach preto odporúčame predvolenú zálohu bez sieťovej EPG cache.

Sieťové playlisty sa obnovujú po 15 minútach, EPG po 6 hodinách aj počas dlhej relácie. Aktivácia už aktívneho sieťového playlistu vynúti refresh. Lokálne zdroje sa nenačítavajú z názvu súboru cez sieť. Pri chybe sťahovania zostáva posledný použiteľný obsah. Veľkosť jedného zdroja je obmedzená na 64 MiB pred aj po dekompresii; JSON záloha môže mať do 256 MiB.

**Nastavenia → EPG zdroje → Obnoviť EPG teraz** vynúti nové stiahnutie všetkých zapnutých sieťových zdrojov aj pred uplynutím cache a znovu spracuje lokálne uložené XMLTV. Ak už beží automatická obnova, ručná obnova sa vykoná po nej. Tlačidlo počas práce blokuje duplicitné kliknutia a výsledok oznámi priamo v menu. Pri chybe siete alebo neúplnom/neplatnom XML sa ponechajú posledné použiteľné dáta; vypnuté zdroje sa nesťahujú.

Android sťahuje sieťové XMLTV na pracovnom vlákne priamo do súkromného súboru, rozpoznáva gzip podľa obsahu a spracuje deklarované kódovanie aj UTF-16 BOM. Do WebView sa neposiela celý XML reťazec; worker súbor postupne číta a filtruje programy. Natívne sťahovanie je sekvenčné, má rozpočet 60 sekúnd (connect/read najviac 15 sekúnd), limit 64 MiB pre vstup, dekompresiu aj výsledné UTF-8 a cache do 256 MiB. Staršia cache sa uvoľňuje; odstránený súbor možno znovu stiahnuť. Nový súbor nahradí posledný dobrý až po úspešnom XMLTV parsovaní.

Pri každom EPG zdroji sa zobrazuje načítavanie, počet relevantných/aktuálnych programov alebo konkrétny problém: **HTTP stav**, **TLS**, **timeout**, **XML**, limit veľkosti, chýbajúca cache, prázdny/starý/budúci program či nesúlad staníc. Chyba nevypisuje poskytovateľskú URL ani token. Po chybe automatické pokusy ustupujú od 1 minúty po 1 hodinu; **Obnoviť EPG teraz** tento odklad obíde. Pri časovom nesúlade skontrolujte aj automatický dátum a čas zariadenia.

Párovanie EPG používa presné ID a potom názvy/alternatívne názvy bez rozdielov v diakritike, interpunkcii a samostatných označeniach HD/SD/UHD. Podporuje aj `<identifier>` v XSPF a bežné koncové krajinné prípony ID. Nejednoznačný názov sa automaticky nepriradí k nesprávnej stanici. Bez skutočnej adresy zdroja nemožno potvrdiť dostupnosť konkrétneho poskytovateľa; nová diagnostika pomáha odlíšiť prenos, obsah a párovanie.

Serverový `/api/proxy` je obmedzený na playlisty/EPG do 3 MiB a 15 sekúnd. Každé spojenie aj redirect používa overenú a pripnutú DNS adresu. Limity sú 30 požiadaviek/minútu na klienta a 8 súbežných požiadaviek na proces. Pre rozpočet celého nasadenia treba prípadne nastaviť aj limity hostingu; process limit nie je distribuovaná kvóta účtu.

## IPTVPlaylistgen a menšie EPG prenosy

[IPTVPlaylistgen](https://github.com/bucala/IPTVPlaylistgen) možno použiť na priradenie ID, názvov a log. Odporúčaný prenos je **lokálny M3U export/import**: zachová aj EPG adresy. XSPF parser číta `<meta rel="tvg-id">` a ďalšie metadáta generátora; jeho aktuálny XSPF export však EPG URL neobsahuje, preto ich treba pridať osobitne. Pri importe sa odhalia aj nové zdroje z hlavičiek `url-tvg`/`x-tvg-url` a atribútov `tvg-url`, vrátane existujúceho zoznamu zdrojov. Importér rozpozná čiarky v úvodzovkách a exportované XML entity v atribútoch; HTML prihlasovacia stránka sa neuloží ako playlist. Podporované sú aj lokálne `.m3u.gz` a `.xspf.gz`.

Pre verejné Open‑EPG `files/*.xml` adresy bez prihlasovacích údajov/query/vlastného portu sa prednostne stiahne `.xml.gz`, pri chybe pôvodné XML. Uložená adresa zostáva zachovaná. Pri troch overených zdrojoch gzip znížil prenos o **85,8–91,0 %** a po rozbalení bol obsah zhodný. Android cache zostáva rozbalené UTF‑8; gzip nemení nároky parsovania ani 3 MiB limit voliteľného Vercel proxy po rozbalení.

Automatické objavovanie spracuje najviac 12 adries playlistu; konkrétne `tvg-url` priradené staniciam majú prednosť a nie sú obmedzené na tri úspešné heuristické zdroje. Ďalšie zdroje možno pridať ručne.

EPG výber uprednostní aktuálny rozvrh rovnakej stanice a krajiny pred starým HD rozvrhom, zohľadní zdroj priradený v playliste a vyberie jeden konzistentný rozvrh namiesto miešania konfliktujúcich programov. Slovenské a české varianty sa nezamenia. Verejný `slovakia1` pri kontrole 17. 10. 2026 končil o 06:00 UTC; nový dátum súboru sám nepotvrdzuje aktuálny program.

[EPG-COMPATIBILITY.md](EPG-COMPATIBILITY.md) obsahuje merania, potvrdené príčiny, postup z generátora a overenie na skutočných verejných dátach. Nové regresné scenáre prešli v oboch Chromium balíkoch; unit kontrola má 229 úspešných testov a 2 Windows testy na Linuxe vynechané.

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

Overenie predchádzajúcich zmien verzie 1.3.0 k 16. 10. 2026:

- `npm run check`: 217 úspešných testov, 2 vynechané; kontrola verzie, privacy guard aj lint prešli. `npm audit` vykázal 0 zraniteľností vrátane vývojových závislostí.
- Chromium integračné testy prešli pre `dist/web` aj `dist/vercel`: D-pad, dialógy, obľúbené, lokálne uloženie/export, odmietnutie neplatného importu, súbeh playlistov, XMLTV worker, virtualizácia a bridge fallback druhého slotu.
- Ďalšie regresné scenáre overujú obnovu EPG cez cache, zachovanie dát po neúplnom XML, súbeh ručnej/automatickej obnovy, kvalitu v Nastaveniach, úzke menu a nulové volania Vercel proxy pri vypnutom vzdialenom proxy aj pri video fallbacku.
- Vercel build vrátane Windows bridge runtime prešiel. Android `assembleDebug` a `lintDebug` prešli; podpis debug APK a verzia 1.3.0 / versionCode 1003000 boli overené.
- Windows x64 unpacked a portable build prešli; Electron smoke test na Linuxe overil UI, EPG worker a IPC. Distribučný `app.asar` obsahuje iba potrebné súbory, bez duplicitných `node_modules`.

Oprava EPG/exportu zo 17. 10. 2026 pridáva regresné scenáre pre natívny prenos odkazu na súbor, postupné parsovanie viac ako 15000 programov, párovanie diakritiky/HD/XSPF, HTTP chybu a odklad retry, zachovanie pôvodných dát, veľký lokálny export, voliteľnú EPG cache, zrušenie uloženia a zlyhanie zápisu. `tests/android-data.test.js` pri dostupnom JDK kompiluje skutočné `FileExports`/`SourceCache` a testuje lokálny HTTP server, gzip bez prípony, kódovania, limity a cleanup s Java heapom 64 MiB; platformové Android I/O nahrádzajú malé stuby. Nenahrádza test Storage Access Framework na reálnom zariadení. Redmi Pad 2/Android 16 je nahlásené zariadenie, fyzické overenie na ňom zatiaľ neprebehlo.

Lokálne pripravený Windows portable EXE je nepodpísaný testovací build; pri krížovom zostavení nebola aplikovaná úprava Windows ikony/metadát. Android APK má vývojový podpis. Tieto binárne súbory sa necommitujú do repozitára a nejde o publikovaný produkčný release. Úplný NSIS installer nebol v Linux prostredí dokončený pre chýbajúce Wine; jeho build je nakonfigurovaný na Windows CI. Overenie na fyzickom Windows/Android TV a produkčný Android podpis existujúcim kľúčom zostávajú potrebné pred produkčným vydaním.

## Štruktúra

- `app.js`, `styles.css`, `index.html`: spoločné používateľské rozhranie;
- `lib/parsers.js`: jeden parser používaný aplikáciou aj testami;
- `lib/backup.js`: postupný JSON export;
- `lib/storage.js`: validácia a súkromná lokálna IndexedDB;
- `lib/epg.js`: identita staníc, krajina, výber rozvrhu a gzip adresy;
- `lib/epg-worker.js`: SAX XMLTV spracovanie mimo UI;
- `lib/android-player.js`: synchronizácia natívneho obrazu a ovládania;
- `native/android/`: Media3 service, Capacitor plugin a Activity;
- `native/electron/`: Windows shell a overené IPC;
- `bridge/`, `web/`: spárovaný lokálny bridge a browser integrácia;
- `api/proxy.js`: obmedzené serverové sťahovanie textových zdrojov;
- `scripts/`: zostavenie, generovanie a aktualizácie;
- `tests/`: jednotkové a integračné kontroly so syntetickými dátami.

MIT licencia aplikácie: [LICENSE](LICENSE). Licencie tretích strán: [THIRDPARTY.md](THIRDPARTY.md), plné podklady knižníc sa kopírujú do distribučného `vendor/licenses/`. Media3 je Apache-2.0, SAX parser Blue Oak Model License 1.0.0. Aplikácia neposkytuje televízny obsah; používajte vlastné oprávnené zdroje.
