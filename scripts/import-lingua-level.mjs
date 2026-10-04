import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { isLevel, validateNotebook } from '../src/model.ts';

const execFileAsync = promisify(execFile);
const questionMarker = 'Did you understand the text?';
const watermark = /^T:\s*\d{2}\.\d{2}\.\d{4}.*\/\s*U:.*\/\s*OT:/;
const minorTitleWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'via', 'with']);

function formatTitle(value) {
  const words = value.split(/\s+/);
  return words.map((word, index) => {
    const lower = word.toLocaleLowerCase('en-US');
    if (index > 0 && index < words.length - 1 && minorTitleWords.has(lower)) return lower;
    return lower.replace(/[a-z]/, letter => letter.toUpperCase());
  }).join(' ');
}

export function parseLinguaText(raw, expectedLevel) {
  const lines = raw.replaceAll('\r', '').replaceAll('\f', '').split('\n');
  const markerIndex = lines.findIndex(line => line.trim() === questionMarker);
  if (markerIndex < 0) throw new Error(`Soru bölümü bulunamadı: ${questionMarker}`);

  const content = lines.slice(0, markerIndex).filter(line => !watermark.test(line.trim()));
  const titleIndex = content.findIndex(line => line.trim());
  if (titleIndex < 0) throw new Error('Başlık bulunamadı.');
  const title = formatTitle(content[titleIndex].trim().replace(
    new RegExp(`\\s*\\((?:${expectedLevel}|Beginner)\\)\\s*$`, 'i'),
    '',
  ));

  const paragraphs = [];
  let paragraph = [];
  for (const line of content.slice(titleIndex + 1)) {
    const clean = line.trim();
    if (!clean) {
      if (paragraph.length) paragraphs.push(paragraph.join(' ').replaceAll(/\s+/g, ' '));
      paragraph = [];
    } else {
      paragraph.push(clean);
    }
  }
  if (paragraph.length) paragraphs.push(paragraph.join(' ').replaceAll(/\s+/g, ' '));
  const text = paragraphs.join('\n\n').trim();
  if (!title || text.length < 80) throw new Error('Başlık veya hikâye metni beklenenden kısa.');
  return { title, text };
}

function slug(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replaceAll(/[^a-zA-Z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
}

async function extractPdf(path, level) {
  const { stdout } = await execFileAsync('pdftotext', [path, '-'], { maxBuffer: 2_000_000 });
  return parseLinguaText(stdout, level);
}

export async function importLevel({ source, level, notebookPath, dryRun = false }) {
  if (!isLevel(level)) throw new Error(`Geçersiz seviye: ${level}`);
  const filenames = (await readdir(source)).filter(name => name.toLowerCase().endsWith('.pdf')).sort();
  if (!filenames.length) throw new Error(`PDF bulunamadı: ${source}`);

  const notebook = validateNotebook(JSON.parse(await readFile(notebookPath, 'utf8')));
  const additions = [];
  const replacements = new Map();
  for (const filename of filenames) {
    const id = `lingua-${level.toLowerCase()}-${slug(filename)}`;
    const sourceName = `Lingua/${level}/${filename}`;
    const extracted = await extractPdf(join(source, filename), level);
    const current = notebook.stories.find(story => story.id === id || story.sourceName === sourceName);
    if (!current) {
      additions.push({ id, ...extracted, level, read: false, sample: false, sourceName });
    } else {
      const replacement = { ...current, ...extracted, id, level, sourceName };
      if (JSON.stringify(replacement) !== JSON.stringify(current)) replacements.set(current.id, replacement);
    }
  }

  if (!dryRun && (additions.length || replacements.size)) {
    const stories = notebook.stories.map(story => replacements.get(story.id) ?? story).concat(additions);
    const updated = validateNotebook({ ...notebook, stories });
    const backupDirectory = join(resolve(notebookPath, '..'), 'backups');
    await mkdir(backupDirectory, { recursive: true });
    await copyFile(notebookPath, join(backupDirectory, `${Date.now()}-before-lingua-${level}.json`));
    const temporary = `${notebookPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'w' });
    await rename(temporary, notebookPath);
  }
  return { scanned: filenames.length, added: additions.length, updated: replacements.size, stories: [...additions, ...replacements.values()] };
}

async function main() {
  const args = process.argv.slice(2);
  const value = name => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const source = value('--source');
  const level = value('--level');
  const notebookPath = value('--notebook') ?? fileURLToPath(new URL('../data/notebook.json', import.meta.url));
  if (!source || !level) {
    throw new Error('Kullanım: node scripts/import-lingua-level.mjs --source DİZİN --level A1 [--notebook DOSYA] [--dry-run]');
  }
  const result = await importLevel({ source: resolve(source), level, notebookPath: resolve(notebookPath), dryRun: args.includes('--dry-run') });
  const action = args.includes('--dry-run') ? 'bulundu' : 'işlendi';
  console.log(`${result.scanned} PDF tarandı; ${result.added} yeni, ${result.updated} güncellenmiş ${level} hikâyesi ${action}.`);
  for (const story of result.stories) console.log(`- ${story.title} (${story.text.length} karakter)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
