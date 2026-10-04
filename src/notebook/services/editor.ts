import { isModalityTopic } from "../../modality.ts";
import type {
  Grammar,
  Notebook,
  Story,
  StoryNote,
  StoryNoteCategory,
  Word,
  WordSense,
} from "../../model.ts";
import { isLevel, STORY_NOTE_CATEGORIES } from "../../model.ts";
import { isTenseName } from "../../tenses.ts";
import { addRelatedCards, normalizeWord } from "../../word-enrichment.ts";
import { isVerbType, wordTypeKey } from "../../word-types.ts";
import type { Editor } from "../types.ts";

export function applyEditor(
  current: Notebook,
  editor: Editor,
  extraSenses: WordSense[],
  makeId: () => string,
): { data: Notebook; recordId: string } {
  const values = Object.fromEntries(
    Object.entries(editor.values).map(([key, value]) => [key, value.trim()]),
  );
  const required =
    editor.kind === "stories"
      ? ["title", "text"]
      : editor.kind === "words"
        ? ["word"]
        : ["title", "body"];
  if (required.some((key) => !values[key])) {
    throw new Error("Yıldızlı alanları doldur.");
  }
  if (editor.kind === "stories" && !isLevel(values.level)) {
    throw new Error("A1, A2, B1, B2, C1 veya C2 seviyesini seç.");
  }
  if (
    editor.kind === "storyNotes" &&
    (!values.selection ||
      !current.stories.some((story) => story.id === values.storyId))
  ) {
    throw new Error("Hikâye seçimi bulunamadı. Yeniden seç.");
  }
  if (
    editor.kind === "storyNotes" &&
    (values.selection.length > 5000 ||
      values.title.length > 200 ||
      values.body.length > 20000)
  ) {
    throw new Error("Not çok uzun. Seçimi, başlığı veya açıklamayı kısalt.");
  }
  if (
    editor.kind === "words" &&
    (extraSenses.length > 30 ||
      extraSenses.some(
        (sense) =>
          !sense.meaning.trim() ||
          Object.values(sense).some((value) => value.length > 10000),
      ))
  ) {
    throw new Error(
      "Ek anlamların her birine Türkçe anlam yaz ve uzun alanları kısalt.",
    );
  }
  const tags =
    editor.kind === "storyNotes"
      ? [
          ...new Set(
            (values.tags ?? "")
              .split(",")
              .map((tag) => tag.trim().toLocaleLowerCase("tr"))
              .filter(Boolean),
          ),
        ]
      : [];
  if (
    editor.kind === "words" &&
    isVerbType(values.type) &&
    (values.verbRegularity === "regular" ||
      values.verbRegularity === "irregular") &&
    (!values.verbPast || !values.verbParticiple)
  ) {
    throw new Error("Düzenli/düzensiz seçtiğinde V2 ve V3 biçimlerini doldur.");
  }
  if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
    throw new Error(
      "En fazla 20 etiket kullan; her etiket 40 karakteri geçmesin.",
    );
  }
  const recordId = editor.id ?? makeId();
  if (
    editor.kind === "words" &&
    current.words.some(
      (w) =>
        w.id !== editor.id &&
        normalizeWord(w.word) === normalizeWord(values.word) &&
        wordTypeKey(w.type) === wordTypeKey(values.type),
    )
  ) {
    throw new Error(
      "Bu kelimenin kartı zaten var. Kelimelerim bölümünden mevcut kartı düzenle.",
    );
  }
  const next = { ...current };
  if (editor.kind === "stories") {
    const old = current.stories.find((s) => s.id === editor.id);
    const record: Story = {
      id: recordId,
      title: values.title,
      text: values.text,
      level: values.level,
      read: old?.read ?? false,
      sample: old?.sample ?? false,
      ...(values.sourceName ? { sourceName: values.sourceName } : {}),
      ...(old?.audioId ? { audioId: old.audioId } : {}),
    };
    next.stories = editor.id
      ? current.stories.map((s) => (s.id === editor.id ? record : s))
      : [...current.stories, record];
  } else if (editor.kind === "words") {
    const record: Word = {
      ...current.words.find((w) => w.id === editor.id),
      id: recordId,
      definition: values.definition ?? "",
      levelSource: values.levelSource ?? "",
      word: values.word,
      meaning: values.meaning,
      type: values.type,
      synonyms: values.synonyms,
      antonyms: values.antonyms,
      example: values.example,
      translation: values.translation,
      storyId: values.storyId,
      level: values.level,
      senses: extraSenses.map((sense) => ({
        meaning: sense.meaning.trim(),
        definition: sense.definition.trim(),
        example: sense.example.trim(),
        translation: sense.translation.trim(),
      })),
      verbForms: isVerbType(values.type)
        ? {
            base: values.verbBase || values.word,
            past: values.verbPast || "",
            participle: values.verbParticiple || "",
            regularity:
              values.verbRegularity === "regular" ||
              values.verbRegularity === "irregular"
                ? values.verbRegularity
                : "",
          }
        : undefined,
    };
    next.words = editor.id
      ? current.words.map((w) => (w.id === editor.id ? record : w))
      : [...current.words, record];
    next.words = addRelatedCards(next, record, makeId).words;
  } else if (editor.kind === "storyNotes") {
    const record: StoryNote = {
      id: recordId,
      storyId: values.storyId,
      selection: values.selection,
      category: STORY_NOTE_CATEGORIES.includes(
        values.category as StoryNoteCategory,
      )
        ? (values.category as StoryNoteCategory)
        : "other",
      title: values.title,
      body: values.body,
      tags,
    };
    next.storyNotes = editor.id
      ? (current.storyNotes ?? []).map((note) =>
          note.id === editor.id ? record : note,
        )
      : [...(current.storyNotes ?? []), record];
  } else {
    const record: Grammar = {
      id: recordId,
      title: values.title,
      body: values.body,
      ...(values.topicId ? { topicId: values.topicId } : {}),
      ...(isTenseName(values.tense) ? { tense: values.tense } : {}),
      ...(isModalityTopic(values.modality)
        ? { modality: values.modality }
        : {}),
    };
    next.grammar = editor.id
      ? current.grammar.map((g) => (g.id === editor.id ? record : g))
      : [...current.grammar, record];
  }
  return { data: next, recordId };
}
