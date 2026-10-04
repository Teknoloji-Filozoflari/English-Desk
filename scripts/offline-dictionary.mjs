import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizePos, normalizeWord } from './cefr.mjs';

const entries = JSON.parse(readFileSync(fileURLToPath(new URL('../resources/offline-wordnet.json', import.meta.url)), 'utf8'));
const types = ['noun', 'verb', 'adjective', 'adverb'];

export function lookupOffline(word, requestedType = '') {
  const key = normalizeWord(word);
  const type = normalizePos(requestedType);
  const matches = (type ? [type] : types).filter(pos => entries[`${key}|${pos}`]);
  // An unspecified part of speech should never pick an arbitrary sense.
  if (matches.length !== 1) return null;
  const selected = matches[0];
  const entry = entries[`${key}|${selected}`];
  return {
    definition: entry.definition,
    example: entry.example ?? '',
    type: selected,
    synonyms: [], antonyms: [],
    sources: 'Princeton WordNet 3.0 (çevrimdışı): https://wordnet.princeton.edu/license-and-commercial-use',
  };
}
