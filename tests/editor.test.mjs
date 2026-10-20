import test from "node:test";
import assert from "node:assert/strict";
import { applyEditor } from "../src/notebook/services/editor.ts";
import { validateNotebook } from "../src/model.ts";

const fixture = () => ({
  version: 1,
  stories: [
    {
      id: "story",
      title: "Original",
      text: "A quiet garden.",
      level: "A1",
      read: true,
      sourceName: "original.pdf",
      audioId: "story-audio",
    },
  ],
  words: [
    {
      id: "word",
      word: "quiet",
      meaning: "sessiz",
      type: "adjective",
      synonyms: "",
      antonyms: "",
      example: "A quiet garden.",
      translation: "Sessiz bir bahçe.",
      storyId: "story",
      storyIds: ["story"],
      level: "A1",
      sources: "Original source",
      examples: [
        { example: "Keep quiet.", translation: "Sessiz ol.", source: "PDF" },
      ],
      review: { due: 1800000000000, interval: 5, repetitions: 2 },
      memorization: { addedOn: "2026-10-01", learnedOn: "2026-10-02", reviews: ["2026-10-03"] },
    },
  ],
  grammar: [],
  storyNotes: [],
  audioTimings: { story: [0, 2] },
});

test("editing a word preserves review history, story links and imported examples", () => {
  const original = fixture();
  const before = structuredClone(original);
  const { data } = applyEditor(
    original,
    {
      kind: "words",
      id: "word",
      values: {
        ...Object.fromEntries(
          Object.entries(original.words[0]).filter(
            ([, value]) => typeof value === "string",
          ),
        ),
        meaning: "sakin",
        definition: "Making little noise.",
        levelSource: "",
      },
      importNotes: [],
    },
    [{ meaning: "huzurlu", definition: "", example: "", translation: "" }],
    () => "new",
  );
  assert.equal(data.words[0].meaning, "sakin");
  assert.deepEqual(data.words[0].review, original.words[0].review);
  assert.deepEqual(data.words[0].memorization, original.words[0].memorization);
  assert.deepEqual(data.words[0].storyIds, original.words[0].storyIds);
  assert.deepEqual(data.words[0].examples, original.words[0].examples);
  assert.equal(data.words[0].sources, "Original source");
  assert.equal(data.words[0].senses[0].meaning, "huzurlu");
  assert.deepEqual(original, before);
  validateNotebook(data);
});

test("editing a story preserves its read status, audio and sentence timings", () => {
  const original = fixture();
  const { data, recordId } = applyEditor(
    original,
    {
      kind: "stories",
      id: "story",
      values: {
        title: "Changed",
        text: "Another quiet garden.",
        level: "A2",
        sourceName: "original.pdf",
      },
      importNotes: [],
    },
    [],
    () => "new",
  );
  assert.equal(recordId, "story");
  assert.equal(data.stories[0].read, true);
  assert.equal(data.stories[0].audioId, "story-audio");
  assert.deepEqual(data.audioTimings, original.audioTimings);
  validateNotebook(data);
});

test("invalid and duplicate drafts fail before changing the notebook", () => {
  const original = fixture();
  const before = structuredClone(original);
  for (const values of [
    { word: "" },
    {
      ...Object.fromEntries(
        Object.entries(original.words[0]).filter(
          ([, value]) => typeof value === "string",
        ),
      ),
      word: " QUIET ",
    },
  ]) {
    assert.throws(() =>
      applyEditor(
        original,
        { kind: "words", values, importNotes: [] },
        [],
        () => "new",
      ),
    );
  }
  assert.throws(() =>
    applyEditor(
      original,
      {
        kind: "stories",
        values: { title: "Title", text: "Text", level: "" },
        importNotes: [],
      },
      [],
      () => "new",
    ),
  );
  assert.deepEqual(original, before);
});
