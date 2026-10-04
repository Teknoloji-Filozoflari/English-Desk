// Build a CEFR subset or, with --full, the complete word/type index from WordNet 3.0.
// Usage: node scripts/build-offline-wordnet.mjs <directory containing data.* and index.*>
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, normalizePos, normalizeWord } from './cefr.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('WordNet dict klasörünü belirt.');
const types = { noun: 'n', verb: 'v', adjective: 'a', adverb: 'r' };
const requested = new Set();
const full = process.argv.includes('--full');
for (const filename of ['cefrj-vocabulary-profile-1.5.csv', 'octanove-vocabulary-profile-c1c2-1.0.csv']) {
  const rows = parseCsv(await readFile(join(root, 'resources', 'cefr', filename), 'utf8')).slice(1);
  for (const [headword, pos] of rows) {
    const type = normalizePos(pos);
    if (!types[type]) continue;
    for (const spelling of headword.split('/')) {
      const word = normalizeWord(spelling);
      if (/^[a-z]+(?:[ '-][a-z]+)*$/.test(word)) requested.add(`${word}|${type}`);
    }
  }
}
const output = {};
for (const [type, suffix] of Object.entries(types)) {
  const indexText = await readFile(join(source, `index.${type === 'adjective' ? 'adj' : type === 'adverb' ? 'adv' : type}`), 'utf8');
  const wantedOffsets = new Map();
  for (const line of indexText.split(/\r?\n/)) {
    if (!line || line.startsWith(' ')) continue;
    const tokens = line.trim().split(/\s+/);
    const word = tokens[0].replaceAll('_', ' ').toLowerCase();
    const key = `${word}|${type}`;
    if ((!full && !requested.has(key)) || tokens[1] !== suffix || !/^[a-z]+(?:[ '-][a-z]+)*$/.test(word)) continue;
    const pointerCount = Number(tokens[3]);
    const offset = tokens[6 + pointerCount];
    if (/^\d{8}$/.test(offset)) wantedOffsets.set(offset, [...(wantedOffsets.get(offset) ?? []), key]);
  }
  const dataText = await readFile(join(source, `data.${type === 'adjective' ? 'adj' : type === 'adverb' ? 'adv' : type}`), 'utf8');
  for (const line of dataText.split(/\r?\n/)) {
    const keys = wantedOffsets.get(line.slice(0, 8));
    if (!keys) continue;
    const gloss = line.split(' | ')[1]?.trim();
    if (!gloss) continue;
    const exampleMatch = /;\s*"([^"]+)"/.exec(gloss);
    const definition = (exampleMatch ? gloss.slice(0, exampleMatch.index) : gloss).trim();
    if (definition) for (const key of keys) if (!output[key]) output[key] = { definition, ...(exampleMatch ? { example: exampleMatch[1] } : {}) };
  }
}
const ordered = Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b, 'en')));
const destination = join(root, 'resources', 'offline-wordnet.json');
await writeFile(destination, JSON.stringify(ordered));
console.log(`WordNet 3.0: ${Object.keys(ordered).length} word/type entries (${full ? 'full' : 'CEFR subset'}); ${destination}`);
