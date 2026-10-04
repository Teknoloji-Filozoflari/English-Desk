import { addRelatedCards, mergeLookup, normalizeWord, relatedWords } from '../src/word-enrichment.ts';
import { randomUUID } from 'node:crypto';
const base = 'http://127.0.0.1:8081';
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? response.status); return result;
}
let saved = await api('/api/notebook');
if (!saved.data) throw new Error('Önce uygulamayı açıp defteri oluştur.');
const queue = saved.data.words.map(word => word.id), seen = new Set();
for (let cursor = 0; cursor < queue.length; cursor++) {
  const item = saved.data.words.find(word => word.id === queue[cursor]);
  if (!item || seen.has(normalizeWord(item.word))) continue;
  seen.add(normalizeWord(item.word));
  console.log(`${cursor + 1}/${queue.length}: ${item.word}`);
  const result = await api('/api/words/lookup', 'POST', { word: item.word, type: item.type, example: item.example });
  const merged = mergeLookup(item, result);
  let next = { ...saved.data, words: saved.data.words.map(word => word.id === item.id ? merged : word) };
  // Enrichment never creates cards; only explicit editor saves do.
  saved = await api('/api/notebook', 'PUT', { data: next, revision: saved.revision });
  if (result.warnings.length) console.log(result.warnings.join('\n'));
  if (!merged.generatedFrom) {
    const names = new Set(relatedWords(merged));
    for (const word of saved.data.words) if (names.has(normalizeWord(word.word)) && !seen.has(normalizeWord(word.word)) && !queue.includes(word.id)) queue.push(word.id);
  }
}
console.log(`${seen.size} kelime işlendi. ${saved.data.words.length} kart dosyaya kaydedildi.`);
