import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBackup,
  parseBackup,
  planRestore,
  emptyNotebook,
} from "../src/backup-core.ts";
import { validateNotebook } from "../src/model.ts";
const story = (id = "s") => ({
  id,
  title: "Story",
  text: "This is a quiet garden.",
  level: "B1",
  read: true,
  audioId: "audio-test",
});
const word = (id = "w") => ({
  id,
  word: "quiet",
  meaning: "sessiz",
  definition: "Not noisy.",
  type: "adjective",
  synonyms: "",
  antonyms: "",
  example: "This is a quiet garden.",
  translation: "Bu sessiz bir bahçe.",
  storyId: "s",
  storyIds: ["s"],
  sources: "Source",
  senses: [{ meaning: "sakin", definition: "", example: "", translation: "" }],
  review: { due: 1000000000, interval: 2, repetitions: 3 },
});
const fixture = () => ({
  ...emptyNotebook(),
  stories: [story()],
  words: [word()],
  grammar: [{ id: "g", title: "Grammar", body: "Notes" }],
  storyNotes: [
    {
      id: "n",
      storyId: "s",
      selection: "quiet",
      category: "grammar",
      title: "Adjective",
      body: "Describes a noun.",
    },
  ],
  audioTimings: { s: [0, 2] },
  exams: {
    tests: [
      {
        id: "t",
        exam: "YDS",
        title: "Exam",
        section: "Reading",
        source: "Test",
        minutes: 5,
        questions: [
          {
            id: "q",
            prompt: "A?",
            passage: "",
            kind: "choice",
            options: ["A", "B"],
            answer: "A",
            explanation: "",
          },
        ],
      },
    ],
    attempts: [],
  },
});

test("full and selected backups round-trip all card fields and only selected sections", () => {
  const data = fixture();
  const all = parseBackup(
    makeBackup(data, {
      sections: ["stories", "words", "grammar", "exams"],
      includeAudio: true,
    }),
  );
  assert.deepEqual(all.data, validateNotebook(data));
  const selected = parseBackup(
    makeBackup(data, { sections: ["words"], includeAudio: true }),
  );
  assert.deepEqual(selected.sections, ["words"]);
  assert.equal(selected.includeAudio, false);
  assert.equal(selected.data.stories.length, 0);
  assert.deepEqual(selected.data.words, validateNotebook(data).words);
  assert.deepEqual(selected.storyReferences, [
    { id: "s", title: "Story", level: "B1" },
  ]);
});
test("merge preserves existing content and is idempotent for stories, cards, notes and exams", () => {
  const incoming = fixture();
  const current = fixture();
  current.words[0].meaning = "Kendi anlamım";
  current.grammar[0].body = "Kendi notum";
  const bundle = parseBackup(
    makeBackup(incoming, {
      sections: ["stories", "words", "grammar", "exams"],
      includeAudio: true,
    }),
  );
  const result = planRestore(
    current,
    bundle,
    { sections: bundle.sections, mode: "merge" },
    ["audio-test"],
  );
  assert.equal(result.data.words[0].meaning, "Kendi anlamım");
  assert.equal(result.data.grammar[0].body, "Kendi notum");
  assert.deepEqual(result.data, validateNotebook(current));
  assert.equal(result.summary.skipped.words, 1);
  assert.deepEqual(
    planRestore(
      result.data,
      bundle,
      { sections: bundle.sections, mode: "merge" },
      ["audio-test"],
    ).data,
    result.data,
  );
});
test("same story with a different ID maps words, notes and sentence times to the existing story", () => {
  const source = fixture(),
    current = emptyNotebook();
  current.stories = [story("existing")];
  const bundle = parseBackup(
    makeBackup(source, { sections: ["stories", "words"], includeAudio: true }),
  );
  const result = planRestore(
    current,
    bundle,
    { sections: bundle.sections, mode: "merge" },
    ["audio-test"],
  );
  assert.equal(result.data.stories.length, 1);
  assert.equal(result.data.words[0].storyId, "existing");
  assert.deepEqual(result.data.words[0].storyIds, ["existing"]);
  assert.equal(result.data.storyNotes[0].storyId, "existing");
  assert.deepEqual(result.data.audioTimings.existing, [0, 2]);
});
test("word-only import detaches missing links, preserves inherited level and all card contents", () => {
  const source = fixture();
  delete source.words[0].level;
  const bundle = parseBackup(
    makeBackup(source, { sections: ["words"], includeAudio: false }),
  );
  const result = planRestore(
    emptyNotebook(),
    bundle,
    { sections: ["words"], mode: "merge" },
    [],
  );
  assert.equal(result.data.stories.length, 0);
  assert.equal(result.data.words[0].storyId, "");
  assert.deepEqual(result.data.words[0].storyIds, []);
  assert.equal(result.data.words[0].level, "B1");
  assert.deepEqual(result.data.words[0].senses, source.words[0].senses);
  assert.deepEqual(result.data.words[0].review, source.words[0].review);
  assert.equal(result.summary.detachedLinks, 1);
});
test("story replacement preserves other sections and repairs links to removed stories", () => {
  const current = fixture(),
    incoming = emptyNotebook();
  incoming.stories = [{ ...story("other"), audioId: undefined }];
  const bundle = parseBackup(
    makeBackup(incoming, { sections: ["stories"], includeAudio: false }),
  );
  const result = planRestore(
    current,
    bundle,
    { sections: ["stories"], mode: "replace" },
    [],
  );
  assert.equal(result.data.stories[0].id, "other");
  assert.equal(result.data.words[0].meaning, "sessiz");
  assert.equal(result.data.words[0].storyId, "");
  assert.equal(result.data.words[0].level, "B1");
  assert.deepEqual(result.data.grammar, current.grammar);
  assert.deepEqual(result.data.exams, current.exams);
  assert.deepEqual(result.data.storyNotes, []);
  assert.deepEqual(result.data.audioTimings, {});
});
test("missing audio is reported and removed without leaving invalid sentence times", () => {
  const source = fixture(),
    bundle = parseBackup(
      makeBackup(source, { sections: ["stories"], includeAudio: true }),
    );
  const result = planRestore(
    emptyNotebook(),
    bundle,
    { sections: ["stories"], mode: "merge" },
    [],
  );
  assert.equal(result.summary.missingAudio, 1);
  assert.equal(result.data.stories[0].audioId, undefined);
  assert.deepEqual(result.data.audioTimings, {});
  assert.equal(result.data.stories[0].text, source.stories[0].text);
});
test("old full, story, word and exam payloads are recognized and malformed backups rejected", () => {
  const data = fixture();
  assert.deepEqual(parseBackup(data).sections, [
    "stories",
    "words",
    "grammar",
    "exams",
  ]);
  assert.deepEqual(
    parseBackup({
      version: 1,
      stories: data.stories,
      storyNotes: data.storyNotes,
      audioTimings: data.audioTimings,
    }).sections,
    ["stories"],
  );
  assert.deepEqual(
    parseBackup({ version: 1, words: data.words }, [
      { id: "s", title: "Story", level: "B1" },
    ]).sections,
    ["words"],
  );
  assert.deepEqual(parseBackup(data.exams).sections, ["exams"]);
  for (const invalid of [
    { version: 2, stories: [] },
    { format: "unknown", version: 1, stories: [] },
    { version: 1, words: [{ ...word(), storyIds: [123] }] },
    { format: "english-desk-backup", version: 1, sections: ["unknown"], data },
  ])
    assert.throws(() => parseBackup(invalid));
  assert.throws(() =>
    planRestore(emptyNotebook(), parseBackup({ version: 1, words: [] }), {
      sections: ["stories"],
      mode: "replace",
    }),
  );
});
test("same-ID conflicting story does not attach notes or times from a different text", () => {
  const current = fixture(),
    source = fixture();
  source.stories[0].text = "Different text.";
  const bundle = parseBackup(
    makeBackup(source, { sections: ["stories"], includeAudio: true }),
  );
  const result = planRestore(
    current,
    bundle,
    { sections: ["stories"], mode: "merge" },
    ["audio-test"],
  );
  assert.equal(result.data.stories[0].text, current.stories[0].text);
  assert.equal(result.summary.notes, 0);
  assert.match(result.warnings.join(" "), /farklı içerik/);
});
