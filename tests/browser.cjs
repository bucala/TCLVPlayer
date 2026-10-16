/* global URL, process, document, addPlaylistRecord, persistSourcesPending, loadPlaylistText, loadTextFromUrl: writable, persistSources, dom, state, saveExportedFile: writable, exportSettings, importSettingsFromFile, File, parseEpgOffThread, focusChannelIndex, ensureHls, playInSlot1, window, location, activatePlaylist, console */
// Integration tests use only generated, synthetic sources. No personal fixture files.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const directory = path.resolve(process.env.BROWSER_BUILD === 'vercel' ? 'dist/vercel' : 'dist/web');
  const server = http.createServer(async (req, res) => {
    const target = path.resolve(directory, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(directory + path.sep) && target !== directory) { res.writeHead(403).end(); return; }
    try {
      const file = target === directory || req.url.endsWith('/') ? path.join(target, 'index.html') : target;
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime }); res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin); await page.waitForFunction(() => typeof epgProgramCache !== 'undefined' && document.documentElement.dataset.platform);
    await page.evaluate(async () => {
      const text = '#EXTM3U\n#EXTINF:-1,Fixture A\nhttps://media.example/a.m3u8\n#EXTINF:-1,Fixture B\nhttps://media.example/b.m3u8';
      addPlaylistRecord({ id: 'fixture', name: 'local.m3u', source: 'local.m3u', origin: 'local', type: 'm3u', text });
      await persistSourcesPending;
      await loadPlaylistText(text, 'local.m3u');
    });
    await page.locator('.channel-card').first().focus();
    await page.keyboard.press('ArrowDown'); assert.equal(await page.evaluate(() => document.activeElement.dataset.channelId), 'fixture-b');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.id), 'chToggle');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => dom.settingsPanel.hidden), false);
    const selection = await page.evaluate(() => state.selectedChannelId);
    await page.keyboard.press('PageDown'); assert.equal(await page.evaluate(() => state.selectedChannelId), selection);
    for (let i = 0; i < 28; i++) await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('#settingsPanel')), true);
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => dom.settingsPanel.hidden), true);
    // Favourite activation must not also select/play the enclosing channel.
    await page.locator('.fav-action').nth(1).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => state.selectedChannelId), selection);
    const backup = await page.evaluate(() => {
      let result; const save = saveExportedFile; saveExportedFile = text => { result = JSON.parse(text); }; exportSettings(); saveExportedFile = save; return result;
    });
    assert.ok(backup.playlists[0].text.includes('#EXTM3U'));
    const race = await page.evaluate(async () => {
      const originalSources = state.playlists, active = state.activePlaylistId, fetchSource = loadTextFromUrl;
      const pending = {};
      loadTextFromUrl = url => new Promise(resolve => { pending[url] = resolve; });
      state.playlists = [{ id: 'a', name: 'a.m3u', origin: 'network', type: 'm3u', source: 'https://source.example/a.m3u' }, { id: 'b', name: 'b.m3u', origin: 'network', type: 'm3u', source: 'https://source.example/b.m3u' }];
      const a = activatePlaylist('a'), b = activatePlaylist('b');
      pending['https://source.example/b.m3u']('#EXTM3U\n#EXTINF:-1,Chosen B\nhttps://media.example/b.m3u8'); await b;
      pending['https://source.example/a.m3u']('#EXTM3U\n#EXTINF:-1,Stale A\nhttps://media.example/a.m3u8'); await a;
      const result = { active: state.activePlaylistId, name: state.channels[0].name };
      loadTextFromUrl = fetchSource; state.playlists = originalSources; state.activePlaylistId = active; await persistSources(); await activatePlaylist(active);
      return result;
    });
    assert.deepEqual(race, { active: 'b', name: 'Chosen B' });
    await page.reload(); await page.waitForFunction(() => state.channels.length === 2);
    assert.equal(await page.evaluate(() => state.playlists[0].text.includes('#EXTM3U')), true);
    const rejected = await page.evaluate(async () => {
      const old = state.playlists;
      await importSettingsFromFile(new File(['{"version":2,"playlists":[null]}'], 'invalid.json'));
      return old === state.playlists;
    }); assert.equal(rejected, true);
    // Exercise the real worker, including UTF-8, entity decoding and programme dates.
    const parsed = await page.evaluate(async () => {
      const timestamp = date => date.toISOString().slice(0, 19).replace(/[-:T]/g, '') + ' +0000';
      const xml = '<tv><channel id="fixture-a"><display-name>Fixture A</display-name></channel><programme channel="fixture-a" start="20261016120000 +0000" stop="20261016130000 +0000"><title>Čas &amp; deň</title><desc><![CDATA[Description]]></desc></programme></tv>';
      const map = await parseEpgOffThread(xml.replace('20261016120000 +0000', timestamp(new Date(Date.now() - 1800000))).replace('20261016130000 +0000', timestamp(new Date(Date.now() + 1800000))));
      return map.get('fixture-a')[0];
    }); assert.equal(parsed.title, 'Čas & deň'); assert.equal(parsed.channelName, 'Fixture A');
    // Check focus across scroll/render frames, including backwards window updates.
    const expectChannelFocus = async id => {
      await page.waitForFunction(expected => document.activeElement.dataset.channelId === expected, id);
      const result = await page.evaluate(async () => {
        const focus = [];
        for (let frame = 0; frame < 8; frame++) {
          await new Promise(resolve => window.requestAnimationFrame(resolve));
          focus.push(document.activeElement.dataset.channelId);
        }
        const cards = [...dom.channelGrid.querySelectorAll('.channel-card')];
        const bounds = dom.channelGrid.getBoundingClientRect();
        const active = document.activeElement.getBoundingClientRect();
        return {
          focus, positions: cards.map(card => Number(card.getAttribute('aria-posinset'))),
          visible: active.top >= bounds.top && active.bottom <= bounds.bottom,
        };
      });
      assert.deepEqual(result.focus, Array(8).fill(id), 'Focus must survive pending scroll renders');
      assert.ok(result.visible, 'The focused channel must stay in view');
      assert.equal(result.positions.length, 70, 'Keep a full, bounded window at either end');
      assert.ok(result.positions.every((position, i, all) => !i || position === all[i - 1] + 1), 'Rendered rows must remain in playlist order');
    };
    // A thousand channels must keep a bounded DOM through repeated D-pad traversal.
    await page.evaluate(async () => { await loadPlaylistText('#EXTM3U\n' + Array.from({ length: 1000 }, (_, i) => '#EXTINF:-1,Fixture ' + i + '\nhttps://media.example/' + i + '.m3u8').join('\n'), 'large.m3u'); focusChannelIndex(0); });
    const largeSelection = await page.evaluate(() => state.selectedChannelId);
    for (let round = 0; round < 2; round++) {
      await page.keyboard.press('End'); await expectChannelFocus('fixture-999');
      for (let i = 0; i < 81; i++) await page.keyboard.press('ArrowUp');
      await expectChannelFocus('fixture-918');
      await page.keyboard.press('Home'); await expectChannelFocus('fixture-0');
      for (let i = 0; i < 81; i++) await page.keyboard.press('ArrowDown');
      await expectChannelFocus('fixture-81');
    }
    assert.equal(await page.evaluate(() => state.selectedChannelId), largeSelection, 'Focus traversal must not start another channel');
    if (process.env.BROWSER_BUILD === 'vercel') {
      await page.route('**/failure.m3u8', route => route.fulfill({ status: 403, body: 'Forbidden' }));
      await page.evaluate(async () => {
        await ensureHls(); window.auditBridgeOpens = 0;
        window.TCLVBridgeClient.prototype.openStream = async function() { window.auditBridgeOpens++; throw new Error('Fixture bridge offline'); };
        state.player = 'html5'; state.multiview = true;
        state.mvChannel1 = { id: 'secondary', name: 'Fixture Secondary', url: location.origin + '/failure.m3u8' };
        await playInSlot1(state.mvChannel1);
      });
      try { await page.waitForFunction(() => window.auditBridgeOpens === 1, null, { timeout: 5000 }); } catch (error) { console.log(await page.evaluate(() => ({ opens: window.auditBridgeOpens, hls: !!state.hls2, message: dom.playerMessage2.textContent, version: window.Hls?.version, supported: window.Hls?.isSupported(), source: dom.video2.currentSrc, errors: dom.video2.error?.code, bridged: !!window.TCLVWebBridge }))); throw error; }
      assert.equal(await page.evaluate(() => window.auditBridgeOpens), 1);
    }
    assert.deepEqual(errors, []); console.log('Browser integration passed: D-pad, modal isolation, local persistence/export, invalid import, EPG worker, virtual channels.');
  } finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
