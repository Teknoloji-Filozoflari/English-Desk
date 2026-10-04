import test from 'node:test';
import assert from 'node:assert/strict';
import { correct, examCollection, exampleTests, score, validateExamTest, validateExams } from '../src/exams.ts';
import { validateNotebook } from '../src/model.ts';

test('sınavlar ve yarım oturum cevapları yedek turunda kayıpsız korunur', () => {
  const test = exampleTests()[0];
  const attempt = { id: 'a1', test, mode: 'exam', answers: { y1: 'Although' }, flags: ['y2'], position: 1, elapsed: 25, finished: false, created: Date.now() };
  const notebook = { version: 1, stories: [], words: [], grammar: [], exams: { tests: [test], attempts: [attempt] } };
  const loaded = validateNotebook(JSON.parse(JSON.stringify(notebook)));
  assert.deepEqual(loaded.exams, notebook.exams);
  assert.deepEqual(score(attempt), { right: 1, wrong: 0, blank: 2, total: 3 });
  assert.equal(validateNotebook({ version: 1, stories: [], words: [], grammar: [] }).exams, undefined);
});

test('cevap anahtarı seçeneklerde yoksa ve oturum bozuksa kayıt reddedilir', () => {
  const test = exampleTests()[0];
  assert.throws(() => validateExamTest({ ...test, questions: [{ ...test.questions[0], answer: 'invalid' }] }));
  assert.throws(() => validateExamTest({ ...test, questions: [test.questions[0], test.questions[0]] }));
  assert.throws(() => validateExams({ tests: [test], attempts: [{ id: 'a', test, mode: 'exam', answers: { missing: 'answer' }, flags: [], position: 0, elapsed: 0, created: 1, finished: false }] }));
});

test('test düzenlense veya silinse de sonuçtaki soru kopyası korunur', () => {
  const original = exampleTests()[1];
  const attempt = { id: 'a1', test: original, mode: 'study', answers: { i1: 'True', i2: 'True', i3: ' saturdays ' }, flags: [], position: 2, elapsed: 60, finished: true, created: 1 };
  const data = validateExams({ tests: [], attempts: [attempt] });
  assert.equal(correct(original.questions[2], ' Saturdays '), true);
  assert.deepEqual(score(data.attempts[0]), { right: 2, wrong: 1, blank: 0, total: 3 });
  assert.equal(data.attempts[0].test.questions.length, 3);
});

test('ÖSYM ve diğer kaynaklar yedekte ve oturumda ayrı korunur', () => {
  const official = { ...exampleTests()[0], collection: 'osym', source: 'ÖSYM; 2025_yds_1.pdf' };
  const other = { ...official, id: 'practice', collection: 'other' };
  const attempt = { id: 'a1', test: official, mode: 'exam', answers: {}, flags: [], position: 0, elapsed: 0, finished: false, created: 1 };
  const loaded = validateExams(JSON.parse(JSON.stringify({ tests: [official, other], attempts: [attempt] })));
  assert.equal(examCollection(loaded.tests[0]), 'osym');
  assert.equal(examCollection(loaded.tests[1]), 'other');
  assert.equal(loaded.attempts[0].test.collection, 'osym');
  const legacy = { ...official }; delete legacy.collection;
  assert.equal(examCollection(legacy), 'osym');
  assert.equal(examCollection(exampleTests()[0]), 'other');
  assert.throws(() => validateExamTest({ ...official, collection: 'invalid' }));
});
