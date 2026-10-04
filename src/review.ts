import type { Word } from './model';

const DAY = 86_400_000;
export function isDue(word: Word, now = Date.now()) { return !!word.meaning.trim() && (!word.review || word.review.due <= now); }
export function reviewWord(word: Word, result: 'again' | 'hard' | 'good', now = Date.now()): Word {
  const previous = word.review;
  const interval = result === 'again' ? 0 : result === 'hard' ? 1 : previous?.interval ? Math.min(3650, Math.max(2, Math.round(previous.interval * 2.2))) : 1;
  return { ...word, review: { due: now + (result === 'again' ? 10 * 60_000 : interval * DAY), interval, repetitions: result === 'again' ? 0 : (previous?.repetitions ?? 0) + 1 } };
}
