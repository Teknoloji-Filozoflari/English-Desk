import type { Notebook } from "./model.ts";
import {
  correct,
  examTopicId,
  isExampleExam,
  type ExamAttempt,
} from "./exams.ts";
import {
  addDays,
  calendarDay,
  isCalendarDay,
  MEMORIZATION_DAYS,
} from "./memorization.ts";

export type GrammarExercise = {
  id: string;
  mode: "choice" | "completion";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};
export type LearningCard = {
  kind: "grammar" | "mistake";
  sourceId: string;
  identity: string;
  title: string;
  topic: string;
  mode: "recall" | "choice" | "completion" | "exam";
  prompt: string;
  passage: string;
  options: string[];
  answer: string;
  explanation: string;
};
export type LearningEvent = {
  id: string;
  card: LearningCard;
  answer: string;
  correct: boolean;
  created: number;
  day: string;
  sessionId?: string;
};
export type WeeklyAnswer = {
  index: number;
  answer: string;
  correct: boolean;
  created: number;
};
export type WeeklySession = {
  id: string;
  week: string;
  created: number;
  cards: LearningCard[];
  answers: WeeklyAnswer[];
};
export type LearningData = {
  grammarHistory: LearningEvent[];
  mistakeHistory: LearningEvent[];
  weekly: WeeklySession[];
};
export const emptyLearning = (): LearningData => ({
  grammarHistory: [],
  mistakeHistory: [],
  weekly: [],
});
const normalize = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Çalışma kaydı geçersiz.");
  return v as Record<string, any>;
};
const text = (v: unknown, required = false, max = 500000): string => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw Error("Çalışma metni geçersiz.");
  return v;
};
const timestamp = (v: unknown): number => {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    !Number.isFinite(new Date(v).getTime())
  )
    throw Error("Çalışma zamanı geçersiz.");
  return v;
};
function list<T>(value: unknown, max: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max)
    throw Error("Çalışma listesi geçersiz.");
  return value.map(parse);
}
function uniqueIds<T extends { id: string }>(rows: T[]): T[] {
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error("Tekrarlanan çalışma kimliği.");
  return rows;
}
export function validateGrammarExercises(value: unknown): GrammarExercise[] {
  return uniqueIds(
    list(value, 50, (v) => {
      const r = object(v);
      if (!["choice", "completion"].includes(r.mode))
        throw Error("Gramer çalışma türü geçersiz.");
      const options = list(r.options, 8, (o) => text(o, true, 2000));
      const answer = text(r.answer, true, 2000),
        prompt = text(r.prompt, true, 20000);
      if (
        r.mode === "choice"
          ? options.length < 2 ||
            new Set(options.map(normalize)).size !== options.length ||
            !options.includes(answer)
          : options.length !== 0 || !prompt.includes("_____")
      )
        throw Error(
          "Seçenekleri, doğru cevabı ve cümledeki _____ boşluğunu kontrol et.",
        );
      return {
        id: text(r.id, true, 200),
        mode: r.mode,
        prompt,
        options,
        answer,
        explanation: text(r.explanation),
      };
    }),
  );
}
export function cardKey(c: LearningCard) {
  return JSON.stringify([
    c.kind,
    c.identity,
    c.mode,
    c.prompt,
    c.passage,
    c.options,
    c.answer,
    c.kind === "grammar" ? c.explanation : "",
  ]);
}
function validateCard(v: unknown): LearningCard {
  const r = object(v);
  if (
    !["grammar", "mistake"].includes(r.kind) ||
    !["recall", "choice", "completion", "exam"].includes(r.mode) ||
    (r.kind === "mistake" ? r.mode !== "exam" : r.mode === "exam")
  )
    throw Error("Çalışma kartı türü geçersiz.");
  const c: LearningCard = {
    kind: r.kind,
    sourceId: text(r.sourceId, true),
    identity: text(r.identity, true),
    title: text(r.title, true),
    topic: text(r.topic),
    mode: r.mode,
    prompt: text(r.prompt, true),
    passage: text(r.passage),
    options: list(r.options, 8, (v) => text(v, true, 2000)),
    answer: text(r.answer, true),
    explanation: text(r.explanation),
  };
  if (c.mode === "choice" || (c.mode === "exam" && c.options.length)) {
    if (
      c.options.length < 2 ||
      !c.options.includes(c.answer) ||
      new Set(c.options.map(normalize)).size !== c.options.length
    )
      throw Error("Çalışma kartı seçenekleri geçersiz.");
  }
  if ((c.mode === "completion" || c.mode === "recall") && c.options.length)
    throw Error("Çalışma kartı seçenekleri geçersiz.");
  if (c.mode === "completion" && !c.prompt.includes("_____"))
    throw Error("Cümle tamamlama boşluğu bulunamadı.");
  return c;
}
export function checkLearningAnswer(
  card: LearningCard,
  answer: string,
): boolean {
  return (
    normalize(answer) !== "" && normalize(answer) === normalize(card.answer)
  );
}
export function validateLearning(value: unknown): LearningData {
  const r = object(value);
  const events = (value: unknown, kind: LearningCard["kind"]) =>
    uniqueIds(
      list(value, 20000, (v) => {
        const e = object(v),
          card = validateCard(e.card),
          answer = text(e.answer, false, 2000);
        if (
          card.kind !== kind ||
          typeof e.correct !== "boolean" ||
          !isCalendarDay(e.day) ||
          (card.mode !== "recall" &&
            e.correct !== checkLearningAnswer(card, answer))
        )
          throw Error("Çalışma cevabı geçersiz.");
        return {
          id: text(e.id, true, 200),
          card,
          answer,
          correct: e.correct,
          created: timestamp(e.created),
          day: e.day,
          ...(e.sessionId !== undefined
            ? { sessionId: text(e.sessionId, true, 200) }
            : {}),
        };
      }),
    );
  const grammarHistory = events(r.grammarHistory, "grammar"),
    mistakeHistory = events(r.mistakeHistory, "mistake");
  uniqueIds([...grammarHistory, ...mistakeHistory]);
  const weekly = uniqueIds(
    list(r.weekly, 500, (v) => {
      const s = object(v),
        cards = list(s.cards, 10, validateCard),
        created = timestamp(s.created);
      if (
        !isCalendarDay(s.week) ||
        weekStart(s.week) !== s.week ||
        !cards.length ||
        new Set(cards.map(cardKey)).size !== cards.length
      )
        throw Error("Haftalık sınav geçersiz.");
      const answers = list(s.answers, cards.length, (v) => {
        const a = object(v);
        if (
          !Number.isInteger(a.index) ||
          a.index < 0 ||
          a.index >= cards.length ||
          typeof a.correct !== "boolean"
        )
          throw Error("Haftalık cevap geçersiz.");
        const answer = text(a.answer, false, 2000),
          card = cards[a.index];
        if (
          card.mode !== "recall" &&
          a.correct !== checkLearningAnswer(card, answer)
        )
          throw Error("Haftalık cevap puanı geçersiz.");
        return {
          index: a.index,
          answer,
          correct: a.correct,
          created: timestamp(a.created),
        };
      });
      if (
        new Set(answers.map((a) => a.index)).size !== answers.length ||
        answers.some(
          (a, i) =>
            a.index !== i ||
            a.created < created ||
            (i > 0 && a.created < answers[i - 1].created),
        )
      )
        throw Error("Haftalık cevap sırası geçersiz.");
      return {
        id: text(s.id, true, 200),
        week: s.week,
        created,
        cards,
        answers,
      };
    }),
  );
  return { grammarHistory, mistakeHistory, weekly };
}
export function grammarCards(data: Notebook): LearningCard[] {
  return data.grammar
    .filter((note) => note.title.trim() && note.body.trim())
    .flatMap((note) => {
      const base = {
        kind: "grammar" as const,
        sourceId: note.id,
        title: note.title,
        topic:
          note.tense ??
          note.modality ??
          data.grammarTopics?.find((t) => t.id === note.topicId)?.title ??
          "Genel gramer",
        passage: "",
      };
      return [
        {
          ...base,
          identity: JSON.stringify([note.id, "recall"]),
          mode: "recall" as const,
          prompt: `${note.title}: kuralı ve kullanımını hatırla.`,
          options: [],
          answer: note.body,
          explanation: note.body,
        },
        ...(note.exercises ?? []).map((e) => ({
          ...base,
          identity: JSON.stringify([note.id, e.id]),
          mode: e.mode,
          prompt: e.prompt,
          options: e.options,
          answer: e.answer,
          explanation: [e.explanation, note.body].filter(Boolean).join("\n\n"),
        })),
      ];
    });
}
function examCard(
  attempt: ExamAttempt,
  q: ExamAttempt["test"]["questions"][number],
): LearningCard {
  return {
    kind: "mistake",
    sourceId: attempt.id,
    identity: JSON.stringify([attempt.test.id, q.id]),
    title: attempt.test.title,
    topic: [examTopicId(attempt.test), attempt.test.section].join(" · "),
    mode: "exam",
    prompt: q.prompt,
    passage: q.passage,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  };
}
// Only original finished sessions determine the source pool. Reviews never rewrite them.
export function learningMistakes(
  attempts: ExamAttempt[],
  history: LearningEvent[] = [],
) {
  const latest = new Map<
    string,
    {
      card: LearningCard;
      attempt: ExamAttempt;
      question: ExamAttempt["test"]["questions"][number];
    }
  >();
  for (const attempt of attempts
    .filter((a) => a.finished && !isExampleExam(a.test))
    .slice()
    .sort(
      (a, b) => (a.completedAt ?? a.created) - (b.completedAt ?? b.created),
    ))
    for (const question of attempt.test.questions) {
      const card = examCard(attempt, question);
      latest.set(cardKey(card), { card, attempt, question });
    }
  return [...latest.values()].filter(({ card, attempt, question }) => {
    if (correct(question, attempt.answers[question.id])) return false;
    const last = history
      .filter(
        (e) =>
          e.card.sourceId === attempt.id && cardKey(e.card) === cardKey(card),
      )
      .sort((a, b) => a.created - b.created)
      .at(-1);
    return !last?.correct;
  });
}
export function learningWrongGroups(data: Notebook) {
  const groups = new Map<
    string,
    { attempt: ExamAttempt; questions: ExamAttempt["test"]["questions"] }
  >();
  for (const { attempt, question } of learningMistakes(
    data.exams?.attempts ?? [],
    data.learning?.mistakeHistory,
  )) {
    const group = groups.get(attempt.id) ?? { attempt, questions: [] };
    group.questions.push(question);
    groups.set(attempt.id, group);
  }
  return [...groups.values()].reverse();
}
export function grammarDue(
  card: LearningCard,
  history: LearningEvent[],
  today: string,
): boolean {
  const events = history
      .filter((e) => cardKey(e.card) === cardKey(card))
      .sort((a, b) => a.created - b.created),
    last = events.at(-1);
  if (!last) return true;
  if (last.day > today) return false;
  if (!last.correct) return true;
  const days = new Set<string>();
  for (const e of events.slice().reverse()) {
    if (!e.correct) break;
    days.add(e.day);
  }
  const streak = days.size;
  return (
    addDays(
      last.day,
      MEMORIZATION_DAYS[Math.min(streak - 1, MEMORIZATION_DAYS.length - 1)],
    ) <= today
  );
}
export function historyStamp(data: Notebook, card: LearningCard): string {
  const rows =
    card.kind === "grammar"
      ? data.learning?.grammarHistory
      : data.learning?.mistakeHistory;
  return JSON.stringify(
    (rows ?? [])
      .filter((e) => cardKey(e.card) === cardKey(card))
      .map((e) => e.id),
  );
}
export function recordLearning(
  data: Notebook,
  card: LearningCard,
  answer: string,
  recalled: boolean,
  eventId: string,
  expected: string,
  now = Date.now(),
  weeklyId?: string,
): Notebook {
  const learning = data.learning ?? emptyLearning(),
    today = calendarDay(new Date(now));
  if (
    [...learning.grammarHistory, ...learning.mistakeHistory].some(
      (e) => e.id === eventId,
    )
  )
    return data;
  const session = weeklyId
    ? learning.weekly.find((s) => s.id === weeklyId)
    : undefined;
  if (weeklyId) {
    if (
      !session ||
      session.created > now ||
      (session.answers.at(-1)?.created ?? 0) > now ||
      !session.cards[session.answers.length] ||
      JSON.stringify(session.cards[session.answers.length]) !==
        JSON.stringify(card)
    )
      return data;
  } else {
    if (historyStamp(data, card) !== expected) return data;
    const valid =
      card.kind === "grammar"
        ? grammarCards(data).some((c) => cardKey(c) === cardKey(card)) &&
          grammarDue(card, learning.grammarHistory, today)
        : learningMistakes(
            data.exams?.attempts ?? [],
            learning.mistakeHistory,
          ).some(
            (row) =>
              row.card.sourceId === card.sourceId &&
              cardKey(row.card) === cardKey(card),
          );
    if (!valid) return data;
  }
  if (
    [...learning.grammarHistory, ...learning.mistakeHistory].some(
      (e) =>
        e.card.kind === card.kind &&
        cardKey(e.card) === cardKey(card) &&
        e.created > now,
    )
  )
    return data;
  const event: LearningEvent = {
    id: eventId,
    card: JSON.parse(JSON.stringify(card)),
    answer,
    correct:
      card.mode === "recall" ? recalled : checkLearningAnswer(card, answer),
    created: now,
    day: today,
    ...(weeklyId ? { sessionId: weeklyId } : {}),
  };
  const field = card.kind === "grammar" ? "grammarHistory" : "mistakeHistory";
  const next: LearningData = {
    ...learning,
    [field]: [...learning[field], event],
    weekly: session
      ? learning.weekly.map((s) =>
          s.id !== session.id
            ? s
            : {
                ...s,
                answers: [
                  ...s.answers,
                  {
                    index: s.answers.length,
                    answer,
                    correct: event.correct,
                    created: now,
                  },
                ],
              },
        )
      : learning.weekly,
  };
  return { ...data, learning: validateLearning(next) };
}
export function weekStart(day = calendarDay()): string {
  const offset = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}
export function startWeekly(
  data: Notebook,
  id: string,
  now = Date.now(),
): Notebook {
  const learning = data.learning ?? emptyLearning(),
    week = weekStart(calendarDay(new Date(now)));
  if (learning.weekly.some((s) => s.week === week)) return data;
  const grammar = grammarCards(data),
    mistakes = learningMistakes(
      data.exams?.attempts ?? [],
      learning.mistakeHistory,
    ).map((r) => r.card);
  // Rotate deterministic source order each week, then interleave both pools.
  const rotation = Math.floor(
    new Date(`${week}T12:00:00Z`).getTime() / 604800000,
  );
  const rotate = (rows: LearningCard[]) =>
    rows.length
      ? [
          ...rows.slice(rotation % rows.length),
          ...rows.slice(0, rotation % rows.length),
        ]
      : [];
  const a = rotate(grammar),
    b = rotate(mistakes),
    cards: LearningCard[] = [];
  for (let i = 0; cards.length < 10 && (i < a.length || i < b.length); i++) {
    if (a[i]) cards.push(a[i]);
    if (b[i] && cards.length < 10) cards.push(b[i]);
  }
  if (!cards.length) return data;
  return {
    ...data,
    learning: validateLearning({
      ...learning,
      weekly: [
        ...learning.weekly,
        {
          id,
          week,
          created: now,
          cards: JSON.parse(JSON.stringify(cards)),
          answers: [],
        },
      ],
    }),
  };
}
export function mistakePatterns(data: Notebook) {
  const groups = new Map<
    string,
    {
      topic: string;
      wrong: number;
      total: number;
      pending: number;
      reviewRight: number;
      reviewWrong: number;
    }
  >();
  const get = (topic: string) => {
    const row = groups.get(topic) ?? {
      topic,
      wrong: 0,
      total: 0,
      pending: 0,
      reviewRight: 0,
      reviewWrong: 0,
    };
    groups.set(topic, row);
    return row;
  };
  for (const a of data.exams?.attempts ?? [])
    if (a.finished && !isExampleExam(a.test))
      for (const q of a.test.questions) {
        const r = get(examCard(a, q).topic);
        r.total++;
        if (!correct(q, a.answers[q.id])) r.wrong++;
      }
  for (const { card } of learningMistakes(
    data.exams?.attempts ?? [],
    data.learning?.mistakeHistory,
  ))
    get(card.topic).pending++;
  for (const e of data.learning?.mistakeHistory ?? []) {
    const r = get(e.card.topic);
    if (e.correct) r.reviewRight++;
    else r.reviewWrong++;
  }
  return [...groups.values()].sort(
    (a, b) => b.wrong - a.wrong || a.topic.localeCompare(b.topic),
  );
}
