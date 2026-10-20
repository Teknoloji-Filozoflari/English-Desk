import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { progressReport } from "../src/progress.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
  BACKUP_SECTIONS,
} from "../src/backup-core.ts";
import { validateNotebook } from "../src/model.ts";
import { validateStudyPreferences } from "../src/daily-study.ts";
import { recordPractice } from "../src/notebook/services/practice.ts";
import {
  recordMemorization,
  recordWordReview,
} from "../src/notebook/services/repetition.ts";
import { practiceSnapshot } from "../src/word-practice.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../scripts/backup-archive.mjs";
import {
  grammarCards,
  recordLearning,
  historyStamp,
  startWeekly,
  learningMistakes,
} from "../src/learning.ts";
const now = new Date("2026-10-19T12:00:00+03:00").getTime();
const word = (id = "w", name = "remember") => ({
  id,
  word: name,
  meaning: "hatırlamak",
  type: "verb",
  synonyms: "",
  antonyms: "",
  example: "",
  translation: "",
  storyId: "",
});
const event = (id, day, outcome = "good", activity = "review") => ({
  id,
  day,
  outcome,
  activity,
  engine: "memory",
});
function fixture() {
  const d = emptyNotebook();
  d.words = [word()];
  d.grammar = [{ id: "g", title: "Present", body: "Use reads with she." }];
  const exam = {
    id: "t",
    exam: "YDS",
    title: "Personal",
    source: "Personal",
    section: "Grammar",
    minutes: 5,
    questions: [
      {
        id: "q",
        prompt: "She _____.",
        passage: "",
        kind: "choice",
        options: ["reads", "read"],
        answer: "reads",
        explanation: "Third person.",
      },
    ],
  };
  d.exams = {
    tests: [exam],
    attempts: [
      {
        id: "a",
        test: exam,
        mode: "exam",
        answers: { q: "read" },
        flags: [],
        position: 0,
        elapsed: 125,
        finished: true,
        created: now - 10000,
        completedAt: now - 1000,
      },
    ],
  };
  return d;
}
test("empty and import-only notebooks have no fabricated learning, accuracy, repeat or duration history", () => {
  let d = emptyNotebook(),
    r = progressReport(d, now);
  for (const k of [
    "total",
    "learned",
    "verified",
    "pending",
    "completedExams",
    "examSeconds",
  ])
    assert.equal(r[k], 0);
  assert.equal(r.accuracy.percent, null);
  assert.equal(r.previousAccuracy.percent, null);
  d.words = [word(), word("phrase", "give up")];
  r = progressReport(d, now);
  assert.equal(r.total, 2);
  assert.equal(r.phrases, 1);
  assert.equal(r.unlearned, 2);
  assert.equal(r.learned, 0);
  assert.equal(r.verified, 0);
  assert.equal(r.weeklyReviews.successful, 0);
});
test("first learning and retained recall are separate; old legacy counters do not invent successful answers", () => {
  const d = emptyNotebook();
  d.words = [
    {
      ...word(),
      memorization: {
        addedOn: "2026-10-01",
        learnedOn: "2026-10-01",
        reviews: [],
      },
    },
    {
      ...word("old", "go"),
      review: { due: now - 1, interval: 30, repetitions: 8 },
    },
  ];
  let r = progressReport(d, now);
  assert.equal(r.learned, 1);
  assert.equal(r.verified, 0);
  assert.equal(r.accuracy.total, 0);
  d.words[0].memorization.reviews = ["2026-10-02"];
  r = progressReport(d, now);
  assert.equal(r.verified, 1);
  assert.equal(r.legacyReviewDays, 1);
  assert.equal(r.accuracy.percent, null);
});
test("new word answers capture failures, successes and initial learning without changing the fixed schedule", () => {
  let d = emptyNotebook();
  d.words = [
    {
      ...word(),
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
    },
  ];
  const original = structuredClone(d.words[0].memorization);
  const snapshot = practiceSnapshot(d.words[0]);
  d = recordPractice(d, "w", snapshot, "again", now).data;
  assert.deepEqual(d.words[0].memorization, original);
  assert.equal(recordPractice(d, "w", snapshot, "again", now).status, "stale");
  d = recordPractice(
    d,
    "w",
    practiceSnapshot(d.words[0]),
    "again",
    now + 1,
  ).data;
  let r = progressReport(d, now + 1);
  assert.equal(r.difficult.length, 1);
  assert.equal(r.difficult[0].misses, 2);
  assert.equal(r.verified, 0);
  assert.equal(r.dailyReviews.answered, 2);
  assert.equal(r.accuracy.percent, 0);
  d = recordPractice(
    d,
    "w",
    practiceSnapshot(d.words[0]),
    "good",
    now + 2,
  ).data;
  r = progressReport(d, now + 2);
  assert.equal(r.accuracy.percent, 33);
  assert.equal(r.dailyReviews.answered, 3);
  assert.equal(r.dailyReviews.successful, 1);
  assert.equal(r.verified, 1);
  assert.equal(r.legacyReviewDays, 0);
  assert.deepEqual(d.words[0].memorization.reviews, ["2026-10-19"]);
  validateNotebook(d);
});
test("memory and legacy first-learning successes are not counted as completed repeat answers", () => {
  let d = emptyNotebook();
  d.words = [
    { ...word(), memorization: { addedOn: "2026-10-19", reviews: [] } },
    word("legacy", "go"),
  ];
  d = recordMemorization(
    d,
    "w",
    d.words[0].memorization,
    "learn",
    "2026-10-19",
  );
  d = recordWordReview(d, "legacy", undefined, "good", now);
  const r = progressReport(d, now);
  assert.equal(r.todayLearned, 2);
  assert.equal(r.learned, 2);
  assert.equal(r.verified, 0);
  assert.equal(r.dailyReviews.answered, 0);
  assert.equal(r.accuracy.total, 2);
});
test("duplicate imported words, answer snapshots, original exams and learning events never inflate reports", () => {
  let d = fixture();
  d.words[0].answerHistory = [event("e", "2026-10-19")];
  d.words[0].studyActivity = { firstLearnedOn: "2026-10-19" };
  const card = grammarCards(d)[0];
  d = recordLearning(d, card, "", false, "g-event", historyStamp(d, card), now);
  const before = progressReport(d, now);
  d.words.push({
    ...structuredClone(d.words[0]),
    id: "copy",
    word: " REMEMBER ",
  });
  d.exams.attempts.push({
    ...structuredClone(d.exams.attempts[0]),
    id: "copy-attempt",
  });
  d.learning.grammarHistory.push({
    ...structuredClone(d.learning.grammarHistory[0]),
    id: "copy-event",
  });
  const after = progressReport(d, now);
  for (const key of [
    "total",
    "learned",
    "todayLearned",
    "completedExams",
    "examSeconds",
    "examTotal",
  ])
    assert.equal(after[key], before[key]);
  assert.deepEqual(after.accuracy, before.accuracy);
  assert.deepEqual(after.dailyReviews, before.dailyReviews);
  assert.equal(after.grammarTopics[0].total, 1);
});
test("sample stories and exams are excluded while unrelated personal cards are retained", () => {
  const d = fixture();
  d.stories = [
    {
      id: "s",
      title: "Sample",
      text: "Sample story.",
      level: "A1",
      read: false,
      sample: true,
    },
  ];
  d.words[0].storyId = "s";
  d.words.push(word("personal", "give up"));
  d.exams.attempts[0].test.id = "example-yds-01";
  const r = progressReport(d, now);
  assert.equal(r.total, 1);
  assert.equal(r.phrases, 1);
  assert.equal(r.completedExams, 0);
  assert.equal(r.examSeconds, 0);
  assert.equal(r.mistakePending, 0);
});
test("daily and weekly boundaries use Monday calendar labels and ignore future activity", () => {
  const d = fixture();
  d.words[0].answerHistory = [
    event("sun", "2026-10-18"),
    event("mon", "2026-10-19"),
    event("future", "2026-10-20"),
  ];
  d.words[0].studyActivity = { firstLearnedOn: "2026-10-20" };
  const r = progressReport(d, now);
  assert.equal(r.week, "2026-10-19");
  assert.equal(r.weekEnd, "2026-10-25");
  assert.equal(r.dailyReviews.answered, 1);
  assert.equal(r.weeklyReviews.answered, 1);
  assert.equal(r.learned, 0);
  assert.equal(r.accuracy.total, 2);
  const sunday = progressReport(
    d,
    new Date("2026-10-18T23:59:59+03:00").getTime(),
  );
  assert.equal(sunday.week, "2026-10-12");
  assert.equal(sunday.dailyReviews.answered, 1);
  assert.equal(sunday.weeklyReviews.answered, 1);
  assert.equal(sunday.completedExams, 0);
});
test("rates distinguish checked answers and self assessment and provide honest empty trends", () => {
  let d = fixture();
  d.words[0].answerHistory = [
    event("older", "2026-10-10", "again"),
    event("recent", "2026-10-19"),
  ];
  const c = grammarCards(d)[0];
  d = recordLearning(d, c, "", true, "recall", historyStamp(d, c), now);
  d.grammar[0].exercises = [
    {
      id: "choice",
      mode: "choice",
      prompt: "Choose a sentence.",
      options: ["She reads.", "She read."],
      answer: "She reads.",
      explanation: "",
    },
  ];
  const choice = grammarCards(d)[1];
  d = recordLearning(
    d,
    choice,
    "She read.",
    false,
    "checked",
    historyStamp(d, choice),
    now,
  );
  const r = progressReport(d, now);
  assert.equal(r.accuracy.percent, 50);
  assert.deepEqual(r.objectiveAccuracy, { total: 1, right: 0, percent: 0 });
  assert.equal(r.selfAccuracy.total, 3);
  assert.equal(r.previousAccuracy.percent, 0);
  assert.equal(r.currentAccuracy.percent, 67);
  assert.equal(r.trend.length, 14);
  assert.equal(r.trend[0].percent, null);
  assert.equal(r.trend.at(-1).total, 3);
});
test("a weekly answer is counted once from its category history, never again from the session array", () => {
  let d = startWeekly(fixture(), "session", now),
    c = d.learning.weekly[0].cards[0];
  d = recordLearning(
    d,
    c,
    c.mode === "recall" ? "" : c.answer,
    true,
    "weekly-event",
    "",
    now,
    "session",
  );
  let r = progressReport(d, now);
  assert.equal(r.dailyReviews.answered, 1);
  assert.equal(r.accuracy.total, 1);
  assert.equal(r.weeklyInProgress, 1);
  assert.equal(r.weeklyFinished, 0);
  const next = d.learning.weekly[0].cards[1];
  d = recordLearning(
    d,
    next,
    next.answer,
    true,
    "second",
    "",
    now + 1,
    "session",
  );
  r = progressReport(d, now + 1);
  assert.equal(r.weeklyFinished, 1);
  assert.equal(r.accuracy.total, 2);
});
test("grammar topic errors retain a current note shortcut and deleted notes keep honest history", () => {
  let d = fixture(),
    c = grammarCards(d)[0];
  d = recordLearning(d, c, "", false, "miss", historyStamp(d, c), now);
  let r = progressReport(d, now);
  assert.equal(r.grammarTopics[0].wrong, 1);
  assert.equal(r.grammarTopics[0].notes[0].id, "g");
  d.grammar = [];
  r = progressReport(d, now);
  assert.equal(r.grammarTopics[0].wrong, 1);
  assert.equal(r.grammarTopics[0].notes.length, 0);
});
test("exam performance excludes unfinished results, includes blanks in the denominator and uses measured duration only", () => {
  const d = fixture();
  d.exams.attempts.push({
    ...structuredClone(d.exams.attempts[0]),
    id: "pending",
    created: now - 5000,
    finished: false,
    completedAt: undefined,
    elapsed: 20,
    answers: { q: "reads" },
  });
  const r = progressReport(d, now);
  assert.equal(r.completedExams, 1);
  assert.equal(r.examPercent, 0);
  assert.equal(r.examTotal, 1);
  assert.equal(r.examSeconds, 145);
  assert.equal(r.sessions.length, 2);
});
test("different checkpoints of an imported exam session count once and prefer the completed measured result", () => {
  const d = fixture(),
    completed = d.exams.attempts[0];
  d.exams.attempts.unshift({
    ...structuredClone(completed),
    id: "old-checkpoint",
    finished: false,
    completedAt: undefined,
    elapsed: 20,
    answers: {},
  });
  d.exams.attempts.push({
    ...structuredClone(completed),
    id: "older-export",
    completedAt: undefined,
  });
  const r = progressReport(d, now);
  assert.equal(r.completedExams, 1);
  assert.equal(r.examSeconds, 125);
  assert.equal(r.sessions.length, 1);
  assert.equal(r.sessions[0].attempt.finished, true);
});
test("one card pending in both word engines counts once, even when its fixed review is still in the future", () => {
  const d = emptyNotebook();
  d.words = [
    {
      ...word(),
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-19",
        reviews: [],
      },
      review: { due: now - 1, interval: 1, repetitions: 1 },
    },
  ];
  assert.equal(progressReport(d, now).pending, 1);
  d.words[0].memorization.learnedOn = "2026-10-18";
  assert.equal(progressReport(d, now).pending, 1);
});
test("word-only backup carries detailed answers and weekly goal while unrelated sections stay unchanged", () => {
  const d = fixture();
  d.words[0].answerHistory = [event("miss", "2026-10-19", "again")];
  d.studyPreferences = { dailyNewWordGoal: 6, weeklyReviewGoal: 20 };
  const backup = parseBackup(
    JSON.parse(
      JSON.stringify(
        makeBackup(d, { sections: ["words"], includeAudio: false }),
      ),
    ),
  );
  const current = fixture();
  current.words = [];
  const result = planRestore(
    current,
    backup,
    { sections: ["words"], mode: "replace" },
    [],
  ).data;
  assert.deepEqual(result.words, d.words);
  assert.deepEqual(result.exams, current.exams);
  assert.deepEqual(result.grammar, current.grammar);
  assert.deepEqual(result.studyPreferences, d.studyPreferences);
  const again = planRestore(
    result,
    backup,
    { sections: ["words"], mode: "merge" },
    [],
  ).data;
  assert.deepEqual(progressReport(result, now), progressReport(again, now));
});
test("future category and weekly answers do not complete work before their recorded time", () => {
  let d = startWeekly(fixture(), "weekly", now);
  const cards = d.learning.weekly[0].cards;
  for (let i = 0; i < cards.length; i++)
    d = recordLearning(
      d,
      cards[i],
      cards[i].mode === "recall" ? "" : cards[i].answer,
      true,
      `future-${i}`,
      "",
      now + 1000 + i,
      "weekly",
    );
  const r = progressReport(d, now);
  assert.equal(r.accuracy.total, 0);
  assert.equal(r.mistakePending, 1);
  assert.equal(r.weeklyFinished, 0);
  assert.equal(r.weeklyInProgress, 1);
});
test("a resolved question stays resolved when an imported copy of the same source is listed first", () => {
  let d = fixture(),
    card = learningMistakes(d.exams.attempts)[0].card;
  d = recordLearning(
    d,
    card,
    card.answer,
    true,
    "resolved",
    historyStamp(d, card),
    now,
  );
  assert.equal(progressReport(d, now).mistakePending, 0);
  d.exams.attempts.unshift({
    ...structuredClone(d.exams.attempts[0]),
    id: "first-imported-copy",
  });
  assert.equal(progressReport(d, now).mistakePending, 0);
  assert.equal(progressReport(d, now).completedExams, 1);
});
test("imported checkpoints of the same weekly session count once without mutating saved histories", () => {
  let d = startWeekly(fixture(), "weekly", now);
  const partial = structuredClone(d.learning.weekly[0]);
  const cards = d.learning.weekly[0].cards;
  for (let i = 0; i < cards.length; i++)
    d = recordLearning(
      d,
      cards[i],
      cards[i].mode === "recall" ? "" : cards[i].answer,
      true,
      `answer-${i}`,
      "",
      now + i,
      "weekly",
    );
  d.learning.weekly.unshift({ ...partial, id: "imported-weekly" });
  const before = structuredClone(d);
  const report = progressReport(d, now + 100);
  assert.equal(report.weeklyFinished, 1);
  assert.equal(report.weeklyInProgress, 0);
  assert.deepEqual(d, before);
});
test("weekly target validates, supports zero and persists independently of daily learning target", () => {
  for (const target of [-1, 1.5, 1001, "5"])
    assert.throws(() =>
      validateStudyPreferences({
        dailyNewWordGoal: 5,
        weeklyReviewGoal: target,
      }),
    );
  const d = emptyNotebook();
  d.studyPreferences = validateStudyPreferences({
    dailyNewWordGoal: 0,
    weeklyReviewGoal: 0,
  });
  let r = progressReport(d, now);
  assert.equal(r.dailyProgress, null);
  assert.equal(r.weeklyProgress, null);
  d.studyPreferences = { dailyNewWordGoal: 4, weeklyReviewGoal: 2 };
  d.words = [
    {
      ...word(),
      answerHistory: [
        event("1", "2026-10-19"),
        event("2", "2026-10-19", "again"),
      ],
    },
  ];
  r = progressReport(d, now);
  assert.equal(r.weeklyProgress, 50);
  assert.equal(r.dailyProgress, 0);
  assert.equal(r.dailyGoal, 4);
});
test("invalid word history is rejected without accepting duplicate events or fabricated dates", () => {
  for (const answerHistory of [
    [event("e", "2026-02-30")],
    [event("e", "2026-10-19"), event("e", "2026-10-19")],
    [{ ...event("e", "2026-10-19"), outcome: "excellent" }],
  ]) {
    const d = emptyNotebook();
    d.words = [{ ...word(), answerHistory }];
    assert.throws(() => validateNotebook(d));
  }
});
test("JSON, ZIP and independent disk reopen preserve identical reports and repeat imports are idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "progress-"));
  try {
    let d = fixture();
    d.words[0].answerHistory = [
      event("miss", "2026-10-19", "again"),
      event("good", "2026-10-19"),
    ];
    d.studyPreferences = { dailyNewWordGoal: 5, weeklyReviewGoal: 10 };
    const c = grammarCards(d)[0];
    d = recordLearning(d, c, "", false, "g-event", historyStamp(d, c), now);
    const expected = progressReport(d, now);
    const path = join(dir, "store");
    await createStore(path).save(d, null);
    assert.deepEqual(
      progressReport((await createStore(path).read()).data, now),
      expected,
    );
    const bundle = parseBackup(
      JSON.parse(
        JSON.stringify(
          makeBackup(d, { sections: BACKUP_SECTIONS, includeAudio: false }),
        ),
      ),
    );
    let restored = planRestore(
      emptyNotebook(),
      bundle,
      { sections: BACKUP_SECTIONS, mode: "replace" },
      [],
    ).data;
    assert.deepEqual(progressReport(restored, now), expected);
    restored = planRestore(
      restored,
      bundle,
      { sections: BACKUP_SECTIONS, mode: "merge" },
      [],
    ).data;
    assert.deepEqual(progressReport(restored, now), expected);
    const file = join(dir, "backup.zip");
    await writeBackupArchive(file, bundle);
    const loaded = await readBackupArchive(file, join(dir, "stage"));
    assert.deepEqual(
      progressReport(
        planRestore(
          emptyNotebook(),
          loaded.bundle,
          { sections: BACKUP_SECTIONS, mode: "replace" },
          [],
        ).data,
        now,
      ),
      expected,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("local midnight, leap day, daylight saving weeks and year rollover respect local calendar boundaries", () => {
  const source = `import {progressReport} from './src/progress.ts';import {emptyNotebook} from './src/backup-core.ts';let d=emptyNotebook();d.words=[${JSON.stringify({ ...word(), answerHistory: [event("a", "2026-03-29"), event("b", "2026-03-30")] })}];console.log(JSON.stringify(process.argv.slice(1).map(t=>{const r=progressReport(d,Number(t));return [r.today,r.week,r.dailyReviews.answered,r.weeklyReviews.answered]})));`;
  for (const [zone, dates, expected] of [
    [
      "Europe/Istanbul",
      ["2026-10-18T20:59:59Z", "2026-10-18T21:00:00Z"],
      [
        ["2026-10-18", "2026-10-12", 0, 0],
        ["2026-10-19", "2026-10-19", 0, 0],
      ],
    ],
    [
      "Europe/Berlin",
      ["2026-03-29T21:59:59Z", "2026-03-29T22:00:00Z"],
      [
        ["2026-03-29", "2026-03-23", 1, 1],
        ["2026-03-30", "2026-03-30", 1, 1],
      ],
    ],
    [
      "America/New_York",
      ["2024-02-29T17:00:00Z", "2027-01-03T17:00:00Z"],
      [
        ["2024-02-29", "2024-02-26", 0, 0],
        ["2027-01-03", "2026-12-28", 0, 0],
      ],
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        source,
        ...dates.map((d) => String(new Date(d).getTime())),
      ],
      { env: { ...process.env, TZ: zone }, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), expected);
  }
});
