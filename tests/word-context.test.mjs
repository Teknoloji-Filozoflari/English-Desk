import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  attachStoryContext,
  wordContexts,
  savePersonalContext,
} from "../src/word-context.ts";
import { removeStory, validateNotebook } from "../src/model.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
} from "../src/backup-core.ts";
import { applyEditor } from "../src/notebook/services/editor.ts";
import {
  clozeExamples,
  evaluateAnswer,
  practiceSnapshot,
} from "../src/word-practice.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../scripts/backup-archive.mjs";
const stories = [
  {
    id: "s1",
    title: "First source",
    text: "Never give up.",
    level: "A1",
    read: false,
  },
  {
    id: "s2",
    title: "Second source",
    text: "They give up their seats.",
    level: "B1",
    read: false,
  },
];
let sequence = 0;
const id = () => `context-${++sequence}`;
const card = () => ({
  id: "w",
  word: "give up",
  meaning: "vazgeçmek",
  type: "phrasal verb",
  synonyms: "",
  antonyms: "",
  example: "Never give up.",
  translation: "Asla vazgeçme.",
  storyId: "s1",
  storyIds: ["s1"],
  senses: [
    {
      meaning: "bırakmak",
      definition: "",
      example: "I give up my seat.",
      translation: "Yerimi bırakırım.",
    },
  ],
  review: { due: 1800000000000, interval: 7, repetitions: 3 },
  memorization: {
    addedOn: "2026-10-01",
    learnedOn: "2026-10-01",
    reviews: ["2026-10-02"],
  },
});
const data = () => ({
  ...emptyNotebook(),
  stories: structuredClone(stories),
  words: [card()],
});
function linked() {
  const d = data();
  d.words[0] = attachStoryContext(
    d.words[0],
    stories[1],
    stories[1].text,
    "give up",
    "yerini bırakmak",
    id,
    stories,
  );
  d.words[0].tags = ["seyahat"];
  return d;
}
test("a newly selected phrase has exactly one source snapshot with collocation metadata", () => {
  const d = data();
  d.words = [];
  const values = {
    word: "give up",
    meaning: "vazgeçmek",
    type: "collocation",
    synonyms: "",
    antonyms: "",
    example: "Never give up.",
    translation: "Asla vazgeçme.",
    storyId: "s1",
    level: "B1",
    tags: "günlük",
    sourceStoryId: "s1",
    sourceSelection: "give up",
    sourceSentence: "Never give up.",
  };
  const created = applyEditor(
    d,
    { kind: "words", values, importNotes: [] },
    [],
    id,
  ).data;
  assert.equal(created.words.length, 1);
  assert.equal(created.words[0].contexts.length, 1);
  assert.equal(created.words[0].contexts[0].storyTitle, "First source");
  assert.deepEqual(created.words[0].tags, ["günlük"]);
  assert.equal(created.words[0].type, "collocation");
  assert.equal(created.words[0].level, "B1");
  validateNotebook(created);
});
test("migration preserves long string fields accepted by the legacy notebook validator", () => {
  const d = data();
  d.words[0].example = "x".repeat(10001);
  d.stories[0].title = "t".repeat(501);
  validateNotebook(d);
  const migrated = savePersonalContext(
    d,
    "w",
    { sentence: "Never give up.", translation: "", meaning: "vazgeçmek" },
    id,
  );
  assert.equal(migrated.words[0].contexts[0].sentence, d.words[0].example);
  assert.equal(migrated.words[0].contexts[0].storyTitle, d.stories[0].title);
  validateNotebook(migrated);
});
test("legacy contexts are optional, displayed on demand and original sentences survive later editor changes", () => {
  const d = data();
  const parsed = validateNotebook(d);
  assert.equal(parsed.words[0].contexts, undefined);
  assert.equal(
    wordContexts(parsed.words[0], stories)[0].storyTitle,
    stories[0].title,
  );
  const w = d.words[0];
  const values = Object.fromEntries(
    Object.entries(w).filter(([, v]) => typeof v === "string"),
  );
  const result = applyEditor(
    d,
    {
      kind: "words",
      id: w.id,
      values: {
        ...values,
        example: "Please give up.",
        meaning: "değişen anlam",
        tags: " Seyahat, SEYAHAT ",
        level: "B1",
      },
      importNotes: [],
    },
    w.senses,
    id,
  ).data;
  assert.equal(result.words[0].contexts[0].sentence, "Never give up.");
  assert.equal(result.words[0].contexts[0].meaning, "vazgeçmek");
  assert.deepEqual(result.words[0].tags, ["seyahat"]);
  assert.deepEqual(result.words[0].memorization, w.memorization);
  validateNotebook(result);
});
test("same expression in multiple stories retains distinct meanings and duplicate selections are idempotent", () => {
  const d = linked(),
    w = d.words[0];
  assert.equal(w.contexts.length, 2);
  assert.deepEqual(w.storyIds, ["s1", "s2"]);
  assert.equal(w.contexts[1].meaning, "yerini bırakmak");
  assert.equal(w.contexts[0].sentence, "Never give up.");
  const duplicate = attachStoryContext(
    w,
    stories[1],
    stories[1].text,
    "GIVE UP",
    "yerini bırakmak",
    id,
    stories,
  );
  assert.deepEqual(duplicate, w);
  assert.equal(evaluateAnswer(w, "yerini bırakmak", "en-tr"), "correct");
  assert.equal(evaluateAnswer(w, "yerini", "en-tr"), "incorrect");
});
test("source editor attaches context without replacing the existing example, senses or schedule", () => {
  const d = data(),
    w = d.words[0];
  const values = Object.fromEntries(
    Object.entries(w).filter(([, v]) => typeof v === "string"),
  );
  const result = applyEditor(
    d,
    {
      kind: "words",
      id: w.id,
      values: {
        ...values,
        sourceStoryId: "s2",
        sourceSentence: stories[1].text,
        sourceSelection: "give up",
        sourceMeaning: "yerini bırakmak",
      },
      importNotes: [],
    },
    w.senses,
    id,
  ).data;
  assert.equal(result.words.length, 1);
  assert.equal(result.words[0].contexts.length, 2);
  for (const key of ["example", "senses", "review", "memorization"])
    assert.deepEqual(result.words[0][key], w[key]);
  validateNotebook(result);
});
test("personal examples can be added and edited per meaning without mutating original sources", () => {
  const d = linked(),
    before = structuredClone(d);
  const added = savePersonalContext(
    d,
    "w",
    {
      sentence: " I give up my ticket. ",
      translation: "Biletimi bırakırım.",
      meaning: "bırakmak",
    },
    id,
  );
  const personal = added.words[0].contexts.at(-1);
  assert.equal(personal.sentence, "I give up my ticket.");
  const changed = savePersonalContext(
    added,
    "w",
    { ...personal, sentence: "We give up our tickets." },
    id,
    personal.id,
  );
  assert.equal(changed.words[0].contexts.length, 3);
  assert.equal(changed.words[0].contexts.at(-1).id, personal.id);
  assert.deepEqual(
    changed.words[0].contexts.slice(0, 2),
    before.words[0].contexts,
  );
  assert.deepEqual(d, before);
  assert.notEqual(
    practiceSnapshot(d.words[0]),
    practiceSnapshot(changed.words[0]),
  );
  assert.throws(() =>
    savePersonalContext(
      d,
      "w",
      { sentence: "", translation: "", meaning: "" },
      id,
    ),
  );
  assert.throws(() =>
    savePersonalContext(
      d,
      "w",
      { sentence: "X", translation: "", meaning: "" },
      id,
      d.words[0].contexts[0].id,
    ),
  );
  validateNotebook(changed);
});
test("cloze exercises use every saved source, personal and sense example and hide the complete expression", () => {
  const d = savePersonalContext(
    linked(),
    "w",
    {
      sentence: "Do not GIVE UP!",
      translation: "Vazgeçme!",
      meaning: "vazgeçmek",
    },
    id,
  );
  const examples = clozeExamples(d.words[0]);
  for (const sentence of [
    "Never _____.",
    "They _____ their seats.",
    "Do not _____!",
    "I _____ my seat.",
  ])
    assert.ok(examples.some((e) => e.sentence === sentence));
  assert.equal(
    examples.find((e) => e.source === "Second source").meaning,
    "yerini bırakmak",
  );
  assert.equal(
    examples.find((e) => e.source === "Kendi örneğim").translation,
    "Vazgeçme!",
  );
  assert.deepEqual(
    clozeExamples({
      ...card(),
      word: "art",
      example: "A cart.",
      storyId: "",
      senses: [],
    }),
    [],
  );
});
test("deleting a source detaches its link while preserving title, original sentence, meaning and other sources", () => {
  const d = removeStory(linked(), "s1");
  const w = d.words[0];
  assert.equal(w.contexts[0].storyId, "");
  assert.equal(w.contexts[0].storyTitle, "First source");
  assert.equal(w.contexts[0].sentence, "Never give up.");
  assert.equal(w.contexts[1].storyId, "s2");
  validateNotebook(d);
});
test("invalid context records and tags are rejected before changing the notebook", () => {
  for (const update of [
    { tags: [8] },
    { tags: ["x".repeat(41)] },
    { contexts: [{}] },
    { contexts: [{ ...wordContexts(card(), stories)[0], storyId: "missing" }] },
    {
      contexts: [
        wordContexts(card(), stories)[0],
        wordContexts(card(), stories)[0],
      ],
    },
  ]) {
    const d = data();
    Object.assign(d.words[0], update);
    assert.throws(() => validateNotebook(d));
  }
});
test("full and word-only JSON backups preserve contexts, repair references and keep current cards on merge", () => {
  const d = linked();
  for (const sections of [["stories", "words"], ["words"]]) {
    const bundle = parseBackup(
      JSON.parse(
        JSON.stringify(makeBackup(d, { sections, includeAudio: false })),
      ),
    );
    const restored = planRestore(
      emptyNotebook(),
      bundle,
      { sections, mode: "replace" },
      [],
    ).data;
    assert.deepEqual(
      restored.words[0].contexts.map((c) => ({ ...c, storyId: "" })),
      d.words[0].contexts.map((c) => ({ ...c, storyId: "" })),
    );
    assert.deepEqual(restored.words[0].memorization, d.words[0].memorization);
    assert.deepEqual(restored.words[0].tags, ["seyahat"]);
    assert.deepEqual(
      planRestore(d, bundle, { sections, mode: "merge" }, []).data.words,
      d.words,
    );
    validateNotebook(restored);
  }
  const renamed = {
    ...emptyNotebook(),
    stories: stories.map((s) => ({ ...s, id: `new-${s.id}` })),
  };
  const restored = planRestore(
    renamed,
    makeBackup(d, { sections: ["stories", "words"], includeAudio: false }),
    { sections: ["stories", "words"], mode: "merge" },
    [],
  ).data;
  assert.deepEqual(
    restored.words[0].contexts.map((c) => c.storyId),
    ["new-s1", "new-s2"],
  );
});
test("new context fields survive file-store restart and ZIP export/import", async () => {
  const dir = await mkdtemp(join(tmpdir(), "word-context-"));
  try {
    const d = savePersonalContext(
      linked(),
      "w",
      {
        sentence: "We give up.",
        translation: "Vazgeçeriz.",
        meaning: "vazgeçmek",
      },
      id,
    );
    const path = join(dir, "notebook.json");
    await createStore(path).save(d, null);
    assert.deepEqual((await createStore(path).read()).data.words, d.words);
    const bundle = makeBackup(d, {
      sections: ["stories", "words"],
      includeAudio: false,
    });
    const file = join(dir, "backup.zip");
    await writeBackupArchive(file, bundle);
    const loaded = await readBackupArchive(file, join(dir, "stage"));
    assert.deepEqual(
      planRestore(
        emptyNotebook(),
        loaded.bundle,
        { sections: ["stories", "words"], mode: "replace" },
        [],
      ).data.words,
      d.words,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
