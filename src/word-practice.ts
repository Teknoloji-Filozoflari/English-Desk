import type { Word } from "./model.ts";
import { wordContexts } from "./word-context.ts";
export const PRACTICE_MODES = [
  ["classic", "Klasik kart"],
  ["en-tr", "İngilizce → Türkçe"],
  ["tr-en", "Türkçe → İngilizce"],
  ["written", "Yazılı cevap"],
  ["cloze", "Boşluk doldurma"],
] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number][0];
export type Direction = "en-tr" | "tr-en";
export type Evaluation = "correct" | "incorrect" | "uncertain";
export function normalizeAnswer(value: string, language: "en" | "tr") {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(language);
}
function alternatives(value: string) {
  // Only explicit list delimiters. Slashes, parentheses and prose are ambiguous.
  return value
    .split(/[;,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
export function meanings(word: Word): string[] {
  return [
    ...new Set(
      [
        word.meaning,
        ...(word.senses ?? []).map((sense) => sense.meaning),
        ...wordContexts(word).map((context) => context.meaning),
      ].flatMap(alternatives),
    ),
  ];
}
export function evaluateAnswer(
  word: Word,
  answer: string,
  direction: Direction,
  cloze = false,
): Evaluation {
  const language = direction === "en-tr" ? "tr" : "en";
  const normalized = normalizeAnswer(answer, language);
  if (!normalized) return "incorrect";
  const expected = direction === "en-tr" ? meanings(word) : [word.word];
  if (expected.some((value) => normalizeAnswer(value, language) === normalized))
    return "correct";
  if (
    direction === "tr-en" &&
    !cloze &&
    alternatives(word.synonyms).some(
      (value) => normalizeAnswer(value, "en") === normalized,
    )
  )
    return "uncertain";
  // Recognize a component of a composite explanation as uncertain, never as an
  // exact answer. Do not use edit distance, substring matching or strip negation.
  if (
    direction === "en-tr" &&
    expected.some((value) =>
      value
        .split(/[()/]/)
        .some((part) => normalizeAnswer(part, "tr") === normalized),
    )
  )
    return "uncertain";
  return "incorrect";
}
export function clozeExample(
  word: Word,
): { sentence: string; original: string; translation: string } | null {
  return clozeExamples(word)[0] ?? null;
}
export function clozeExamples(word: Word): {
  sentence: string;
  original: string;
  translation: string;
  meaning?: string;
  source?: string;
}[] {
  const escaped = word.word
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (!escaped) return [];
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_'-])(${escaped})(?=$|[^\\p{L}\\p{N}_'-])`,
    "giu",
  );
  const examples: {
    example: string;
    translation: string;
    meaning?: string;
    source?: string;
  }[] = [
    ...wordContexts(word).map((context) => ({
      example: context.sentence,
      translation: context.translation,
      meaning: context.meaning,
      source:
        context.kind === "personal" ? "Kendi örneğim" : context.storyTitle,
    })),
    { example: word.example, translation: word.translation },
    ...(word.senses ?? []),
    ...(word.examples ?? []),
  ];
  const result: ReturnType<typeof clozeExamples> = [];
  for (const example of examples) {
    if (!example.example.trim()) continue;
    const sentence = example.example.replace(pattern, "$1_____");
    if (
      sentence !== example.example &&
      !result.some(
        (item) =>
          item.original === example.example &&
          item.meaning === ("meaning" in example ? example.meaning : undefined),
      )
    )
      result.push({
        sentence,
        original: example.example,
        translation: example.translation,
        ...(example.meaning !== undefined
          ? { meaning: example.meaning, source: example.source }
          : {}),
      });
  }
  return result;
}

// Includes content as well as both schedules: a stale prompt must not be scored
// against an edited meaning or consume a different repetition step.
export function practiceSnapshot(word: Word): string {
  return JSON.stringify([
    word.word,
    word.meaning,
    word.senses,
    word.synonyms,
    word.example,
    word.examples,
    word.review,
    word.memorization,
    word.contexts,
    word.answerHistory,
  ]);
}
