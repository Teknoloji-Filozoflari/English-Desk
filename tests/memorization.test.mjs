import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, calendarDay, learnMemorization, completeMemorization, memorizationDue, nextMemorizationDate, validateMemorization, MEMORIZATION_DAYS } from '../src/memorization.ts';
import { validateNotebook } from '../src/model.ts';

test('adding a word waits for an explicit learning date; all six dates use that date', () => {
  let plan = { addedOn: '2026-10-19', reviews: [] };
  assert.equal(nextMemorizationDate(plan), null);
  assert.equal(memorizationDue(plan, '2026-10-20'), false);
  plan = learnMemorization(plan, '2026-10-21');
  assert.equal(plan.learnedOn, '2026-10-21');
  assert.deepEqual(learnMemorization(plan, '2026-10-22'), plan);
  for (const offset of MEMORIZATION_DAYS) {
    const due = addDays('2026-10-21', offset);
    assert.equal(nextMemorizationDate(plan), due);
    assert.equal(memorizationDue(plan, addDays(due, -1)), false);
    assert.equal(memorizationDue(plan, due), true);
    assert.deepEqual(completeMemorization(plan, addDays(due, -1)), plan);
    plan = completeMemorization(plan, due);
    assert.equal(plan.reviews.at(-1), due);
  }
  assert.equal(nextMemorizationDate(plan), null);
  assert.equal(memorizationDue(plan, '2027-01-01'), false);
  assert.deepEqual(completeMemorization(plan, '2027-01-01'), plan);
});

test('late reviews retain their actual date and cannot skip multiple stages in one day', () => {
  let plan = { addedOn: '2026-01-01', learnedOn: '2026-01-01', reviews: [] };
  assert.equal(memorizationDue(plan, '2026-02-01'), true);
  plan = completeMemorization(plan, '2026-02-01');
  assert.deepEqual(plan.reviews, ['2026-02-01']);
  assert.equal(nextMemorizationDate(plan), '2026-01-04');
  assert.equal(memorizationDue(plan, '2026-02-01'), false);
  assert.deepEqual(completeMemorization(plan, '2026-02-01'), plan);
  assert.equal(memorizationDue(plan, '2026-02-02'), true);
  assert.deepEqual(validateMemorization(plan), plan);
});

test('calendar arithmetic crosses months, leap years and local daylight saving changes', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-28', 3), '2026-03-31');
  assert.equal(calendarDay(new Date(2026, 9, 19, 0, 1)), '2026-10-19');
});

const word = { id: 'w1', word: 'remember', meaning: 'hatırlamak', type: '', synonyms: '', antonyms: '', example: '', translation: '', storyId: '' };
const notebook = { version: 1, stories: [], words: [word], grammar: [] };
test('saving and restoring notebooks preserves memorization and supports older words', () => {
  assert.equal(validateNotebook(notebook).words[0].memorization, undefined);
  const memorization = { addedOn: '2026-10-19', learnedOn: '2026-10-20', reviews: ['2026-10-21'] };
  const restored = validateNotebook(JSON.parse(JSON.stringify({ ...notebook, words: [{ ...word, memorization }] })));
  assert.deepEqual(restored.words[0].memorization, memorization);
});
test('invalid dates, history order and premature reviews are rejected', () => {
  for (const plan of [null, {}, { addedOn: '2026-02-30', reviews: [] },
    { addedOn: '2026-10-19', reviews: ['2026-10-20'] },
    { addedOn: '2026-10-19', learnedOn: '2026-10-18', reviews: [] },
    { addedOn: '2026-10-19', learnedOn: '2026-10-19', reviews: ['2026-10-19'] },
    { addedOn: '2026-10-19', learnedOn: '2026-10-19', reviews: ['2026-11-01', '2026-11-01'] },
    { addedOn: '2026-10-19', learnedOn: '2026-10-19', reviews: Array(7).fill('2027-01-01') }]) {
    assert.throws(() => validateNotebook({ ...notebook, words: [{ ...word, memorization: plan }] }), /ezber/);
  }
});
