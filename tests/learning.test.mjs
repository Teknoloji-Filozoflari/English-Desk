import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
  BACKUP_SECTIONS,
} from "../src/backup-core.ts";
import { validateNotebook } from "../src/model.ts";
import {
  grammarCards,
  grammarDue,
  recordLearning,
  historyStamp,
  learningMistakes,
  learningWrongGroups,
  mistakePatterns,
  startWeekly,
  weekStart,
  cardKey,
  validateLearning,
  validateGrammarExercises,
  emptyLearning,
} from "../src/learning.ts";
import { dailyStudy } from "../src/daily-study.ts";
import { applyEditor } from "../src/notebook/services/editor.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../scripts/backup-archive.mjs";
const now = new Date("2026-10-19T12:00:00+03:00").getTime();
let seq = 0;
const uid = () => `event-${++seq}`;
export function fixture() {
  const d = emptyNotebook();
  d.grammar = [
    {
      id: "g1",
      title: "Present simple",
      body: "He / she / it ile fiile -s eklenir.",
      exercises: [
        {
          id: "choose",
          mode: "choice",
          prompt: "Üçüncü tekil şahıs için doğru örneği seç.",
          options: ["She reads.", "She read."],
          answer: "She reads.",
          explanation: "She üçüncü tekil şahıstır.",
        },
        {
          id: "complete",
          mode: "completion",
          prompt: "She _____ every day. (read)",
          options: [],
          answer: "reads",
          explanation: "Geniş zaman: reads.",
        },
      ],
    },
  ];
  const exam = {
    id: "test",
    exam: "YDS",
    title: "Personal exam",
    section: "Grammar",
    source: "Kişisel",
    minutes: 5,
    questions: [
      {
        id: "q1",
        prompt: "She _____ a book.",
        passage: "",
        kind: "choice",
        options: ["reads", "read"],
        answer: "reads",
        explanation: "She ile reads.",
      },
      {
        id: "q2",
        prompt: "Write the past of go.",
        passage: "",
        kind: "text",
        options: [],
        answer: "went",
        explanation: "Go → went.",
      },
    ],
  };
  d.exams = {
    tests: [exam],
    attempts: [
      {
        id: "a1",
        test: structuredClone(exam),
        mode: "exam",
        answers: { q1: "read" },
        flags: [],
        position: 0,
        elapsed: 30,
        finished: true,
        created: now - 100000,
      },
    ],
  };
  return d;
}
const answer = (
  data,
  card,
  response = card.answer,
  recalled = true,
  at = now,
  weeklyId,
) =>
  recordLearning(
    data,
    card,
    response,
    recalled,
    uid(),
    historyStamp(data, card),
    at,
    weeklyId,
  );
test("old notebooks remain unchanged; personal notes produce recall and structured choice/completion cards", () => {
  const d = fixture();
  assert.equal(validateNotebook(d).learning, undefined);
  const cards = grammarCards(d);
  assert.deepEqual(
    cards.map((c) => c.mode),
    ["recall", "choice", "completion"],
  );
  assert.equal(cards[0].answer, d.grammar[0].body);
  assert.ok(cards.every((c) => grammarDue(c, [], "2026-10-19")));
  assert.equal(
    grammarCards({ ...d, grammar: [{ id: "empty", title: "", body: "" }] })
      .length,
    0,
  );
  assert.deepEqual(
    validateNotebook(d).grammar[0].exercises,
    d.grammar[0].exercises,
  );
});
for (const mode of ["recall", "choice", "completion"]) {
  test(`${mode}: correct response persists under grammar, without changing words or exams`, () => {
    const d = fixture(),
      before = structuredClone(d),
      card = grammarCards(d).find((c) => c.mode === mode);
    const next = answer(
      d,
      card,
      mode === "completion" ? "  READS  " : card.answer,
    );
    assert.equal(next.learning.grammarHistory.length, 1);
    assert.equal(next.learning.grammarHistory[0].correct, true);
    assert.equal(next.learning.mistakeHistory.length, 0);
    assert.deepEqual(next.exams, before.exams);
    assert.deepEqual(next.words, before.words);
    assert.deepEqual(d, before);
    assert.equal(
      grammarDue(card, next.learning.grammarHistory, "2026-10-19"),
      false,
    );
    assert.equal(
      grammarDue(card, next.learning.grammarHistory, "2026-10-20"),
      true,
    );
    validateNotebook(next);
  });
  test(`${mode}: wrong response stays pending and feedback data contains the actual rule`, () => {
    const d = fixture(),
      card = grammarCards(d).find((c) => c.mode === mode),
      next = answer(d, card, "wrong", false);
    assert.equal(next.learning.grammarHistory[0].correct, false);
    assert.ok(
      next.learning.grammarHistory[0].card.explanation.includes(
        d.grammar[0].body,
      ),
    );
    assert.equal(
      grammarDue(card, next.learning.grammarHistory, "2026-10-19"),
      true,
    );
  });
}
test("duplicate events, stale prompts and concurrent responses cannot record a second grammar step", () => {
  const d = fixture(),
    card = grammarCards(d)[0],
    stamp = historyStamp(d, card),
    id = uid();
  const next = recordLearning(d, card, "", true, id, stamp, now);
  assert.equal(recordLearning(next, card, "", true, id, stamp, now), next);
  assert.equal(recordLearning(next, card, "", true, uid(), stamp, now), next);
  const changed = structuredClone(d);
  changed.grammar[0].body = "Changed rule";
  assert.equal(
    recordLearning(changed, card, "", true, uid(), stamp, now),
    changed,
  );
});
test("schedule uses calendar days and shared intervals, rejects clock rollback and resets after a miss", () => {
  let d = fixture(),
    card = grammarCards(d)[0];
  d = answer(d, card, "", true, now);
  d = answer(d, card, "", true, now + 86400000);
  assert.equal(
    grammarDue(card, d.learning.grammarHistory, "2026-10-22"),
    false,
  );
  assert.equal(grammarDue(card, d.learning.grammarHistory, "2026-10-23"), true);
  assert.equal(
    recordLearning(d, card, "", true, uid(), historyStamp(d, card), now - 1),
    d,
  );
  d = answer(d, card, "", false, now + 4 * 86400000);
  assert.equal(grammarDue(card, d.learning.grammarHistory, "2026-10-23"), true);
  d = answer(d, card, "", true, now + 4 * 86400000 + 1000);
  assert.equal(grammarDue(card, d.learning.grammarHistory, "2026-10-24"), true);
  assert.equal(weekStart("2027-01-03"), "2026-12-28");
  assert.equal(weekStart("2026-10-19"), "2026-10-19");
});
test("wrong and blank questions can be answered independently of immutable source exam snapshots", () => {
  const d = fixture(),
    before = structuredClone(d.exams),
    pool = learningMistakes(d.exams.attempts);
  assert.equal(pool.length, 2);
  let next = answer(d, pool[0].card, "wrong");
  assert.equal(
    learningMistakes(next.exams.attempts, next.learning.mistakeHistory).length,
    2,
  );
  next = answer(next, pool[0].card, "reads");
  assert.equal(
    learningMistakes(next.exams.attempts, next.learning.mistakeHistory).length,
    1,
  );
  assert.equal(next.learning.grammarHistory.length, 0);
  assert.deepEqual(next.exams, before);
  assert.equal(dailyStudy(next, now).wrongCount, 1);
  assert.equal(learningWrongGroups(next)[0].questions[0].id, "q2");
  assert.equal(answer(next, pool[0].card), next);
  validateNotebook(next);
});
test("a later original failure reopens a resolved question; an old weekly snapshot cannot clear the new failure", () => {
  let d = fixture();
  const old = learningMistakes(d.exams.attempts)[0].card;
  d = answer(d, old);
  assert.equal(
    learningMistakes(d.exams.attempts, d.learning.mistakeHistory).length,
    1,
  );
  const newer = {
    ...structuredClone(d.exams.attempts[0]),
    id: "a2",
    created: now + 1000,
    completedAt: now + 3000,
  };
  d.exams.attempts.push(newer);
  const pool = learningMistakes(d.exams.attempts, d.learning.mistakeHistory);
  assert.equal(pool.length, 2);
  assert.ok(pool.every((r) => r.attempt.id === "a2"));
  const correctLater = {
    ...structuredClone(newer),
    id: "a3",
    created: now + 4000,
    completedAt: now + 5000,
    answers: { q1: "reads", q2: "went" },
  };
  d.exams.attempts.push(correctLater);
  assert.equal(
    learningMistakes(d.exams.attempts, d.learning.mistakeHistory).length,
    0,
  );
});
test("question identities include test and content; unfinished and sample sessions never enter the live pool", () => {
  const d = fixture(),
    same = structuredClone(d.exams.attempts[0]);
  same.id = "other";
  same.test.id = "other-test";
  d.exams.attempts.push(same);
  assert.equal(learningMistakes(d.exams.attempts).length, 4);
  same.finished = false;
  assert.equal(learningMistakes(d.exams.attempts).length, 2);
  same.finished = true;
  same.test.id = "example-yds-01";
  assert.equal(learningMistakes(d.exams.attempts).length, 2);
  d.exams.tests = [];
  assert.equal(learningMistakes(d.exams.attempts).length, 2);
  const edited = structuredClone(d.exams.attempts[0]);
  edited.id = "edited";
  edited.test.questions[0].answer = "read";
  edited.created = now + 1000;
  edited.answers = { q1: "read", q2: "went" };
  d.exams.attempts.push(edited);
  assert.equal(learningMistakes(d.exams.attempts).length, 1);
});
test("topic patterns distinguish original errors, pending questions and review performance", () => {
  let d = fixture();
  const card = learningMistakes(d.exams.attempts)[0].card;
  d = answer(d, card, "read");
  d = answer(d, card, "reads");
  assert.deepEqual(mistakePatterns(d)[0], {
    topic: "other · Grammar",
    wrong: 2,
    total: 2,
    pending: 1,
    reviewRight: 1,
    reviewWrong: 1,
  });
});
test("weekly sessions freeze a mixed set, resume after restart, reject duplicates and save each result in its own category", () => {
  let d = startWeekly(fixture(), "week", now),
    session = d.learning.weekly[0];
  const before = structuredClone(d.exams);
  assert.equal(session.cards.length, 5);
  assert.ok(session.cards.some((c) => c.kind === "grammar"));
  assert.ok(session.cards.some((c) => c.kind === "mistake"));
  assert.equal(startWeekly(d, "duplicate", now + 1000), d);
  for (let i = 0; i < session.cards.length; i++) {
    const card = d.learning.weekly[0].cards[i],
      eventId = uid(),
      stamp = historyStamp(d, card);
    const next = recordLearning(
      d,
      card,
      card.mode === "recall" ? "" : card.answer,
      true,
      eventId,
      stamp,
      now + i,
      "week",
    );
    assert.notEqual(next, d);
    assert.equal(
      recordLearning(
        next,
        card,
        card.answer,
        true,
        eventId,
        stamp,
        now + i,
        "week",
      ),
      next,
    );
    d = validateNotebook(JSON.parse(JSON.stringify(next)));
  }
  assert.equal(d.learning.weekly[0].answers.length, 5);
  assert.equal(d.learning.grammarHistory.length, 3);
  assert.equal(d.learning.mistakeHistory.length, 2);
  assert.deepEqual(d.exams, before);
  assert.equal(
    learningMistakes(d.exams.attempts, d.learning.mistakeHistory).length,
    0,
  );
  const edited = structuredClone(d);
  edited.grammar = [];
  assert.equal(edited.learning.weekly[0].cards.length, 5);
  assert.equal(
    startWeekly(d, "next-week", now + 7 * 86400000).learning.weekly.length,
    2,
  );
});
test("weekly sessions tolerate deleted or edited sources and empty pools create no fake questions", () => {
  const empty = emptyNotebook();
  assert.equal(startWeekly(empty, "empty", now), empty);
  let d = startWeekly(fixture(), "week", now);
  d.grammar = [];
  d.exams.tests = [];
  const c = d.learning.weekly[0].cards[0];
  d = answer(d, c, c.answer, true, now, "week");
  assert.equal(d.learning.weekly[0].answers.length, 1);
});
test("invalid exercises, history kinds, scores and duplicate weekly answers are rejected without altering the notebook", () => {
  const d = fixture();
  for (const exercise of [
    { ...d.grammar[0].exercises[0], options: ["reads", "READS"] },
    { ...d.grammar[0].exercises[1], prompt: "No blank" },
    { ...d.grammar[0].exercises[0], answer: "not an option" },
  ])
    assert.throws(() => validateGrammarExercises([exercise]));
  let next = answer(d, grammarCards(d)[1]);
  const bad = structuredClone(next.learning);
  bad.grammarHistory[0].correct = false;
  assert.throws(() => validateLearning(bad));
  const wrongKind = structuredClone(next.learning);
  wrongKind.mistakeHistory = wrongKind.grammarHistory;
  wrongKind.grammarHistory = [];
  assert.throws(() => validateLearning(wrongKind));
  next = startWeekly(d, "week", now);
  const c = next.learning.weekly[0].cards[0];
  next = answer(next, c, c.answer, true, now, "week");
  next.learning.weekly[0].answers.push(next.learning.weekly[0].answers[0]);
  assert.throws(() => validateNotebook(next));
});
test("ordinary note editing preserves authored exercises and history after its source is deleted", () => {
  let d = fixture();
  d = answer(d, grammarCards(d)[0]);
  const note = d.grammar[0],
    edited = applyEditor(
      d,
      {
        kind: "grammar",
        id: note.id,
        values: { title: note.title, body: "Updated rule" },
        importNotes: [],
      },
      [],
      uid,
    ).data;
  assert.deepEqual(edited.grammar[0].exercises, note.exercises);
  assert.deepEqual(edited.learning, d.learning);
  edited.grammar = [];
  assert.equal(validateNotebook(edited).learning.grammarHistory.length, 1);
});
test("JSON selected restore isolates histories, full replace and merge preserve snapshots and remain idempotent", () => {
  let d = startWeekly(fixture(), "week", now);
  const card = d.learning.weekly[0].cards[0];
  d = answer(d, card, card.answer, true, now, "week");
  d = answer(d, learningMistakes(d.exams.attempts)[0].card);
  for (const sections of [BACKUP_SECTIONS, ["grammar"], ["exams"]]) {
    const bundle = parseBackup(
      JSON.parse(
        JSON.stringify(makeBackup(d, { sections, includeAudio: false })),
      ),
    );
    const target = planRestore(
      emptyNotebook(),
      bundle,
      { sections, mode: "replace" },
      [],
    ).data;
    assert.equal(
      target.learning.grammarHistory.length,
      sections.includes("grammar") ? d.learning.grammarHistory.length : 0,
    );
    assert.equal(
      target.learning.mistakeHistory.length,
      sections.includes("exams") ? d.learning.mistakeHistory.length : 0,
    );
    assert.equal(
      target.learning.weekly.length,
      sections.includes("grammar") && sections.includes("exams") ? 1 : 0,
    );
    assert.deepEqual(
      planRestore(d, bundle, { sections, mode: "merge" }, []).data.learning,
      d.learning,
    );
  }
  const old = makeBackup(fixture(), {
    sections: ["grammar"],
    includeAudio: false,
  });
  const replacement = planRestore(
    d,
    old,
    { sections: ["grammar"], mode: "replace" },
    [],
  ).data;
  assert.equal(replacement.learning.grammarHistory.length, 0);
  assert.deepEqual(
    replacement.learning.mistakeHistory,
    d.learning.mistakeHistory,
  );
  assert.deepEqual(replacement.exams, d.exams);
});
test("restore merge relinks reviews when equivalent notes and attempts already exist under different IDs", () => {
  let incoming = fixture();
  incoming = answer(incoming, grammarCards(incoming)[0]);
  incoming = answer(
    incoming,
    learningMistakes(incoming.exams.attempts)[0].card,
  );
  const current = fixture();
  current.grammar[0].id = "existing-note";
  current.exams.attempts[0].id = "existing-attempt";
  const result = planRestore(
    current,
    makeBackup(incoming, { sections: BACKUP_SECTIONS, includeAudio: false }),
    { sections: BACKUP_SECTIONS, mode: "merge" },
    [],
  ).data;
  assert.equal(result.grammar.length, 1);
  assert.equal(result.exams.attempts.length, 1);
  assert.equal(
    result.learning.grammarHistory[0].card.sourceId,
    "existing-note",
  );
  assert.equal(
    result.learning.mistakeHistory[0].card.sourceId,
    "existing-attempt",
  );
  assert.equal(
    grammarDue(
      grammarCards(result)[0],
      result.learning.grammarHistory,
      "2026-10-19",
    ),
    false,
  );
  assert.equal(
    learningMistakes(result.exams.attempts, result.learning.mistakeHistory)
      .length,
    1,
  );
  assert.deepEqual(current.exams.attempts[0].answers, { q1: "read" });
});
test("a conflict with the same ID does not attach imported practice to different source content", () => {
  let incoming = fixture();
  incoming = answer(incoming, grammarCards(incoming)[0]);
  incoming = answer(
    incoming,
    learningMistakes(incoming.exams.attempts)[0].card,
  );
  const current = fixture();
  current.grammar[0].body = "A completely different rule.";
  current.exams.attempts[0].test.questions[0].prompt = "A different question.";
  const result = planRestore(
    current,
    makeBackup(incoming, { sections: BACKUP_SECTIONS, includeAudio: false }),
    { sections: BACKUP_SECTIONS, mode: "merge" },
    [],
  ).data;
  assert.equal(
    grammarDue(
      grammarCards(result)[0],
      result.learning.grammarHistory,
      "2026-10-19",
    ),
    true,
  );
  assert.equal(
    learningMistakes(result.exams.attempts, result.learning.mistakeHistory)
      .length,
    2,
  );
  assert.equal(
    result.learning.grammarHistory[0].card.answer,
    incoming.grammar[0].body,
  );
});
test("an old weekly success cannot resolve the same question failed in a later original exam", () => {
  let d = startWeekly(fixture(), "week", now),
    session = d.learning.weekly[0];
  const index = session.cards.findIndex((c) => c.kind === "mistake");
  for (let i = 0; i < index; i++)
    d = answer(
      d,
      session.cards[i],
      session.cards[i].mode === "recall" ? "" : session.cards[i].answer,
      true,
      now + i,
      "week",
    );
  const newer = {
    ...structuredClone(d.exams.attempts[0]),
    id: "newer-source",
    created: now + 100,
    completedAt: now + 150,
  };
  d.exams.attempts.push(newer);
  const oldCard = session.cards[index];
  d = answer(d, oldCard, oldCard.answer, true, now + 200, "week");
  const remaining = learningMistakes(
    d.exams.attempts,
    d.learning.mistakeHistory,
  );
  assert.equal(remaining.length, 2);
  assert.ok(remaining.every((r) => r.attempt.id === "newer-source"));
  assert.equal(d.learning.mistakeHistory.at(-1).card.sourceId, "a1");
});
test("normal and weekly successes on the same day count as one successful grammar day", () => {
  let d = fixture(),
    card = grammarCards(d)[0];
  d = answer(d, card, "", true, now);
  d = startWeekly(d, "week", now + 1);
  const session = d.learning.weekly[0],
    index = session.cards.findIndex((c) => cardKey(c) === cardKey(card));
  for (let i = 0; i <= index; i++) {
    const c = session.cards[i];
    d = answer(
      d,
      c,
      c.mode === "recall" ? "" : c.answer,
      true,
      now + 2 + i,
      "week",
    );
  }
  assert.equal(
    d.learning.grammarHistory.filter((e) => cardKey(e.card) === cardKey(card))
      .length,
    2,
  );
  assert.equal(grammarDue(card, d.learning.grammarHistory, "2026-10-20"), true);
});
test("backup relinking preserves separately identified questions and exercises even when their text is identical", () => {
  const d = fixture();
  d.grammar[0].exercises.push({
    ...d.grammar[0].exercises[0],
    id: "same-text-exercise",
  });
  d.exams.attempts[0].test.questions.push({
    ...d.exams.attempts[0].test.questions[0],
    id: "same-text-question",
  });
  const source = startWeekly(d, "week", now);
  const restored = planRestore(
    emptyNotebook(),
    makeBackup(source, { sections: BACKUP_SECTIONS, includeAudio: false }),
    { sections: BACKUP_SECTIONS, mode: "replace" },
    [],
  ).data;
  assert.deepEqual(restored.learning, source.learning);
});
test("disk restart and ZIP round trip preserve partial weekly work, source results and category histories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "learning-"));
  try {
    let d = startWeekly(fixture(), "week", now);
    const c = d.learning.weekly[0].cards[0];
    d = answer(d, c, c.answer, true, now, "week");
    const store = join(dir, "store");
    await createStore(store).save(d, null);
    assert.deepEqual(
      (await createStore(store).read()).data.learning,
      d.learning,
    );
    const file = join(dir, "backup.zip");
    await writeBackupArchive(
      file,
      makeBackup(d, { sections: BACKUP_SECTIONS, includeAudio: false }),
    );
    const loaded = await readBackupArchive(file, join(dir, "stage"));
    const restored = planRestore(
      emptyNotebook(),
      loaded.bundle,
      { sections: BACKUP_SECTIONS, mode: "replace" },
      [],
    ).data;
    assert.deepEqual(restored.learning, d.learning);
    assert.deepEqual(restored.exams, d.exams);
    assert.deepEqual(restored.grammar, d.grammar);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
