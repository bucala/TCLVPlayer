/* global importScripts, sax */
"use strict";
importScripts('../vendor/sax/sax.js', './parsers.js');
self.onmessage = function(event) {
  const { id, text } = event.data;
  try {
    const wanted = new Set(event.data.wanted || []);
    const earliest = Date.now() - (event.data.pastDays || 2) * 86400000;
    const latest = Date.now() + 14 * 86400000;
    const parser = sax.parser(true, { trim: false, normalize: false });
    const names = new Map(), epg = new Map();
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
        if (name === 'display-name' && channelId) names.set(channelId, content.trim());
        if (programme) {
          const key = { 'sub-title': 'subTitle', 'episode-num': 'episode' }[name] || name;
          if (!programme[key]) programme[key] = content.trim();
        }
        field = ''; content = '';
      }
      if (name === 'channel') channelId = '';
      if (name === 'programme' && programme) {
        if (programme.start && programme.stop && programme.stop > programme.start && programme.stop >= earliest && programme.start <= latest &&
            (!wanted.size || wanted.has(self.TCLVParsers.normalizeId(programme.channelId)) || wanted.has(self.TCLVParsers.normalizeId(names.get(programme.channelId))))) {
          if (!epg.has(programme.channelId)) epg.set(programme.channelId, []);
          epg.get(programme.channelId).push(programme);
        }
        programme = null;
      }
    };
    // SAX works off the UI thread and does not resolve external XML entities.
    parser.write(text).close();
    // SAX may accept a stream truncated inside an opening tag. Never replace a
    // working guide with an incomplete XMLTV response or a provider login page.
    if (!rootSeen || !rootClosed || depth !== 0) throw new Error('Incomplete XMLTV');
    for (const [key, programs] of epg) {
      programs.sort((a, b) => a.start - b.start);
      for (const program of programs) { program.channelName = names.get(key) || ''; program.title ||= '—'; }
    }
    self.postMessage({ id, entries: [...epg] });
  } catch { self.postMessage({ id, error: true }); }
};
