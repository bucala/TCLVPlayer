TCLV Bridge, standalone helper for the WEB player only

Windows:
1. Extract the complete folder.
2. Double-click "Start TCLV Bridge.cmd".
3. In the web player, open Settings > Network > Pair bridge.
4. Enter the pairing code shown in the bridge window.
5. If your browser asks for access to the local network, allow it for TCLVPlayer.
6. Leave the bridge window open while watching.

The portable Windows package includes a Node.js runtime. The smaller source
package requires Node.js 22 or newer from https://nodejs.org/. No npm commands
or dependency installation are needed.

Other systems: run "node start.mjs". The browser and helper must run on the
same computer. This is not an Android service or a LAN proxy.

Auto playback tries the provider directly, then this bridge for HTTP/CORS
streams. Settings also offer Direct only and Bridge only. It does not transcode:
unsupported codecs, DRM, provider outages or geo-blocks still cannot be fixed.

The helper binds only to 127.0.0.1. Only the production TCLVPlayer website and
localhost development on port 3000 can pair by default. A random pairing code,
origin-bound 12-hour session and opaque media tickets protect access. Sessions
are forgotten when the helper stops. Tokens are never sent to the provider.
Private-network targets are blocked, including after redirects.

Optional environment:
TCLV_PROXY_PORT: port 3939, 3940 or 3941 (default: first free discovery port).
TCLV_BRIDGE_ORIGINS: comma-separated exact additional origins, for development.
Never add untrusted websites. No wildcard origins are supported.

This helper does not change, launch or update the existing Windows/Android app.
