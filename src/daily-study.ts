import type { Notebook, Word } from "./model.ts";
import { calendarDay, isCalendarDay, memorizationDue } from "./memorization.ts";
import { isDue } from "./review.ts";
import { learningWrongGroups, grammarCards, grammarDue } from "./learning.ts";

export const DEFAULT_NEW_WORD_GOAL = 5;
export type StudyPreferences = {
  dailyNewWordGoal: number;
  weeklyReviewGoal?: number;
};
export type StudyActivity = {
  startedOn?: string;
  firstLearnedOn?: string;
  lastReviewedOn?: string;
};
export function validateStudyPreferences(value: unknown): StudyPreferences {
  const row = value as StudyPreferences;
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    !Number.isInteger(row.dailyNewWordGoal) ||
    row.dailyNewWordGoal < 0 ||
    row.dailyNewWordGoal > 100
  )
    throw Error("Günlük yeni kelime hedefi 0–100 arasında tam sayı olmalı.");
  if (
    row.weeklyReviewGoal !== undefined &&
    (!Number.isInteger(row.weeklyReviewGoal) ||
      row.weeklyReviewGoal < 0 ||
      row.weeklyReviewGoal > 1000)
  )
    throw Error(
      "Haftalık başarılı tekrar hedefi 0–1000 arasında tam sayı olmalı.",
    );
  return {
    dailyNewWordGoal: row.dailyNewWordGoal,
    ...(row.weeklyReviewGoal !== undefined
      ? { weeklyReviewGoal: row.weeklyReviewGoal }
      : {}),
  };
}
export function validateStudyActivity(value: unknown): StudyActivity {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Kelime çalışma kaydı geçersiz.");
  const row = value as StudyActivity;
  const result: StudyActivity = {};
  for (const key of [
    "startedOn",
    "firstLearnedOn",
    "lastReviewedOn",
  ] as const) {
    if (row[key] !== undefined) {
      if (!isCalendarDay(row[key]))
        throw Error("Kelime çalışma tarihi geçersiz.");
      result[key] = row[key];
    }
  }
  return result;
}
export function firstLearnedDay(word: Word): string | undefined {
  return [word.memorization?.learnedOn, word.studyActivity?.firstLearnedOn]
    .filter((day): day is string => !!day)
    .sort()[0];
}
export function dailyStudy(data: Notebook, now = Date.now()) {
  const today = calendarDay(new Date(now));
  const sampleIds = new Set(
    data.stories.filter((story) => story.sample).map((story) => story.id),
  );
  const words = data.words.filter((word) => {
    const links = [word.storyId, ...(word.storyIds ?? [])].filter(Boolean);
    return !links.length || !links.every((id) => sampleIds.has(id));
  });
  const goal = data.studyPreferences?.dailyNewWordGoal ?? DEFAULT_NEW_WORD_GOAL;
  const memoryDue = words.filter(
    (word) =>
      word.meaning.trim() &&
      word.memorization &&
      memorizationDue(word.memorization, today),
  );
  // Unanswered cards have no scheduled legacy review yet: they are new words.
  const reviewDue = words.filter((word) => word.review && isDue(word, now));
  const pendingIds = new Set(
    [...memoryDue, ...reviewDue].map((word) => word.id),
  );
  const completed = words.filter(
    (word) =>
      !pendingIds.has(word.id) &&
      (word.memorization?.reviews.includes(today) ||
        word.studyActivity?.lastReviewedOn === today),
  );
  const learned = words.filter((word) => firstLearnedDay(word) === today);
  const available = words.filter(
    (word) =>
      word.meaning.trim() &&
      !firstLearnedDay(word) &&
      (!word.review || !!word.studyActivity?.startedOn),
  );
  const remainingNew = Math.max(0, goal - learned.length);
  const total = pendingIds.size + completed.length + goal;
  const done = completed.length + Math.min(goal, learned.length);
  const wrong = learningWrongGroups(data);
  return {
    today,
    grammarPending: grammarCards(data).filter((card) =>
      grammarDue(card, data.learning?.grammarHistory ?? [], today),
    ).length,
    goal,
    pending: pendingIds.size,
    completed: completed.length,
    memoryDue: memoryDue.length,
    reviewDue: reviewDue.length,
    learned: learned.length,
    remainingNew,
    availableNew: available.length,
    pendingLearning: available.filter(
      (word) => word.memorization && !word.memorization.learnedOn,
    ).length,
    progress: total ? Math.round((100 * done) / total) : 0,
    // An estimate for remaining word work, not a recorded study duration.
    estimatedMinutes: Math.ceil(
      ((memoryDue.length + reviewDue.length) * 30 +
        Math.min(remainingNew, available.length) * 90) /
        60,
    ),
    wrong,
    wrongCount: wrong.reduce((sum, group) => sum + group.questions.length, 0),
    stories: data.stories.filter((story) => !story.sample),
    personalWords: words.length,
  };
}
