import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lookupLevel, normalizePos, normalizeWord } from './cefr.mjs';
import { translateTexts } from './translator.mjs';
import { lookupOffline } from './offline-dictionary.mjs';
import { lookupStudyExample } from './study-examples.mjs';
import { turkishTranslations } from './wiktionary.mjs';

const cacheDir = fileURLToPath(new URL('../data/dictionary-cache/', import.meta.url));
const clean = (value, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validWord = value => /^[a-z]+(?:[ '\-][a-z]+)*$/.test(value) && value.length <= 100;
const unique = values => [...new Set(values.map(value => normalizeWord(clean(value, 100))).filter(validWord))];
const tooSimilarToEnglish = (english, translated) => {
  const words = value => (value.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  const source = words(english), output = words(translated);
  return !!source.length && !!output.length && output.filter(word => source.includes(word)).length / output.length >= 0.6;
};
export function dictionaryEntry(payload, requestedType = '') {
  if (!Array.isArray(payload)) return { definition: '', type: '', example: '', synonyms: [], antonyms: [], sources: '' };
  const entries = payload.filter(entry => entry && Array.isArray(entry.meanings)).flatMap(entry => entry.meanings.filter(meaning => meaning && typeof meaning === 'object').map(meaning => ({ ...meaning, entry })));
  const selected = requestedType ? entries.find(entry => normalizePos(entry.partOfSpeech) === normalizePos(requestedType)) : entries[0];
  if (!selected) return { definition: '', type: '', example: '', synonyms: [], antonyms: [], sources: '' };
  const def = selected?.definitions?.[0];
  const license = selected?.entry.license;
  const urls = (selected?.entry.sourceUrls ?? []).filter(url => typeof url === 'string' && url.startsWith('https://')).slice(0, 4);
  return {
    definition: clean(def?.definition), type: clean(selected?.partOfSpeech, 100), example: clean(entries.filter(item => normalizePos(item.partOfSpeech) === normalizePos(selected?.partOfSpeech)).flatMap(item => item.definitions ?? []).find(item => typeof item?.example === 'string' && item.example.trim())?.example, 2000),
    synonyms: unique([...(selected?.synonyms ?? []), ...(def?.synonyms ?? [])]),
    antonyms: unique([...(selected?.antonyms ?? []), ...(def?.antonyms ?? [])]),
    sources: ['Free Dictionary API: https://dictionaryapi.dev/', ...urls, license ? `${clean(license.name)} ${clean(license.url)}` : ''].filter(Boolean).join('\n'),
  };
}
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function failureMessage(error, name) {
  if (error?.status === 429) return `${name} istek sınırına ulaştı; daha sonra yeniden dene.`;
  if (error?.status >= 500) return `${name} şu an yanıt veremiyor.`;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return `${name} zaman aşımına uğradı.`;
  if (error instanceof SyntaxError) return `${name} geçersiz veri gönderdi.`;
  return `${name} bağlantısı kurulamadı.`;
}
export function createDictionaryService({ fetcher = fetch, translate = translateTexts, level = lookupLevel, offline = lookupOffline, directory = cacheDir, useWiktionary = fetcher === fetch, preferOffline = fetcher === fetch } = {}) {
  const cooldowns = new Map();
  async function cached(key, loader, lifetime = 30 * 86400000, onStale = () => {}, missingLifetime = lifetime) {
    const file = join(directory, createHash('sha256').update(key).digest('hex') + '.json');
    let saved;
    try { saved = JSON.parse(await readFile(file, 'utf8')); if (Date.now() < (saved.expires ?? saved.time + (Array.isArray(saved.value) && !saved.value.length ? missingLifetime : lifetime))) return saved.value; } catch { /* Cache is disposable. */ }
    let value;
    try { value = await loader(); }
    catch (error) { if (saved && 'value' in saved) { onStale(error); return saved.value; } throw error; }
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(temporary, JSON.stringify({ time: Date.now(), expires: Date.now() + (Array.isArray(value) && !value.length ? missingLifetime : lifetime), value }));
      await rename(temporary, file);
    } catch { await unlink(temporary).catch(() => {}); /* A cache write must not discard a good lookup. */ }
    return value;
  }
  async function json(url, allowMissing = false, allowRetry = true) {
    const host = new URL(url).host;
    if ((cooldowns.get(host) ?? 0) > Date.now()) { const error = new Error('Servis geçici olarak beklemede.'); error.status = 429; throw error; }
    for (let attempt = 0; attempt < (allowRetry ? 2 : 1); attempt++) {
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json', 'User-Agent': 'EnglishDesk/0.1 (personal language study)' } });
        if (allowMissing && response.status === 404) return [];
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`); error.status = response.status;
          if (response.status === 429) {
            const seconds = Number(response.headers?.get?.('retry-after'));
            cooldowns.set(host, Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 300000) : 60000));
          }
          throw error;
        }
        const text = await response.text(); if (text.length > 2_000_000) throw new Error('Sözlük yanıtı çok büyük.'); return JSON.parse(text);
      } catch (error) {
        if (attempt || !allowRetry) {
          if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || !error?.status) cooldowns.set(host, Date.now() + 60000);
        }
        if (!allowRetry || attempt || error?.status === 429 || (error?.status && error.status < 500) || error instanceof SyntaxError) throw error;
        await sleep(350);
      }
    }
  }
  return async input => {
    const word = normalizeWord(clean(input.word, 101));
    if (!validWord(word)) throw new Error('En fazla 100 karakterlik İngilizce kelime veya ifade gir.');
    const warnings = [];
    const local = offline(word, clean(input.type, 100));
    const prepared = lookupStudyExample(word, clean(input.type, 100));
    let dictionary = [];
    if (!(preferOffline && local?.definition && (input.example || local.example || prepared?.example))) {
    try {
      dictionary = await cached(`dictionary-v1:${word}`, () => json(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, true, !local), 30 * 86400000, error => warnings.push(`${failureMessage(error, 'Free Dictionary API')} Eski önbellek kullanıldı.`), 86400000);
    } catch (error) { warnings.push(failureMessage(error, 'Free Dictionary API')); }
    }
    let entry = dictionaryEntry(dictionary, clean(input.type, 100));
    if (!entry.definition) {
      if (local) entry = local;
    }
    if (!entry.definition) {
      try {
        const url = new URL('https://api.datamuse.com/words');
        url.searchParams.set('sp', word); url.searchParams.set('qe', 'sp'); url.searchParams.set('md', 'dp'); url.searchParams.set('max', '1');
        if (process.env.DATAMUSE_API_KEY) url.searchParams.set('key', process.env.DATAMUSE_API_KEY);
        const definitions = await cached(`definition-v1:${word}`, () => json(url.href), 30 * 86400000, error => warnings.push(`${failureMessage(error, 'Datamuse')} Eski önbellek kullanıldı.`), 86400000);
        const exact = Array.isArray(definitions) ? definitions.find(item => normalizeWord(clean(item.word)) === word) : undefined;
        const parts = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
        const options = (exact?.defs ?? []).filter(item => typeof item === 'string').map(item => { const [pos, ...text] = item.split('\t'); return { type: parts[pos] ?? pos, definition: text.join(' ') }; });
        const selected = input.type ? options.find(item => normalizePos(item.type) === normalizePos(input.type)) : options[0];
        if (selected?.definition) entry = { ...entry, ...selected, sources: 'Datamuse açıklaması (WordNet / Wiktionary): https://www.datamuse.com/api/' };
      } catch (error) { warnings.push(failureMessage(error, 'Datamuse')); }
    }
    const type = clean(input.type, 100) || entry.type;
    const studyExample = prepared ?? lookupStudyExample(word, type);
    if (!entry.example && studyExample) entry = { ...entry, example: studyExample.example, sources: [entry.sources, studyExample.sources].filter(Boolean).join('\n') };
    const example = clean(input.example, 2000) || entry.example;
    const levelInfo = level(word, type);
    if (levelInfo.levelNote) warnings.push(levelInfo.levelNote);
    if (!entry.definition) warnings.push('İngilizce açıklama bulunamadı; kartı elle tamamlayabilirsin.');
    let meaning = '', translation = '', meaningSource = '';
    const preparedTranslation = studyExample?.example === example ? studyExample.translation : '';
    if (useWiktionary && type) {
      try {
        const url = new URL('https://en.wiktionary.org/w/api.php');
        url.search = new URLSearchParams({ action: 'parse', page: word, prop: 'wikitext', format: 'json', formatversion: '2' }).toString();
        const candidates = await cached(`wiktionary-tr-v1:${word}:${type}`, async () => turkishTranslations((await json(url.href, false, false))?.parse?.wikitext, type), 30 * 86400000, error => warnings.push(`${failureMessage(error, 'Wiktionary')} Eski önbellek kullanıldı.`), 86400000);
        if (candidates.length) {
          meaning = candidates.slice(0, 2).join(', ');
          meaningSource = `Türkçe karşılık: English Wiktionary (CC BY-SA 4.0) https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
        }
      } catch (error) { warnings.push(failureMessage(error, 'Wiktionary')); }
    }
    try {
      // A bilingual dictionary entry is preferred over machine-translating an English definition.
      const texts = [meaning ? '' : entry.definition, preparedTranslation ? '' : example];
      if (texts.some(Boolean)) {
        const translated = await cached(`argos-en-tr-v1:${JSON.stringify(texts)}`, () => translate(texts), 365 * 86400000, () => warnings.push('Yerel çeviri çalışmadı; önbellekteki çeviri kullanıldı.'));
        const [automaticMeaning, automaticTranslation] = translated.map(value => clean(value));
        if (!meaning && automaticMeaning && !tooSimilarToEnglish(entry.definition, automaticMeaning)) { meaning = automaticMeaning; meaningSource = 'Türkçe: Argos Translate (otomatik çeviri)'; }
        else if (!meaning && automaticMeaning) warnings.push('Otomatik Türkçe anlam güvenilir görünmüyor; kartı elle tamamla.');
        translation = preparedTranslation || automaticTranslation;
      }
    } catch (error) { warnings.push(`Türkçe çeviri bekliyor: ${error.message}`); }
    if (preparedTranslation) translation = preparedTranslation;
    return {
      word, meaning, definition: entry.definition, type, example, translation,
      synonyms: unique(entry.synonyms ?? []).filter(item => item !== word).join(', '),
      antonyms: unique(entry.antonyms ?? []).filter(item => item !== word).join(', '),
      level: levelInfo.level, levelSource: levelInfo.levelSource,
      sources: [entry.sources, meaningSource, translation && !preparedTranslation ? 'Örnek cümle: Argos Translate (otomatik çeviri; kontrol et)' : ''].filter(Boolean).join('\n'),
      warnings,
    };
  };
}
export const lookupWord = createDictionaryService();
