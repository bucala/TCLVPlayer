"use strict";
(function(root) {
  const PLAYERS = new Set(['native', 'html5', 'videojs', 'artplayer', 'flvjs', 'jplayer', 'vlc', 'mpv']);
  const MAX_TEXT = 64 * 1024 * 1024;
  function string(value, label, max = 8192) {
    if (typeof value !== 'string' || value.length > max) throw new Error('Invalid ' + label);
    return value;
  }
  function sourceUrl(value) {
    const url = new URL(string(value, 'source URL'));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) source URLs are supported');
    return value;
  }
  function records(value, epg = false) {
    if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid source list');
    const ids = new Set();
    return value.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid source record');
      const id = string(item.id, 'source ID', 160);
      if (!/^[\w.-]+$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate source ID');
      ids.add(id);
      const origin = item.origin || (/^https?:\/\//i.test(item.source || '') ? 'network' : 'local');
      if (!['local', 'network'].includes(origin)) throw new Error('Invalid source origin');
      const result = { id, name: string(item.name, 'source name', 512), origin,
        source: origin === 'network' ? sourceUrl(item.source) : string(item.source || item.name, 'filename', 512) };
      if (item.text !== undefined) result.text = string(item.text, 'local source content', MAX_TEXT);
      if (Number.isFinite(item.fetchedAt) && item.fetchedAt >= 0) result.fetchedAt = item.fetchedAt;
      if (epg && typeof item.nativeCache === 'string' && /^[a-f0-9]{64}$/.test(item.nativeCache)) result.nativeCache = item.nativeCache;
      // v1 files can lack local content. Keep the record for explicit re-import, never fetch a filename.
      if (epg) {
        if (item.active !== undefined && typeof item.active !== 'boolean') throw new Error('Invalid EPG active flag');
        result.active = item.active !== false;
      } else {
        if (!['m3u', 'xspf'].includes(item.type)) throw new Error('Invalid playlist type');
        result.type = item.type;
      }
      return result;
    });
  }
  function validateBackup(data) {
    if (!data || ![1, 2].includes(data.version)) throw new Error('Unsupported backup version');
    const playlists = records(data.playlists === undefined ? [] : data.playlists);
    const epgSources = records(data.epgSources === undefined ? [] : data.epgSources, true);
    for (const source of epgSources) delete source.nativeCache; // Device-local cache paths never transfer in backups.
    const favorites = data.favorites === undefined ? [] : data.favorites;
    if (!Array.isArray(favorites) || favorites.length > 100000 || favorites.some(id => typeof id !== 'string' || id.length > 160)) throw new Error('Invalid favourites');
    const language = data.language || 'sk';
    if (!['sk', 'en'].includes(language)) throw new Error('Invalid language');
    if (data.player !== undefined && !PLAYERS.has(data.player)) throw new Error('Invalid player');
    const players = {};
    const keys = { web: 'web-https', webHttp: 'web-http', webHttps: 'web-https', windows: 'electron', android: 'android', 'web-http': 'web-http', 'web-https': 'web-https', electron: 'electron' };
    if (data.players !== undefined && (!data.players || typeof data.players !== 'object' || Array.isArray(data.players))) throw new Error('Invalid players');
    for (const [key, value] of Object.entries(data.players || {})) {
      if (!value) continue;
      if (!Object.prototype.hasOwnProperty.call(keys, key) || !PLAYERS.has(value)) throw new Error('Invalid platform player');
      players[keys[key]] = value;
      if (key === 'web') players['web-http'] = value;
    }
    const corsProxy = data.corsProxy === undefined ? '' : string(data.corsProxy, 'proxy');
    if (corsProxy && !/^https?:$/.test(new URL(corsProxy, root.location?.origin || 'https://app.invalid').protocol)) throw new Error('Invalid proxy protocol');
    const activePlaylistId = playlists.some(p => p.id === data.activePlaylistId) ? data.activePlaylistId : playlists[0]?.id || null;
    return { version: 2, playlists, epgSources, activePlaylistId, favorites, language, player: data.player, players, corsProxy };
  }
  let database;
  async function db() {
    if (!root.indexedDB) throw new Error('Local database unavailable. Allow site storage before importing.');
    if (!database) database = new Promise((resolve, reject) => {
      const request = root.indexedDB.open('tclv.private.v2', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('private');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { database = null; reject(request.error); };
    });
    return database;
  }
  async function saveSnapshot(data) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('private', 'readwrite');
      transaction.objectStore('private').put({ playlists: records(data.playlists), epgSources: records(data.epgSources, true) }, 'sources');
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Could not save local data'));
    });
  }
  async function loadSnapshot() {
    try {
      const database = await db();
      return await new Promise((resolve, reject) => {
        const request = database.transaction('private').objectStore('private').get('sources');
        request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
      });
    } catch { return null; }
  }
  const api = { validateBackup, records, saveSnapshot, loadSnapshot };
  if (typeof module !== 'undefined') module.exports = api; else root.TCLVStorage = api;
})(globalThis);
