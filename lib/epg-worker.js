/* global importScripts, sax */
"use strict";
importScripts('../vendor/sax/sax.js', './parsers.js', './epg.js');
self.onmessage = async function(event) {
  const { id, text } = event.data;
  try {
    const now = Date.now(), matches = new Map();
    const wanted = new Set(event.data.wanted || []);
    const countries = new Map(event.data.countries || []);
    const earliest = now - (event.data.pastDays || 2) * 86400000;
    const latest = now + 14 * 86400000;
    const parser = sax.parser(true, { trim: false, normalize: false });
    const names = new Map(), epg = new Map();
    const stats = { programmes: 0, kept: 0, current: 0, first: null, last: null };
    let channelId = '', programme = null, field = '', content = '', depth = 0, rootSeen = false, rootClosed = false;
    parser.onopentag = node => {
      if (depth === 0) { if (rootSeen || node.name !== 'tv') throw new Error('Expected XMLTV root'); rootSeen = true; }
      depth++;
      if (node.name === 'channel') channelId = node.attributes.id || '';
      if (node.name === 'programme') programme = { channelId: node.attributes.channel || '', start: self.TCLVParsers.parseXmlTvDate(node.attributes.start), stop: self.TCLVParsers.parseXmlTvDate(node.attributes.stop) };
      if (['display-name', 'title', 'sub-title', 'desc', 'category', 'episode-num', 'date'].includes(node.name)) { field = node.name; content = ''; }
    };
    parser.ontext = parser.oncdata = value => { if (field) content += value; };
    parser.onclosetag = name => {
      depth--; if (depth === 0 && name === 'tv') rootClosed = true;
      if (name === field) {
        if (name === 'display-name' && channelId) { if (!names.has(channelId)) names.set(channelId, []); if (names.get(channelId).length < 32) names.get(channelId).push(content.trim()); }
        if (programme) {
          const key = { 'sub-title': 'subTitle', 'episode-num': 'episode' }[name] || name;
          if (!programme[key]) programme[key] = content.trim();
        }
        field = ''; content = '';
      }
      if (name === 'channel') channelId = '';
      if (name === 'programme' && programme) {
        stats.programmes++;
        if (!matches.has(programme.channelId)) {
          const channelNames = names.get(programme.channelId) || [];
          const country = self.TCLVEpg.country(programme.channelId) || channelNames.map(self.TCLVEpg.country).find(Boolean) || '';
          matches.set(programme.channelId, [programme.channelId, ...channelNames].some(value => self.TCLVParsers.epgKeys(value).some(key =>
            wanted.has(key) && (!country || !countries.has(key) || countries.get(key).includes('') || countries.get(key).includes(country)))));
        }
        if (programme.start && programme.stop) { stats.first = Math.min(stats.first ?? +programme.start, +programme.start); stats.last = Math.max(stats.last ?? +programme.stop, +programme.stop); }
        if (programme.start && programme.stop && programme.stop > programme.start && programme.stop >= earliest && programme.start <= latest &&
            matches.get(programme.channelId)) {
          if (!epg.has(programme.channelId)) epg.set(programme.channelId, []);
          epg.get(programme.channelId).push(programme);
          stats.kept++;
          if (programme.start <= now && programme.stop > now) stats.current++;
        }
        programme = null;
      }
    };
    // SAX works off the UI thread and does not resolve external XML entities.
    if (event.data.url) {
      const response = await fetch(event.data.url);
      if (!response.ok) throw new Error('Cached EPG unavailable');
      const reader = response.body.getReader(), decoder = new globalThis.TextDecoder(); let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          total += value.byteLength; if (total > 64 * 1024 * 1024) throw new Error('Source too large');
          parser.write(decoder.decode(value, { stream: true }));
        }
        parser.write(decoder.decode()).close();
      } finally { await reader.cancel().catch(() => {}); }
    } else {
      // Chunk SAX input too; never retain an additional copy of the entire body.
      for (let start = 0; start < text.length; start += 65536) parser.write(text.slice(start, start + 65536));
      parser.close();
    }
    // SAX may accept a stream truncated inside an opening tag. Never replace a
    // working guide with an incomplete XMLTV response or a provider login page.
    if (!rootSeen || !rootClosed || depth !== 0) throw new Error('Incomplete XMLTV');
    for (const [key, programs] of epg) {
      programs.sort((a, b) => a.start - b.start);
      for (const program of programs) { program.channelNames = names.get(key) || []; program.channelName = program.channelNames[0] || ''; program.title ||= '—'; }
    }
    self.postMessage({ id, entries: [...epg], stats });
  } catch (error) { self.postMessage({ id, error: /large/i.test(error.message) ? 'Source too large' : /cache/i.test(error.message) ? 'Cached EPG unavailable' : 'Invalid XMLTV' }); }
};
