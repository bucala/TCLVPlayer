# Webové prehrávanie, Vercel a lokálny pomocník

Kontrola a implementácia: 24. 10. 2026. Rozsah: webový build, lokálny TCLV Bridge a jeho doručenie používateľovi Windows. Natívne prehrávanie Android/Windows má samostatnú cestu.

## Doplnenie 12. 11. 2026: softvérové dekódovanie H.265

Kanály vysielané v H.265/HEVC predtým v prehliadačoch bez natívneho dekódovania (Chrome/Edge na Windows bez hardvérovej podpory HEVC) skončili chybou `bufferAddCodecError`. Nová voľba **Nastavenia → Sieť → Softvérové dekódovanie H.265** je predvolene vypnutá a uchováva sa lokálne (`tclv.softDecode`).

- Použitá knižnica [hevc.js](https://github.com/lid-labs/hevc.js) (`@hevcjs/hlsjs-plugin` 0.1.13, MIT): WebAssembly dekodér H.265 v workroch, kódovanie do H.264 cez WebCodecs `VideoEncoder`, zásah do `MediaSource.isTypeSupported`/`addSourceBuffer`. Zasahuje globálne do MSE, preto funguje pre hls.js aj mpegts.js cesty (HLS aj živý MPEG-TS). Nepotrebuje COOP/COEP hlavičky; beží jednovláknovo v workroch (predvolený fond 2 workery).
- Výber overený aj voči alternatívam: libmedia AVPlayer (LGPL, najlepší výkon vyžaduje SharedArrayBuffer, teda COOP/COEP, ktoré by rozbili lokálny bridge aj obrázky kanálov), h265web.js (vlastná licencia CYL_Free-1.0, samostatný prehrávač), libde265.js (starší port bez MSE pipeline).
- Zapnutie/vypnutie za chodu reštartuje práve hrajúci kanál. Pri natívnom H.265 sa detekcia neaktivuje a nič sa nemení. Detekcia je oneskorená až do prvého štartu, aby sa 0,8 MB súborov dekodéra načítalo len pri použití.
- Obmedzenia: video-only transkódovanie; zvuk (AAC) prechádza pôvodnou cestou. Nevzťahuje sa na súbory MP4/MKV prehrávané natívne ani na DRM. Vyžaduje WebCodecs H.264 enkodér (Chrome/Edge 94+, Firefox 130+; Safari má H.265 natívne). LL-HLS nie je podporované knižnicou.
- Výkon na referenčnom stroji (16 jadier, Chrome 157, vypnuté HW dekódovanie): 1080p25 ~2,0× rýchlosť prehrávania, 1080p50 ~1,07×. Prvý segment pridá 2–3 s. Lišta nad videom zobrazí „H.265 softvérovo“, pri opakovanom nedostatočnom výkone „procesor nestíha“. Diagnostika zapisuje `transcode speed=…` riadky.
- CSP hlavička aj meta tag webového buildu pribúdajú o `'wasm-unsafe-eval'` v `script-src` (kompilácia WebAssembly). Natívne Windows/Android buildy sa nemenia a tento modul nepoužívajú (`window.TCLVNative`/`Capacitor` skráti inicializáciu).
- Zostavenie: `scripts/copy-web.mjs --vercel` zbalí plugin cez rolldown (devDependency) do `vendor/hevcjs/hevc-support.js` a skopíruje worker aj WASM. Overenie: unit testy v `tests/bridge-player.test.js`; E2E skript s lokálnym HEVC MPEG-TS HLS poskytovateľom cez relay prehral v Chrome s vypnutým hardvérovým dekódovaním 1080p video bez zahodených snímkov.

## Doplnenie 11. 11. 2026: cez Vercel bez bridge

Nová voľba **Nastavenia → Sieť → Bez pomocníka: cez Vercel** potrebuje potvrdenie upozornenia na mesačný limit. Predvolene je vypnutá. **Auto: priamo → cez Vercel** používa relay až pri HTTP na HTTPS webe alebo po chybe priameho spojenia; **Iba cez Vercel** ho používa vždy. Zapnutie obnoví aj čakajúci stream, odopnutie prepne späť na priame/lokálne Auto. Nastavenie sa uchováva lokálne. Windows/Android aplikácie tento webový modul nepoužívajú.

- `/api/stream` prenáša video, HLS varianty, segmenty, titulky a HTTP(S) AES kľúče. `/api/proxy` zostáva oddelený a obmedzený na malé playlisty/EPG.
- Lišta nad videom zobrazuje varovanie aj pri prenose druhého obrazu. V nastaveniach je odhad bajtov z Resource Timing za kalendárny mesiac UTC len v tomto prehliadači. Nezahŕňa spoľahlivo prerušené požiadavky ani iné zariadenia, nie je rozpočtový limit a nemusí zodpovedať 30-dňovému obdobiu hostingu. Presné údaje sú vo Vercel Usage.
- [Hobby](https://vercel.com/docs/plans/hobby): 10 GB Fast Origin Transfer, 100 GB Fast Data Transfer, navyše limity CPU/pamäte/volaní funkcií. Relay bez cache čerpá origin aj CDN prenos. 8 Mbit/s znamená približne 3,6 GB/h, teda 2,8 h na 10 GB pred réžiou. Po prekročení môže byť funkcia pozastavená až 30 dní.
- [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines#never-fair-use) uvádza proxy medzi **Never fair use**, aj na platených plánoch. Samotné upozornenie v aplikácii nezaručuje súlad s podmienkami. Prevádzku si pred nasadením overte s Vercelom; lokálny bridge zostáva odporúčanou cestou bez video prenosu hostingu.
- Správca vypne endpoint cez `TCLV_VIDEO_RELAY=off` (aj `0`/`false`) a nové nasadenie. Lokálne vypnutie používateľom neblokuje endpoint ostatným používateľom.
- Same-origin kontrola chráni pred použitím z iného webu, nie pred klientom, ktorý si HTTP hlavičky podvrhne. Limity 900 požiadaviek/minútu, 16 streamov/klienta a 128/proces sú iba lokálne jednej inštancii. Nie sú globálny účet, autentifikácia ani ochrana fakturačného rozpočtu; na verejné nasadenie treba aj obmedzenia hostingu/prístupov.
- Vercel dostane URL poskytovateľa vrátane query parametrov, obsah a klientsku IP. URL môže byť v platformových access logoch; aplikácia ho sama neloguje ani neposiela cudziemu analytickému systému. Cookies a Authorization prehliadača sa poskytovateľovi neposielajú. Odpovede sú `private, no-store`.
- Funkcie sú v regióne `fra1`. Server má 15 s limit na hlavičky, 30 s nečinnosti a celkový limit 280 s vrátane čítania manifestu; Vercel má `maxDuration: 300` a cancellation. HLS vytvára nové krátke požiadavky, dlhý TS/FLV sa po ukončení znovu pripojí. Pri kontinuálnom toku môže vzniknúť krátky výpadok. Bežné MP4 podporuje Range; čiastočný HLS manifest relay odmietne.
- HLS manifest je najviac 2 MiB. Nepodporované sú premenné manifestov, DRM `data:`/`skd:` URI, content steering a plná LL-HLS semantika. Žiadne transkódovanie, obchádzanie DRM, oprava kodekov ani záruka dostupnosti poskytovateľa. Hosting môže byť blokovaný alebo stream viazaný na inú IP.
- Obyčajný statický server endpoint nemá. Na Verceli sa zostaví z `api/stream.mjs`; na inom Node hostingu potrebuje vlastné zapojenie handlera.

Regresné `npm run test:relay-browser` používa skutočný lokálny server a syntetického poskytovateľa bez dekódovateľného videa. Kontroluje predvolené vypnutie, odmietnutie/potvrdenie, HLS/segmenty, route varovanie, odhad a perzistenciu. Samostatný opt-in test s `RELAY_LIVE_URL` prehral verejný Mux test stream s dekódovaným obrazom a časom >3 s; osobné playlisty neboli použité. Toto nie je test nasadeného Vercelu ani záruka pre konkrétny platený IPTV účet. [Výsledky auditu](AUDIT-2026-11.md).

## Čo používa kapacitu Vercelu

| Operácia | Cesta | Kapacita Vercelu |
| --- | --- | --- |
| Podporované HTTPS video | poskytovateľ → prehliadač | Video ju nepoužíva |
| HTTP/CORS video cez bridge | poskytovateľ → pomocník na tomto počítači → prehliadač | Video ani HLS segmenty ju nepoužívajú |
| Výslovne zapnuté video cez Vercel | poskytovateľ → `/api/stream` → prehliadač | Míňa mesačný dátový limit aj kapacitu funkcií |
| HTML, JavaScript, knižnice, inštalátor/ZIP | hosting → prehliadač | Používajú hostingový prenos |
| Playlist/EPG priamo alebo cez bridge | poskytovateľ → prehliadač/pomocník | Vercel proxy sa nepoužíva |
| Používateľom zapnutý vzdialený source proxy | poskytovateľ → proxy → prehliadač | Používa príslušný hosting; predvolene vypnuté |

`host.canProxyStreams()` a `host.needsProxy()` zakazujú starý automatický video fallback cez source proxy. Nový `/api/stream` sa používa samostatne len vo výslovne zapnutých Vercel režimoch. HLS manifesty lokálny server prepíše na nepriehľadné loopback adresy, Vercel handler na vlastné relay URL. `/api/proxy` je iba voliteľná cesta pre malé zdroje playlistov/EPG. **Vypnúť vzdialený proxy** ju vymaže a vypne Vercel video bez odpojenia lokálneho pomocníka.

## Nálezy a vykonané zmeny

Pôvodný tok bol pred úpravami zachytený v Chromium. Pri prázdnom prehrávači zobrazoval „Video: priamo“, v nastaveniach dominovali technické režimy a ZIP vyžadoval rozbalenie, spustenie skriptu a prepis kódu. Chýbalo jasné poradie krokov.

1. **Pripraviť pomocníka — upravené.** Windows má EXE inštalátor s pribaleným overeným runtime, inštaláciou pre aktuálny účet, odkazom v Štarte a odinštalovaním. ZIP je rozbaliteľná záloha v rozbaľovacej sekcii. Inštalátor sa úspešne zostavil; jeho spustenie na Windows zostáva neoverené.
2. **Spustiť a nájsť — upravené.** Web otvorí nainštalovanú aplikáciu cez pevný `tclvbridge://open`; prehliadač si môže vyžiadať súhlas. Spustenie z webu zachová aktuálnu kartu aj čakajúci stream; nevytvorí druhú kartu v inom predvolenom prehliadači. Opakované otvorenie využije už bežiaci proces. Odkaz zo Štartu otvorí sprievodcu. Sprievodca rozlišuje stav pred kontrolou, hľadanie, nedostupnosť a pripravené spojenie. Kontrola sa spúšťa výslovnou akciou, návratom do otvoreného sprievodcu alebo pri obnove už uloženej relácie.
3. **Potvrdiť prehliadač — upravené.** Namiesto prepisovania kódu sa otvorí lokálne okno s presnou adresou webu a tlačidlami Povoliť/Odmietnuť. Po potvrdení sa dokončí spojenie a zopakuje čakajúce prehrávanie. Zrušenie, vypršanie a zablokované vyskakovacie okno majú stav a cestu späť; starší pomocník zachová ručný kód.
4. **Sledovať a spravovať — upravené.** Po pripojení sa tri kroky nahradia krátkym potvrdením a odpojením. Lišta nad videom ukazuje cestu vybraného streamu, čakanie alebo chybu; pri prázdnom prehrávači netvrdí, že video hrá. Režimy a vzdialený proxy sú v pokročilých nastaveniach. Chyba poskytovateľa sa odlišuje od chýbajúceho párovania.

Použité sú existujúce nastavenia a vizuálny štýl aplikácie. Nové ovládače majú viditeľný fokus, textové pomenovanie, hlásenie stavu cez `role=status` a minimálnu výšku 44 px. Zobrazenie bolo kontrolované na desktopovom a mobilnom rozmere v skutočnom lokálnom Chromium; nejde o úplný audit WCAG ani test systémových dialógov Windows.

## Hranice pripojenia a súkromie

- Pomocník musí bežať na rovnakom zariadení. Windows inštalátor a protokol sa na Androide neponúkajú; UI odporúča natívnu aplikáciu.
- Prehliadač nemôže sám inštalovať/spustiť ľubovoľný program ani obísť povolenie lokálnej siete. Inštalácia, otvorenie aplikácie a lokálne schválenie zostávajú vedomé kroky používateľa.
- Požiadavka na schválenie trvá dve minúty. Vyzdvihnutie výsledku vyžaduje samostatný dôkaz, potvrdenie má lokálny Origin a CSRF ochranu a výsledok je jednorazový. Token ani dôkaz nie sú v URL potvrdenia.
- Relácia je viazaná na pôvod webu a uložená iba v `sessionStorage`, najviac 12 hodín. Reštart pomocníka ju ukončí; nové spárovanie rovnakého pôvodu nahradí jeho predchádzajúcu reláciu. Párovanie sa neexportuje s nastaveniami.
- Systémový protokol má pevné argumenty bez `%1`. Odkaz nemôže odovzdať URL streamu ani ďalšie Node argumenty. Pomocník sa automaticky nespúšťa pri prihlásení.
- Inštalátor je aktuálne nepodpísaný. SmartScreen, inštalácia, aktualizácia pri bežiacom pomocníkovi a systémové otvorenie protokolu vyžadujú overenie na Windows. Povolenie lokálnej siete z verejného HTTPS webu treba preveriť v cieľovom prehliadači; lokálny HTTP test ho nesimuluje.
- Testy používajú syntetické zdroje. Snímky, inštalátory a používateľské dáta sa necommitujú.

## Overenie

`npm run check` kontroluje verzie, súkromné dáta, ESLint a unit testy. `npm run test:browser` beží nad spoločným aj webovým buildom. Nové `npm run test:bridge-browser` používa skutočný lokálny server a prehliadač: nájdenie, potvrdenie, prenos médií, odmietnutie, zrušenie, zablokované okno, mobilné zobrazenie a kontrolu úniku tokenov/URL. Test prenosu kontroluje požiadavky a bajty syntetického média; nepotvrdzuje kodeky poskytovateľov.

Produkčný Vercel postup bol samostatne overený s čistými závislosťami cez `npm ci --include=dev --ignore-scripts` a `npm run prepare:vercel`: vznikol skutočný NSIS EXE a ZIP s Windows x64 Node.js v24.19.0. Vývojové závislosti sú potrebné pri zostavení inštalátora, neinštalujú sa používateľovi. Binárka sa počas overenia nespúšťala.
