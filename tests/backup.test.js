import { describe, expect, it } from 'vitest';
import backup from '../lib/backup.js';
import storage from '../lib/storage.js';

async function serialize(data) {
  const chunks = [];
  for await (const chunk of backup.chunks(data)) chunks.push(chunk);
  return { chunks, value: JSON.parse(chunks.join('')) };
}
describe('bounded, lossless backup serialization', () => {
  it('preserves escaped XML, Unicode, surrogate boundaries, empty strings and optional fields', async () => {
    const text = 'x'.repeat(16383) + '😀\n"\\\t\u0000' + '\uD800';
    const data = { text, empty: '', optional: undefined, array: [undefined, true, null, 3], nested: { 'číslo': 'ľščť' } };
    expect((await serialize(data)).value).toEqual(JSON.parse(JSON.stringify(data)));
  });
  it('exports multi-megabyte local sources in bounded chunks rather than one huge string', async () => {
    const data = { version: 2, text: '<title>Čas &amp; deň</title>\n'.repeat(150000) };
    const result = await serialize(data);
    expect(result.value).toEqual(data);
    expect(result.chunks.length).toBeGreaterThan(50);
    expect(Math.max(...result.chunks.map(chunk => chunk.length))).toBeLessThanOrEqual(98304);
  });
  it('streams private cached files, including escape expansion, without exposing device cache references', async () => {
    const text = '\u0000"😀'.repeat(50000);
    const result = await serialize({ text: backup.textSource(async function* () { yield text; }) });
    expect(result.value.text).toBe(text);
    expect(Math.max(...result.chunks.map(chunk => chunk.length))).toBeLessThanOrEqual(98304);
    const input = { version: 2, epgSources: [{ id: 'fixture', name: 'Fixture', source: 'https://source.example/guide.xml', origin: 'network', nativeCache: 'a'.repeat(64) }] };
    expect(storage.records(input.epgSources, true)[0].nativeCache).toBe('a'.repeat(64));
    expect(storage.validateBackup(input).epgSources[0]).not.toHaveProperty('nativeCache');
  });
});
