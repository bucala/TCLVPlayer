import { describe, expect, it } from 'vitest';
import storage from '../lib/storage.js';
const source = { id: 'fixture', name: 'Local fixture', source: 'local.m3u', type: 'm3u', origin: 'local', text: '#EXTM3U\nhttps://media.example/live.m3u8' };
const valid = () => ({ version: 2, playlists: [source], epgSources: [], favorites: ['fixture'], language: 'sk', player: 'native', players: { android: 'native' }, corsProxy: '' });
describe('private, recoverable backup schema', () => {
  it('retains local content and disabled proxy, repairing stale selection', () => {
    const result = storage.validateBackup({ ...valid(), activePlaylistId: 'removed' });
    expect(result.playlists[0].text).toBe(source.text);
    expect(result.activePlaylistId).toBe(source.id);
    expect(result.corsProxy).toBe('');
  });
  it('retains credentials for explicit local file backup without substituting placeholders', () => {
    const url = 'https://provider.example/get.php?username=fixture&password=fixture-secret&type=m3u';
    const data = valid(); data.playlists = [{ ...source, origin: 'network', source: url }];
    expect(storage.validateBackup(data).playlists[0].source).toBe(url);
    expect(storage.validateBackup(data).playlists[0].text).toBe(source.text);
  });
  it.each([[null], [17], [{ ...source, source: 12 }], [source, source], [{ ...source, id: '"]invalid' }]].map(records => [records]))('rejects malformed source records before any persistence: %j', records => {
    expect(() => storage.validateBackup({ ...valid(), playlists: records })).toThrow();
  });
  it.each(['file:///private/list.m3u', 'javascript:alert(1)', 'data:text/plain,example'])('rejects unsafe network URL %s', sourceUrl => {
    expect(() => storage.validateBackup({ ...valid(), playlists: [{ ...source, origin: 'network', source: sourceUrl }] })).toThrow();
  });
  it('rejects unsupported player/version/favourites and wrong EPG active types', () => {
    for (const patch of [{ version: 999 }, { player: 'unknown' }, { favorites: [{}] }, { language: 'unknown' }, { epgSources: [{ ...source, active: 'false' }] }]) {
      expect(() => storage.validateBackup({ ...valid(), ...patch })).toThrow();
    }
  });
  it('accepts legacy metadata-only backup without fetching local filenames', () => {
    const legacy = { ...source }; delete legacy.text;
    expect(storage.validateBackup({ ...valid(), version: 1, playlists: [legacy] }).playlists[0].origin).toBe('local');
  });
});
