import type { Notebook, Word } from './model';
import { lookupVerbForms } from './verb-forms.ts';
import { isVerbType } from './word-types.ts';

export type WordLookup = {
  word: string; meaning: string; definition: string; type: string; synonyms: string; antonyms: string;
  example: string; translation: string; level: string; levelSource: string; sources: string; warnings: string[];
};
export const normalizeWord = (value: string) => value.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
export function relatedWords(word: Pick<Word, 'word' | 'synonyms' | 'antonyms'>): string[] {
  const items = `${word.synonyms},${word.antonyms}`.replace(/\([^)]*\)/g, '').split(/[,;\n]+/).map(normalizeWord);
  return [...new Set(items)].filter(value => value !== normalizeWord(word.word) && /^[a-z]+(?:[ '\-][a-z]+)*$/.test(value) && value.length <= 100);
}
export function mergeLookup(current: Word, result: WordLookup): Word {
  const next = { ...current };
  for (const field of ['meaning', 'definition', 'type', 'example', 'sources'] as const) {
    if (!next[field]?.trim() && result[field]) next[field] = result[field];
  }
  // A dictionary example translation must never be paired with the user's different example.
  if (!next.translation && normalizeWord(next.example) === normalizeWord(result.example)) next.translation = result.translation;
  if (!current.example?.trim() && result.example && result.sources) next.sources = [...new Set([current.sources, result.sources].filter(Boolean).flatMap(source => source!.split('\n')))].join('\n');
  if (!next.level) { next.level = result.level || ''; next.levelSource = result.levelSource; }
  if (isVerbType(next.type)) {
    const forms = lookupVerbForms(next.word);
    if (forms && !next.verbForms?.past && !next.verbForms?.participle) next.verbForms = forms;
  }
  return next;
}
export function addRelatedCards(data: Notebook, parent: Word, makeId: () => string): Notebook {
  const seen = new Set(data.words.map(word => normalizeWord(word.word)));
  const added: Word[] = [];
  for (const name of relatedWords(parent)) {
    if (seen.has(name)) continue;
    seen.add(name);
    added.push({ id: makeId(), word: name, meaning: '', type: parent.type, synonyms: '', antonyms: '', example: '', translation: '', storyId: '', level: '', generatedFrom: parent.word });
  }
  return { ...data, words: [...data.words, ...added] };
}
