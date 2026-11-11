/* global URL, process, document, window, localStorage, Buffer, fetch, console, __dirname, performance */
// End-to-end checks of opt-in playback through the hosting relay (api/stream.js).
// By default they use a synthetic local provider. To watch a real stream play,
// set RELAY_LIVE_URL to an HLS address and BROWSER_CHANNEL to a browser with
// H.264 support (for example msedge or chrome).
// Build first: node scripts/copy-web.mjs --vercel --source-bridge
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const liveUrl = process.env.RELAY_LIVE_URL || '';
const fixtureKey = 'fixture_key=synthetic-private-value';
const channelUrl = liveUrl || 'http://provider.example/live/master.m3u8?' + fixtureKey;
const segment = Buffer.concat(Array.from({ length: 10 }, () => Buffer.concat([Buffer.from([0x47, 0x1f, 0xff, 0x10]), Buffer.alloc(184, 0xff)])));
const manifest = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:4', '#EXT-X-MEDIA-SEQUENCE:0',
  '#EXTINF:4.0,', 'seg-0.ts?' + fixtureKey, '#EXTINF:4.0,', 'seg-1.ts?' + fixtureKey, '#EXT-X-ENDLIST', ''].join('\n');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

async function close(server) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

(async () => {
  const directory = path.resolve(__dirname, '../dist/vercel');
  const screenshots = process.env.RELAY_SCREENSHOT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'tclv-relay-browser-'));
  const builtPlayer = await fs.readFile(path.join(directory, 'bridge-player.js'), 'utf8');
  assert.ok(builtPlayer.includes('id="vercelToggle"'), 'Generate the current Vercel build before running relay browser tests');
  await fs.mkdir(screenshots, { recursive: true });
  const { createRelay } = await import('../api/stream.js');

  const providerRequests = [];
  let releaseSegments;
  const segmentsReady = new Promise(resolve => { releaseSegments = resolve; });
  const provider = http.createServer(async (req, res) => {
    providerRequests.push({ path: req.url, headers: req.headers });
    if (req.url.startsWith('/live/master.m3u8')) {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      res.end(manifest);
    } else if (/^\/live\/seg-\d\.ts/.test(req.url)) {
      // Assert the connecting/playing UI before the intentionally undecodable
      // transport fixture raises a player error. Live mode tests real decoding.
      await segmentsReady;
      res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': segment.length });
      res.end(segment);
    } else res.writeHead(404).end();
  });
  // The synthetic provider has a public-looking name; only its transport is local.
  const relay = liveUrl ? createRelay({ env: {} }) : createRelay({
    env: {},
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: (url, init) => fetch(url.replace('http://provider.example', 'http://127.0.0.1:' + provider.address().port),
      { headers: init.headers, redirect: 'manual', signal: init.signal }),
  });
  const relayRequests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/stream') { relayRequests.push({ url, headers: req.headers }); await relay(req, res); return; }
    const target = path.resolve(directory, '.' + decodeURIComponent(url.pathname));
    if (target !== directory && !target.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const file = url.pathname.endsWith('/') ? path.join(target, 'index.html') : target;
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  try {
    await listen(provider);
    await listen(server);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const channel = process.env.BROWSER_CHANNEL;
    browser = await chromium.launch({
      ...(channel ? { channel } : { executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() }),
      headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    await context.addInitScript(appOrigin => {
      if (window.location.origin === appOrigin && !localStorage.getItem('tclv.language')) localStorage.setItem('tclv.language', 'en');
    }, origin);
    const blocked = [], errors = [], dialogs = [];
    // Like a provider without CORS: the browser itself can never reach it.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      blocked.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(liveUrl ? 45000 : 10000);
    const mode = () => page.evaluate(() => window.TCLVWebBridge.mode);
    const routeText = () => page.locator('#webVideoRoute').textContent();
    await page.goto(origin);
    await page.waitForFunction(() => !!window.TCLVWebBridge);
    assert.equal(await mode(), 'auto');

    // Default mode: the stream waits for the local helper and never touches the relay.
    await page.locator('#playlistFile').setInputFiles({ name: 'relay-fixture.m3u', buffer: Buffer.from('#EXTM3U\n#EXTINF:-1,Relay fixture\n' + channelUrl) });
    await page.locator('.channel-card').first().click();
    await page.waitForFunction(() => document.querySelector('#webVideoRoute').textContent.includes('waiting for a local connection'));
    assert.equal(relayRequests.length, 0, 'Video must not use the hosting relay before the viewer opts in');
    assert.equal(await page.locator('.web-bridge-bar').getAttribute('data-relay'), 'none');

    // Declining the warning changes nothing.
    await page.locator('#bridgeQuickConnect').click();
    await page.locator('#vercelToggle').waitFor();
    assert.match(await page.locator('#vercelWarning').textContent(), /monthly data limit/);
    assert.equal(await page.locator('#vercelUsage').isVisible(), false);
    page.once('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
    await page.locator('#vercelToggle').click();
    assert.match(dialogs[0], /monthly data limit/);
    assert.equal(await page.locator('#vercelToggle').isChecked(), false);
    assert.equal(await mode(), 'auto');
    assert.equal(relayRequests.length, 0);
    await page.screenshot({ path: path.join(screenshots, '20-relay-offer.png') });

    // Accepting it resumes the waiting stream through the relay.
    const relayedManifest = page.waitForResponse(response => new URL(response.url()).pathname === '/api/stream' && response.status() === 200 &&
      /mpegurl/.test(response.headers()['content-type'] || ''));
    page.once('dialog', dialog => { dialogs.push(dialog.message()); void dialog.accept(); });
    await page.locator('#vercelToggle').click();
    assert.equal(await mode(), 'auto-vercel');
    assert.equal(await page.locator('#webVideoMode').inputValue(), 'auto-vercel');
    const manifestResponse = await relayedManifest;
    const rewritten = await manifestResponse.text();
    assert.equal(/^https?:\/\//m.test(rewritten), false, 'A relayed manifest must not point the browser back at the provider');
    assert.match(rewritten, /^\/api\/stream\?url=http/m);
    await page.waitForFunction(() => document.querySelector('.web-bridge-bar').dataset.relay === 'vercel').catch(async error => {
      console.error(await page.evaluate(() => ({
        route: window.TCLVWebBridge.route,
        mode: window.TCLVWebBridge.mode,
        routeLabel: document.querySelector('#webVideoRoute').textContent,
        message: document.querySelector('#playerMessage')?.textContent,
        videoError: document.querySelector('#videoPlayer')?.error?.code,
        resources: performance.getEntriesByType('resource').filter(e => e.name.includes('/api/stream')).map(e => ({
          bytes: e.transferSize, body: e.encodedBodySize, duration: e.duration,
        })),
      })));
      console.error('Provider request count:', providerRequests.length, 'Page errors:', errors);
      throw error;
    });
    assert.match(await routeText(), /through Vercel/);
    await page.waitForFunction(() => window.TCLVWebBridge.relayBytes > 0);
    assert.equal(await page.locator('#vercelUsage').isVisible(), true);
    await page.screenshot({ path: path.join(screenshots, '21-relay-on.png') });
    await page.locator('#settingsClose').click();
    releaseSegments();

    if (liveUrl) {
      await page.waitForFunction(() => document.querySelector('#videoPlayer').currentTime > 3);
      assert.ok(await page.evaluate(() => document.querySelector('#videoPlayer').videoWidth) > 0, 'The relayed stream decodes real video');
    } else {
      await page.waitForFunction(() => window.TCLVWebBridge.relayBytes > 1880);
      assert.ok(providerRequests.some(request => request.path === '/live/seg-0.ts?' + fixtureKey), 'Segments reach the provider through the relay');
      for (const request of providerRequests) {
        assert.equal(request.headers.cookie, undefined);
        assert.equal(request.headers.referer, undefined);
        assert.equal(request.headers.origin, undefined);
        assert.equal(request.headers['accept-encoding'], 'identity');
      }
    }
    await page.screenshot({ path: path.join(screenshots, '22-relay-playing.png') });
    assert.ok(relayRequests.every(request => request.headers['sec-fetch-site'] === 'same-origin'));
    assert.ok(relayRequests.length >= 2, 'The manifest and its segments use the relay');

    // The choice survives a reload without asking again; switching it off is immediate.
    await page.reload();
    await page.waitForFunction(() => !!window.TCLVWebBridge);
    assert.equal(await mode(), 'auto-vercel');
    assert.equal(dialogs.length, 2);
    await page.locator('#bridgeQuickConnect').click();
    assert.equal(await page.locator('#vercelToggle').isChecked(), true);
    await page.locator('#vercelToggle').click();
    assert.equal(await mode(), 'auto');
    assert.equal(await page.evaluate(() => localStorage.getItem('tclv.webVideoMode')), 'auto');

    assert.deepEqual(errors, []);
    console.log(`Relay browser integration passed (${liveUrl ? 'live stream' : 'synthetic provider'}): default off, warning and confirmation, relayed HLS, route warning, usage estimate, persistence. Screenshots: ${screenshots}`);
  } finally {
    releaseSegments();
    if (browser) await browser.close();
    await close(server);
    await close(provider);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
