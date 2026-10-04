import type { Story } from './model';
export const SUCCESS_SERIES = 'series:effortless-success';
export function chapterNumber(story: Story): number | null {
  const match = /^b1b2-effortless-success-chapter-([1-5])$/.exec(story.id);
  return match ? Number(match[1]) : null;
}
export function successChapters(stories: Story[]) {
  return stories.filter(s => chapterNumber(s) !== null).sort((a,b) => chapterNumber(a)! - chapterNumber(b)!);
}
export function storyLibraryItems(stories: Story[]) {
  const chapters = successChapters(stories);
  const item = (s: Story) => ({ id: s.id, title: s.title, search: s.title + ' ' + s.text, level: s.level, read: s.read });
  const last = [...stories].reverse().find(s => chapterNumber(s) !== null);
  return stories.flatMap(s => chapterNumber(s) === null ? [item(s)] : s.id === last?.id ? [{
    id: SUCCESS_SERIES, title: 'Effortless Success — ' + chapters.length + ' Bölüm',
    search: chapters.map(s => s.title + ' ' + s.text).join(' '), level: chapters[0].level,
    read: chapters.every(s => s.read), members: chapters.map(item),
  }] : []);
}
