import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDictionaryService } from '../scripts/dictionary.mjs';

test('yerel sözlükte bulunan kelime başarısız API beklenmeden tamamlanır', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'english-offline-first-'));
  try {
    let calls = 0;
    const lookup = createDictionaryService({ directory, preferOffline: true, useWiktionary: false, fetcher: async () => { calls++; throw new Error('unavailable'); }, translate: async () => ['dürüst', ''] });
    const result = await lookup({ word: 'quiet', type: 'adjective' });
    assert.equal(calls, 0);
    assert.ok(result.definition);
    assert.equal(result.meaning, 'dürüst');
    assert.match(result.sources, /WordNet/);
    assert.ok(!result.warnings.some(warning => warning.includes('Free Dictionary API')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
