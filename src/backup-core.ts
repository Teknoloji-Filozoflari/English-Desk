import { DEFAULT_EXAM_TOPICS, mergeTopics } from "./topics.ts";
import { examTopicId } from "./exams.ts";
import {
  validateNotebook,
  wordLevel,
  type Notebook,
  type Story,
  type Word,
} from "./model.ts";
import { wordTypeKey } from "./word-types.ts";
import { normalizeWord } from "./word-enrichment.ts";
import { wordContexts } from "./word-context.ts";
import {
  emptyLearning,
  validateLearning,
  grammarCards,
  type LearningCard,
} from "./learning.ts";

export const BACKUP_SECTIONS = [
  "stories",
  "words",
  "grammar",
  "exams",
] as const;
export type BackupSection = (typeof BACKUP_SECTIONS)[number];
export type RestoreMode = "merge" | "replace";
export const sectionLabels: Record<BackupSection, string> = {
  stories: "Hikâyeler",
  words: "Kelimelerim",
  grammar: "Gramer",
  exams: "Sınavlar",
};
export type StoryReference = Pick<Story, "id" | "title" | "level">;
export type BackupBundle = {
  format: "english-desk-backup";
  version: 1;
  sections: BackupSection[];
  createdAt?: string;
  includeAudio: boolean;
  data: Notebook;
  storyReferences: StoryReference[];
};
export type BackupCounts = Record<BackupSection, number> & {
  notes: number;
  audio: number;
  attempts: number;
};
export type RestoreSummary = {
  added: Record<BackupSection, number>;
  skipped: Record<BackupSection, number>;
  removed: Record<BackupSection, number>;
  notes: number;
  attempts: number;
  detachedLinks: number;
  missingAudio: number;
};
export type RestorePlan = {
  data: Notebook;
  summary: RestoreSummary;
  warnings: string[];
};
export type BackupImport = {
  token?: string;
  bundle?: BackupBundle;
  sections: BackupSection[];
  counts: BackupCounts;
  warnings: string[];
};
export type BackupOptions = {
  sections: BackupSection[];
  includeAudio: boolean;
};
export type RestoreOptions = { sections: BackupSection[]; mode: RestoreMode };
const emptyCounts = (): Record<BackupSection, number> => ({
  stories: 0,
  words: 0,
  grammar: 0,
  exams: 0,
});
export const emptyNotebook = (): Notebook => ({
  version: 1,
  stories: [],
  words: [],
  grammar: [],
  storyNotes: [],
  audioTimings: {},
  exams: { tests: [], attempts: [] },
});
const record = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Yedek içeriği geçersiz.");
  return value as Record<string, any>;
};
export function checkSections(value: unknown): BackupSection[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((key) => !BACKUP_SECTIONS.includes(key)) ||
    new Set(value).size !== value.length
  )
    throw Error("En az bir geçerli bölüm seç.");
  return BACKUP_SECTIONS.filter((key) => value.includes(key));
}
export function backupCounts(
  data: Notebook,
  sections: BackupSection[] = [...BACKUP_SECTIONS],
  audioIds?: string[],
): BackupCounts {
  return {
    stories: sections.includes("stories") ? data.stories.length : 0,
    words: sections.includes("words") ? data.words.length : 0,
    grammar: sections.includes("grammar") ? data.grammar.length : 0,
    exams: sections.includes("exams") ? (data.exams?.tests.length ?? 0) : 0,
    notes: sections.includes("stories") ? (data.storyNotes?.length ?? 0) : 0,
    attempts: sections.includes("exams")
      ? (data.exams?.attempts.length ?? 0)
      : 0,
    audio: sections.includes("stories")
      ? new Set(
          data.stories
            .map((s) => s.audioId)
            .filter((id) => id && (!audioIds || audioIds.includes(id))),
        ).size
      : 0,
  };
}
export function makeBackup(
  data: Notebook,
  options: BackupOptions,
): BackupBundle {
  const checked = validateNotebook(data),
    sections = checkSections(options.sections);
  const result = emptyNotebook();
  if (sections.includes("stories")) {
    result.stories = checked.stories;
    result.storyNotes = checked.storyNotes;
    result.audioTimings = checked.audioTimings;
  }
  if (sections.includes("words")) {
    result.words = checked.words;
    if (checked.studyPreferences !== undefined)
      result.studyPreferences = checked.studyPreferences;
  }
  if (sections.includes("grammar")) {
    result.grammar = checked.grammar;
    if (checked.hiddenGrammarTopics !== undefined)
      result.hiddenGrammarTopics = checked.hiddenGrammarTopics;
    if (checked.grammarTopics !== undefined)
      result.grammarTopics = checked.grammarTopics;
  }
  if (sections.includes("exams"))
    result.exams = checked.exams ?? { tests: [], attempts: [] };
  if (
    checked.learning !== undefined &&
    (sections.includes("grammar") || sections.includes("exams"))
  ) {
    result.learning = {
      grammarHistory: sections.includes("grammar")
        ? checked.learning.grammarHistory
        : [],
      mistakeHistory: sections.includes("exams")
        ? checked.learning.mistakeHistory
        : [],
      weekly:
        sections.includes("grammar") && sections.includes("exams")
          ? checked.learning.weekly
          : [],
    };
  }
  const linked = new Set(
    result.words.flatMap((w) => [
      w.storyId,
      ...(w.storyIds ?? []),
      ...(w.contexts ?? []).map((context) => context.storyId),
    ]),
  );
  return {
    format: "english-desk-backup",
    version: 1,
    sections,
    createdAt: new Date().toISOString(),
    includeAudio: sections.includes("stories") && options.includeAudio,
    data: result,
    storyReferences: checked.stories
      .filter((s) => linked.has(s.id))
      .map(({ id, title, level }) => ({ id, title, level })),
  };
}

// Validate partial and historical exports against temporary story references, without
// importing placeholder stories into the user's library.
export function parseBackup(
  value: unknown,
  referenceValue: unknown = [],
): BackupBundle {
  const source = record(value);
  if (source.version !== undefined && source.version !== 1)
    throw Error("Bu yedek sürümü desteklenmiyor.");
  const modern = source.format === "english-desk-backup";
  if (source.format !== undefined && !modern)
    throw Error("Yedek biçimi desteklenmiyor.");
  const payload = modern ? record(source.data) : source;
  const sections = modern
    ? checkSections(source.sections)
    : checkSections(
        BACKUP_SECTIONS.filter(
          (key) =>
            Object.hasOwn(payload, key) ||
            (key === "exams" && Object.hasOwn(payload, "tests")),
        ),
      );
  const raw = { ...emptyNotebook(), ...payload } as Notebook;
  if (
    !Array.isArray(raw.stories) ||
    !Array.isArray(raw.words) ||
    raw.stories.length > 10000 ||
    raw.words.length > 10000
  )
    throw Error("Yedekteki kayıt listesi geçersiz.");
  if (sections.includes("exams") && Object.hasOwn(payload, "tests"))
    raw.exams = {
      tests: payload.tests,
      attempts: payload.attempts ?? [],
      ...(payload.topics !== undefined ? { topics: payload.topics } : {}),
    };
  for (const key of BACKUP_SECTIONS) {
    if (sections.includes(key)) continue;
    if (key === "exams") raw.exams = { tests: [], attempts: [] };
    else raw[key] = [];
  }
  if (!sections.includes("words")) delete raw.studyPreferences;
  if (!sections.includes("grammar")) {
    delete raw.grammarTopics;
    delete raw.hiddenGrammarTopics;
  }
  if (!sections.includes("stories")) {
    raw.storyNotes = [];
    raw.audioTimings = {};
  }
  const refSource = modern ? (source.storyReferences ?? []) : referenceValue;
  if (!Array.isArray(refSource) || refSource.length > 10000)
    throw Error("Hikâye bağlantı listesi geçersiz.");
  const references: StoryReference[] = refSource.map((value) => {
    const row = record(value);
    if (
      ["id", "title", "level"].some(
        (key) => typeof row[key] !== "string" || row[key].length > 500,
      ) ||
      !row.id.trim()
    )
      throw Error("Hikâye bağlantısı geçersiz.");
    return { id: row.id, title: row.title, level: row.level };
  });
  if (new Set(references.map((r) => r.id)).size !== references.length)
    throw Error("Tekrarlanan hikâye bağlantısı.");
  const known = new Set(raw.stories.map((s) => s.id));
  const referenceMap = new Map(references.map((r) => [r.id, r]));
  for (const word of raw.words) {
    if (
      !word ||
      typeof word.storyId !== "string" ||
      (word.storyIds !== undefined &&
        (!Array.isArray(word.storyIds) ||
          word.storyIds.length > 1000 ||
          word.storyIds.some(
            (id) => typeof id !== "string" || !id.trim() || id.length > 500,
          )))
    )
      throw Error("Kelimenin hikâye bağlantısı geçersiz.");
    for (const id of [
      word.storyId,
      ...(word.storyIds ?? []),
      ...(word.contexts
        ? (Array.isArray(word.contexts) ? word.contexts : []).map(
            (context) => context?.storyId,
          )
        : []),
    ].filter(Boolean)) {
      if (typeof id !== "string")
        throw Error("Kelime bağlamının hikâye bağlantısı geçersiz.");
      if (!known.has(id) && !referenceMap.has(id))
        referenceMap.set(id, { id, title: "", level: "" });
    }
  }
  const placeholders = [...referenceMap.values()]
    .filter((r) => !known.has(r.id))
    .map((r) => ({
      ...r,
      title: r.title || "Hikâye referansı",
      text: "Hikâye referansı",
      read: false,
    }));
  const checked = validateNotebook({
    ...raw,
    stories: [...raw.stories, ...placeholders],
  });
  return {
    format: "english-desk-backup",
    version: 1,
    sections,
    includeAudio: modern ? source.includeAudio === true : true,
    data: {
      ...checked,
      stories: checked.stories.filter((s) => known.has(s.id)),
    },
    storyReferences: [...referenceMap.values()],
    ...(typeof source.createdAt === "string"
      ? { createdAt: source.createdAt }
      : {}),
  };
}
const normalized = (value: string) =>
  value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
const storyKey = (story: Story) =>
  JSON.stringify([
    normalized(story.title),
    story.text.replace(/\r\n/g, "\n").trim(),
  ]);
const wordKey = (word: Word) =>
  normalizeWord(word.word) + "|" + wordTypeKey(word.type);
const grammarKey = (g: Notebook["grammar"][number]) =>
  JSON.stringify([
    g.title.trim(),
    g.body.trim(),
    g.tense ?? "",
    g.modality ?? "",
  ]);
const testKey = (t: NonNullable<Notebook["exams"]>["tests"][number]) =>
  JSON.stringify([
    t.exam,
    t.title.trim(),
    t.section,
    t.questions.map(({ id, ...q }) => q),
  ]);
function mergeRows<T extends { id: string }>(
  current: T[],
  incoming: T[],
  key: (row: T) => string,
) {
  const rows = [...current],
    ids = new Map(current.map((row) => [row.id, row])),
    keys = new Map(current.map((row) => [key(row), row]));
  let added = 0,
    skipped = 0;
  for (const row of incoming) {
    if (ids.has(row.id) || keys.has(key(row))) {
      skipped++;
      continue;
    }
    rows.push(row);
    ids.set(row.id, row);
    keys.set(key(row), row);
    added++;
  }
  return { rows, added, skipped };
}
export function planRestore(
  currentValue: Notebook,
  bundle: BackupBundle,
  options: RestoreOptions,
  availableAudioIds?: string[],
): RestorePlan {
  const current = validateNotebook(currentValue),
    selected = checkSections(options.sections);
  if (
    selected.some((key) => !bundle.sections.includes(key)) ||
    !["merge", "replace"].includes(options.mode)
  )
    throw Error("Geri yükleme seçimi geçersiz.");
  const incoming = bundle.data,
    replace = options.mode === "replace";
  const grammarMapping = new Map<string, string>();
  const attemptMapping = new Map<
    string,
    NonNullable<Notebook["exams"]>["attempts"][number]
  >();
  const next = {
    ...current,
    storyNotes: [...(current.storyNotes ?? [])],
    audioTimings: { ...current.audioTimings },
    exams: current.exams ?? { tests: [], attempts: [] },
  };
  const summary: RestoreSummary = {
    added: emptyCounts(),
    skipped: emptyCounts(),
    removed: emptyCounts(),
    notes: 0,
    attempts: 0,
    detachedLinks: 0,
    missingAudio: 0,
  };
  const warnings: string[] = [],
    storyMapping = new Map<string, string>();
  if (
    selected.includes("words") &&
    incoming.studyPreferences &&
    (replace || !current.studyPreferences)
  )
    next.studyPreferences = incoming.studyPreferences;
  const sourceStoryMap = new Map(incoming.stories.map((s) => [s.id, s]));
  const references = new Map(
    [...bundle.storyReferences, ...incoming.stories].map((s) => [s.id, s]),
  );
  let conflicts = 0;
  if (selected.includes("stories")) {
    const rows: Story[] = replace ? [] : [...current.stories];
    const ids = new Map(rows.map((s) => [s.id, s])),
      keys = new Map(rows.map((s) => [storyKey(s), s]));
    for (const story of incoming.stories) {
      const match = ids.get(story.id) ?? keys.get(storyKey(story));
      if (match) {
        summary.skipped.stories++;
        storyMapping.set(story.id, match.id);
        if (storyKey(match) !== storyKey(story)) conflicts++;
        continue;
      }
      const copy = { ...story };
      if (
        copy.audioId &&
        availableAudioIds &&
        !availableAudioIds.includes(copy.audioId)
      ) {
        delete copy.audioId;
        summary.missingAudio++;
      }
      rows.push(copy);
      ids.set(copy.id, copy);
      keys.set(storyKey(copy), copy);
      storyMapping.set(story.id, copy.id);
      summary.added.stories++;
    }
    next.stories = rows;
    if (replace) summary.removed.stories = current.stories.length;
    const notes = (incoming.storyNotes ?? [])
      .filter((note) => {
        const source = sourceStoryMap.get(note.storyId),
          target = ids.get(storyMapping.get(note.storyId) ?? "");
        return source && target && storyKey(source) === storyKey(target);
      })
      .map((note) => ({ ...note, storyId: storyMapping.get(note.storyId)! }));
    const noteKey = (note: (typeof notes)[number]) =>
      JSON.stringify([
        note.storyId,
        note.selection,
        note.title,
        note.body,
        note.category,
        note.tags ?? [],
      ]);
    const noteResult = mergeRows(
      replace ? [] : next.storyNotes,
      notes,
      noteKey,
    );
    next.storyNotes = noteResult.rows;
    summary.notes = noteResult.added;
    if (replace) next.audioTimings = {};
    for (const [sourceId, times] of Object.entries(
      incoming.audioTimings ?? {},
    )) {
      const targetId = storyMapping.get(sourceId),
        target = ids.get(targetId ?? ""),
        source = sourceStoryMap.get(sourceId);
      if (
        targetId &&
        target?.audioId &&
        source &&
        storyKey(source) === storyKey(target) &&
        !next.audioTimings[targetId]
      )
        next.audioTimings[targetId] = [...times];
    }
  }
  const finalStories = new Map(next.stories.map((s) => [s.id, s]));
  const resolveIncomingLink = (id: string): string => {
    if (!id) return "";
    if (storyMapping.has(id)) return storyMapping.get(id)!;
    const source = references.get(id),
      sameId = finalStories.get(id);
    if (
      sameId &&
      source &&
      normalized(source.title) === normalized(sameId.title) &&
      (!sourceStoryMap.has(id) ||
        storyKey(sourceStoryMap.get(id)!) === storyKey(sameId))
    )
      return id;
    if (source?.title) {
      const matches = next.stories.filter(
        (s) =>
          normalized(s.title) === normalized(source.title) &&
          (sourceStoryMap.has(id)
            ? storyKey(sourceStoryMap.get(id)!) === storyKey(s)
            : s.level === source.level),
      );
      if (matches.length === 1) return matches[0].id;
    }
    return "";
  };
  const repairWord = (word: Word, importing: boolean): Word => {
    const resolve = importing
      ? resolveIncomingLink
      : (id: string) => (finalStories.has(id) ? id : "");
    const storyId = resolve(word.storyId),
      storyIds = word.storyIds?.map(resolve).filter(Boolean);
    const lost =
      (word.storyId && !storyId) || word.storyIds?.some((id) => !resolve(id));
    if (lost) summary.detachedLinks++;
    const sourceLevel = importing
      ? (references.get(word.storyId)?.level ?? "")
      : wordLevel(word, current.stories);
    return {
      ...word,
      storyId,
      ...((word.contexts !== undefined || lost) &&
      wordContexts(word, importing ? incoming.stories : current.stories).length
        ? {
            contexts: wordContexts(
              word,
              importing ? incoming.stories : current.stories,
            ).map((context) => ({
              ...context,
              storyId: context.storyId ? resolve(context.storyId) : "",
            })),
          }
        : {}),
      ...(word.storyIds ? { storyIds: [...new Set(storyIds)] } : {}),
      ...(lost && word.level === undefined && sourceLevel
        ? { level: sourceLevel }
        : {}),
    };
  };
  if (selected.includes("words")) {
    const words = incoming.words.map((w) => repairWord(w, true));
    const result = mergeRows(
      replace ? [] : current.words.map((w) => repairWord(w, false)),
      words,
      wordKey,
    );
    next.words = result.rows;
    summary.added.words = result.added;
    summary.skipped.words = result.skipped;
    if (replace) summary.removed.words = current.words.length;
  } else if (selected.includes("stories"))
    next.words = current.words.map((w) => repairWord(w, false));
  if (selected.includes("grammar")) {
    if (replace) {
      if (incoming.hiddenGrammarTopics !== undefined)
        next.hiddenGrammarTopics = incoming.hiddenGrammarTopics;
      else delete next.hiddenGrammarTopics;
    } else if (
      current.hiddenGrammarTopics === undefined &&
      incoming.hiddenGrammarTopics !== undefined
    )
      next.hiddenGrammarTopics = incoming.hiddenGrammarTopics;
    const topics = mergeTopics(
      replace ? [] : (current.grammarTopics ?? []),
      incoming.grammarTopics ?? [],
    );
    if (
      current.grammarTopics !== undefined ||
      incoming.grammarTopics !== undefined
    )
      next.grammarTopics = topics.rows;
    const result = mergeRows(
      replace ? [] : current.grammar,
      incoming.grammar.map((g) =>
        g.topicId ? { ...g, topicId: topics.ids.get(g.topicId) } : g,
      ),
      (g) => grammarKey(g) + "|" + (g.topicId ?? ""),
    );
    next.grammar = result.rows;
    const targets = new Map(
      result.rows.map((g) => [grammarKey(g) + "|" + (g.topicId ?? ""), g]),
    );
    for (const g of incoming.grammar) {
      const target = targets.get(
        grammarKey(g) +
          "|" +
          (g.topicId ? (topics.ids.get(g.topicId) ?? "") : ""),
      );
      if (target) grammarMapping.set(g.id, target.id);
    }
    summary.added.grammar = result.added;
    summary.skipped.grammar = result.skipped;
    if (replace) summary.removed.grammar = current.grammar.length;
  }
  if (selected.includes("exams")) {
    const source = incoming.exams ?? { tests: [], attempts: [] };
    const topics = mergeTopics(
      replace ? [] : (next.exams.topics ?? DEFAULT_EXAM_TOPICS),
      source.topics ?? DEFAULT_EXAM_TOPICS,
    );
    const remapTest = (test: (typeof source.tests)[number]) => {
      const mapped = topics.ids.get(examTopicId(test)) ?? "";
      return test.topicId !== undefined || mapped !== examTopicId(test)
        ? { ...test, topicId: mapped }
        : test;
    };
    const tests = mergeRows(
      replace ? [] : next.exams.tests,
      source.tests.map(remapTest),
      testKey,
    );
    const attemptKey = (a: (typeof source.attempts)[number]) =>
      JSON.stringify([
        a.created,
        testKey(a.test),
        a.mode,
        a.answers,
        a.finished,
        a.elapsed,
        a.position,
        a.flags,
      ]);
    const incomingAttempts = source.attempts.map((a) => ({
      ...a,
      test: remapTest(a.test),
    }));
    const attempts = mergeRows(
      replace ? [] : next.exams.attempts,
      incomingAttempts,
      attemptKey,
    );
    const targets = new Map(attempts.rows.map((a) => [attemptKey(a), a]));
    for (const a of incomingAttempts) {
      const target = targets.get(attemptKey(a));
      if (target) attemptMapping.set(a.id, target);
    }
    next.exams = {
      tests: tests.rows,
      attempts: attempts.rows,
      ...(next.exams.topics !== undefined || source.topics !== undefined
        ? { topics: topics.rows }
        : {}),
    };
    summary.added.exams = tests.added;
    summary.skipped.exams = tests.skipped;
    summary.attempts = attempts.added;
    if (replace) summary.removed.exams = current.exams?.tests.length ?? 0;
  }
  if (
    (current.learning !== undefined || incoming.learning !== undefined) &&
    (selected.includes("grammar") || selected.includes("exams"))
  ) {
    const before = current.learning ?? emptyLearning(),
      source = incoming.learning ?? emptyLearning();
    const targetCards = grammarCards(next);
    const contentKey = (c: LearningCard) =>
      JSON.stringify([
        c.mode,
        c.prompt,
        c.passage,
        c.options,
        c.answer,
        c.explanation,
      ]);
    const identityPart = (c: LearningCard) => {
      try {
        const parts = JSON.parse(c.identity);
        return Array.isArray(parts) ? parts[1] : undefined;
      } catch {
        return undefined;
      }
    };
    const relink = (card: LearningCard): LearningCard => {
      if (card.kind === "grammar") {
        const targetId = grammarMapping.get(card.sourceId);
        const candidates = targetId
          ? targetCards.filter(
              (c) =>
                c.sourceId === targetId && contentKey(c) === contentKey(card),
            )
          : [];
        const target =
          candidates.find((c) => identityPart(c) === identityPart(card)) ??
          (candidates.length === 1 ? candidates[0] : undefined);
        return target
          ? { ...card, sourceId: target.sourceId, identity: target.identity }
          : card;
      }
      const target = attemptMapping.get(card.sourceId);
      const candidates =
        target?.test.questions.filter(
          (q) =>
            q.prompt === card.prompt &&
            q.passage === card.passage &&
            q.answer === card.answer &&
            JSON.stringify(q.options) === JSON.stringify(card.options),
        ) ?? [];
      const question =
        candidates.find((q) => q.id === identityPart(card)) ??
        (candidates.length === 1 ? candidates[0] : undefined);
      return target && question
        ? {
            ...card,
            sourceId: target.id,
            identity: JSON.stringify([target.test.id, question.id]),
          }
        : card;
    };
    next.learning = validateLearning({
      grammarHistory: selected.includes("grammar")
        ? mergeRows(
            replace ? [] : before.grammarHistory,
            source.grammarHistory.map((e) => ({ ...e, card: relink(e.card) })),
            (e) => JSON.stringify(e),
          ).rows
        : before.grammarHistory,
      mistakeHistory: selected.includes("exams")
        ? mergeRows(
            replace ? [] : before.mistakeHistory,
            source.mistakeHistory.map((e) => ({ ...e, card: relink(e.card) })),
            (e) => JSON.stringify(e),
          ).rows
        : before.mistakeHistory,
      weekly:
        selected.includes("grammar") && selected.includes("exams")
          ? mergeRows(
              replace ? [] : before.weekly,
              source.weekly.map((s) => ({ ...s, cards: s.cards.map(relink) })),
              (s) => JSON.stringify(s),
            ).rows
          : before.weekly,
    });
  }
  if (conflicts)
    warnings.push(
      `${conflicts} hikâyede aynı kimlikli farklı içerik bulundu; mevcut hikâye korundu.`,
    );
  const skipped = Object.values(summary.skipped).reduce((a, b) => a + b, 0);
  if (skipped)
    warnings.push(
      `${skipped} mevcut veya tekrarlanan kayıt yeniden eklenmeyecek; mevcut içerik korunacak.`,
    );
  if (summary.detachedLinks)
    warnings.push(
      `${summary.detachedLinks} kelime kartında bulunamayan hikâye bağlantıları kaldırılacak. Kartların anlamları ve diğer içerikleri korunacak.`,
    );
  if (summary.missingAudio)
    warnings.push(
      `${summary.missingAudio} hikâyenin ses dosyası yedekte veya uygulamada bulunamadı. Bu hikâyeler metin olarak yüklenecek.`,
    );
  return { data: validateNotebook(next), summary, warnings };
}
