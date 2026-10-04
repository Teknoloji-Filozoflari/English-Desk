import {
  validateHiddenGrammarTopics,
  type HiddenGrammarTopics,
} from "./grammar-guide.ts";
import { validateTopics, type Topic } from "./topics.ts";
import { isTenseName, type TenseName } from "./tenses.ts";
import { isModalityTopic, type ModalityTopic } from "./modality.ts";
import { validateExams, type ExamData } from "./exams.ts";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];
export const isLevel = (value: string): value is Level =>
  LEVELS.includes(value as Level);
export type Story = {
  id: string;
  title: string;
  text: string;
  level: string;
  read: boolean;
  sample?: boolean;
  sourceName?: string;
  audioId?: string;
};
export function groupStories(stories: Story[], query = "") {
  const matches = stories.filter((story) =>
    `${story.title} ${story.text}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  return {
    groups: LEVELS.map((level) => ({
      level,
      stories: matches.filter((story) => story.level === level),
    })),
    unassigned: matches.filter((story) => !isLevel(story.level)),
  };
}
export type WordSense = {
  meaning: string;
  definition: string;
  example: string;
  translation: string;
};
export type WordFamilyMember = {
  word: string;
  meaning: string;
  type: string;
  level?: string;
  levelSource?: string;
};
export type VerbForms = {
  base: string;
  past: string;
  participle: string;
  regularity: "regular" | "irregular" | "";
};
export type Word = {
  id: string;
  word: string;
  meaning: string;
  type: string;
  synonyms: string;
  antonyms: string;
  example: string;
  translation: string;
  storyId: string;
  storyIds?: string[];
  level?: string;
  definition?: string;
  levelSource?: string;
  sources?: string;
  generatedFrom?: string;
  family?: WordFamilyMember[];
  senses?: WordSense[];
  examples?: { example: string; translation: string; source: string }[];
  verbForms?: VerbForms;
  review?: { due: number; interval: number; repetitions: number };
};
export function wordLevel(word: Word, stories: Story[]): string {
  if (word.level && isLevel(word.level)) return word.level;
  if (word.level !== undefined || word.generatedFrom) return "";
  const inherited = stories.find((story) => story.id === word.storyId)?.level;
  return inherited && isLevel(inherited) ? inherited : "";
}
export function groupWords(words: Word[], stories: Story[], query = "") {
  const matches = words.filter((word) =>
    `${word.word} ${word.meaning}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  return {
    groups: LEVELS.map((level) => ({
      level,
      words: matches.filter((word) => wordLevel(word, stories) === level),
    })),
    unassigned: matches.filter((word) => !wordLevel(word, stories)),
  };
}
export type Grammar = {
  id: string;
  title: string;
  body: string;
  tense?: TenseName;
  modality?: ModalityTopic;
  topicId?: string;
};
export const STORY_NOTE_CATEGORIES = [
  "grammar",
  "pattern",
  "connector",
  "other",
] as const;
export type StoryNoteCategory = (typeof STORY_NOTE_CATEGORIES)[number];
export type StoryNote = {
  id: string;
  storyId: string;
  selection: string;
  category: StoryNoteCategory;
  title: string;
  body: string;
  tags?: string[];
};
export type Notebook = {
  version: 1;
  stories: Story[];
  words: Word[];
  grammar: Grammar[];
  grammarTopics?: Topic[];
  hiddenGrammarTopics?: HiddenGrammarTopics;
  storyNotes?: StoryNote[];
  audioTimings?: Record<string, (number | null)[]>;
  exams?: ExamData;
};
export type Token = {
  text: string;
  start: number;
  end: number;
  isWord: boolean;
};

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > cursor)
      tokens.push({
        text: text.slice(cursor, start),
        start: cursor,
        end: start,
        isWord: false,
      });
    tokens.push({
      text: match[0],
      start,
      end: start + match[0].length,
      isWord: true,
    });
    cursor = start + match[0].length;
  }
  if (cursor < text.length)
    tokens.push({
      text: text.slice(cursor),
      start: cursor,
      end: text.length,
      isWord: false,
    });
  return tokens;
}
export function sentenceAt(text: string, start: number, end: number) {
  let left = start,
    right = end;
  while (left > 0 && !/[.!?\n]/.test(text[left - 1])) left--;
  while (right < text.length && !/[.!?\n]/.test(text[right])) right++;
  if (right < text.length) right++;
  return text.slice(left, right).trim();
}
export function removeStory(data: Notebook, id: string): Notebook {
  const audioTimings = { ...data.audioTimings };
  delete audioTimings[id];
  return {
    ...data,
    stories: data.stories.filter((s) => s.id !== id),
    words: data.words.map((w) => ({
      ...w,
      ...(w.storyId === id
        ? { level: wordLevel(w, data.stories), storyId: "" }
        : {}),
      ...(w.storyIds
        ? { storyIds: w.storyIds.filter((link) => link !== id) }
        : {}),
    })),
    storyNotes: (data.storyNotes ?? []).filter((note) => note.storyId !== id),
    audioTimings,
  };
}
export function validateNotebook(value: unknown): Notebook {
  if (!value || typeof value !== "object")
    throw new Error("Yedek dosyası geçersiz.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1) throw new Error("Bu yedek sürümü desteklenmiyor.");
  const definitions = {
    stories: ["id", "title", "text", "level"],
    words: [
      "id",
      "word",
      "meaning",
      "type",
      "synonyms",
      "antonyms",
      "example",
      "translation",
      "storyId",
    ],
    grammar: ["id", "title", "body"],
    storyNotes: ["id", "storyId", "selection", "category", "title", "body"],
  };
  for (const [key, fields] of Object.entries(definitions)) {
    const rows =
      key === "storyNotes" && data[key] === undefined ? [] : data[key];
    if (!Array.isArray(rows) || rows.length > 10000)
      throw new Error("Yedekteki kayıt listesi geçersiz.");
    const ids = new Set<string>();
    for (const record of rows) {
      if (
        !record ||
        typeof record !== "object" ||
        fields.some(
          (field) =>
            typeof record[field] !== "string" || record[field].length > 500000,
        )
      )
        throw new Error("Yedekte eksik veya geçersiz bir alan var.");
      if (!record.id.trim() || ids.has(record.id))
        throw new Error("Yedekte tekrarlanan veya boş kimlik var.");
      ids.add(record.id);
    }
  }
  const parsed = data as unknown as Notebook;
  const grammarTopics = validateTopics(parsed.grammarTopics ?? []);
  if (
    parsed.grammar.some(
      (g) =>
        g.topicId !== undefined &&
        (typeof g.topicId !== "string" ||
          (g.topicId &&
            (!grammarTopics.some((t) => t.id === g.topicId) ||
              g.tense ||
              g.modality))),
    )
  )
    throw Error("Gramer alt başlık bağlantısı geçersiz.");
  for (const word of parsed.words)
    if (
      word.family !== undefined &&
      (!Array.isArray(word.family) ||
        word.family.length > 100 ||
        word.family.some(
          (member) =>
            !member ||
            ["word", "meaning", "type"].some(
              (key) =>
                typeof member[key as keyof WordFamilyMember] !== "string" ||
                member[key as keyof WordFamilyMember]!.length > 10000,
            ) ||
            !member.word.trim() ||
            (member.level !== undefined &&
              member.level !== "" &&
              !isLevel(member.level)) ||
            (member.levelSource !== undefined &&
              (typeof member.levelSource !== "string" ||
                member.levelSource.length > 10000)),
        ))
    )
      throw new Error("Kelime ailesi geçersiz.");
  if (
    parsed.audioTimings !== undefined &&
    (!parsed.audioTimings ||
      typeof parsed.audioTimings !== "object" ||
      Array.isArray(parsed.audioTimings))
  )
    throw new Error("Yedekte ses eşlemesi geçersiz.");
  const audioTimings: Record<string, (number | null)[]> = {};
  for (const [storyId, times] of Object.entries(parsed.audioTimings ?? {})) {
    if (
      !parsed.stories.some((story) => story.id === storyId && story.audioId) ||
      !Array.isArray(times) ||
      times.length > 10000 ||
      times.some(
        (time) =>
          time !== null &&
          (typeof time !== "number" ||
            !Number.isFinite(time) ||
            time < 0 ||
            time > 86400),
      )
    )
      throw new Error("Yedekte ses eşlemesi geçersiz.");
    let previous = -1;
    for (const time of times)
      if (time !== null) {
        if (time <= previous)
          throw new Error("Yedekte ses eşlemesi sırası geçersiz.");
        previous = time;
      }
    audioTimings[storyId] = [...times];
  }
  for (const word of parsed.words)
    for (const key of [
      "definition",
      "levelSource",
      "sources",
      "generatedFrom",
    ] as const) {
      if (
        word[key] !== undefined &&
        (typeof word[key] !== "string" || word[key]!.length > 10000)
      )
        throw new Error("Yedekte sözlük alanı geçersiz.");
    }
  for (const word of parsed.words)
    if (
      word.storyIds !== undefined &&
      (!Array.isArray(word.storyIds) ||
        word.storyIds.length > 1000 ||
        word.storyIds.some(
          (id) =>
            typeof id !== "string" ||
            !parsed.stories.some((story) => story.id === id),
        ))
    )
      throw new Error("Story links invalid.");
  for (const word of parsed.words)
    if (
      word.examples !== undefined &&
      (!Array.isArray(word.examples) ||
        word.examples.length > 100 ||
        word.examples.some(
          (e) =>
            !e ||
            ["example", "translation", "source"].some(
              (key) =>
                typeof e[key as keyof typeof e] !== "string" ||
                e[key as keyof typeof e].length > 10000,
            ) ||
            !e.example.trim(),
        ))
    )
      throw new Error("PDF examples invalid.");
  for (const word of parsed.words)
    if (
      word.senses !== undefined &&
      (!Array.isArray(word.senses) ||
        word.senses.length > 30 ||
        word.senses.some(
          (sense) =>
            !sense ||
            typeof sense !== "object" ||
            ["meaning", "definition", "example", "translation"].some(
              (key) =>
                typeof sense[key as keyof WordSense] !== "string" ||
                sense[key as keyof WordSense].length > 10000,
            ) ||
            !sense.meaning.trim(),
        ))
    )
      throw new Error("Yedekte kelime anlamları geçersiz.");
  for (const word of parsed.words)
    if (
      word.verbForms !== undefined &&
      (!word.verbForms ||
        typeof word.verbForms !== "object" ||
        ["base", "past", "participle"].some(
          (key) =>
            typeof word.verbForms?.[key as keyof VerbForms] !== "string" ||
            word.verbForms[key as keyof VerbForms].length > 100,
        ) ||
        !["", "regular", "irregular"].includes(word.verbForms.regularity))
    )
      throw new Error("Yedekte fiil halleri ge?ersiz.");
  if (
    parsed.words.some(
      (w) =>
        w.level !== undefined &&
        w.level !== "" &&
        (typeof w.level !== "string" || !isLevel(w.level)),
    )
  )
    throw new Error("Yedekte kelime seviyesi geçersiz.");
  if (
    parsed.stories.some(
      (s) =>
        s.sourceName !== undefined &&
        (typeof s.sourceName !== "string" || s.sourceName.length > 500),
    )
  )
    throw new Error("Yedekte kaynak dosya adı geçersiz.");
  if (
    parsed.stories.some(
      (s) =>
        s.audioId !== undefined &&
        (typeof s.audioId !== "string" || !/^[a-z0-9-]{1,80}$/.test(s.audioId)),
    )
  )
    throw new Error("Yedekte hikâye ses bağlantısı geçersiz.");
  if (
    parsed.words.some(
      (w) =>
        w.review !== undefined &&
        (!w.review ||
          typeof w.review !== "object" ||
          !Number.isFinite(w.review.due) ||
          !Number.isFinite(w.review.interval) ||
          !Number.isInteger(w.review.repetitions) ||
          w.review.interval < 0 ||
          w.review.interval > 3650 ||
          w.review.repetitions < 0 ||
          w.review.repetitions > 10000),
    )
  )
    throw new Error("Yedekte tekrar bilgisi geçersiz.");
  if (
    parsed.grammar.some((g) => g.tense !== undefined && !isTenseName(g.tense))
  )
    throw new Error("Yedekte tense bağlantısı geçersiz.");
  if (
    parsed.grammar.some(
      (g) => g.modality !== undefined && !isModalityTopic(g.modality),
    )
  )
    throw new Error("Yedekte modality bağlantısı geçersiz.");
  if (parsed.grammar.some((g) => g.tense && g.modality))
    throw new Error("Yedekte gramer notu iki konuya birden bağlı.");
  const storyNotes = parsed.storyNotes ?? [];
  if (
    storyNotes.some(
      (note) =>
        note.tags !== undefined &&
        (!Array.isArray(note.tags) ||
          note.tags.length > 20 ||
          note.tags.some(
            (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40,
          )),
    )
  )
    throw new Error("Yedekte not etiketleri geçersiz.");
  if (
    storyNotes.some(
      (note) =>
        !note.storyId.trim() ||
        !note.selection.trim() ||
        !note.title.trim() ||
        !note.body.trim() ||
        !STORY_NOTE_CATEGORIES.includes(note.category) ||
        note.selection.length > 5000 ||
        note.title.length > 200 ||
        note.body.length > 20000 ||
        !parsed.stories.some((story) => story.id === note.storyId),
    )
  )
    throw new Error("Yedekte hikâye notu geçersiz.");
  if (
    parsed.stories.some(
      (s) =>
        !s.title.trim() ||
        !s.text.trim() ||
        typeof s.read !== "boolean" ||
        (s.sample !== undefined && typeof s.sample !== "boolean"),
    ) ||
    parsed.words.some((w) => !w.word.trim()) ||
    parsed.grammar.some((g) => !g.title.trim() || !g.body.trim())
  )
    throw new Error("Yedekte zorunlu bir alan boş veya geçersiz.");
  if (
    parsed.words.some(
      (w) => w.storyId && !parsed.stories.some((s) => s.id === w.storyId),
    )
  )
    throw new Error("Yedekte bir hikâye bağlantısı bulunamadı.");
  // Rebuild known fields only: import never carries arbitrary object properties into app state.
  return {
    version: 1,
    ...(parsed.hiddenGrammarTopics !== undefined
      ? {
          hiddenGrammarTopics: validateHiddenGrammarTopics(
            parsed.hiddenGrammarTopics,
          ),
        }
      : {}),
    ...(parsed.grammarTopics !== undefined ? { grammarTopics } : {}),
    ...(parsed.exams !== undefined
      ? { exams: validateExams(parsed.exams) }
      : {}),
    stories: parsed.stories.map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      level: s.level,
      read: s.read,
      sample: s.sample === true,
      ...(s.sourceName ? { sourceName: s.sourceName } : {}),
      ...(s.audioId ? { audioId: s.audioId } : {}),
    })),
    words: parsed.words.map((w) => ({
      id: w.id,
      word: w.word,
      meaning: w.meaning,
      type: w.type,
      synonyms: w.synonyms,
      antonyms: w.antonyms,
      example: w.example,
      translation: w.translation,
      storyId: w.storyId,
      ...(w.storyIds ? { storyIds: [...new Set(w.storyIds)] } : {}),
      ...(w.level !== undefined ? { level: w.level } : {}),
      ...Object.fromEntries(
        ["definition", "levelSource", "sources", "generatedFrom"]
          .filter((key) => typeof w[key as keyof Word] === "string")
          .map((key) => [key, w[key as keyof Word]]),
      ),
      ...(w.family
        ? {
            family: w.family.map((member) => ({
              word: member.word,
              meaning: member.meaning,
              type: member.type,
              ...(member.level !== undefined ? { level: member.level } : {}),
              ...(member.levelSource !== undefined
                ? { levelSource: member.levelSource }
                : {}),
            })),
          }
        : {}),
      ...(w.examples
        ? {
            examples: w.examples.map((e) => ({
              example: e.example,
              translation: e.translation,
              source: e.source,
            })),
          }
        : {}),
      ...(w.senses
        ? {
            senses: w.senses.map((sense) => ({
              meaning: sense.meaning,
              definition: sense.definition,
              example: sense.example,
              translation: sense.translation,
            })),
          }
        : {}),
      ...(w.verbForms
        ? {
            verbForms: {
              base: w.verbForms.base,
              past: w.verbForms.past,
              participle: w.verbForms.participle,
              regularity: w.verbForms.regularity,
            },
          }
        : {}),
      ...(w.review
        ? {
            review: {
              due: w.review.due,
              interval: w.review.interval,
              repetitions: w.review.repetitions,
            },
          }
        : {}),
    })),
    grammar: parsed.grammar.map((g) => ({
      id: g.id,
      title: g.title,
      body: g.body,
      ...(g.topicId ? { topicId: g.topicId } : {}),
      ...(g.tense ? { tense: g.tense } : {}),
      ...(g.modality ? { modality: g.modality } : {}),
    })),
    storyNotes: storyNotes.map((note) => ({
      id: note.id,
      storyId: note.storyId,
      selection: note.selection,
      category: note.category,
      title: note.title,
      body: note.body,
      ...(note.tags ? { tags: [...note.tags] } : {}),
    })),
    audioTimings,
  };
}
