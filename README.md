# TCLVPlayer

TCLVPlayer je jednoducha IPTV aplikacia vytvorena od nuly ako mensia alternativa inspirovana pracovnym postupom IPTV prehravacov. Zdrojovy kod z IPTVnator nie je kopirovany.

Primarne platformy su Windows 11 ako nativna desktop aplikacia a Android/GoogleTV ako nativna mobilna/TV aplikacia. Web verzia ostava doplnkova moznost na rychle testovanie UI.

## Funkcie

- zobrazenie kanalov v mriezke s logami
- nahratie playlistu zo suboru alebo URL
- podpora `*.m3u`, `*.m3u8` a `*.xspf`
- nahratie alebo prepis loga kanala z lokalneho uloziska
- XMLTV EPG zo suboru alebo URL, napriklad `https://www.open-epg.com/files/slovakia1.xml`
- EPG casova os s aktualnym programom a priebehom
- docasny EPG overlay pri prepnuti kanala
- HTML5 video ako primarny player
- Video.js a ArtPlayer ako interne web player rezimy
- MPV a VLC ako externe nativne player rezimy cez Windows proces alebo Android intent
- jazyky: Slovencina ako default, English

## Windows 11

Windows shell je pripraveny cez Electron.

```powershell
npm install
npm run windows
```

Build instalatora alebo portable verzie:

```powershell
npm run windows:dist
```

Ak MPV alebo VLC nie su v `PATH`, nastav cesty pred spustenim:

```powershell
$env:TCLV_MPV_PATH="C:\Program Files\mpv\mpv.exe"
$env:TCLV_VLC_PATH="C:\Program Files\VideoLAN\VLC\vlc.exe"
npm run windows
```

## Android a GoogleTV

Android/GoogleTV shell je pripraveny cez Capacitor. Po instalacii zavislosti vytvor Android projekt:

```powershell
npm install
npm run android:init
```

Potom postupuj podla `native/android/README.md`: skopiruj Kotlin bridge subory, zaregistruj plugin a dopln GoogleTV manifest polozky. Synchronizacia web jadra do Android projektu:

```powershell
npm run android:sync
npm run android:open
```

## Doplnkove web spustenie

Pre rychly browser test:

```powershell
npm install
npm run web
```

Potom otvor:

```text
http://127.0.0.1:3000
```

## Poznamky k playerom

HTML5 player je aktivny bez zavislosti. Video.js a ArtPlayer su v ponuke a po `npm install` sa pri nativnom baleni kopiruju ako lokalne vendor subory. Ak sa aplikacia spusti iba ako web bez balenia, pouzije lokalny vendor subor alebo CDN fallback.

MPV a VLC su v ponuke vzdy. Vo Windows nativnej aplikacii sa spustaju cez Electron bridge. Na Android/GoogleTV sa spustaju cez intent bridge. V obycajnom web prehliadaci sa z bezpecnostnych dovodov neda spustit externy proces, preto web fallback pripravi prikaz na kopirovanie.

## Licencie

Projekt zatial neobsahuje prevzate tretostranne kniznice ani IPTVnator kod. Ak ma byt projekt skutocne open-source, odporuca sa pridat explicitny licencny subor, napriklad MIT alebo Apache-2.0. Bez licencie je kod verejne viditelny, ale pravne nie je jasne opakovane pouzitie.
