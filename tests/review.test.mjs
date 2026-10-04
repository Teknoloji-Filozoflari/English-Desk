import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue, reviewWord } from '../src/review.ts';
import { validateNotebook } from '../src/model.ts';

const word = { id: 'w1', word: 'book', meaning: 'kitap', type: 'noun', synonyms: '', antonyms: '', example: '', translation: '', storyId: '' };

test('kelime tekrarı zamanı ve yedek turu korunur', () => {
  const now = 1_800_000_000_000;
  assert.equal(isDue(word, now), true);
  const learned = reviewWord(word, 'good', now);
  assert.equal(isDue(learned, now), false);
  assert.equal(isDue(learned, now + 86_400_000), true);
  const second = reviewWord(learned, 'good', now + 86_400_000);
  assert.ok(second.review.interval > learned.review.interval);
  const again = reviewWord(second, 'again', now + 86_400_000);
  assert.equal(again.review.repetitions, 0);
  const backup = validateNotebook({ version: 1, stories: [{ id: 's1', title: 'Story', text: 'Text', level: 'A1', read: false }], words: [again], grammar: [], storyNotes: [] });
  assert.deepEqual(backup.words[0].review, again.review);
});
