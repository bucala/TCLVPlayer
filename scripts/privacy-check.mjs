import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
// Never enumerate browser profiles or inspect private runtime storage.
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const names = [...new Set([...tracked, ...staged])];
const violations = [];
for (const name of names) {
  if (/\.(m3u8?|xspf|xmltv|xml\.gz|keystore|jks|p12)(\.gz)?$/i.test(name) || /(^|\/)(private|backups|exports|local-data)\//.test(name) || /tclvplayer-(settings.*\.json|epg-list.*\.txt)$/.test(name)) {
    violations.push(name); continue;
  }
  if (!/\.(json|xml|txt)$/i.test(name) || name === 'package-lock.json') continue;
  let text; try { text = await readFile(name, 'utf8'); } catch { continue; }
  if (/^#EXTM3U\b/m.test(text) || /<tv(?:\s|>)/i.test(text) || /"playlists"\s*:\s*\[\s*\{/.test(text)) violations.push(name);
}
if (violations.length) { console.error('Private data/signing files must not be tracked:', violations.join(', ')); process.exitCode = 1; }
else console.log('Privacy check passed: no tracked source lists, backups or signing keys.');
