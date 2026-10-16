import { readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const parts = version.split('.').map(Number);
if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 999)) throw new Error('Use a stable major.minor.patch version; each component must be 0–999.');
const tag = process.env.GITHUB_REF;
if (tag?.startsWith('refs/tags/v') && tag !== 'refs/tags/v' + version) throw new Error('Release tag and package version do not match.');
console.log('Version metadata is consistent:', version);
