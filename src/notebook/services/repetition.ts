import type { Notebook, Word } from "../../model.ts";
import {
  calendarDay,
  completeMemorization,
  isCalendarDay,
  learnMemorization,
  type Memorization,
} from "../../memorization.ts";
import { isDue, reviewWord } from "../../review.ts";
import { firstLearnedDay } from "../../daily-study.ts";
import { appendWordAnswer } from "../../word-history.ts";

function updateWord(
  data: Notebook,
  id: string,
  update: (word: Word) => Word,
): Notebook {
  let changed = false;
  const words = data.words.map((word) => {
    if (word.id !== id) return word;
    const next = update(word);
    changed ||= next !== word;
    return next;
  });
  return changed ? { ...data, words } : data;
}

export function enrollMemorization(
  data: Notebook,
  id: string,
  today = calendarDay(),
): Notebook {
  if (!isCalendarDay(today)) return data;
  return updateWord(data, id, (word) =>
    word.memorization
      ? word
      : {
          ...word,
          memorization: { addedOn: today, reviews: [] },
        },
  );
}

// Compare the state shown to the learner with the state being saved. A delayed
// duplicate must not answer the next step, even if it arrives after midnight.
export function recordMemorization(
  data: Notebook,
  id: string,
  expected: Memorization,
  action: "learn" | "review",
  today = calendarDay(),
): Notebook {
  return updateWord(data, id, (word) => {
    const plan = word.memorization;
    if (
      !plan ||
      !word.meaning.trim() ||
      plan.addedOn !== expected.addedOn ||
      plan.learnedOn !== expected.learnedOn ||
      plan.reviews.length !== expected.reviews.length ||
      plan.reviews.some((day, i) => day !== expected.reviews[i])
    )
      return word;
    const memorization =
      action === "learn"
        ? learnMemorization(plan, today)
        : completeMemorization(plan, today);
    return memorization === plan
      ? word
      : appendWordAnswer(
          word,
          { ...word, memorization },
          today,
          "good",
          action,
          "memory",
        );
  });
}

export function recordWordReview(
  data: Notebook,
  id: string,
  expected: Word["review"],
  result: "again" | "hard" | "good",
  now = Date.now(),
): Notebook {
  return updateWord(data, id, (word) => {
    const review = word.review;
    if (
      !Number.isFinite(now) ||
      !isDue(word, now) ||
      review?.due !== expected?.due ||
      review?.interval !== expected?.interval ||
      review?.repetitions !== expected?.repetitions
    )
      return word;
    const today = calendarDay(new Date(now));
    const activity = word.studyActivity ?? {};
    const startedOn = activity.startedOn ?? (!word.review ? today : undefined);
    const known = firstLearnedDay(word);
    const firstLearnedOn =
      activity.firstLearnedOn ??
      (!known && startedOn && result !== "again" ? today : undefined);
    const wasLearned = !!known || (!!word.review && !startedOn);
    return appendWordAnswer(
      word,
      {
        ...reviewWord(word, result, now),
        studyActivity: {
          ...activity,
          ...(startedOn ? { startedOn } : {}),
          ...(firstLearnedOn ? { firstLearnedOn } : {}),
          ...(wasLearned ? { lastReviewedOn: today } : {}),
        },
      },
      today,
      result,
      wasLearned ? "review" : "learn",
      "legacy",
    );
  });
}
