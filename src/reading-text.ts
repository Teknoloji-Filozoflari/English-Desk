/** PDF line wrapping is layout, whereas blank lines delimit paragraphs. */
export function reflowPdfText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\u00ad[ \t]*\n[ \t]*(?=\S)/g, '').replace(/\u00ad/g, '')
    .split(/\n[ \t]*\n+/)
    .map(paragraph => paragraph.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean).join('\n\n');
}
