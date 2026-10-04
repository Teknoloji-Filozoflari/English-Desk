import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { turkishTranslations } from '../scripts/wiktionary.mjs';
import { createDictionaryService } from '../scripts/dictionary.mjs';

test('Wiktionary yalnız İngilizce ve doğru türdeki Türkçe karşılıkları seçer', () => {
  const text = '==English==\n===Noun===\n====Translations====\n* Turkish: {{t|tr|isim}}\n===Adverb===\n====Translations====\n* Turkish: {{t+|tr|yaklaşık}}, {{t+|tr|takriben}}\n==French==\n===Adverb===\n====Translations====\n* Turkish: {{t|tr|yanlış}}';
  assert.deepEqual(turkishTranslations(text, 'adverb'), ['yaklaşık', 'takriben']);
  assert.deepEqual(turkishTranslations(text, 'verb'), []);
});

test('Türkçe sözlük karşılığı bozuk açıklama çevirisinin yerine geçer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'english-wiktionary-'));
  try {
    const fetcher = async url => new Response(JSON.stringify(url.includes('wiktionary.org')
      ? { parse: { wikitext: '==English==\n===Adverb===\n====Translations====\n* Turkish: {{t+|tr|yaklaşık}}' } }
      : [{ meanings: [{ partOfSpeech: 'adverb', definitions: [{ definition: 'Imprecise but close to in quantity or amount.' }] }] }]));
    const lookup = createDictionaryService({ directory, useWiktionary: true, fetcher, translate: async () => ['Imprecise but close to in amount or amount.', ''] });
    const result = await lookup({ word: 'approximately', type: 'adverb' });
    assert.equal(result.meaning, 'yaklaşık');
    assert.match(result.sources, /English Wiktionary/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
