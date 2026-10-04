export type StoryDraft = { title: string; text: string; sourceName: string; pageCount?: number; warnings: string[] };
export const MAX_FILE_BYTES = 20_000_000;
export const MAX_STORY_CHARS = 100_000;
export const MAX_PDF_PAGES = 150;
export function checkFile(name: string, size: number) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'md', 'markdown', 'txt'].includes(extension ?? '')) throw new Error('PDF, Markdown (.md) veya düz metin (.txt) dosyası seç.');
  if (size > MAX_FILE_BYTES) throw new Error('Dosya en fazla 20 MB olabilir. Daha küçük bir dosya seç.');
  if (size === 0) throw new Error('Seçtiğin dosya boş.');
  return extension!;
}
export function titleFromFilename(name: string) { return name.replace(/\.(pdf|md|markdown|txt)$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 500) || 'Yeni hikâye'; }
export function cleanText(text: string) { return text.replace(/\r\n?/g, '\n').replace(/\0/g, '').replace(/[\t ]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim(); }
export function textFileDraft(name: string, content: string): StoryDraft {
  let text = cleanText(content.replace(/^\uFEFF/, ''));
  let title = titleFromFilename(name);
  if (/\.(md|markdown)$/i.test(name)) {
    const heading = text.match(/^#\s+(.+)\n?/);
    if (heading) { title = heading[1].trim().slice(0, 500); text = text.slice(heading[0].length); }
    text = text.replace(/^#{1,6}\s+/gm, '').replace(/!\[([^\]]*)\]\([^\n)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^\n)]*\)/g, '$1').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/__([^_\n]+)__/g, '$1');
  }
  text = cleanText(text);
  checkStoryText(text);
  return { title, text, sourceName: name, warnings: [] };
}
export function checkStoryText(text: string) {
  if (!text.trim()) throw new Error('Dosyada okunabilir metin bulunamadı.');
  if (text.length > MAX_STORY_CHARS) throw new Error('Hikâye 100.000 karakter sınırını aşıyor. Dosyayı daha kısa bölümlere ayırıp tekrar ekle.');
}
export type PdfTextItem = { str?: string; hasEOL?: boolean; transform?: number[]; height?: number; width?: number };
export function textFromPdfItems(items: PdfTextItem[]): string {
  let result = ''; let previous: PdfTextItem | undefined;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5], py = previous?.transform?.[5];
    const h = Math.max(1, previous?.height ?? item.height ?? 10);
    const changedLine = y !== undefined && py !== undefined && Math.abs(y - py) > Math.max(2, h * .5);
    if (result && (changedLine || previous?.hasEOL)) {
      const gap = y !== undefined && py !== undefined ? Math.abs(y - py) : 0;
      result += gap > h * 1.75 ? '\n\n' : '\n';
    } else if (result && !/\s$/.test(result) && item.str && !/^\s/.test(item.str)) {
      const x = item.transform?.[4];
      const end = previous?.transform?.[4] === undefined ? undefined : previous.transform[4] + (previous.width ?? 0);
      if (x === undefined || end === undefined || x - end > Math.max(.8, h * .08)) result += ' ';
    }
    result += item.str;
    previous = item;
  }
  return cleanText(result);
}
