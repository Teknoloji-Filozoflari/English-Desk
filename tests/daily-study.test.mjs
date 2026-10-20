import test from "node:test";
import assert from "node:assert/strict";
import { dailyStudy } from "../src/daily-study.ts";
import { validateNotebook } from "../src/model.ts";
import {
  enrollMemorization,
  recordMemorization,
  recordWordReview,
} from "../src/notebook/services/repetition.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
} from "../src/backup-core.ts";
import { pendingWrongQuestions, exampleTests } from "../src/exams.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const now = new Date("2026-10-19T12:00:00+03:00").getTime();
const word = (id = "word") => ({
  id,
  word: id,
  meaning: "anlam",
  type: "noun",
  synonyms: "",
  antonyms: "",
  example: "",
  translation: "",
  storyId: "",
});
const data = (words) => ({ ...emptyNotebook(), words });
const memory = { addedOn: "2026-10-18", learnedOn: "2026-10-18", reviews: [] };
const review = { due: now - 1000, interval: 1, repetitions: 1 };

test("empty and legacy notebooks have honest zero statistics and a default goal", () => {
  const plan = dailyStudy(data([]), now);
  assert.equal(plan.goal, 5);
  for (const key of [
    "pending",
    "completed",
    "learned",
    "progress",
    "estimatedMinutes",
    "wrongCount",
  ])
    assert.equal(plan[key], 0);
  const legacy = dailyStudy(data([word()]), now);
  assert.equal(legacy.pending, 0);
  assert.equal(legacy.availableNew, 1);
  assert.equal(legacy.estimatedMinutes, 2);
});

test("a card in two queues is counted once and completes only after both answers are saved", () => {
  let notebook = {
    ...data([{ ...word(), memorization: structuredClone(memory), review }]),
    studyPreferences: { dailyNewWordGoal: 1 },
  };
  let plan = dailyStudy(notebook, now);
  assert.equal(plan.pending, 1);
  assert.equal(plan.memoryDue, 1);
  assert.equal(plan.reviewDue, 1);
  assert.equal(plan.completed, 0);
  notebook = recordMemorization(
    notebook,
    "word",
    memory,
    "review",
    "2026-10-19",
  );
  plan = dailyStudy(notebook, now);
  assert.equal(plan.pending, 1);
  assert.equal(plan.completed, 0);
  notebook = recordWordReview(notebook, "word", review, "good", now);
  plan = dailyStudy(notebook, now);
  assert.equal(plan.pending, 0);
  assert.equal(plan.completed, 1);
  assert.equal(plan.progress, 50);
  const enrolled = enrollMemorization(
    { ...notebook, words: [...notebook.words, word("new")] },
    "new",
    "2026-10-19",
  );
  notebook = recordMemorization(
    enrolled,
    "new",
    enrolled.words[1].memorization,
    "learn",
    "2026-10-19",
  );
  assert.equal(dailyStudy(notebook, now).progress, 100);
});

test("new-word goal counts saved first learning once across both engines", () => {
  let notebook = recordWordReview(
    data([word()]),
    "word",
    undefined,
    "good",
    now,
  );
  assert.equal(dailyStudy(notebook, now).learned, 1);
  assert.equal(dailyStudy(notebook, now).completed, 0);
  notebook = enrollMemorization(notebook, "word", "2026-10-19");
  notebook = recordMemorization(
    notebook,
    "word",
    notebook.words[0].memorization,
    "learn",
    "2026-10-19",
  );
  assert.equal(dailyStudy(notebook, now).learned, 1);
  assert.equal(dailyStudy(notebook, now).remainingNew, 4);
  const again = recordWordReview(
    data([word()]),
    "word",
    undefined,
    "again",
    now,
  );
  assert.equal(dailyStudy(again, now).learned, 0);
  const learnedLater = recordWordReview(
    again,
    "word",
    again.words[0].review,
    "hard",
    now + 600000,
  );
  assert.equal(dailyStudy(learnedLater, now + 600000).learned, 1);
});

test("legacy review answers are not invented as first learning, and days reset without changing the goal", () => {
  const notebook = recordWordReview(
    {
      ...data([{ ...word(), review }]),
      studyPreferences: { dailyNewWordGoal: 3 },
    },
    "word",
    review,
    "good",
    now,
  );
  assert.equal(dailyStudy(notebook, now).learned, 0);
  assert.equal(dailyStudy(notebook, now).completed, 1);
  const tomorrow = dailyStudy(notebook, now + 86400000);
  assert.equal(tomorrow.goal, 3);
  assert.equal(tomorrow.completed, 0);
  assert.equal(tomorrow.learned, 0);
  assert.equal(tomorrow.pending, 0);
  assert.equal(dailyStudy(notebook, now + 2 * 86400000).pending, 1);
});

test("editing the goal changes progress, not the schedule; zero is supported", () => {
  const notebook = data([{ ...word(), memorization: structuredClone(memory) }]);
  const before = structuredClone(notebook);
  const noNewWords = { ...notebook, studyPreferences: { dailyNewWordGoal: 0 } };
  assert.equal(dailyStudy(noNewWords, now).pending, 1);
  assert.equal(dailyStudy(noNewWords, now).estimatedMinutes, 1);
  assert.deepEqual(notebook, before);
  assert.equal(
    dailyStudy({ ...data([]), studyPreferences: { dailyNewWordGoal: 0 } }, now)
      .progress,
    0,
  );
});

const question = {
  id: "q",
  prompt: "Book?",
  passage: "",
  kind: "choice",
  options: ["kitap", "masa"],
  answer: "kitap",
  explanation: "",
};
const exam = {
  id: "test",
  title: "Kişisel test",
  exam: "YDS",
  source: "Kendi sorularım",
  section: "Karma",
  minutes: 0,
  questions: [question],
};
const attempt = (id, created, answer, finished = true) => ({
  id,
  created,
  finished,
  test: exam,
  mode: "study",
  answers: answer === undefined ? {} : { q: answer },
  flags: [],
  position: 0,
  elapsed: 0,
});
test("wrong questions use the latest finished answer and never change the exam history", () => {
  const history = [
    attempt("old", 1, "masa"),
    attempt("unfinished", 2, "kitap", false),
  ];
  const before = structuredClone(history);
  assert.equal(pendingWrongQuestions(history)[0].questions.length, 1);
  assert.deepEqual(history, before);
  const corrected = [...history, attempt("repeat", 3, "kitap")];
  assert.equal(pendingWrongQuestions(corrected).length, 0);
  assert.equal(
    pendingWrongQuestions([...corrected, attempt("later", 4, undefined)])[0]
      .questions.length,
    1,
  );
});

test("sample stories, their words and built-in example exams do not inflate live counts", () => {
  const notebook = data([
    {
      ...word(),
      storyId: "sample",
      review,
      memorization: structuredClone(memory),
    },
  ]);
  notebook.stories = [
    {
      id: "sample",
      title: "Demo",
      text: "Demo.",
      level: "A1",
      read: false,
      sample: true,
    },
  ];
  notebook.exams = {
    tests: exampleTests(),
    attempts: [{ ...attempt("demo", 1, "wrong"), test: exampleTests()[0] }],
  };
  const plan = dailyStudy(notebook, now);
  assert.equal(plan.pending, 0);
  assert.equal(plan.personalWords, 0);
  assert.equal(plan.stories.length, 0);
  assert.equal(plan.wrongCount, 0);
});

test("optional study fields validate, survive sanitization and reject malformed goals or dates", () => {
  const notebook = {
    ...data([
      {
        ...word(),
        studyActivity: {
          startedOn: "2026-10-18",
          firstLearnedOn: "2026-10-19",
          extra: true,
        },
      },
    ]),
    studyPreferences: { dailyNewWordGoal: 7, extra: true },
  };
  const checked = validateNotebook(notebook);
  assert.deepEqual(checked.studyPreferences, { dailyNewWordGoal: 7 });
  assert.equal(checked.words[0].studyActivity.extra, undefined);
  for (const invalid of [-1, 101, 1.5, "5", null])
    assert.throws(
      () =>
        validateNotebook({
          ...notebook,
          studyPreferences: { dailyNewWordGoal: invalid },
        }),
      /hedefi/,
    );
  assert.throws(
    () =>
      validateNotebook(
        data([{ ...word(), studyActivity: { firstLearnedOn: "2026-02-30" } }]),
      ),
    /tarihi/,
  );
});

test("goals and activity survive disk restart and JSON restore; partial backups do not overwrite preferences", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "english-desk-daily-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const notebook = {
    ...recordWordReview(data([word()]), "word", undefined, "good", now),
    studyPreferences: { dailyNewWordGoal: 7 },
  };
  await createStore(directory).save(notebook, null);
  assert.deepEqual(
    dailyStudy((await createStore(directory).read()).data, now),
    dailyStudy(notebook, now),
  );
  const bundle = parseBackup(
    JSON.parse(
      JSON.stringify(
        makeBackup(notebook, { sections: ["words"], includeAudio: false }),
      ),
    ),
  );
  const restored = planRestore(
    emptyNotebook(),
    bundle,
    { sections: ["words"], mode: "replace" },
    [],
  ).data;
  assert.equal(restored.studyPreferences.dailyNewWordGoal, 7);
  assert.deepEqual(
    restored.words[0].studyActivity,
    notebook.words[0].studyActivity,
  );
  const current = { ...notebook, studyPreferences: { dailyNewWordGoal: 2 } };
  assert.equal(
    planRestore(current, bundle, { sections: ["words"], mode: "merge" }, [])
      .data.studyPreferences.dailyNewWordGoal,
    2,
  );
  const old = parseBackup({ version: 1, words: [word()] });
  assert.equal(
    planRestore(current, old, { sections: ["words"], mode: "replace" }, []).data
      .studyPreferences.dailyNewWordGoal,
    2,
  );
  assert.equal(
    makeBackup(notebook, { sections: ["stories"], includeAudio: false }).data
      .studyPreferences,
    undefined,
  );
});
