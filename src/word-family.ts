import type { Notebook, Word, WordFamilyMember } from './model.ts';
import { wordTypeKey } from './word-types.ts';
import { normalizeWord } from './word-enrichment.ts';

export function addFamilyCard(data: Notebook, parent: Word, member: WordFamilyMember, makeId: () => string) {
  const existing = data.words.find(w => normalizeWord(w.word) === normalizeWord(member.word) && wordTypeKey(w.type) === wordTypeKey(member.type));
  if (existing) return { data, card: existing };
  const card: Word = { id: makeId(), word: member.word, meaning: member.meaning, type: member.type, synonyms: '', antonyms: '', example: '', translation: '', storyId: '', level: member.level ?? '', levelSource: member.levelSource ?? '', sources: parent.sources, generatedFrom: parent.word, family: [{ word: parent.word, meaning: parent.meaning, type: parent.type, level: parent.level ?? '', levelSource: parent.levelSource ?? '' }, ...(parent.family ?? []).filter(m => normalizeWord(m.word) !== normalizeWord(member.word))] };
  return { data: { ...data, words: [...data.words, card] }, card };
}
