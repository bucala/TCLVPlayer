/* global URL, process, document, window, localStorage, Buffer, fetch, console, __dirname */
// End-to-end bridge checks use only synthetic sources and a local provider fixture.
// Build first: node scripts/copy-web.mjs --vercel --source-bridge
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const windowsAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const androidAgent = 'Mozilla/5.0 (Linux; Android 16; Redmi Pad 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const providerUrl = 'http://provider.example/private-channel.mp4?fixture_key=synthetic-private-value';

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    const failed = error => { server.off('listening', ready); reject(error); };
    const ready = () => { server.off('error', failed); resolve(); };
    server.once('error', failed);
    server.once('listening', ready);
    server.listen(port, '127.0.0.1');
  });
}

async function close(server) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

async function approvalPopup(context, page) {
  const opened = context.waitForEvent('page');
  await page.locator('#bridgeApprove').click();
  const popup = await opened;
  await popup.waitForURL(/^http:\/\/127\.0\.0\.1:(3939|3940|3941)\/pair\/approve\/[A-Za-z0-9_-]{32}$/);
  await popup.locator('button[value="approve"]').waitFor();
  return popup;
}

async function waitForStatus(page, status) {
  await page.waitForFunction(expected => window.TCLVWebBridge?.status === expected, status);
}

(async () => {
  const directory = path.resolve(__dirname, '../dist/vercel');
  const screenshots = process.env.BRIDGE_SCREENSHOT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'tclv-bridge-browser-'));
  const builtPlayer = await fs.readFile(path.join(directory, 'bridge-player.js'), 'utf8');
  assert.ok(builtPlayer.includes('id="bridgeApprove"'), 'Generate the current Vercel build before running bridge browser tests');
  await fs.mkdir(screenshots, { recursive: true });
  const staticRequests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    staticRequests.push(url);
    const target = path.resolve(directory, '.' + decodeURIComponent(url.pathname));
    if (target !== directory && !target.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const file = url.pathname.endsWith('/') ? path.join(target, 'index.html') : target;
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  let browser, bridge, provider;
  const originalGet = http.get;
  try {
    await listen(server);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const providerRequests = [];
    provider = http.createServer((req, res) => {
      providerRequests.push({ path: req.url, headers: req.headers });
      // Transport is real; decoding a fixture video is outside this connection test.
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(Buffer.from('000000186674797069736F6D0000020069736F6D69736F32', 'hex'));
    });
    await listen(provider);
    http.get = function(url, options, callback) {
      const target = new URL(url);
      if (target.hostname === 'provider.example') {
        return originalGet('http://127.0.0.1:' + provider.address().port + target.pathname + target.search, {
          headers: options.headers, signal: options.signal,
        }, callback);
      }
      return originalGet(url, options, callback);
    };
    const { createBridge } = await import('../bridge/server.mjs');
    for (const port of [3939, 3940, 3941]) {
      const candidate = createBridge({ origins: [origin], resolve: async () => [{ address: '8.8.8.8', family: 4 }] });
      try { await listen(candidate.server, port); bridge = candidate; break; }
      catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
    }
    assert.ok(bridge, 'No bridge discovery port (3939–3941) is available');
    const bridgeOrigin = 'http://127.0.0.1:' + bridge.server.address().port;
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ userAgent: windowsAgent, viewport: { width: 1440, height: 1080 } });
    await context.addInitScript(appOrigin => {
      if (window.location.origin === appOrigin) localStorage.setItem('tclv.language', 'en');
    }, origin);
    const requests = [], externalRequests = [], errors = [];
    context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData(), headers: request.headers() }));
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      externalRequests.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(origin);
    await page.waitForFunction(() => !!window.TCLVWebBridge);
    await page.locator('#bridgeQuickConnect').click();
    assert.equal(await page.locator('#bridgeSetupDownload').isVisible(), true);
    assert.equal(await page.locator('#bridgeLaunch').getAttribute('href'), 'tclvbridge://open');
    assert.equal(await page.locator('#bridgeApprove').isDisabled(), true);
    assert.equal(requests.filter(request => new URL(request.url).pathname === '/ping').length, 0, 'Discovery starts with an explicit user action');
    await page.screenshot({ path: path.join(screenshots, '10-setup.png') });

    await page.locator('#bridgeFind').click();
    await waitForStatus(page, 'available');
    assert.equal(await page.locator('#bridgeApprove').isEnabled(), true);
    const popup = await approvalPopup(context, page);
    const approvalUrl = new URL(popup.url());
    assert.equal(approvalUrl.origin, bridgeOrigin);
    assert.equal(approvalUrl.search + approvalUrl.hash + approvalUrl.username + approvalUrl.password, '');
    assert.equal(await popup.locator('#request-origin').textContent(), origin);
    assert.equal(await popup.locator('script, img, iframe, link').count(), 0, 'The local approval page needs no external assets or scripts');
    await page.locator('#bridgeCancel').waitFor();
    assert.equal(await page.locator('#bridgeApprove').getAttribute('aria-busy'), 'true');
    await page.screenshot({ path: path.join(screenshots, '11-pending.png') });
    await popup.screenshot({ path: path.join(screenshots, '12-local-approval.png') });
    await popup.locator('button[value="approve"]').click();
    await waitForStatus(page, 'ready');
    if (!popup.isClosed()) await popup.close();
    assert.equal(await page.locator('#bridgeConnected').isVisible(), true);
    assert.equal(await page.locator('#bridgeSteps').isVisible(), false);
    assert.equal(await page.locator('#bridgeApprovalLink').getAttribute('href'), null);
    const session = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('tclv.bridge.session')));
    assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(Object.keys(session).sort(), ['base', 'expires', 'token']);
    await page.screenshot({ path: path.join(screenshots, '13-ready.png') });

    // Real UI playback reaches /open, an opaque loopback /media ticket and then
    // the synthetic provider through the running bridge, without a Vercel proxy.
    await page.locator('#bridgeAdvanced > summary').click();
    await page.locator('#webVideoMode').selectOption('bridge');
    await page.locator('#playlistFile').setInputFiles({ name: 'bridge-fixture.m3u', buffer: Buffer.from('#EXTM3U\n#EXTINF:-1 tvg-logo="' + origin + '/favicon.svg",Bridge fixture\n' + providerUrl) });
    await page.locator('.channel-card').first().waitFor();
    await page.locator('#settingsClose').click();
    const mediaResponse = page.waitForResponse(response => new URL(response.url()).origin === bridgeOrigin && /^\/media\/[A-Za-z0-9_-]{32}$/.test(new URL(response.url()).pathname));
    await page.locator('.channel-card').first().click();
    await mediaResponse;
    assert.equal(providerRequests[0].path, '/private-channel.mp4?fixture_key=synthetic-private-value');
    assert.equal(providerRequests[0].headers.authorization, undefined);
    assert.equal(providerRequests[0].headers.referer, undefined);
    const openedStream = requests.find(request => new URL(request.url).pathname === '/open');
    assert.equal(new URL(openedStream.url).origin, bridgeOrigin);
    assert.deepEqual(JSON.parse(openedStream.body), { url: providerUrl });
    assert.ok(requests.some(request => new URL(request.url).origin === bridgeOrigin && /^\/media\/[A-Za-z0-9_-]{32}$/.test(new URL(request.url).pathname)));

    await page.locator('#bridgeQuickConnect').click();
    await page.locator('#bridgeDisconnect').click();
    await waitForStatus(page, 'available');
    assert.equal(await page.locator('#bridgeApprove').isVisible(), true, 'Disconnect preserves support for local approval');
    assert.equal(await page.evaluate(() => window.sessionStorage.getItem('tclv.bridge.session')), null);
    const denied = await approvalPopup(context, page);
    await denied.locator('button[value="deny"]').click();
    await page.waitForFunction(() => document.querySelector('#bridgeStatus').textContent.includes('declined'));
    assert.equal(await page.locator('#bridgeApprove').isEnabled(), true);
    assert.equal(await page.evaluate(() => window.sessionStorage.getItem('tclv.bridge.session')), null);
    if (!denied.isClosed()) await denied.close();

    const cancelled = await approvalPopup(context, page);
    const cancelledUrl = cancelled.url();
    const requestRemoved = page.waitForResponse(response => response.request().method() === 'DELETE' && /\/pair\/request\//.test(response.url()));
    await page.locator('#bridgeCancel').click();
    await requestRemoved;
    await page.waitForFunction(() => document.querySelector('#bridgeStatus').textContent.includes('cancelled'));
    assert.equal(await page.locator('#bridgeApprovalLink').getAttribute('href'), null);
    assert.equal((await fetch(cancelledUrl)).status, 410, 'Cancellation removes the actual server request');
    // Browsers may refuse parent-driven close after opener has been removed.
    if (!cancelled.isClosed()) await cancelled.close();

    // Simulate a popup blocker while retaining real navigation and confirmation
    // through the explicit fallback link.
    await page.evaluate(() => { window.open = () => null; });
    await page.locator('#bridgeApprove').click();
    await page.locator('#bridgeApprovalLink').waitFor();
    await page.waitForFunction(() => document.querySelector('#bridgeStatus').textContent.includes('did not open'));
    const fallbackOpened = context.waitForEvent('page');
    await page.locator('#bridgeApprovalLink').click();
    const fallback = await fallbackOpened;
    await fallback.locator('button[value="approve"]').click();
    await waitForStatus(page, 'ready');
    await fallback.close();
    assert.equal(await page.locator('#bridgeConnected').isVisible(), true);

    const mobile = await browser.newContext({ userAgent: androidAgent, viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await mobile.addInitScript(appOrigin => {
      if (window.location.origin === appOrigin) localStorage.setItem('tclv.language', 'en');
    }, origin);
    await mobile.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto(origin + '/#connect-bridge');
    await waitForStatus(mobilePage, 'available');
    assert.equal(await mobilePage.locator('#settingsPanel').isVisible(), true);
    assert.equal(await mobilePage.locator('#bridgeSetupDownload').isVisible(), false);
    assert.equal(await mobilePage.locator('#bridgeLaunch').isVisible(), false);
    assert.match(await mobilePage.locator('#bridgeDeviceHint').textContent(), /native app on Android/);
    assert.equal(await mobilePage.locator('a[href$="Setup.exe"]:visible, a[href^="tclvbridge:"]:visible').count(), 0);
    assert.equal(await mobilePage.locator('.web-bridge-settings').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Setup must fit the mobile settings panel');
    await mobilePage.screenshot({ path: path.join(screenshots, '14-android-browser.png') });
    await mobile.close();

    const secrets = [session.token,
      ...requests.filter(request => /\/pair\/request\//.test(request.url) && request.body).map(request => JSON.parse(request.body).proof),
      ...requests.map(request => request.headers.authorization?.replace(/^Bearer /, '')),
    ].filter(Boolean);
    for (const request of requests) {
      assert.ok(secrets.every(secret => !request.url.includes(secret)), 'No pairing proof or session token belongs in a URL');
      assert.notEqual(new URL(request.url).pathname, '/api/proxy', 'Video must never call the Vercel proxy');
      if (request.url.includes('fixture_key=') || request.body?.includes('fixture_key=')) {
        assert.equal(new URL(request.url).origin, bridgeOrigin, 'Provider addresses must stay between the browser and its local bridge');
      }
      if (request.headers.authorization) assert.equal(new URL(request.url).origin, bridgeOrigin);
    }
    assert.equal(staticRequests.some(url => url.pathname === '/api/proxy' || url.search.includes('fixture_key=')), false);
    // Public logo catalogs may be requested by the existing logo index. The
    // harness blocks them, and source addresses must never appear among them.
    assert.equal(externalRequests.some(url => url.includes('provider.example') || url.includes('fixture_key=')), false);
    assert.deepEqual(errors, []);
    console.log('Bridge browser integration passed: discovery, real local approval, playback routing, denial/retry/cancel, blocked-popup fallback, mobile guidance and privacy.');
  } finally {
    if (browser) await browser.close();
    http.get = originalGet;
    await close(bridge?.server);
    await close(provider);
    await close(server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
