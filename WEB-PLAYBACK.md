# Webové prehrávanie a lokálny pomocník

Kontrola a implementácia: 24. 10. 2026. Rozsah: webový build, lokálny TCLV Bridge a jeho doručenie používateľovi Windows. Natívne prehrávanie Android/Windows má samostatnú cestu.

## Čo používa kapacitu Vercelu

| Operácia | Cesta | Kapacita Vercelu |
| --- | --- | --- |
| Podporované HTTPS video | poskytovateľ → prehliadač | Video ju nepoužíva |
| HTTP/CORS video cez bridge | poskytovateľ → pomocník na tomto počítači → prehliadač | Video ani HLS segmenty ju nepoužívajú |
| HTML, JavaScript, knižnice, inštalátor/ZIP | hosting → prehliadač | Používajú hostingový prenos |
| Playlist/EPG priamo alebo cez bridge | poskytovateľ → prehliadač/pomocník | Vercel proxy sa nepoužíva |
| Používateľom zapnutý vzdialený source proxy | poskytovateľ → proxy → prehliadač | Používa príslušný hosting; predvolene vypnuté |

`host.canProxyStreams()` a `host.needsProxy()` vo webovom prehrávači zakazujú serverovú video cestu. HLS manifesty lokálny server prepíše na nepriehľadné loopback adresy. `/api/proxy` je iba voliteľná cesta pre malé zdroje playlistov/EPG. Voľba **Vypnúť vzdialený proxy** ju vymaže bez odpojenia lokálneho pomocníka.

## Nálezy a vykonané zmeny

Pôvodný tok bol pred úpravami zachytený v Chromium. Pri prázdnom prehrávači zobrazoval „Video: priamo“, v nastaveniach dominovali technické režimy a ZIP vyžadoval rozbalenie, spustenie skriptu a prepis kódu. Chýbalo jasné poradie krokov.

1. **Pripraviť pomocníka — upravené.** Windows má EXE inštalátor s pribaleným overeným runtime, inštaláciou pre aktuálny účet, odkazom v Štarte a odinštalovaním. ZIP je rozbaliteľná záloha v rozbaľovacej sekcii. Inštalátor sa úspešne zostavil; jeho spustenie na Windows zostáva neoverené.
2. **Spustiť a nájsť — upravené.** Web otvorí nainštalovanú aplikáciu cez pevný `tclvbridge://open`; prehliadač si môže vyžiadať súhlas. Opakované otvorenie využije už bežiaci proces. Sprievodca rozlišuje stav pred kontrolou, hľadanie, nedostupnosť a pripravené spojenie. Kontrola sa spúšťa výslovnou akciou, návratom do otvoreného sprievodcu alebo pri obnove už uloženej relácie.
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
