import type { Notebook, Word } from "./model.ts";
import { addDays, calendarDay, memorizationDue } from "./memorization.ts";
import { firstLearnedDay, DEFAULT_NEW_WORD_GOAL } from "./daily-study.ts";
import {
  grammarCards,
  grammarDue,
  learningMistakes,
  weekStart,
  type LearningCard,
} from "./learning.ts";
import { isExampleExam, score, type ExamAttempt } from "./exams.ts";
import { normalizeWord } from "./word-enrichment.ts";
import { wordTypeKey } from "./word-types.ts";

export const DEFAULT_WEEKLY_REVIEW_GOAL = 35;
function unique<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const wordKey = (w: Word) =>
  JSON.stringify([normalizeWord(w.word), wordTypeKey(w.type)]);
const cardContent = (c: LearningCard) =>
  JSON.stringify([
    c.kind,
    c.mode,
    c.prompt,
    c.passage,
    c.options,
    c.answer,
    c.explanation,
  ]);
function attemptKey(a: ExamAttempt) {
  return JSON.stringify([
    a.created,
    a.test.exam,
    a.test.title,
    a.test.source,
    a.test.section,
    a.test.questions.map((q) => [
      q.prompt,
      q.passage,
      q.kind,
      q.options,
      q.answer,
    ]),
    a.mode,
  ]);
}
export function progressReport(data: Notebook, now = Date.now()) {
  const today = calendarDay(new Date(now)),
    week = weekStart(today),
    weekEnd = addDays(week, 6);
  const sample = new Set(data.stories.filter((s) => s.sample).map((s) => s.id));
  const personal = data.words.filter((w) => {
    const ids = [w.storyId, ...(w.storyIds ?? [])].filter(Boolean);
    return !ids.length || !ids.every((id) => sample.has(id));
  });
  const groups = new Map<string, Word[]>();
  for (const w of personal) {
    const key = wordKey(w);
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  const items = [...groups.values()];
  const learnedDay = (rows: Word[]) =>
    rows
      .map(firstLearnedDay)
      .filter((d): d is string => !!d && d <= today)
      .sort()[0];
  const known = items.filter((rows) => learnedDay(rows));
  const pending = items.filter((rows) =>
    rows.some(
      (w) =>
        w.meaning.trim() &&
        ((!!w.memorization && memorizationDue(w.memorization, today)) ||
          (!!w.review && w.review.due <= now)),
    ),
  );
  const waiting = items.filter((rows) => !learnedDay(rows));
  const wordAnswers = items.flatMap((rows) =>
    unique(
      rows.flatMap((w) => w.answerHistory ?? []),
      (e) => e.id,
    )
      .filter((e) => e.day <= today)
      .map((e) => ({ ...e, key: wordKey(rows[0]) })),
  );
  const answersByWord = new Map<string, typeof wordAnswers>();
  for (const event of wordAnswers) {
    const rows = answersByWord.get(event.key) ?? [];
    rows.push(event);
    answersByWord.set(event.key, rows);
  }
  // Old explicit memory review days are useful completion evidence. They cannot
  // supply an honest answer-rate denominator, since old misses were not recorded.
  const legacyDays = items.flatMap((rows) => {
    const tracked = new Set(
      (answersByWord.get(wordKey(rows[0])) ?? [])
        .filter(
          (e) =>
            e.engine === "memory" &&
            e.activity === "review" &&
            e.outcome !== "again",
        )
        .map((e) => e.day),
    );
    return [...new Set(rows.flatMap((w) => w.memorization?.reviews ?? []))]
      .filter((day) => day <= today && !tracked.has(day))
      .map((day) => ({ day, key: wordKey(rows[0]) }));
  });
  const retained = items.filter((rows) =>
    rows.some(
      (w) =>
        (w.memorization?.reviews ?? []).some((d) => d <= today) ||
        (w.answerHistory ?? []).some(
          (e) =>
            e.day <= today && e.activity === "review" && e.outcome !== "again",
        ),
    ),
  );
  const eventKey = (
    e: NonNullable<Notebook["learning"]>["grammarHistory"][number],
  ) =>
    JSON.stringify([
      cardContent(e.card),
      e.created,
      e.day,
      e.answer,
      e.correct,
      !!e.sessionId,
    ]);
  const grammar = unique(data.learning?.grammarHistory ?? [], eventKey).filter(
    (e) => e.created <= now && e.day <= today,
  );
  const mistakes = unique(data.learning?.mistakeHistory ?? [], eventKey).filter(
    (e) => e.created <= now && e.day <= today,
  );
  type Response = {
    day: string;
    right: boolean;
    kind: "word" | "grammar" | "mistake";
    self: boolean;
  };
  const responses: Response[] = [
    ...wordAnswers.map((e) => ({
      day: e.day,
      right: e.outcome !== "again",
      kind: "word" as const,
      self: true,
    })),
    ...grammar.map((e) => ({
      day: e.day,
      right: e.correct,
      kind: "grammar" as const,
      self: e.card.mode === "recall",
    })),
    ...mistakes.map((e) => ({
      day: e.day,
      right: e.correct,
      kind: "mistake" as const,
      self: false,
    })),
  ];
  const rate = (rows: Response[]) => ({
    total: rows.length,
    right: rows.filter((e) => e.right).length,
    percent: rows.length
      ? Math.round((rows.filter((e) => e.right).length / rows.length) * 100)
      : null,
  });
  const reviewResponses = [
    ...wordAnswers
      .filter((e) => e.activity === "review")
      .map((e) => ({ day: e.day, right: e.outcome !== "again" })),
    ...grammar.map((e) => ({ day: e.day, right: e.correct })),
    ...mistakes.map((e) => ({ day: e.day, right: e.correct })),
    ...legacyDays.map((e) => ({ day: e.day, right: true })),
  ];
  const dayCount = (start: string, end: string) => {
    const rows = reviewResponses.filter((e) => e.day >= start && e.day <= end);
    return {
      answered: rows.length,
      successful: rows.filter((e) => e.right).length,
    };
  };
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13),
      rows = responses.filter((e) => e.day === day);
    return {
      day,
      ...rate(rows),
      objective: rate(rows.filter((e) => !e.self)),
      self: rate(rows.filter((e) => e.self)),
    };
  });
  const difficult = items
    .map((rows) => {
      const events = answersByWord.get(wordKey(rows[0])) ?? [],
        misses = events.filter((e) => e.outcome === "again");
      return {
        word: rows[0],
        misses: misses.length,
        attempts: events.length,
        lastMiss:
          misses
            .map((e) => e.day)
            .sort()
            .at(-1) ?? "",
      };
    })
    .filter((r) => r.misses >= 2)
    .sort(
      (a, b) => b.misses - a.misses || b.lastMiss.localeCompare(a.lastMiss),
    );
  const grammarTopics = [...new Set(grammar.map((e) => e.card.topic))]
    .map((topic) => {
      const rows = grammar.filter((e) => e.card.topic === topic),
        wrong = rows.filter((e) => !e.correct);
      const identities = new Set(wrong.map((e) => e.card.sourceId));
      return {
        topic,
        total: rows.length,
        wrong: wrong.length,
        percent: Math.round((wrong.length / rows.length) * 100),
        notes: unique(
          data.grammar.filter((n) => identities.has(n.id)),
          (n) =>
            JSON.stringify([n.title, n.body, n.tense, n.modality, n.topicId]),
        ),
      };
    })
    .sort((a, b) => b.wrong - a.wrong);
  // Backups may contain different checkpoints of one session under new IDs.
  // Prefer its finished snapshot, then the largest measured checkpoint.
  const exams = unique(
    (data.exams?.attempts ?? [])
      .filter(
        (a) =>
          !isExampleExam(a.test) &&
          a.created <= now &&
          (!a.completedAt || a.completedAt <= now),
      )
      .slice()
      .sort(
        (a, b) =>
          Number(b.finished) - Number(a.finished) || b.elapsed - a.elapsed,
      ),
    attemptKey,
  );
  const completed = exams.filter((a) => a.finished);
  const canonicalExams = new Map(exams.map((a) => [attemptKey(a), a]));
  const originalExams = new Map(
    (data.exams?.attempts ?? []).map((a) => [a.id, a]),
  );
  const canonicalMistakes = mistakes.map((event) => {
    const original = originalExams.get(event.card.sourceId),
      target = original && canonicalExams.get(attemptKey(original));
    if (!target || target.id === event.card.sourceId) return event;
    const candidates = target.test.questions.filter(
      (q) =>
        q.prompt === event.card.prompt &&
        q.passage === event.card.passage &&
        q.answer === event.card.answer &&
        JSON.stringify(q.options) === JSON.stringify(event.card.options),
    );
    let questionId = "";
    try {
      questionId = JSON.parse(event.card.identity)[1];
    } catch {}
    const question =
      candidates.find((q) => q.id === questionId) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    return question
      ? {
          ...event,
          card: {
            ...event.card,
            sourceId: target.id,
            identity: JSON.stringify([target.test.id, question.id]),
          },
        }
      : event;
  });
  const scores = completed.map((a) => ({ attempt: a, ...score(a) }));
  const examTotal = scores.reduce((n, a) => n + a.total, 0),
    examRight = scores.reduce((n, a) => n + a.right, 0);
  const dailyGoal =
      data.studyPreferences?.dailyNewWordGoal ?? DEFAULT_NEW_WORD_GOAL,
    weeklyGoal =
      data.studyPreferences?.weeklyReviewGoal ?? DEFAULT_WEEKLY_REVIEW_GOAL;
  const todayLearned = known.filter(
      (rows) => learnedDay(rows) === today,
    ).length,
    weekLearned = known.filter(
      (rows) => (learnedDay(rows) ?? "") >= week,
    ).length;
  const weeklySessions = unique(
    (data.learning?.weekly ?? [])
      .filter((s) => s.created <= now)
      .map((s) => ({
        ...s,
        answers: s.answers.filter((a) => a.created <= now),
      }))
      .sort((a, b) => b.answers.length - a.answers.length),
    (s) => JSON.stringify([s.week, s.created, s.cards.map(cardContent)]),
  );
  const currentWeekly = weeklySessions.filter((s) => s.week === week);
  const dueGrammar = unique(grammarCards(data), cardContent).filter((c) =>
    grammarDue(c, grammar, today),
  ).length;
  return {
    today,
    week,
    weekEnd,
    total: items.length,
    phrases: items.filter((rows) =>
      rows.some(
        (w) =>
          /\s/.test(w.word.trim()) ||
          ["phrase", "collocation", "phrasal verb"].includes(
            wordTypeKey(w.type),
          ),
      ),
    ).length,
    learned: known.length,
    verified: retained.length,
    unlearned: waiting.length,
    pending: pending.length,
    grammarPending: dueGrammar,
    mistakePending: unique(learningMistakes(exams, canonicalMistakes), (r) =>
      cardContent(r.card),
    ).length,
    todayLearned,
    weekLearned,
    dailyGoal,
    weeklyGoal,
    dailyProgress: dailyGoal
      ? Math.min(100, Math.round((todayLearned / dailyGoal) * 100))
      : null,
    weeklyProgress: weeklyGoal
      ? Math.min(
          100,
          Math.round((dayCount(week, today).successful / weeklyGoal) * 100),
        )
      : null,
    dailyReviews: dayCount(today, today),
    weeklyReviews: dayCount(week, today),
    accuracy: rate(responses),
    objectiveAccuracy: rate(responses.filter((e) => !e.self)),
    selfAccuracy: rate(responses.filter((e) => e.self)),
    currentAccuracy: rate(responses.filter((e) => e.day >= addDays(today, -6))),
    previousAccuracy: rate(
      responses.filter(
        (e) => e.day >= addDays(today, -13) && e.day < addDays(today, -6),
      ),
    ),
    trend,
    difficult,
    grammarTopics,
    legacyReviewDays: legacyDays.length,
    completedExams: completed.length,
    examPercent: examTotal ? Math.round((examRight / examTotal) * 100) : null,
    examTotal,
    examRight,
    examSeconds: exams.reduce((n, a) => n + a.elapsed, 0),
    sessions: exams
      .slice()
      .sort((a, b) => b.created - a.created)
      .map((a) => ({
        attempt: a,
        day: calendarDay(new Date(a.completedAt ?? a.created)),
        ...score(a),
      })),
    weeklyFinished: currentWeekly.filter(
      (s) => s.answers.length === s.cards.length,
    ).length,
    weeklyInProgress: currentWeekly.filter(
      (s) => s.answers.length < s.cards.length,
    ).length,
  };
}
