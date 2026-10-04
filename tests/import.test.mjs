import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFile, textFileDraft, textFromPdfItems, checkStoryText } from '../src/story-import-core.ts';
import { groupStories, LEVELS, isLevel, validateNotebook } from '../src/model.ts';

test('Altı CEFR grubu sabit sırada; eski seviyesiz kayıtlar kaybolmaz', () => {
  const story = { id: 'one', title: 'Blue', text: 'A story', level: 'A2', read: false };
  const result = groupStories([story, { ...story, id: 'two', level: 'Belirtilmedi' }]);
  assert.deepEqual(result.groups.map(g => g.level), LEVELS);
  assert.equal(result.groups[1].stories.length, 1);
  assert.equal(result.unassigned.length, 1);
  assert.equal(groupStories([story], 'missing').groups.flatMap(g => g.stories).length, 0);
  assert.equal(isLevel('A1-A2'), false);
  assert.equal(isLevel('C2'), true);
});
test('Seviye değişikliği hikâyeyi yeni gruba taşır; kaynak adı yedekte korunur', () => {
  const story = { id: 'one', title: 'Blue', text: 'A story', level: 'C1', read: false, sourceName: 'Blue.pdf' };
  const data = validateNotebook({ version: 1, stories: [story], words: [], grammar: [] });
  assert.equal(groupStories(data.stories).groups[4].stories[0].id, 'one');
  assert.equal(data.stories[0].sourceName, 'Blue.pdf');
});
test('Dosya türü, boyutu ve boş metin kaydedilmeden reddedilir', () => {
  assert.equal(checkFile('Story.PDF', 47205), 'pdf');
  assert.throws(() => checkFile('story.exe', 10));
  assert.throws(() => checkFile('story.pdf', 0));
  assert.throws(() => checkFile('story.pdf', 20_000_001));
  assert.throws(() => checkStoryText(' '));
  assert.throws(() => checkStoryText('x'.repeat(100001)));
});
test('Markdown başlığı ayrılır, bağlantılar çalıştırılmadan düz metne dönüşür', () => {
  const draft = textFileDraft('story.md', '# A New Day\r\n\r\nA **quiet** [morning](https://example.org).');
  assert.equal(draft.title, 'A New Day');
  assert.equal(draft.text, 'A quiet morning.');
  assert.equal(draft.sourceName, 'story.md');
});
test('PDF metin parçaları, sözcük aralıkları ve paragraflar doğru birleştirilir', () => {
  const item = (str, x, y, width, hasEOL = false) => ({ str, transform: [1, 0, 0, 1, x, y], height: 10, width, hasEOL });
  const result = textFromPdfItems([item('A', 10, 100, 6), item('quiet', 20, 100, 25), item(' day.', 45, 100, 20, true), item('Next paragraph.', 10, 75, 70, true)]);
  assert.equal(result, 'A quiet day.\n\nNext paragraph.');
  assert.equal(textFromPdfItems([{ str: 'note', hasEOL: true }, { str: 'line' }]), 'note\nline');
});
