import { describe, it, expect } from 'vitest';
import epg from '../lib/epg.js';
const now = Date.UTC(2026, 9, 17, 12);
const programme = (id, title, start = now - 1000, stop = now + 1000, source = '') => ({ channelId: id, title, start: new Date(start), stop: new Date(stop), epgSource: source });
const find = (entries, channel) => epg.programsFor(epg.buildIndex(new Map(entries)), channel, [], now);
describe('EPG station identity and source selection', () => {
  it('uses a current same-country SD feed when the exact HD feed has expired', () => {
    const old = programme('Fíxture HD.sk', 'Expired', now - 10000, now - 5000);
    const current = programme('Fixture.sk', 'Current');
    const foreign = programme('Fixture.cz', 'Other country');
    expect(find([['Fíxture HD.sk', [old]], ['Fixture.sk', [current]], ['Fixture.cz', [foreign]]], { id: 'local', tvgId: 'Fíxture HD.sk', name: 'Fixture' })).toEqual([current]);
  });
  it('keeps countries separate and never guesses between unrelated station IDs', () => {
    const sk = programme('Fixture.sk', 'SK'), cz = programme('Fixture.cz', 'CZ');
    expect(find([['Fixture.sk', [sk]], ['Fixture.cz', [cz]]], { id: 'local', name: 'Fixture' })).toEqual([]);
    expect(find([['Fixture.sk', [sk]], ['Fixture.cz', [cz]]], { id: 'local', name: 'Fixture', tvgCountry: 'sk' })).toEqual([sk]);
    const shared = id => ({ ...programme(id, id), channelNames: ['Shared HD'] });
    expect(find([['one', [shared('one')]], ['two', [shared('two')]]], { id: 'local', name: 'Shared' })).toEqual([]);
  });
  it('keeps a normalized exact ID ahead of ambiguous display-name aliases', () => {
    const one = { ...programme('PróviderOne.sk', 'One'), channelNames: ['Shared'] };
    const two = { ...programme('ProviderTwo.sk', 'Two'), channelNames: ['Shared'] };
    expect(find([['PróviderOne.sk', [one]], ['ProviderTwo.sk', [two]]], { id: 'local', tvgId: 'providerone.sk', name: 'Shared' })).toEqual([one]);
  });
  it('selects one complete schedule per source and honours the playlist source while current', () => {
    const a = programme('Fixture.sk', 'A', now - 1000, now + 2000, 'https://source.example/a.xml');
    const b = programme('Fixture.sk', 'B', now - 1000, now + 5000, 'https://source.example/b.xml.gz');
    expect(find([['Fixture.sk', [a, b]]], { id: 'local', tvgId: 'Fixture.sk', tvgUrl: 'https://source.example/a.xml.gz' })).toEqual([a]);
    expect(find([['Fixture.sk', [a, b]]], { id: 'local', tvgId: 'Fixture.sk' })).toEqual([b]);
  });
  it('keeps a running programme visible after an overlapping short entry expires', () => {
    const long = programme('Fixture', 'Long', now - 10000, now + 10000);
    const short = programme('Fixture', 'Short', now - 5000, now - 1000);
    expect(epg.activeProgram([long, short], now)).toEqual(long);
  });
  it('prefers advertised public Open-EPG gzip companions without rewriting credentials or arbitrary providers', () => {
    expect(epg.downloadUrls('https://www.open-epg.com/files/slovakia2.xml')).toEqual(['https://www.open-epg.com/files/slovakia2.xml.gz', 'https://www.open-epg.com/files/slovakia2.xml']);
    expect(epg.downloadUrls('https://source.example/guide.xml?token=fixture')).toEqual(['https://source.example/guide.xml?token=fixture']);
    expect(epg.downloadUrls('https://source.example/guide.xml.gz?token=fixture')).toEqual(['https://source.example/guide.xml.gz?token=fixture', 'https://source.example/guide.xml?token=fixture']);
    expect(epg.downloadUrls('https://www.open-epg.com/files/slovakia2.xml?token=fixture')).toHaveLength(1);
  });
});
