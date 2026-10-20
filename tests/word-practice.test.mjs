import test from "node:test";
import assert from "node:assert/strict";
import {
  clozeExample,
  evaluateAnswer,
  meanings,
  normalizeAnswer,
  practiceSnapshot,
  PRACTICE_MODES,
} from "../src/word-practice.ts";
import {
  recordPractice,
  practiceAvailability,
} from "../src/notebook/services/practice.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
} from "../src/backup-core.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const now = new Date("2026-10-19T12:00:00+03:00").getTime();
const card = () => ({
  id: "word",
  word: "give up",
  meaning: "vazgeçmek; bırakmak",
  type: "phrasal verb",
  synonyms: "quit; surrender",
  antonyms: "continue",
  example: "Do not give up. Never GIVE UP!",
  translation: "Vazgeçme.",
  storyId: "",
  definition: "To stop trying.",
  senses: [
    {
      meaning: "teslim olmak",
      definition: "To surrender.",
      example: "",
      translation: "",
    },
  ],
});
const notebook = (word) => ({ ...emptyNotebook(), words: [word] });
test("case, Unicode and repeated whitespace normalize without stripping negation, accents or words", () => {
  assert.equal(normalizeAnswer("  GIVE   UP  ", "en"), "give up");
  assert.equal(normalizeAnswer(" BIRAKMAK ", "tr"), "bırakmak");
  for (const answer of ["vazgeçmek", "  BIRAKMAK ", "teslim olmak"])
    assert.equal(evaluateAnswer(card(), answer, "en-tr"), "correct");
  for (const answer of ["", "give", "not give up", "give ups", "give up now"])
    assert.equal(evaluateAnswer(card(), answer, "tr-en"), "incorrect");
  for (const answer of ["vazgecmek", "vazgeçmemek", "vazgeç", "olmak"])
    assert.equal(evaluateAnswer(card(), answer, "en-tr"), "incorrect");
  assert.deepEqual(meanings(card()), ["vazgeçmek", "bırakmak", "teslim olmak"]);
});
test("saved English synonyms and composite meanings require self assessment; cloze requires the target itself", () => {
  assert.equal(evaluateAnswer(card(), "QUIT", "tr-en"), "uncertain");
  assert.equal(evaluateAnswer(card(), "quit", "tr-en", true), "incorrect");
  assert.equal(
    evaluateAnswer({ ...card(), meaning: "sessiz/sakin" }, "sakin", "en-tr"),
    "uncertain",
  );
  assert.equal(evaluateAnswer(card(), "quitting", "tr-en"), "incorrect");
  assert.equal(evaluateAnswer(card(), "GIVE UP", "tr-en"), "correct");
});
test("cloze replaces all whole targets, escapes regex, supports phrases and refuses substrings or guessed inflections", () => {
  assert.equal(clozeExample(card()).sentence, "Do not _____. Never _____!");
  assert.equal(
    clozeExample({
      ...card(),
      word: "art",
      example: "A cart starts.",
      senses: [],
    }),
    null,
  );
  assert.equal(
    clozeExample({
      ...card(),
      word: "go",
      example: "She goes home.",
      senses: [],
    }),
    null,
  );
  assert.equal(
    clozeExample({
      ...card(),
      word: "C++",
      example: "I use C++ daily.",
      senses: [],
    }).sentence,
    "I use _____ daily.",
  );
  assert.equal(
    clozeExample({
      ...card(),
      word: "give up",
      example: "We give   up.",
      senses: [],
    }).sentence,
    "We _____.",
  );
  assert.equal(
    clozeExample({
      ...card(),
      example: "",
      senses: [],
      examples: [
        {
          example: "They give up.",
          translation: "Vazgeçerler.",
          source: "mine",
        },
      ],
    }).translation,
    "Vazgeçerler.",
  );
  assert.equal(clozeExample({ ...card(), example: "", senses: [] }), null);
});
for (const [mode] of PRACTICE_MODES) {
  test(`${mode}: successful answers persist one step, duplicates and edited prompts are stale`, () => {
    const word = {
      ...card(),
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
      review: { due: now - 1, interval: 1, repetitions: 1 },
    };
    const data = notebook(word);
    const snapshot = practiceSnapshot(word);
    const result = recordPractice(data, word.id, snapshot, "good", now);
    assert.equal(result.status, "saved");
    assert.deepEqual(result.data.words[0].memorization.reviews, ["2026-10-19"]);
    assert.deepEqual(result.data.words[0].review, word.review);
    assert.equal(
      recordPractice(result.data, word.id, snapshot, "good", now).status,
      "stale",
    );
    const edited = notebook({ ...word, meaning: "edited" });
    assert.equal(
      recordPractice(edited, word.id, snapshot, "good", now).status,
      "stale",
    );
    assert.deepEqual(data.words[0], word);
  });
  test(`${mode}: wrong answers preserve the fixed step, legacy misses use the existing ten-minute interval`, () => {
    const word = {
      ...card(),
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
    };
    const data = notebook(word);
    const result = recordPractice(
      data,
      word.id,
      practiceSnapshot(word),
      "again",
      now,
    );
    assert.equal(result.status, "retry");
    assert.notEqual(result.data, data);
    assert.deepEqual(result.data.words[0].memorization, word.memorization);
    assert.equal(result.data.words[0].answerHistory.at(-1).outcome, "again");
    assert.equal(
      recordPractice(result.data, word.id, practiceSnapshot(word), "again", now)
        .status,
      "stale",
    );
    assert.equal(practiceAvailability(word, now), true);
    const old = card();
    const missed = recordPractice(
      notebook(old),
      old.id,
      practiceSnapshot(old),
      "again",
      now,
    );
    assert.equal(missed.status, "saved");
    assert.equal(missed.data.words[0].review.due, now + 600000);
    assert.equal(
      recordPractice(missed.data, old.id, practiceSnapshot(old), "again", now)
        .status,
      "stale",
    );
  });
}
test("unlearned, future and finished memory cards cannot silently switch to another scheduler", () => {
  const fresh = {
    ...card(),
    memorization: { addedOn: "2026-10-19", reviews: [] },
  };
  const learned = recordPractice(
    notebook(fresh),
    fresh.id,
    practiceSnapshot(fresh),
    "hard",
    now,
  );
  assert.equal(learned.data.words[0].memorization.learnedOn, "2026-10-19");
  assert.equal(learned.data.words[0].review, undefined);
  assert.equal(practiceAvailability(learned.data.words[0], now), false);
  const blank = { ...card(), meaning: "" };
  assert.equal(practiceAvailability(blank, now), false);
  assert.equal(
    recordPractice(notebook(card()), "deleted", "", "good", now).status,
    "stale",
  );
});
test("both schedules from practice survive disk restart and selected JSON backup/merge", async (t) => {
  const path = await mkdtemp(join(tmpdir(), "english-desk-practice-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  let data = notebook(card());
  data = recordPractice(
    data,
    "word",
    practiceSnapshot(data.words[0]),
    "good",
    now,
  ).data;
  await createStore(path).save(data, null);
  assert.deepEqual((await createStore(path).read()).data.words, data.words);
  const bundle = parseBackup(
    JSON.parse(
      JSON.stringify(
        makeBackup(data, { sections: ["words"], includeAudio: false }),
      ),
    ),
  );
  assert.deepEqual(
    planRestore(
      emptyNotebook(),
      bundle,
      { sections: ["words"], mode: "replace" },
      [],
    ).data.words,
    data.words,
  );
  assert.deepEqual(
    planRestore(data, bundle, { sections: ["words"], mode: "merge" }, []).data
      .words,
    data.words,
  );
});
