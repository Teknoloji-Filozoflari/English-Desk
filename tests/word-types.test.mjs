import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerbType, wordTypeKey } from '../src/word-types.ts';
import { validateNotebook } from '../src/model.ts';

test('eski Türkçe ve İngilizce türler aynı filtreye düşer', () => {
  assert.equal(wordTypeKey('Sıfat'), 'adjective');
  assert.equal(wordTypeKey('Phrasal verb'), 'phrasal verb');
  assert.equal(wordTypeKey('İsim'), 'noun');
  assert.equal(wordTypeKey(''), 'pending');
  assert.equal(wordTypeKey('unknown type'), 'other');
  assert.equal(isVerbType('Öbek fiil'), true);
});

test('yedekler fiil biçimlerini korur, geçersiz sınıflandırmayı reddeder', () => {
  const word = { id: 'w1', word: 'give', meaning: 'vermek', type: 'verb', synonyms: '', antonyms: '', example: '', translation: '', storyId: '', verbForms: { base: 'give', past: 'gave', participle: 'given', regularity: 'irregular' } };
  const backup = { version: 1, stories: [], words: [word], grammar: [] };
  assert.deepEqual(validateNotebook(backup).words[0].verbForms, word.verbForms);
  assert.throws(() => validateNotebook({ ...backup, words: [{ ...word, verbForms: { ...word.verbForms, regularity: 'maybe' } }] }));
});
