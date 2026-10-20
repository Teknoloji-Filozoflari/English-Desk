import { DEFAULT_EXAM_TOPICS, validateTopics, type Topic } from "./topics.ts";
export type ExamKind = "YDS" | "IELTS";
export type ExamCollection = "osym" | "other";
export type ExamQuestion = {
  id: string;
  prompt: string;
  passage: string;
  kind: "choice" | "text";
  options: string[];
  answer: string;
  explanation: string;
};
export type ExamTest = {
  id: string;
  exam: ExamKind;
  collection?: ExamCollection;
  topicId?: string;
  title: string;
  section: string;
  source: string;
  minutes: number;
  questions: ExamQuestion[];
};
export type ExamAttempt = {
  id: string;
  test: ExamTest;
  mode: "study" | "exam";
  answers: Record<string, string>;
  flags: string[];
  position: number;
  elapsed: number;
  finished: boolean;
  created: number;
  completedAt?: number;
};
export type ExamData = {
  tests: ExamTest[];
  attempts: ExamAttempt[];
  topics?: Topic[];
};
export const emptyExams: ExamData = { tests: [], attempts: [] };
export function examTopicId(test: ExamTest): string {
  return (
    test.topicId ?? (test.exam === "IELTS" ? "ielts" : examCollection(test))
  );
}
export function removeExamTopic(data: ExamData, id: string): ExamData {
  const detach = (test: ExamTest) =>
    examTopicId(test) === id ? { ...test, topicId: "" } : test;
  return {
    ...data,
    topics: (data.topics ?? DEFAULT_EXAM_TOPICS).filter((t) => t.id !== id),
    tests: data.tests.map(detach),
    attempts: data.attempts.map((a) => ({ ...a, test: detach(a.test) })),
  };
}
export function examCollection(test: ExamTest): ExamCollection {
  return (
    test.collection ??
    (test.exam === "YDS" && /^ÖSYM(?:\s|[;,]|$)/i.test(test.source.trim())
      ? "osym"
      : "other")
  );
}
export function examPresentation(test: ExamTest) {
  const year =
    test.title.match(/\b(20\d{2})\b/)?.[1] ??
    test.id.match(/\b(20\d{2})\b/)?.[1] ??
    test.source.match(/\b(20\d{2})\b/)?.[1] ??
    null;
  const imported =
    test.exam === "YDS" &&
    test.title.match(
      /^20\d{2}\s*-\s*(?:e-)?YDS\s*\/\s*(.+?)(?:\s*[-·]\s*\d+\s+soru)?$/i,
    );
  const name = imported ? imported[1].trim() : test.title;
  const title = imported && /^\d+$/.test(name) ? `${name}. Oturum` : name;
  return {
    year,
    title:
      imported && /-\s*e-YDS/i.test(test.title) ? `e-YDS · ${title}` : title,
  };
}
export function groupExamTests(tests: ExamTest[]) {
  const groups = new Map<string, ExamTest[]>();
  for (const test of tests) {
    const year = examPresentation(test).year ?? "Diğer testler";
    groups.set(year, [...(groups.get(year) ?? []), test]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === "Diğer testler"
        ? 1
        : b === "Diğer testler"
          ? -1
          : Number(b) - Number(a),
    )
    .map(([year, rows]) => ({
      year,
      tests: rows
        .slice()
        .sort((a, b) =>
          examPresentation(a).title.localeCompare(
            examPresentation(b).title,
            "tr",
            { numeric: true },
          ),
        ),
    }));
}
const normalized = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");
export function correct(question: ExamQuestion, answer = "") {
  return !!answer.trim() && normalized(answer) === normalized(question.answer);
}
export function score(attempt: ExamAttempt) {
  const right = attempt.test.questions.filter((q) =>
    correct(q, attempt.answers[q.id]),
  ).length;
  const blank = attempt.test.questions.filter(
    (q) => !attempt.answers[q.id]?.trim(),
  ).length;
  return {
    right,
    blank,
    wrong: attempt.test.questions.length - right - blank,
    total: attempt.test.questions.length,
  };
}
export function isExampleExam(test: ExamTest): boolean {
  return (
    test.id === "example-yds-01" ||
    test.id === "example-ielts-01" ||
    test.source.startsWith("Uygulama için hazırlanmış örnek;")
  );
}
// A later finished answer supersedes the same question's earlier answer.
// Repeated sessions keep the original questions; history itself is never removed.
export function pendingWrongQuestions(attempts: ExamAttempt[]) {
  const latest = new Map<
    string,
    { attempt: ExamAttempt; question: ExamQuestion }
  >();
  for (const attempt of attempts
    .filter((a) => a.finished)
    .slice()
    .sort((a, b) => a.created - b.created)) {
    for (const question of attempt.test.questions) {
      const key = JSON.stringify([
        question.id,
        question.prompt,
        question.passage,
        question.kind,
        question.options,
        question.answer,
      ]);
      latest.set(key, { attempt, question });
    }
  }
  const groups = new Map<
    string,
    { attempt: ExamAttempt; questions: ExamQuestion[] }
  >();
  for (const { attempt, question } of latest.values()) {
    if (correct(question, attempt.answers[question.id])) continue;
    const group = groups.get(attempt.id) ?? { attempt, questions: [] };
    group.questions.push(question);
    groups.set(attempt.id, group);
  }
  return [...groups.values()].reverse();
}
const record = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Sınav verisi geçersiz.");
  return value as Record<string, any>;
};
const text = (value: unknown, max = 20000, required = false): string => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error("Testte eksik veya çok uzun metin var.");
  return value;
};
export function validateExamTest(value: unknown): ExamTest {
  const row = record(value);
  if (
    row.topicId !== undefined &&
    (typeof row.topicId !== "string" ||
      (row.topicId && !/^[a-zA-Z0-9-]{1,100}$/.test(row.topicId)))
  )
    throw Error("Sınav alt başlık bağlantısı geçersiz.");
  if (
    row.collection !== undefined &&
    !["osym", "other"].includes(row.collection)
  )
    throw Error("Sınav arşivi geçersiz.");
  if (
    !["YDS", "IELTS"].includes(row.exam) ||
    !Number.isInteger(row.minutes) ||
    row.minutes < 0 ||
    row.minutes > 300 ||
    !Array.isArray(row.questions) ||
    !row.questions.length ||
    row.questions.length > 200
  )
    throw Error("Sınav türü, süre veya soru sayısı geçersiz.");
  const ids = new Set<string>();
  const questions = row.questions.map((value: unknown) => {
    const q = record(value),
      id = text(q.id, 100, true);
    if (ids.has(id)) throw Error("Tekrarlanan soru kimliği.");
    ids.add(id);
    if (
      !["choice", "text"].includes(q.kind) ||
      !Array.isArray(q.options) ||
      q.options.length > 8
    )
      throw Error("Soru türü veya seçenekler geçersiz.");
    const options = q.options.map((item: unknown) => text(item, 2000, true));
    const answer = text(q.answer, 2000, true);
    if (
      q.kind === "choice" &&
      (options.length < 2 ||
        new Set(options).size !== options.length ||
        !options.includes(answer))
    )
      throw Error(
        "Doğru cevap seçenekler arasında olmalı; seçenekler farklı olmalı.",
      );
    return {
      id,
      prompt: text(q.prompt, 20000, true),
      passage: text(q.passage ?? "", 100000),
      kind: q.kind,
      options,
      answer,
      explanation: text(q.explanation ?? ""),
    } as ExamQuestion;
  });
  return {
    id: text(row.id, 100, true),
    exam: row.exam,
    ...(row.topicId !== undefined ? { topicId: row.topicId } : {}),
    ...(row.collection !== undefined ? { collection: row.collection } : {}),
    title: text(row.title, 200, true),
    section: text(row.section, 100, true),
    source: text(row.source ?? "", 500),
    minutes: row.minutes,
    questions,
  };
}
export function validateExams(value: unknown): ExamData {
  if (value === undefined) return { tests: [], attempts: [] };
  const data = record(value);
  if (
    !Array.isArray(data.tests) ||
    data.tests.length > 2000 ||
    !Array.isArray(data.attempts) ||
    data.attempts.length > 5000
  )
    throw Error("Sınav listesi geçersiz.");
  const topics = validateTopics(data.topics ?? DEFAULT_EXAM_TOPICS);
  const tests = data.tests.map(validateExamTest);
  const attempts = data.attempts.map((value: unknown) => {
    const a = record(value),
      test = validateExamTest(a.test),
      rawAnswers = record(a.answers);
    if (
      !["study", "exam"].includes(a.mode) ||
      typeof a.finished !== "boolean" ||
      !Number.isInteger(a.position) ||
      a.position < 0 ||
      a.position >= test.questions.length ||
      !Number.isFinite(a.elapsed) ||
      a.elapsed < 0 ||
      a.elapsed > 1e9 ||
      !Number.isFinite(a.created) ||
      (a.completedAt !== undefined &&
        (!a.finished ||
          !Number.isFinite(a.completedAt) ||
          a.completedAt < a.created)) ||
      !Array.isArray(a.flags) ||
      a.flags.some(
        (id: unknown) =>
          typeof id !== "string" || !test.questions.some((q) => q.id === id),
      )
    )
      throw Error("Test oturumu geçersiz.");
    const answers: Record<string, string> = {};
    for (const [id, answer] of Object.entries(rawAnswers)) {
      const q = test.questions.find((q) => q.id === id);
      if (!q) throw Error("Cevabın sorusu bulunamadı.");
      answers[id] = text(answer, 2000);
    }
    return {
      id: text(a.id, 100, true),
      test,
      mode: a.mode,
      answers,
      flags: [...new Set(a.flags)] as string[],
      position: a.position,
      elapsed: a.elapsed,
      finished: a.finished,
      created: a.created,
      ...(a.completedAt !== undefined ? { completedAt: a.completedAt } : {}),
    } as ExamAttempt;
  });
  if (
    new Set(tests.map((t) => t.id)).size !== tests.length ||
    new Set(attempts.map((a) => a.id)).size !== attempts.length
  )
    throw Error("Tekrarlanan sınav kaydı.");
  if (
    [...tests, ...attempts.map((a) => a.test)].some(
      (test) => test.topicId && !topics.some((t) => t.id === test.topicId),
    )
  )
    throw Error("Sınav alt başlığı bulunamadı.");
  return { tests, attempts, ...(data.topics !== undefined ? { topics } : {}) };
}
export function exampleTests(): ExamTest[] {
  return [
    {
      id: "example-yds-01",
      exam: "YDS",
      title: "Bağlaçlar ve kelimeler · Başlangıç",
      section: "Karma",
      source: "Uygulama için hazırlanmış örnek; resmî sınav sorusu değildir.",
      minutes: 5,
      questions: [
        {
          id: "y1",
          prompt: "_____ it was raining heavily, they continued their journey.",
          passage: "",
          kind: "choice",
          options: ["Although", "Because", "Unless", "So that", "In order to"],
          answer: "Although",
          explanation:
            "Yağmur yağmasına rağmen yolculuk sürüyor: zıtlık kuran Although kullanılır.",
        },
        {
          id: "y2",
          prompt: "The scientist repeated the experiment to _____ the results.",
          passage: "",
          kind: "choice",
          options: ["confirm", "borrow", "forget", "prevent", "replace"],
          answer: "confirm",
          explanation: "Sonuçları doğrulamak: confirm the results.",
        },
        {
          id: "y3",
          prompt: "You will miss the train _____ you leave now.",
          passage: "",
          kind: "choice",
          options: ["unless", "although", "despite", "whereas", "so that"],
          answer: "unless",
          explanation:
            "Şimdi çıkmazsan treni kaçırırsın. Unless, if ... not anlamındadır.",
        },
      ],
    },
    {
      id: "example-ielts-01",
      exam: "IELTS",
      title: "Reading · Community gardens",
      section: "Academic Reading",
      source: "Uygulama için hazırlanmış örnek; resmî IELTS testi değildir.",
      minutes: 5,
      questions: [
        {
          id: "i1",
          passage:
            "The town opened its first community garden in 2018. Residents share the work and grow vegetables for their own use. The garden is open every day, but volunteers meet on Saturdays. A second garden is planned for next year.",
          prompt: "The first community garden opened in 2018.",
          kind: "choice",
          options: ["True", "False", "Not Given"],
          answer: "True",
          explanation:
            "İlk cümlede açılış yılı açıkça 2018 olarak belirtiliyor.",
        },
        {
          id: "i2",
          passage:
            "The town opened its first community garden in 2018. Residents share the work and grow vegetables for their own use. The garden is open every day, but volunteers meet on Saturdays. A second garden is planned for next year.",
          prompt: "Residents sell all the vegetables they grow.",
          kind: "choice",
          options: ["True", "False", "Not Given"],
          answer: "False",
          explanation:
            "Sebzeleri kendi kullanımları için yetiştiriyorlar; bu ifade metne aykırı.",
        },
        {
          id: "i3",
          passage:
            "The town opened its first community garden in 2018. Residents share the work and grow vegetables for their own use. The garden is open every day, but volunteers meet on Saturdays. A second garden is planned for next year.",
          prompt: "Complete with ONE WORD: Volunteers meet on _____.",
          kind: "text",
          options: [],
          answer: "Saturdays",
          explanation:
            "Metindeki volunteers meet on Saturdays ifadesinden alınır.",
        },
      ],
    },
  ];
}
