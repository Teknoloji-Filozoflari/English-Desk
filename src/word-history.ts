import type { Word } from "./model.ts";
import { isCalendarDay } from "./memorization.ts";
export type WordAnswer = {
  id: string;
  day: string;
  outcome: "again" | "hard" | "good";
  activity: "learn" | "review";
  engine: "memory" | "legacy";
};
export function validateWordHistory(value: unknown): WordAnswer[] {
  if (!Array.isArray(value) || value.length > 20000)
    throw Error("Kelime cevap geçmişi geçersiz.");
  const ids = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 2000 ||
      ids.has(row.id) ||
      !isCalendarDay(row.day) ||
      !["again", "hard", "good"].includes(row.outcome) ||
      !["learn", "review"].includes(row.activity) ||
      !["memory", "legacy"].includes(row.engine)
    )
      throw Error("Kelime cevap kaydı geçersiz.");
    ids.add(row.id);
    return {
      id: row.id,
      day: row.day,
      outcome: row.outcome,
      activity: row.activity,
      engine: row.engine,
    };
  });
}
export function appendWordAnswer(
  before: Word,
  after: Word,
  day: string,
  outcome: WordAnswer["outcome"],
  activity: WordAnswer["activity"],
  engine: WordAnswer["engine"],
): Word {
  const history = before.answerHistory ?? [];
  const id = JSON.stringify([
    engine,
    before.review ?? null,
    before.memorization ?? null,
    history.length,
  ]);
  if (history.some((e) => e.id === id)) return after;
  return {
    ...after,
    answerHistory: validateWordHistory([
      ...history,
      { id, day, outcome, activity, engine },
    ]),
  };
}
