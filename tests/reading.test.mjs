import test from 'node:test';
import assert from 'node:assert/strict';
import { reflowPdfText } from '../src/reading-text.ts';
import { tokenize, sentenceAt } from '../src/model.ts';
test('PDF satırları birleşir, paragraflar ve gerçek tireler korunur', () => {
  assert.equal(reflowPdfText('He walks, he\nalways gets tired.\n\nA well-\nknown fact.'), 'He walks, he always gets tired.\n\nA well- known fact.');
  assert.equal(reflowPdfText('un\u00ad\nfortunately'), 'unfortunately');
});
test('Yeniden akıtılan metinde kelime ve cümle konumları doğru kalır', () => {
  const text = reflowPdfText('He walks.\n\nHe is very\nfrustrated.');
  const word = tokenize(text).find(t => t.text === 'frustrated');
  assert.equal(text.slice(word.start, word.end), 'frustrated');
  assert.equal(sentenceAt(text,word.start,word.end), 'He is very frustrated.');
  assert.equal(reflowPdfText(text),text);
});
