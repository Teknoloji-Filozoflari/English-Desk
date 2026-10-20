import type { Notebook, Story, Word } from "./model.ts";
export type WordContext = {
  id: string;
  kind: "story" | "personal";
  storyId: string;
  storyTitle: string;
  selection: string;
  sentence: string;
  translation: string;
  meaning: string;
};
export function validateWordTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some(
      (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40,
    )
  )
    throw Error(
      "Kelime etiketleri geçersiz. En fazla 20 etiket, her biri en fazla 40 karakter olabilir.",
    );
  return [...new Set(value.map((tag) => tag.trim().toLocaleLowerCase("tr")))];
}
export function validateWordContexts(value: unknown): WordContext[] {
  if (!Array.isArray(value) || value.length > 100)
    throw Error("Kelime bağlamları geçersiz. En fazla 100 örnek saklanabilir.");
  const ids = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      !["story", "personal"].includes(row.kind) ||
      [
        "id",
        "storyId",
        "storyTitle",
        "selection",
        "sentence",
        "translation",
        "meaning",
      ].some(
        (key) =>
          typeof row[key] !== "string" ||
          row[key].length >
            // Old notebook string fields allow 500,000 characters. Keep their
            // snapshots readable during migration, including the legacy ID prefix.
            (key === "id" ? 500007 : 500000),
      ) ||
      !row.id.trim() ||
      ids.has(row.id) ||
      !row.sentence.trim() ||
      !row.selection.trim() ||
      (row.kind === "personal" && !!row.storyId)
    )
      throw Error("Kelime bağlam kaydı geçersiz.");
    ids.add(row.id);
    return {
      id: row.id,
      kind: row.kind,
      storyId: row.storyId,
      storyTitle: row.storyTitle,
      selection: row.selection,
      sentence: row.sentence,
      translation: row.translation,
      meaning: row.meaning,
    };
  });
}
// Legacy examples are shown without guessing new associations or rewriting old files.
export function wordContexts(word: Word, stories: Story[] = []): WordContext[] {
  const contexts = [...(word.contexts ?? [])];
  if (word.contexts === undefined && word.storyId && word.example.trim()) {
    contexts.unshift({
      id: `legacy:${word.id}`,
      kind: "story",
      storyId: word.storyId,
      storyTitle:
        stories.find((story) => story.id === word.storyId)?.title ??
        "Kaynak hikâye",
      selection: word.word,
      sentence: word.example,
      translation: word.translation,
      meaning: word.meaning,
    });
  }
  return contexts;
}
export function attachStoryContext(
  word: Word,
  story: Story,
  sentence: string,
  selection: string,
  meaning: string,
  makeId: () => string,
  stories: Story[],
): Word {
  const contexts = wordContexts(word, stories);
  const context: WordContext = {
    id: makeId(),
    kind: "story",
    storyId: story.id,
    storyTitle: story.title,
    sentence,
    selection,
    meaning,
    translation: sentence === word.example ? word.translation : "",
  };
  const duplicate = contexts.some(
    (item) =>
      item.kind === "story" &&
      item.storyId === story.id &&
      item.sentence === sentence &&
      item.selection.toLocaleLowerCase("en") ===
        selection.toLocaleLowerCase("en") &&
      item.meaning === meaning,
  );
  return {
    ...word,
    storyId: word.storyId || story.id,
    storyIds: [
      ...new Set(
        [word.storyId, ...(word.storyIds ?? []), story.id].filter(Boolean),
      ),
    ],
    contexts: validateWordContexts(
      duplicate ? contexts : [...contexts, context],
    ),
  };
}
export function savePersonalContext(
  data: Notebook,
  wordId: string,
  draft: Pick<WordContext, "sentence" | "translation" | "meaning">,
  makeId: () => string,
  contextId?: string,
): Notebook {
  const word = data.words.find((word) => word.id === wordId);
  if (!word) throw Error("Kelime bulunamadı.");
  const contexts = wordContexts(word, data.stories);
  if (
    contextId &&
    !contexts.some(
      (context) => context.id === contextId && context.kind === "personal",
    )
  )
    throw Error("Düzenlenecek kişisel örnek bulunamadı.");
  const context: WordContext = {
    id: contextId ?? makeId(),
    kind: "personal",
    storyId: "",
    storyTitle: "",
    selection: word.word,
    sentence: draft.sentence.trim(),
    translation: draft.translation.trim(),
    meaning: draft.meaning.trim(),
  };
  const updated = validateWordContexts(
    contextId
      ? contexts.map((item) => (item.id === contextId ? context : item))
      : [...contexts, context],
  );
  return {
    ...data,
    words: data.words.map((item) =>
      item.id === wordId ? { ...item, contexts: updated } : item,
    ),
  };
}
