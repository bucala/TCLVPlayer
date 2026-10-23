TCLV Bridge, standalone helper for the WEB player only
Updated: 2026-10-24

If your stream plays directly, you do not need this helper. Otherwise open
Settings > Network > Playback on this computer, or Set up playback above video.

Windows 10 or newer, x64: three steps
1. Get the helper: download and run TCLV-Bridge-Setup.exe. It installs for your
   Windows account, without administrator rights or a separate Node.js install.
   No ZIP extraction or terminal commands are needed.
2. Start TCLV Bridge: choose Open installed bridge in the web player and allow
   your browser to open it, or use TCLV Bridge in the Windows Start menu. Then
   choose Check connection. Keep the helper window open while watching.
3. Approve this browser: choose Connect this browser. In the local confirmation
   window, check the website address and choose Allow. No code needs copying.
   Pending playback retries after approval. If a popup was blocked, allow it or
   choose Reopen approval window in the web player.

The browser and helper MUST run on the same computer. A Windows helper on
another PC cannot serve your phone or TV. Use the native TCLVPlayer app on
Android. The helper binds only to 127.0.0.1, normally port 3939, 3940 or 3941.
If your browser asks for local-network access, allow it for TCLVPlayer. If you
denied access, change this website permission in browser settings and retry.

Leave the helper window open while watching. Close it or press Ctrl+C to stop.
It does not start automatically with Windows. The installed helper can be
removed using Windows Installed apps or its Start menu uninstaller.

The tclvbridge://open link runs a fixed installed command. It does not pass
incoming URI arguments, provider URLs or tokens to Node.js. Opening the helper
does not approve a website. The web link starts or reuses the helper while
keeping your existing player tab, selected stream and browser context. The
Start menu shortcut and installer's Start option open the connection guide in
your default browser instead.

Portable ZIP fallback
Right-click TCLV-Bridge.zip > Extract all. Open the extracted TCLV-Bridge folder
and run Start TCLV Bridge.cmd, not the copy inside the ZIP. Keep all extracted
files together, then approve the connection in the browser as above. The ZIP
and installer include a pinned Windows Node.js runtime and its license.
The manual code shown in the helper window remains a fallback for older
versions under Older helper or manual code in the web player.

Other systems and developer source-only packages require Node.js 22 or newer
from https://nodejs.org/. Run "node start.mjs" (or "node start.mjs --open" to
open the web player). This helper is not an Android service or a LAN proxy.

Connection lifetime and privacy
Local approval requests expire after two minutes and can be allowed or denied.
An approved session is bound to the website origin, kept in the browser tab's
sessionStorage and valid for at most 12 hours. Restarting the helper forgets
all sessions. Expired, disconnected or forgotten sessions need approval again.
Pairing the same website again replaces its previous session. Pairing is not
permanent. Session tokens are not sent to the provider or put in approval URLs.

Only the production TCLVPlayer website and localhost development on port 3000
can pair by default. Opaque media tickets protect provider URLs. Private-network
targets are blocked, including after redirects. Playlists and settings are not
published; transfers between installations use explicit local file export.

Video and Vercel usage
Auto playback tries the provider directly, then this helper for HTTP/CORS
streams. Video travels provider > this computer > browser, without a Vercel
video relay. Loading the website, libraries and helper download still uses
hosting transfer. Optional remote playlist/EPG downloads also consume capacity
on the configured source proxy's hosting when that proxy is enabled.

Advanced network settings contain Auto, Direct only and Local bridge only,
plus Disable remote proxy. Remote source proxying is disabled by default.
Disabling it uses direct/local source requests while preserving bridge pairing.
The helper does not transcode: unsupported codecs, DRM, provider outages or
geo-blocks still cannot be fixed.

Optional environment for development
TCLV_PROXY_PORT: default is the first free port from 3939, 3940 and 3941.
The web player discovers only those ports; custom ports need a custom client.
TCLV_BRIDGE_ORIGINS: comma-separated exact additional website origins.
Never add untrusted websites. No wildcard origins are supported.

The installer is currently unsigned. It was compiled using the pinned NSIS
compiler with a checksum-verified Windows runtime on Linux; physical Windows
installation, system warnings and protocol launching have not been tested.
This helper does not change, launch or update the existing Windows/Android app.
