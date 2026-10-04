import { createComponentLevelLookup } from './component-levels.mjs';
import { loadExtendedLevels } from './extended-levels.mjs';
import { readFileSync } from 'node:fs';

export const normalizeWord = value => value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');
export function normalizePos(value = '') {
  const key = value.trim().toLowerCase();
  return ({ 'sıfat': 'adjective', 'isim': 'noun', 'ad': 'noun', 'fiil': 'verb', 'zarf': 'adverb', 'zamir': 'pronoun', 'edat': 'preposition', 'bağlaç': 'conjunction', 'phrasal verb': 'verb', adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb' })[key] ?? key;
}
// Read CSV including quoted commas and escaped double quotes.
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) rows.push([...row, field.replace(/\r$/, '')]);
  return rows;
}
export function createLevelLookup(datasets) {
  const verbBases = Object.fromEntries([
    ['bring', 'brought'], ['buy', 'bought'], ['think', 'thought'], ['teach', 'taught'],
    ['catch', 'caught'], ['go', 'went gone'], ['come', 'came'], ['do', 'did done'],
    ['be', 'am is are was were been'], ['have', 'has had'], ['take', 'took taken'],
    ['give', 'gave given'], ['see', 'saw seen'], ['write', 'wrote written'],
    ['speak', 'spoke spoken'], ['eat', 'ate eaten'], ['drink', 'drank drunk'],
    ['make', 'made'], ['find', 'found'], ['leave', 'left'], ['feel', 'felt'],
    ['know', 'knew known'], ['get', 'got gotten'], ['tell', 'told'], ['say', 'said'],
    ['run', 'ran'], ['meet', 'met'], ['keep', 'kept'], ['sleep', 'slept'],
    ['lose', 'lost'], ['send', 'sent'], ['build', 'built'], ['stand', 'stood'],
    ['understand', 'understood'], ['choose', 'chose chosen'], ['break', 'broke broken'],
  ].flatMap(([base, forms]) => forms.split(' ').map(form => [form, base])));
  const index = new Map();
  for (const { text, source } of datasets) {
    for (const [headword, pos, level] of parseCsv(text).slice(1)) {
      if (!/^[ABC][12]$/.test(level)) continue;
      for (const spelling of headword.split('/')) {
        const key = normalizeWord(spelling);
        index.set(key, [...(index.get(key) ?? []), { pos: normalizePos(pos), level, source }]);
      }
    }
  }
  return (word, pos = '') => {
    const normalized = normalizeWord(word);
    let rows = index.get(normalized) ?? [];
    if (pos) rows = rows.filter(row => row.pos === normalizePos(pos));
    let base = '';
    if (!rows.length && normalizePos(pos) === 'verb' && verbBases[normalized]) {
      base = verbBases[normalized];
      rows = (index.get(base) ?? []).filter(row => row.pos === 'verb');
    }
    const levels = [...new Set(rows.map(row => row.level))];
    return levels.length === 1 ? { level: levels[0], levelSource: [...new Set(rows.map(row => row.source))].join(' + ') + (base ? ` (${normalized} → ${base}; temel fiilin seviyesi)` : '') } : { level: '', levelSource: '', levelNote: rows.length ? 'Kelime türüne göre birden fazla seviye var.' : 'Seviye listesinde eşleşme bulunamadı.' };
  };
}
const primaryLevelLookup = createLevelLookup([
  { text: readFileSync(new URL('../resources/cefr/cefrj-vocabulary-profile-1.5.csv', import.meta.url), 'utf8'), source: 'CEFR-J 1.5' },
  { text: readFileSync(new URL('../resources/cefr/octanove-vocabulary-profile-c1c2-1.0.csv', import.meta.url), 'utf8'), source: 'Octanove C1/C2 1.0' },
]);

export const lookupLevel = createComponentLevelLookup(loadExtendedLevels(primaryLevelLookup));
