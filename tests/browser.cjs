/* global URL, process, document, addPlaylistRecord, persistSourcesPending, loadPlaylistText, loadTextFromUrl: writable, persistSources, dom, state, saveExportedFile: writable, exportSettings, importSettingsFromFile, File, parseEpgOffThread, focusChannelIndex, ensureHls, playInSlot1, window, location, activatePlaylist, console, buildQualityMenu, openSettings, closeSettings, writeWebSourceCache, reloadEpgSources, currentProgram, selectedChannel, rebuildMergedEpg, forceRefreshEpg, nativeChannelMetadata, epgSourceStatus, reindexEpg, findPrograms, parseXspf, setTimeout, setInterval, clearInterval, Buffer, autoLoadEpgFromPlaylist */
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
    const backup = await page.evaluate(async () => {
      let result; const save = saveExportedFile; saveExportedFile = async chunks => { let text = ''; for await (const chunk of chunks) text += chunk; result = JSON.parse(text); }; await exportSettings(); saveExportedFile = save; return result;
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
    // Reproduce the generator's XSPF <meta rel="tvg-id"> export, including a
    // gzip local file, a stale exact HD schedule and live SK/CZ alternatives.
    const originalData = await page.evaluate(() => {
      window.generatorSavedState = { playlists: state.playlists, active: state.activePlaylistId, epgSources: state.epgSources };
      return { playlists: state.playlists.length };
    });
    const { gzipSync } = require('node:zlib');
    const generatedXspf = '<playlist version="1" xmlns="http://xspf.org/ns/0/"><trackList><track><title>Fíxture A</title><location>https://media.example/a?x=1&amp;y=2</location><image>https://logo.example/a?x=1&amp;y=2</image><meta rel="tvg-id">Fíxture A HD.sk</meta><meta rel="tvg-name">Fíxture A.sk</meta><meta rel="tvg-country">sk</meta><meta rel="group-title">Local, news</meta><meta rel="catchup-days">7</meta></track></trackList></playlist>';
    await page.locator('#playlistFile').setInputFiles({ name: 'generator-selected.xspf.gz', mimeType: 'application/gzip', buffer: gzipSync(generatedXspf) });
    await page.waitForFunction(() => state.channels[0]?.tvgId === 'Fíxture A HD.sk' && !dom.playlistFile.value);
    const generatorMetadata = await page.evaluate(() => ({ channel: state.channels[0], type: state.playlists[0].type }));
    assert.equal(generatorMetadata.type, 'xspf');
    assert.equal(generatorMetadata.channel.id, 'f-xture-a', 'Reading generator metadata must preserve the existing channel selection/favourites ID');
    assert.equal(generatorMetadata.channel.logo, 'https://logo.example/a?x=1&y=2');
    assert.equal(generatorMetadata.channel.url, 'https://media.example/a?x=1&y=2');
    assert.equal(generatorMetadata.channel.group, 'Local, news'); assert.equal(generatorMetadata.channel.catchupDays, 7);
    const generatorEpg = await page.evaluate(async () => {
      const stamp = ms => new Date(ms).toISOString().slice(0, 19).replace(/[-:T]/g, '') + ' +0000';
      const xml = (id, title, start, stop) => '<tv><channel id="' + id + '"><display-name>' + id + '</display-name></channel><programme channel="' + id + '" start="' + stamp(start) + '" stop="' + stamp(stop) + '"><title>' + title + '</title></programme></tv>';
      state.epgSources = [
        { id: 'expired-hd', name: 'Expired', source: 'old.xml', origin: 'local', text: xml('Fíxture A HD.sk', 'Old', Date.now() - 7200000, Date.now() - 3600000) },
        { id: 'current-sk', name: 'Current SK', source: 'new.xml', origin: 'local', text: xml('Fixture A.sk', 'Correct SK programme', Date.now() - 600000, Date.now() + 3600000) },
        { id: 'current-cz', name: 'Current CZ', source: 'cz.xml', origin: 'local', text: xml('Fixture A.cz', 'Wrong country', Date.now() - 600000, Date.now() + 7200000) },
      ];
      await rebuildMergedEpg(); return currentProgram(selectedChannel())?.title;
    });
    assert.equal(generatorEpg, 'Correct SK programme');
    const beforeInvalid = await page.evaluate(() => ({ count: state.playlists.length, active: state.activePlaylistId, channel: state.selectedChannelId }));
    await page.locator('#playlistFile').setInputFiles({ name: 'login.m3u', buffer: Buffer.from('<!doctype html>\n<html>Please sign in</html>') });
    await page.waitForFunction(() => !dom.playlistFile.value && dom.playerMessage.textContent.includes('neobsahuje platné stanice'));
    assert.deepEqual(await page.evaluate(() => ({ count: state.playlists.length, active: state.activePlaylistId, channel: state.selectedChannelId })), beforeInvalid);
    // M3U from the generator carries source URLs in url-tvg and per-track
    // tvg-url. Import must discover them even when other EPG sources exist.
    let generatorRequests = 0;
    const stamp = ms => new Date(ms).toISOString().slice(0, 19).replace(/[-:T]/g, '') + ' +0000';
    const compressedGuide = gzipSync('<tv><programme channel="Fixture A.sk" start="' + stamp(Date.now() - 600000) + '" stop="' + stamp(Date.now() + 3600000) + '"><title>Gzip imported programme</title></programme></tv>');
    await page.route('**/generator-epg.xml.gz?*', route => { generatorRequests++; return route.fulfill({ contentType: 'application/gzip', body: compressedGuide }); });
    const epgUrl = origin + '/generator-epg.xml.gz?x=1&amp;y=2';
    const generatedM3u = '#EXTM3U url-tvg="' + epgUrl + '"\n#EXTINF:-1 group-title="Local, news" tvg-id="Fixture A.sk" tvg-url="' + epgUrl + '",Fixture A\nhttps://media.example/a';
    await page.locator('#playlistFile').setInputFiles({ name: 'generator.m3u.gz', buffer: gzipSync(generatedM3u) });
    await page.waitForFunction(() => currentProgram(selectedChannel())?.title === 'Gzip imported programme' && !dom.playlistFile.value);
    assert.equal(generatorRequests, 1);
    assert.equal(await page.evaluate(() => state.epgSources.find(source => source.origin === 'network').source), origin + '/generator-epg.xml.gz?x=1&y=2');
    assert.equal(await page.evaluate(() => state.playlists.length), originalData.playlists + 2);
    await page.route('**/assigned-*.xml.gz', route => {
      const id = new URL(route.request().url()).pathname.match(/assigned-(\d+)/)[1];
      return route.fulfill({ contentType: 'application/gzip', body: gzipSync('<tv><programme channel="Assigned' + id + '.sk" start="' + stamp(Date.now() - 600000) + '" stop="' + stamp(Date.now() + 3600000) + '"><title>Assigned ' + id + '</title></programme></tv>') });
    });
    const assignedSources = await page.evaluate(async origin => {
      const text = '#EXTM3U\n' + Array.from({ length: 4 }, (_, i) => '#EXTINF:-1 tvg-id="Assigned' + i + '.sk" tvg-url="' + origin + '/assigned-' + i + '.xml.gz",Assigned ' + i + '\nhttps://media.example/' + i).join('\n');
      await loadPlaylistText(text, 'assigned.m3u'); await autoLoadEpgFromPlaylist(text);
      return state.channels.map(channel => currentProgram(channel)?.title);
    }, origin);
    assert.deepEqual(assignedSources, ['Assigned 0', 'Assigned 1', 'Assigned 2', 'Assigned 3'], 'Explicit per-channel sources must not stop at the three-source heuristic limit');
    await page.evaluate(async () => {
      const saved = window.generatorSavedState; state.playlists = saved.playlists; state.epgSources = saved.epgSources;
      await activatePlaylist(saved.active); await persistSources();
    });
    // Quality remains selectable in Settings and never overlays the video.
    const quality = await page.evaluate(() => {
      const original = state.hls;
      state.hls = { levels: [{ height: 720 }, { height: 1080 }], currentLevel: -1 };
      buildQualityMenu(); state.hls = original;
      return { settings: !!dom.qualityControl.closest('#settingsPanel'), overlay: !!dom.qualityControl.closest('.player-stage'), values: [...dom.qualitySelect.options].map(option => option.value) };
    });
    assert.deepEqual(quality, { settings: true, overlay: false, values: ['-1', '0', '1'] });
    // Force refresh bypasses fresh memory/cache data, disables duplicate clicks and
    // keeps the previous EPG when a provider replies with malformed XML.
    const timestamp = ms => new Date(ms).toISOString().slice(0, 19).replace(/[-:T]/g, '') + ' +0000';
    const epgXml = title => '<tv><programme channel="fixture-a" start="' + timestamp(Date.now() - 1800000) + '" stop="' + timestamp(Date.now() + 1800000) + '"><title>' + title + '</title></programme></tv>';
    let epgRequests = 0, releaseEpg, requestStarted;
    let started = new Promise(resolve => { requestStarted = resolve; });
    await page.route('**/forced-epg.xml', async route => {
      epgRequests++;
      await new Promise(resolve => { releaseEpg = resolve; requestStarted(); });
      await route.fulfill({ contentType: 'application/xml', body: epgRequests === 2 ? '<tv><programme' : epgXml('Fresh fixture programme') });
    });
    await page.evaluate(async ({ url, text }) => {
      window.auditSavedEpgSources = state.epgSources;
      state.epgSources = [{ id: 'force', name: 'Fixture EPG', origin: 'network', active: true, source: url, fetchedAt: Date.now(), text },
        { id: 'disabled', name: 'Disabled fixture', origin: 'network', active: false, source: 'https://source.example/disabled.xml' }];
      await writeWebSourceCache(url, text); await reloadEpgSources(); openSettings();
    }, { url: origin + '/forced-epg.xml', text: epgXml('Cached fixture programme') });
    assert.equal(epgRequests, 0);
    await page.locator('#reloadEpg').click(); await started;
    assert.equal(await page.locator('#reloadEpg').isDisabled(), true);
    assert.equal(await page.locator('#reloadEpg').getAttribute('aria-busy'), 'true');
    await page.evaluate(() => dom.reloadEpg.click()); assert.equal(epgRequests, 1);
    releaseEpg();
    await page.waitForFunction(() => !dom.reloadEpg.disabled);
    assert.equal(await page.evaluate(() => currentProgram(selectedChannel()).title), 'Fresh fixture programme');
    const metadata = await page.evaluate(() => nativeChannelMetadata(selectedChannel()));
    assert.equal(metadata.programme, 'Fresh fixture programme');
    assert.equal(metadata.programmes[0].title, 'Fresh fixture programme');
    assert.ok(metadata.programmes[0].start < Date.now() && metadata.programmes[0].stop > Date.now());
    started = new Promise(resolve => { requestStarted = resolve; });
    await page.locator('#reloadEpg').click(); await started; releaseEpg();
    await page.waitForFunction(() => !dom.reloadEpg.disabled);
    assert.equal(await page.evaluate(() => currentProgram(selectedChannel()).title), 'Fresh fixture programme');
    assert.ok((await page.locator('#playerMessage').textContent()).includes('Niektoré zdroje'));
    assert.equal(epgRequests, 2);
    const refreshRace = await page.evaluate(async () => {
      const original = loadTextFromUrl, text = state.epgSources[0].text, pending = [], flags = [];
      let secondReady; const second = new Promise(resolve => { secondReady = resolve; });
      loadTextFromUrl = (_url, options) => new Promise(resolve => { pending.push(resolve); flags.push(options.forceReload); if (pending.length === 2) secondReady(); });
      try {
        state.epgSources[0].fetchedAt = 0; delete state.epgSources[0].retryAt;
        const automatic = reloadEpgSources(); const manual = forceRefreshEpg();
        pending[0](text); await automatic;
        await second; pending[1](text); await manual;
        return flags;
      } finally { loadTextFromUrl = original; }
    });
    assert.deepEqual(refreshRace, [true, true], 'A manual refresh must run after an existing automatic refresh');
    const localReindex = await page.evaluate(async () => {
      await loadPlaylistText('#EXTM3U\n#EXTINF:-1,Unrelated fixture\nhttps://media.example/other.m3u8', 'other.m3u');
      const unrelated = state.epg.size;
      await loadPlaylistText(state.playlists[0].text, 'local.m3u');
      return { unrelated, restored: currentProgram(selectedChannel())?.title };
    });
    assert.deepEqual(localReindex, { unrelated: 0, restored: 'Fresh fixture programme' });
    assert.equal(epgRequests, 2, 'Local playlist changes re-filter cached EPG without downloading again');
    await page.evaluate(async () => {
      state.epgSources = window.auditSavedEpgSources; await persistSources(); await rebuildMergedEpg(); closeSettings();
    });
    // Native source download returns only a private file reference. Exercise the
    // real streaming worker, matching, transactional refresh and error/backoff.
    await page.route('**/native-fixture.xml', route => route.fulfill({ contentType: 'application/xml', body: '<tv><channel id="provider-123"><display-name>Fíxture A HD</display-name><display-name>Fixture A</display-name></channel>' + epgXml('Matched native programme').replace('fixture-a', 'provider-123').replace('<tv>', '').replace('</tv>', '') + '</tv>' }));
    await page.route('**/broken-native.xml', route => route.fulfill({ contentType: 'application/xml', body: '<tv><programme' }));
    const nativeResults = await page.evaluate(async ({ origin }) => {
      const original = window.Capacitor, sources = state.epgSources;
      let downloads = 0, commits = 0, discards = 0, fail = '', broken = false, httpCalls = 0;
      const key = 'a'.repeat(64);
      window.Capacitor = { getPlatform: () => 'android', convertFileSrc: path => path, Plugins: {
        CapacitorHttp: { request: async () => { httpCalls++; throw new Error('Full-body HTTP must not be used'); } },
        TCLVPlayer: {
          fetchEpgSource: async () => { downloads++; if (fail) throw new Error(fail); return { id: 'download', key, path: origin + (broken ? '/broken-native.xml' : '/native-fixture.xml') }; },
          commitEpgSource: async () => { commits++; }, discardEpgSource: async () => { discards++; },
          getEpgCache: async () => ({ path: origin + '/native-fixture.xml' }),
        }
      } };
      try {
        state.epgSources = [{ id: 'native', name: 'Fixture', source: 'https://source.example/guide?token=private-fixture', origin: 'network', active: true }];
        await reloadEpgSources({ forceReload: true, showOnLoad: false });
        const matched = currentProgram(selectedChannel())?.title;
        const persisted = await window.TCLVStorage.loadSnapshot();
        const hasText = Object.hasOwn(state.epgSources[0], 'text');
        const save = saveExportedFile; let exported;
        try { dom.includeEpgCache.checked = true; saveExportedFile = async chunks => { let text = ''; for await (const part of chunks) text += part; exported = JSON.parse(text); }; await exportSettings(); }
        finally { saveExportedFile = save; dom.includeEpgCache.checked = false; }
        const cachedExport = exported.epgSources[0].text.includes('Matched native programme') && !Object.hasOwn(exported.epgSources[0], 'nativeCache');
        broken = true; await reloadEpgSources({ forceReload: true, showOnLoad: false });
        const preserved = currentProgram(selectedChannel())?.title;
        fail = 'HTTP 404'; await reloadEpgSources({ forceReload: true, showOnLoad: false });
        const before = downloads; await reloadEpgSources({ showOnLoad: false });
        const diagnostic = dom.epgList.textContent;
        return { matched, preserved, commits, discards, httpCalls, hasText, cachedExport, savedKey: persisted.epgSources[0].nativeCache, automaticSkipped: before === downloads, diagnostic };
      } finally { window.Capacitor = original; state.epgSources = sources; await persistSources(); await rebuildMergedEpg(); }
    }, { origin });
    assert.equal(nativeResults.matched, 'Matched native programme');
    assert.equal(nativeResults.preserved, 'Matched native programme');
    assert.equal(nativeResults.commits, 1); assert.equal(nativeResults.discards, 1);
    assert.ok(nativeResults.cachedExport); assert.equal(nativeResults.httpCalls, 0); assert.equal(nativeResults.hasText, false);
    assert.equal(nativeResults.savedKey, 'a'.repeat(64)); assert.ok(nativeResults.automaticSkipped);
    assert.ok(nativeResults.diagnostic.includes('HTTP 404')); assert.ok(!nativeResults.diagnostic.includes('private-fixture'));
    await page.route('**/large-native.xml', route => route.fulfill({ contentType: 'application/xml', body: '<tv>' + epgXml('Irrelevant').replace('fixture-a', 'unrelated').replace('<tv>', '').replace('</tv>', '').repeat(15000) + epgXml('Relevant').replace('<tv>', '').replace('</tv>', '') + '</tv>' }));
    const largeEpg = await page.evaluate(async url => { const parsed = await parseEpgOffThread({ url }); return { size: parsed.size, kept: parsed.stats.kept, total: parsed.stats.programmes }; }, origin + '/large-native.xml');
    assert.deepEqual(largeEpg, { size: 1, kept: 1, total: 15001 });
    const diagnostics = await page.evaluate(async () => {
      const timestamp = ms => new Date(ms).toISOString().slice(0, 19).replace(/[-:T]/g, '') + ' +0000';
      const xml = (channel, start, stop) => '<tv><programme channel="' + channel + '" start="' + timestamp(start) + '" stop="' + timestamp(stop) + '"><title>Fixture</title></programme></tv>';
      const result = [];
      for (const text of ['<tv/>', xml('unrelated', Date.now() - 10000, Date.now() + 10000), xml('fixture-a', Date.now() - 4 * 86400000, Date.now() - 3 * 86400000), xml('fixture-a', Date.now() + 86400000, Date.now() + 2 * 86400000)]) {
        const parsed = await parseEpgOffThread(text), source = {}; epgSourceStatus(source, parsed); result.push(source.status);
      }
      const old = state.epg;
      const programme = { start: new Date(Date.now() - 10000), stop: new Date(Date.now() + 10000), title: 'Fixture', channelNames: ['Shared HD'] };
      state.epg = new Map([['one', [programme]], ['two', [programme]]]); reindexEpg();
      const ambiguous = findPrograms({ id: 'missing', name: 'Shared' }).length;
      const exact = findPrograms({ id: 'one', name: 'Shared' }).length;
      state.epg = old; reindexEpg();
      const xspf = parseXspf('<playlist><trackList><track><title>Fixture</title><identifier>provider-123</identifier><location>https://media.example/a</location></track></trackList></playlist>');
      return { statuses: result, ambiguous, exact, tvgId: xspf[0].tvgId };
    });
    assert.deepEqual(diagnostics, { statuses: ['empty', 'unmatched', 'outdated', 'future'], ambiguous: 0, exact: 1, tvgId: 'provider-123' });
    // Export a large LOCAL source intact; omit downloaded network XML by default.
    // Real async serialization must leave the UI responsive and clean up failures.
    const exportResults = await page.evaluate(async () => {
      const original = window.Capacitor, sources = state.epgSources, playlists = state.playlists;
      let chunks = [], active = 0, maxActive = 0, cancelled = 0, fail = '', heartbeats = 0, begins = 0;
      const plugin = {
        beginTextExport: async () => { begins++; chunks = []; return { id: 'fixture-export' }; },
        appendTextExport: async ({ content }) => { active++; maxActive = Math.max(maxActive, active); await new Promise(resolve => setTimeout(resolve, 0)); chunks.push(content); active--; if (fail === 'write') throw new Error('Disk unavailable'); },
        finishTextExport: async () => { if (fail === 'cancel') throw new Error('Save cancelled'); },
        cancelTextExport: async () => { cancelled++; },
      };
      window.Capacitor = { getPlatform: () => 'android', Plugins: { TCLVPlayer: plugin } };
      const timer = setInterval(() => heartbeats++, 0);
      try {
        const large = '#EXTM3U\n' + 'Synthetic "Čas" 😀\n'.repeat(120000);
        state.playlists = [{ id: 'large-local', name: 'local.m3u', source: 'local.m3u', origin: 'local', type: 'm3u', text: large }];
        state.epgSources = [{ id: 'downloaded', name: 'Remote fixture', source: 'https://source.example/epg?token=keep-original-fixture', origin: 'network', active: false, text: '<tv>' + 'x'.repeat(3000000) + '</tv>' }, { id: 'local-epg', name: 'local.xml', source: 'local.xml', origin: 'local', text: '<tv/>' }];
        dom.includeEpgCache.checked = false;
        const pending = exportSettings(); await exportSettings(); await pending;
        const data = JSON.parse(chunks.join(''));
        const result = { localIntact: data.playlists[0].text === large, localEpg: data.epgSources[1].text, cacheOmitted: !Object.hasOwn(data.epgSources[0], 'text'), originalUrl: data.epgSources[0].source, maxChunk: Math.max(...chunks.map(chunk => chunk.length)), maxActive, heartbeats, begins };
        dom.includeEpgCache.checked = true; await exportSettings();
        result.optionalCacheIntact = JSON.parse(chunks.join('')).epgSources[0].text === state.epgSources[0].text;
        fail = 'cancel'; await exportSettings(); result.cancelMessage = dom.backupStatus.textContent;
        fail = 'write'; await exportSettings(); result.failureMessage = dom.backupStatus.textContent;
        result.cancelled = cancelled; result.enabled = !dom.exportSettings.disabled;
        return result;
      } finally { clearInterval(timer); window.Capacitor = original; state.epgSources = sources; state.playlists = playlists; dom.includeEpgCache.checked = false; }
    });
    assert.ok(exportResults.localIntact && exportResults.optionalCacheIntact && exportResults.cacheOmitted);
    assert.equal(exportResults.localEpg, '<tv/>'); assert.ok(exportResults.originalUrl.endsWith('token=keep-original-fixture'));
    assert.ok(exportResults.maxChunk <= 98304); assert.equal(exportResults.maxActive, 1);
    assert.ok(exportResults.heartbeats > 10); assert.equal(exportResults.begins, 1);
    assert.equal(exportResults.cancelled, 2); assert.ok(exportResults.enabled);
    assert.ok(exportResults.cancelMessage.includes('zrušen')); assert.ok(exportResults.failureMessage.includes('nepodarilo'));
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
      // A saved remote proxy can be explicitly disabled; a failed source must not
      // silently fall back to the site's Vercel function afterwards.
      const proxyRequests = [];
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/proxy') proxyRequests.push(request.url()); });
      await page.evaluate(() => { state.corsProxy = dom.corsProxyInput.value = location.origin + '/api/proxy?url='; openSettings(); });
      await page.locator('#bridgeLocalOnly').click();
      const bypass = await page.evaluate(async () => {
        const proxy = state.corsProxy; let rejected = false;
        try { await loadTextFromUrl('https://source.example/no-cors.xml', { forceReload: true }); } catch { rejected = true; }
        closeSettings(); return { proxy, rejected };
      });
      assert.deepEqual(bypass, { proxy: '', rejected: true }); assert.equal(proxyRequests.length, 0);
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
      assert.equal(proxyRequests.length, 0, 'Video and its bridge fallback must never call the Vercel proxy');
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => openSettings());
    const epgActionsFit = await page.locator('.epg-source-actions').evaluate(row => row.scrollWidth <= row.clientWidth);
    assert.ok(epgActionsFit, 'EPG actions must wrap on narrow Android/phone settings');
    assert.deepEqual(errors, []); console.log('Browser integration passed: D-pad, modal isolation, local persistence/export, invalid import, EPG worker, virtual channels.');
  } finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
