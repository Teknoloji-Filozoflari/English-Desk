import { execFile } from 'node:child_process';
import { copyFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore } from './notebook-store.mjs';

const execFileAsync = promisify(execFile);
const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));

function extractStory(raw, title, startAt = '', endAt = '') {
  const lines = raw.replaceAll('\r', '').replaceAll('\f', '\n').split('\n').filter(line => {
    const value = line.trim();
    return value.toLocaleLowerCase('en') !== title.toLocaleLowerCase('en') &&
      !/^(Effortless English|Publish Date:|All Sound|Old Audio|www\.|https?:|Contact:|Mr\.Hung|Trung tam|Các sách)/i.test(value) &&
      !/w\s*o\s*r\s*d\s*p\s*r\s*e\s*s\s*s/i.test(value);
  });
  const first = lines.findIndex(line => startAt ? line.trim().startsWith(startAt) : line.trim());
  if (first < 0) throw new Error('PDF boş.');
  const body = lines.slice(first);
  if (body[0] && /^Effortless English$/i.test(body[0].trim())) body.shift();
  if (body[0] && body[0].trim().toLocaleLowerCase('en') === title.toLocaleLowerCase('en')) body.shift();
  const vocabulary = body.findIndex(line => /^\s*(vocab(?:\/phrases)?|vocabulary)\s*$/i.test(line));
  const references = body.findIndex(line => /^\s*Learn More:\s*$/i.test(line));
  const customEnd = endAt ? body.findIndex(line => line.trim().startsWith(endAt)) : -1;
  if (endAt && customEnd < 0) throw new Error('PDF içinde bitiş işareti bulunamadı.');
  const end = Math.min(...[vocabulary, references, customEnd].filter(index => index >= 0), body.length);
  const storyLines = body.slice(0, end);
  const paragraphs = [];
  let paragraph = [];
  for (const line of storyLines) {
    const cleaned = line.trim();
    if (!cleaned) {
      if (paragraph.length) paragraphs.push(paragraph.join(' '));
      paragraph = [];
    } else paragraph.push(cleaned);
  }
  if (paragraph.length) paragraphs.push(paragraph.join(' '));
  const text = paragraphs.join('\n\n').trim();
  if (text.length < 100 || text.length > 100_000) throw new Error('Hikâye metni beklenen uzunlukta değil.');
  return text;
}

export async function importAudioStory({ pdf, audio, title, level, id, rawPdf = false, startAt = '', endAt = '' }) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new Error('Kimlik yalnızca küçük harf, rakam ve tire içermeli.');
  if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) throw new Error('Geçerli bir seviye seç.');
  if (!/\.pdf$/i.test(pdf) || !/\.mp3$/i.test(audio)) throw new Error('PDF metni ve MP3 ses dosyası gerekli.');
  const audioInfo = await stat(audio);
  if (!audioInfo.isFile() || !audioInfo.size) throw new Error('Ses dosyası boş veya okunamıyor.');
  const { stdout } = await execFileAsync('pdftotext', [rawPdf ? '-raw' : '-layout', pdf, '-'], { maxBuffer: 2_000_000 });
  const text = extractStory(stdout, title, startAt, endAt);
  const store = createStore(dataDirectory);
  const current = await store.read();
  if (!current.data) throw new Error('Önce uygulamayı açıp defteri oluştur.');
  const audioDirectory = join(dataDirectory, 'story-audio');
  await mkdir(audioDirectory, { recursive: true });
  const temporary = join(audioDirectory, `.${id}-${randomUUID()}.tmp`);
  try {
    await copyFile(audio, temporary);
    await rename(temporary, join(audioDirectory, `${id}.mp3`));
  } finally {
    await unlink(temporary).catch(() => {});
  }
  const previous = current.data.stories.find(story => story.id === id);
  const story = { ...previous, id, title, text, level, read: previous?.read ?? false, sample: false, sourceName: basename(pdf), audioId: id };
  const stories = previous ? current.data.stories.map(row => row.id === id ? story : row) : [...current.data.stories, story];
  await store.save({ ...current.data, stories }, current.revision);
  return { id, title, level, textLength: text.length, audioBytes: audioInfo.size, updated: !!previous };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const pdf = value('--pdf'), audio = value('--audio'), title = value('--title'), level = value('--level'), id = value('--id');
  if (!pdf || !audio || !title || !level || !id) throw new Error('Kullanım: node scripts/import-audio-story.mjs --pdf DOSYA --audio DOSYA --title BAŞLIK --level A2 --id kimlik [--raw] [--start-at METİN] [--end-at METİN]');
  console.log(await importAudioStory({ pdf: resolve(pdf), audio: resolve(audio), title, level, id, rawPdf: args.includes('--raw'), startAt: value('--start-at') ?? '', endAt: value('--end-at') ?? '' }));
}
