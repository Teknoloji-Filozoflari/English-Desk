import test from "node:test";
import assert from "node:assert/strict";
import {
  enrollMemorization,
  recordMemorization,
  recordWordReview,
} from "../src/notebook/services/repetition.ts";
import { addDays, MEMORIZATION_DAYS } from "../src/memorization.ts";
import { validateNotebook } from "../src/model.ts";

export const word = {
  id: "w1",
  word: "remember",
  meaning: "hatırlamak",
  type: "verb",
  synonyms: "",
  antonyms: "",
  example: "I remember.",
  translation: "Hatırlıyorum.",
  storyId: "",
};
const notebook = () => ({
  version: 1,
  stories: [],
  words: [{ ...word }],
  grammar: [],
});

test("enrollment and learning are explicit, immutable and idempotent", () => {
  const original = notebook();
  const before = structuredClone(original);
  const enrolled = enrollMemorization(original, "w1", "2026-10-19");
  assert.deepEqual(original, before);
  assert.deepEqual(enrolled.words[0].memorization, {
    addedOn: "2026-10-19",
    reviews: [],
  });
  assert.equal(enrollMemorization(enrolled, "w1", "2026-10-20"), enrolled);
  const expected = enrolled.words[0].memorization;
  const learned = recordMemorization(
    enrolled,
    "w1",
    expected,
    "learn",
    "2026-10-21",
  );
  assert.equal(learned.words[0].memorization.learnedOn, "2026-10-21");
  assert.equal(
    recordMemorization(learned, "w1", expected, "learn", "2026-10-22"),
    learned,
  );
  assert.equal(
    recordMemorization(enrolled, "w1", expected, "learn", "2026-10-18"),
    enrolled,
  );
  assert.equal(
    recordMemorization(enrolled, "w1", expected, "learn", "invalid"),
    enrolled,
  );
  assert.equal(enrollMemorization(original, "missing", "2026-10-19"), original);
  assert.equal(enrollMemorization(original, "w1", "2026-02-30"), original);
});

test("all six answers advance once, preserve the anchor and keep legacy review data", () => {
  let data = notebook();
  data.words[0].review = { due: 1800000000000, interval: 7, repetitions: 3 };
  data = enrollMemorization(data, "w1", "2026-10-19");
  data = recordMemorization(
    data,
    "w1",
    data.words[0].memorization,
    "learn",
    "2026-10-19",
  );
  const history = [];
  for (const day of MEMORIZATION_DAYS) {
    const expected = structuredClone(data.words[0].memorization);
    const today = addDays("2026-10-19", day);
    assert.equal(
      recordMemorization(data, "w1", expected, "review", addDays(today, -1)),
      data,
    );
    data = recordMemorization(data, "w1", expected, "review", today);
    history.push(today);
    assert.deepEqual(data.words[0].memorization.reviews, history);
    assert.equal(
      recordMemorization(data, "w1", expected, "review", today),
      data,
    );
    assert.equal(
      recordMemorization(data, "w1", expected, "review", addDays(today, 90)),
      data,
    );
    assert.equal(data.words[0].memorization.learnedOn, "2026-10-19");
    assert.deepEqual(data.words[0].review, {
      due: 1800000000000,
      interval: 7,
      repetitions: 3,
    });
    validateNotebook(data);
  }
  assert.equal(
    recordMemorization(
      data,
      "w1",
      data.words[0].memorization,
      "review",
      "2027-01-01",
    ),
    data,
  );
});

test("overdue answers cannot be replayed after midnight; fresh next-day answers remain valid", () => {
  let data = enrollMemorization(notebook(), "w1", "2026-01-01");
  data = recordMemorization(
    data,
    "w1",
    data.words[0].memorization,
    "learn",
    "2026-01-01",
  );
  const oldCard = structuredClone(data.words[0].memorization);
  data = recordMemorization(data, "w1", oldCard, "review", "2026-03-01");
  assert.equal(
    recordMemorization(data, "w1", oldCard, "review", "2026-03-02"),
    data,
  );
  assert.equal(
    recordMemorization(
      data,
      "w1",
      data.words[0].memorization,
      "review",
      "2026-02-28",
    ),
    data,
  );
  const next = recordMemorization(
    data,
    "w1",
    data.words[0].memorization,
    "review",
    "2026-03-02",
  );
  assert.deepEqual(next.words[0].memorization.reviews, [
    "2026-03-01",
    "2026-03-02",
  ]);
});

test("blank meanings, deleted words and unenrolled legacy cards cannot create phantom history", () => {
  const data = notebook();
  const expected = { addedOn: "2026-10-19", reviews: [] };
  assert.equal(
    recordMemorization(data, "w1", expected, "learn", "2026-10-19"),
    data,
  );
  let enrolled = enrollMemorization(data, "w1", "2026-10-19");
  enrolled.words[0].meaning = "";
  assert.equal(
    recordMemorization(enrolled, "w1", expected, "learn", "2026-10-19"),
    enrolled,
  );
  assert.equal(
    recordMemorization(enrolled, "deleted", expected, "review", "2026-11-01"),
    enrolled,
  );
  assert.equal(
    recordWordReview(enrolled, "w1", undefined, "good", 1800000000000),
    enrolled,
  );
});

test("the existing review algorithm is unchanged while stale answers are rejected", () => {
  const now = 1800000000000;
  const day = 86400000;
  for (const result of ["again", "hard", "good"]) {
    const original = notebook();
    original.words[0].memorization = { addedOn: "2026-10-19", reviews: [] };
    const first = recordWordReview(original, "w1", undefined, result, now);
    assert.equal(
      first.words[0].review.due,
      now + (result === "again" ? 600000 : day),
    );
    assert.equal(recordWordReview(first, "w1", undefined, result, now), first);
    assert.equal(
      recordWordReview(first, "w1", undefined, "good", now + 100 * day),
      first,
    );
    assert.deepEqual(
      first.words[0].memorization,
      original.words[0].memorization,
    );
    const due = first.words[0].review.due;
    assert.equal(
      recordWordReview(first, "w1", first.words[0].review, "good", due - 1),
      first,
    );
    const next = recordWordReview(
      first,
      "w1",
      first.words[0].review,
      "good",
      due,
    );
    assert.equal(next.words[0].review.interval, result === "again" ? 1 : 2);
  }
});
