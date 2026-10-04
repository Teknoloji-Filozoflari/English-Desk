import { normalizePos } from './cefr.mjs';

const partOfSpeech = new Set(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'determiner', 'article', 'numeral']);

// Only read Turkish translation templates inside the English entry and the requested part of speech.
export function turkishTranslations(wikitext, requestedType = '') {
  if (typeof wikitext !== 'string') return [];
  const english = wikitext.match(/(?:^|\n)==English==\s*\n([\s\S]*?)(?=\n==[^=\n]+==|$)/)?.[1] ?? '';
  const requested = normalizePos(requestedType);
  let currentType = '', inTranslations = false;
  const found = [];
  for (const line of english.split('\n')) {
    const heading = line.match(/^(={3,5})([^=\n]+)\1\s*$/);
    if (heading) {
      const label = heading[2].trim().toLowerCase();
      if (heading[1].length === 3) currentType = '';
      if (partOfSpeech.has(label)) currentType = label;
      inTranslations = label === 'translations';
      continue;
    }
    if (!inTranslations || (requested && currentType !== requested) || !/^\*+\s*Turkish\s*:/.test(line)) continue;
    for (const match of line.matchAll(/\{\{t(?:\+|-check)?\|tr\|([^|{}]+)(?:\|[^{}]*)?\}\}/g)) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value && value.length <= 100 && !found.includes(value)) found.push(value);
      if (found.length === 3) return found;
    }
  }
  return found;
}
