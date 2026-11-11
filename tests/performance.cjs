/* global __dirname, process, URL, window, state, dom, reindexEpg, renderGuide, renderChannels, performance, console */
// Fresh browser, synthetic 5,000-channel guide, 240,000 programmes. No provider traffic.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const directory = path.resolve(__dirname, '../dist/vercel');
  const server = http.createServer(async (req, res) => {
    const target = path.resolve(directory, '.' + new URL(req.url, 'http://localhost').pathname);
    if (target !== directory && !target.startsWith(directory + path.sep)) return res.writeHead(403).end();
    try {
      const file = target === directory ? path.join(target, 'index.html') : target;
      res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => !!window.TCLVWebBridge);
    const result = await page.evaluate(() => {
      const start = Math.floor(Date.now() / 1800000) * 1800000 - 7200000;
      state.channels = Array.from({ length: 5000 }, (_, i) => ({ id: 'perf-' + i, name: 'Perf ' + i, url: 'https://media.example/' + i, logo: '' }));
      state.epg = new Map(state.channels.map(ch => [ch.id, Array.from({ length: 48 }, (_, i) => ({
        title: 'Programme ' + i, start: new Date(start + i * 1800000), stop: new Date(start + (i + 1) * 1800000),
      }))]));
      reindexEpg();
      state.epgVisible = true;
      dom.guidePanel.hidden = false;
      const measure = fn => { const begin = performance.now(); fn(); return +(performance.now() - begin).toFixed(2); };
      const channelsMs = measure(renderChannels);
      const guideMs = [measure(renderGuide), measure(renderGuide), measure(renderGuide)];
      return { channels: state.channels.length, programmes: state.epg.size * 48, channelsMs, guideMs,
        channelNodes: dom.channelGrid.querySelectorAll('.channel-card').length,
        guideRows: dom.epgGuide.querySelectorAll('.timeline-row').length,
        guidePrograms: dom.epgGuide.querySelectorAll('.program').length };
    });
    assert.equal(result.channelNodes, 70);
    assert.equal(result.guideRows, 70);
    assert.ok(result.guidePrograms >= 1120);
    console.log(JSON.stringify(result));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
