import type { Notebook } from "../../model.ts";
import { calendarDay, memorizationDue } from "../../memorization.ts";
import { practiceSnapshot } from "../../word-practice.ts";
import { recordMemorization, recordWordReview } from "./repetition.ts";
import { appendWordAnswer } from "../../word-history.ts";
export type PracticeOutcome = "again" | "hard" | "good";
export function practiceAvailability(
  word: Notebook["words"][number],
  now = Date.now(),
) {
  if (!word.meaning.trim()) return false;
  if (word.memorization)
    return (
      !word.memorization.learnedOn ||
      memorizationDue(word.memorization, calendarDay(new Date(now)))
    );
  return !word.review || word.review.due <= now;
}
export function recordPractice(
  data: Notebook,
  id: string,
  expected: string,
  outcome: PracticeOutcome,
  now = Date.now(),
): { data: Notebook; status: "saved" | "retry" | "stale" } {
  const word = data.words.find((word) => word.id === id);
  if (
    !Number.isFinite(now) ||
    !word ||
    practiceSnapshot(word) !== expected ||
    !practiceAvailability(word, now)
  )
    return { data, status: "stale" };
  if (word.memorization) {
    // A miss stays due; neither the learning day nor the fixed schedule changes.
    if (outcome === "again")
      return {
        data: {
          ...data,
          words: data.words.map((w) =>
            w.id !== id
              ? w
              : appendWordAnswer(
                  w,
                  w,
                  calendarDay(new Date(now)),
                  outcome,
                  w.memorization?.learnedOn ? "review" : "learn",
                  "memory",
                ),
          ),
        },
        status: "retry",
      };
    const next = recordMemorization(
      data,
      id,
      word.memorization,
      word.memorization.learnedOn ? "review" : "learn",
      calendarDay(new Date(now)),
    );
    return { data: next, status: next === data ? "stale" : "saved" };
  }
  const next = recordWordReview(data, id, word.review, outcome, now);
  return { data: next, status: next === data ? "stale" : "saved" };
}
