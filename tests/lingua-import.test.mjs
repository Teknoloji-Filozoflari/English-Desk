import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLinguaText } from '../scripts/import-lingua-level.mjs';

test('Lingua metninden yalnızca başlık ve hikâye çıkarılır', () => {
  const raw = `T: 27.01.2024 12:12:04 / U: abc / OT: 123

My Day (A1)
First line wraps
onto the next line.

Second paragraph is long enough to represent a real story extracted from the source PDF.

Did you understand the text?
1) A question?
Source: https://example.com
Solution: 1) a`;
  assert.deepEqual(parseLinguaText(raw, 'A1'), {
    title: 'My Day',
    text: 'First line wraps onto the next line.\n\nSecond paragraph is long enough to represent a real story extracted from the source PDF.',
  });
});
