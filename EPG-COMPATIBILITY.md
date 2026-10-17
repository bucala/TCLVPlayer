# Gzip a kompatibilita IPTVPlaylistgen

Overené 17. 10. 2026 proti verejným Open‑EPG súborom a [IPTVPlaylistgen](https://github.com/bucala/IPTVPlaylistgen) na commite `ccd1a63` (2.6.0). Do tohto repozitára sa nekopíroval žiadny playlist, EPG XML ani používateľské údaje; merané súbory zostali mimo zdrojového stromu.

## Čo ušetrí gzip

| Open‑EPG súbor | XML bajty | Gzip bajty | Úspora prenosu |
| --- | ---: | ---: | ---: |
| slovakia1 | 3 847 621 | 346 037 | 91,0 % |
| slovakia2 | 4 464 611 | 629 153 | 85,9 % |
| czech3 | 6 685 777 | 948 959 | 85,8 % |

Pri každej dvojici bol SHA‑256 rozbaleného gzip obsahu rovnaký ako pri priamom XML. Veľkosti a aktuálnosť sú vlastnosťou zdrojov v čase kontroly, nie garancia budúcich odpovedí poskytovateľa.

TCLVPlayer prednostne skúša `.xml.gz` pre verejné `https://www.open-epg.com/files/*.xml` a `open-epg.com` adresy bez query, prihlasovacích údajov a vlastného portu. Pri chybe sťahovania skúsi pôvodné `.xml`. Pôvodná uložená adresa aj názov zdroja môžu zostať `.xml`; export ich nemení. Ostatné poskytovateľské `.xml` adresy sa automaticky neprepisujú. Ručne zadané `.xml.gz` sú podporované aj s query; pri chybe sa zachová query pri `.xml` fallbacku.

Gzip znižuje prenos od poskytovateľa. Parsovanie naďalej pracuje s rozbaleným XML; jeho pamäťové limity sa neznižujú podľa veľkosti archívu. Android ukladá súkromnú cache ako rozbalené UTF‑8, aby worker pri opakovanom spracovaní mohol súbor postupne čítať. Táto zmena teda znižuje sieťový prenos, nie deklarovaný limit diskovej cache 256 MiB ani veľkosť APK. Lokálne `.m3u.gz`/`.xspf.gz` možno importovať cez súborový výber; ich dekompresia vyžaduje podporu aktuálneho WebView/prehliadača. Sieťové EPG na Androide dekomprimuje Java.

Voliteľný serverový Vercel source proxy stále kontroluje limit 3 MiB aj po rozbalení. `.gz` ho neobíde. Pre väčšie zdroje použite priamy prenos, spárovaný lokálny bridge, súbor alebo natívnu aplikáciu. Video sa cez Vercel proxy neposiela.

## Prečo sa načítané EPG nepriradilo

1. **XSPF metadáta:** generátor zapisuje presné ID do `<meta rel="tvg-id">`, nie do atribútu tracku ani `<identifier>`. Starší TCLVPlayer ho ignoroval. Opravený parser číta toto ID, `tvg-name`, `tvg-country`, `group-title`, dostupné `tvg-url` a catchup metadáta. Logo z `<image>` a pôvodná stream URL zostávajú zachované. Pri novom prečítaní meta ID sa zachová pôvodný spôsob tvorby interného ID kanála pre obľúbené/výber.
2. **Viac zdrojov:** zdroje obsahujú rôzne HD/SD a slovenské/české ID. Starý index označil normalizované zhody za nejednoznačné alebo dal prednosť presnému, ale starému HD rozvrhu. Nový výber využije aktuálny rozvrh rovnakej stanice a krajiny, zohľadní `tvg-url` a nezmieša navzájom si odporujúce rozvrhy viacerých zdrojov. Bez jednoznačného ID/krajiny zostávajú rôzne stanice nejednoznačné.
3. **Aktuálnosť poskytovateľa:** overené `slovakia1.xml` aj `.xml.gz` mali posledný koniec programu **17. 10. 2026 o 06:00 UTC**, hoci web označoval súbor dátumom 17‑10‑26. Zdroj obsahuje 19975 programov, ale po tomto čase nemá aktuálny program. Kompresia ani opakované sťahovanie nevytvoria chýbajúce vysielanie. `slovakia2` a `czech3` mali novšie programy.

Reprodukcia s verejným XML a syntetickou XSPF stanicou pred opravou: `tvgId` prázdne, 0 priradených programov. Po oprave: presné slovenské ID, 44 priradených programov a aktuálny titul zo slovenského zdroja; český variant sa vylúčil. Ide o test dátovej cesty v Chromium, nie o prehratie súkromného streamu na fyzickom tablete.

## Odporúčaný postup z generátora

1. V IPTVPlaylistgen priraďte presné EPG ID a logo, skontrolujte krajinu a zdroj s aktuálnym programom. Starý `slovakia1` automaticky nenahrádzajte len zmenou prípony; pre konkrétnu stanicu vyberte zdroj, ktorý ju obsahuje aj s aktuálnym rozvrhom.
2. Exportujte **M3U** do lokálneho súboru. Aktuálny generátor vkladá EPG adresy do `url-tvg`/`x-tvg-url` v hlavičke aj do `tvg-url` pri kanáli. TCLVPlayer načíta obe podoby, dekóduje exportované `&amp;` v atribútoch a rozpozná čiarky v úvodzovkách.
3. Importujte súbor do aktualizovaného TCLVPlayera. Nové EPG adresy sa pridajú aj pri existujúcich zdrojoch. Podľa potreby stlačte **Obnoviť EPG teraz**, aby sa obišla doterajšia cache.
4. **XSPF** možno použiť pre ID, názvy a logá. Generátor na kontrolovanom commite do XSPF **neexportuje EPG URL**. Tie treba v TCLVPlayeri pridať osobitne alebo použiť M3U. Samotná prípona `.xspf` teda nezaručí automatické nájdenie EPG servera.

Automatické objavovanie spracuje najviac 12 adries playlistu; konkrétne `tvg-url` priradené staniciam majú prednosť a nie sú obmedzené na tri úspešné heuristické zdroje. Ďalšie zdroje možno pridať ručne. XML a zodpovedajúce `.xml.gz` sa pri automatickom objavovaní/importovaní zoznamu nepovažujú za dva nové zdroje.

Generátor nebol upravený. Prenos ostáva explicitný lokálny export/import bez synchronizácie používateľských playlistov cez GitHub.

## Overenie opráv

- 229 úspešných unit testov na Linuxe, 2 Windows testy vynechané; privacy guard, lint a kontrola verzie.
- Chromium integrácia pre spoločný aj Vercel bundle: gzip XSPF/M3U import, generator meta ID/logo/krajina, starý HD + aktuálny SK/CZ program, gzip EPG discovery aj popri existujúcich zdrojoch, zachovanie pôvodných URL a odmietnutie HTML bez zmeny existujúceho playlistu.
- Pôvodné regresné scenáre exportu, natívneho diskového prenosu, limitov, D‑padu, obnovy EPG a webového bypassu zostávajú súčasťou kontrol.
- `npm run verify` v IPTVPlaylistgen prešlo. Dostupnosť súkromných URL a správanie fyzického Redmi Pad 2 neboli súčasťou merania.
