import { reflowPdfText } from './reading-text';
import * as DocumentPicker from 'expo-document-picker';
import type * as PdfJs from 'pdfjs-dist';
import { checkFile, checkStoryText, cleanText, MAX_PDF_PAGES, StoryDraft, textFileDraft, textFromPdfItems, titleFromFilename } from './story-import-core';

declare global { interface Window { EnglishDeskPdf?: typeof PdfJs } }
let enginePromise: Promise<typeof PdfJs> | undefined;
async function loadEngine(): Promise<typeof PdfJs> {
  if (window.EnglishDeskPdf) return window.EnglishDeskPdf;
  if (!enginePromise) enginePromise = new Promise<typeof PdfJs>((resolve, reject) => {
    const script = document.createElement('script'); script.type = 'module'; script.src = new URL('pdf/loader.js', document.baseURI).href;
    const timer = setTimeout(() => fail(), 20000);
    function fail() { clearTimeout(timer); enginePromise = undefined; script.remove(); reject(new Error('PDF okuyucu yüklenemedi. Uygulamayı yeniden açıp tekrar dene.')); }
    script.onload = () => { clearTimeout(timer); window.EnglishDeskPdf ? resolve(window.EnglishDeskPdf) : fail(); };
    script.onerror = fail; document.head.appendChild(script);
  });
  return enginePromise;
}
export async function chooseStoryFile(): Promise<{ name: string; file: globalThis.File } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'text/markdown', '.pdf', '.md', '.markdown', '.txt'], multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0]; if (!asset.file) throw new Error('Seçilen dosya okunamadı.');
  checkFile(asset.name, asset.file.size);
  return { name: asset.name, file: asset.file };
}
export async function readStoryFile(source: { name: string; file: globalThis.File }, onProgress: (text: string) => void, signal: AbortSignal): Promise<StoryDraft> {
  const extension = checkFile(source.name, source.file.size);
  if (extension !== 'pdf') return textFileDraft(source.name, await source.file.text());
  onProgress('PDF açılıyor…');
  const engine = await loadEngine(); if (signal.aborted) throw new Error('İçe aktarma iptal edildi.');
  const bytes = new Uint8Array(await source.file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('Dosya geçerli bir PDF değil.');
  const task = engine.getDocument({ data: bytes, useSystemFonts: false, cMapUrl: new URL('pdf/cmaps/', document.baseURI).href, cMapPacked: true, standardFontDataUrl: new URL('pdf/standard_fonts/', document.baseURI).href });
  const abort = () => { void task.destroy(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('Bu PDF 150 sayfadan uzun. Hikâyeleri daha küçük PDF dosyaları olarak ekle.');
    const pages: string[] = []; const emptyPages: number[] = []; let total = 0;
    for (let index = 1; index <= pdf.numPages; index++) {
      if (signal.aborted) throw new Error('İçe aktarma iptal edildi.');
      onProgress(`Sayfalar okunuyor: ${index} / ${pdf.numPages}`);
      const page = await pdf.getPage(index); const content = await page.getTextContent();
      const text = textFromPdfItems(content.items.filter(item => 'str' in item));
      if (!text) emptyPages.push(index);
      pages.push(text); total += text.length;
      if (total > 100000) throw new Error('PDF metni 100.000 karakter sınırını aşıyor. Dosyayı bölüp tekrar ekle.');
      page.cleanup();
    }
    const text = reflowPdfText(cleanText(pages.filter(Boolean).join('\n\n')));
    if (!text) throw new Error('Bu PDF’de seçilebilir metin yok. Taranmış sayfalar için önce metin tanıma (OCR) gerekir; metin içeren PDF veya TXT/MD kullanabilirsin.');
    checkStoryText(text);
    return { title: titleFromFilename(source.name), text, sourceName: source.name, pageCount: pdf.numPages, warnings: emptyPages.length ? [`${emptyPages.join(', ')} numaralı sayfalarda metin bulunamadı. Bunlar boş veya görsel sayfalar olabilir; kaydetmeden önce kontrol et.`] : [] };
  } catch (error) {
    if (signal.aborted) throw new Error('İçe aktarma iptal edildi.');
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('Bu PDF şifreli. Şifresiz bir kopyasını seç.');
    if (error instanceof Error && error.name === 'InvalidPDFException') throw new Error('PDF okunamadı; dosya bozuk veya desteklenmeyen bir yapıda olabilir.');
    throw error;
  } finally { signal.removeEventListener('abort', abort); await task.destroy(); }
}
