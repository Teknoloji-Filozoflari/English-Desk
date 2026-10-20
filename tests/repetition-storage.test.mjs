import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createStore } from "../scripts/notebook-store.mjs";
import { validateNotebook } from "../src/model.ts";
import {
  enrollMemorization,
  recordMemorization,
  recordWordReview,
} from "../src/notebook/services/repetition.ts";
import { addDays, MEMORIZATION_DAYS } from "../src/memorization.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
} from "../src/backup-core.ts";
import { applyEditor } from "../src/notebook/services/editor.ts";

const word = {
  id: "word",
  word: "remember",
  meaning: "hatırlamak",
  type: "verb",
  synonyms: "",
  antonyms: "",
  example: "",
  translation: "",
  storyId: "",
};
const fixture = () => ({
  version: 1,
  stories: [],
  words: [{ ...word }],
  grammar: [],
});
const clone = (data) => JSON.parse(JSON.stringify(data));

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), "english-desk-repetition-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test("new word, enrollment, learning and six answers survive independent store instances and a process restart", async (t) => {
  const path = await directory(t);
  let store = createStore(path);
  const { data: created } = applyEditor(
    emptyNotebook(),
    {
      kind: "words",
      values: { ...word, level: "", definition: "", levelSource: "" },
      importNotes: [],
    },
    [],
    () => word.id,
  );
  let saved = await store.save(created, null);
  assert.equal(saved.data.words[0].word, "remember");
  const save = async (update) => {
    store = createStore(path);
    const before = await store.read();
    saved = await store.save(update(before.data), before.revision);
    assert.deepEqual((await createStore(path).read()).data, saved.data);
  };
  await save((data) => enrollMemorization(data, "word", "2026-10-19"));
  await save((data) =>
    recordMemorization(
      data,
      "word",
      data.words[0].memorization,
      "learn",
      "2026-10-20",
    ),
  );
  await save((data) =>
    recordWordReview(data, "word", undefined, "good", 1800000000000),
  );
  for (const day of MEMORIZATION_DAYS) {
    await save((data) =>
      recordMemorization(
        data,
        "word",
        data.words[0].memorization,
        "review",
        addDays("2026-10-20", day),
      ),
    );
  }
  const url = new URL("../scripts/notebook-store.mjs", import.meta.url).href;
  const restored = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { createStore } from ${JSON.stringify(url)}; console.log(JSON.stringify((await createStore(${JSON.stringify(path)}).read()).data));`,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(restored, saved.data);
  assert.deepEqual(
    restored.words[0].memorization.reviews,
    MEMORIZATION_DAYS.map((day) => addDays("2026-10-20", day)),
  );
  assert.equal(restored.words[0].review.repetitions, 1);
});

test("legacy notebook missing optional fields loads without modifying the original file", async (t) => {
  const path = await directory(t);
  const raw = JSON.stringify(fixture());
  await writeFile(join(path, "notebook.json"), raw);
  const loaded = await createStore(path).read();
  assert.equal(loaded.data.words[0].memorization, undefined);
  assert.equal(loaded.data.words[0].review, undefined);
  assert.deepEqual(loaded.data.words[0], word);
  assert.equal(await readFile(join(path, "notebook.json"), "utf8"), raw);
});

test("invalid dates and a stale concurrent answer leave the saved history intact", async (t) => {
  const path = await directory(t);
  const store = createStore(path);
  let data = enrollMemorization(fixture(), "word", "2026-01-01");
  data = recordMemorization(
    data,
    "word",
    data.words[0].memorization,
    "learn",
    "2026-01-01",
  );
  const initial = await store.save(data, null);
  const expected = clone(data.words[0].memorization);
  const first = store.update(initial.revision, (current) =>
    recordMemorization(current, "word", expected, "review", "2026-03-01"),
  );
  const duplicate = store.update(initial.revision, (current) =>
    recordMemorization(current, "word", expected, "review", "2026-03-01"),
  );
  await first;
  await assert.rejects(duplicate, /başka bir pencerede/);
  const saved = await store.read();
  const bad = clone(saved.data);
  bad.words[0].memorization.reviews.push("2026-02-30");
  await assert.rejects(store.save(bad, saved.revision), /ezber/);
  assert.deepEqual(await store.read(), saved);
  assert.deepEqual(saved.data.words[0].memorization.reviews, ["2026-03-01"]);
});

test("full and word-only JSON backups restore both schedules and merge without losing existing progress", () => {
  let data = enrollMemorization(fixture(), "word", "2026-10-01");
  data = recordMemorization(
    data,
    "word",
    data.words[0].memorization,
    "learn",
    "2026-10-01",
  );
  data = recordMemorization(
    data,
    "word",
    data.words[0].memorization,
    "review",
    "2026-10-02",
  );
  data = recordWordReview(data, "word", undefined, "hard", 1800000000000);
  for (const sections of [
    ["words"],
    ["stories", "words", "grammar", "exams"],
  ]) {
    const bundle = parseBackup(
      clone(makeBackup(data, { sections, includeAudio: false })),
    );
    const restored = planRestore(
      emptyNotebook(),
      bundle,
      { sections, mode: "replace" },
      [],
    ).data;
    assert.deepEqual(restored.words[0], data.words[0]);
    const newer = recordMemorization(
      data,
      "word",
      data.words[0].memorization,
      "review",
      "2026-10-04",
    );
    const merge = planRestore(newer, bundle, { sections, mode: "merge" }, []);
    assert.deepEqual(merge.data.words[0], newer.words[0]);
    assert.equal(merge.summary.skipped.words, 1);
    const repeated = planRestore(
      merge.data,
      bundle,
      { sections, mode: "merge" },
      [],
    );
    assert.deepEqual(repeated.data, merge.data);
    const legacy = parseBackup({
      version: 1,
      words: [{ ...word, id: "old-word", word: "legacy" }],
    });
    const combined = planRestore(
      merge.data,
      legacy,
      { sections: ["words"], mode: "merge" },
      [],
    ).data;
    assert.equal(combined.words.length, 2);
    assert.deepEqual(combined.words[0], newer.words[0]);
    assert.equal(combined.words[1].memorization, undefined);
    validateNotebook(combined);
  }
});

// Exercise the production web storage adapter against the real file store.
// Only the fetch transport is substituted; revisions, validation and disk I/O are real.
async function webStorage(t, path, local = null) {
  const oldFetch = globalThis.fetch;
  const oldLocalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const store = createStore(path);
  let fail = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => local },
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/notebook");
    if (fail) throw new Error("offline");
    try {
      const body =
        options.method === "GET"
          ? await store.read()
          : await store.save(
              JSON.parse(options.body).data,
              JSON.parse(options.body).revision,
            );
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status ?? 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldLocalStorage)
      Object.defineProperty(globalThis, "localStorage", oldLocalStorage);
    else delete globalThis.localStorage;
  });
  let instance = 0;
  return {
    store,
    fail: (value) => {
      fail = value;
    },
    loadModule: () =>
      import(
        new URL(
          `../src/storage.web.ts?test=${encodeURIComponent(path)}&instance=${instance++}`,
          import.meta.url,
        ).href
      ),
  };
}

test("web adapter loads old local data, saves history and reloads with a fresh session revision", async (t) => {
  const path = await directory(t);
  const api = await webStorage(t, path, JSON.stringify(fixture()));
  const firstSession = await api.loadModule();
  const legacy = await firstSession.loadNotebook();
  assert.equal(legacy.words[0].memorization, undefined);
  let data = enrollMemorization(legacy, "word", "2026-10-19");
  data = recordMemorization(
    data,
    "word",
    data.words[0].memorization,
    "learn",
    "2026-10-19",
  );
  data = recordMemorization(
    data,
    "word",
    data.words[0].memorization,
    "review",
    "2026-10-20",
  );
  await firstSession.saveNotebook(data);
  const fresh = await api.loadModule();
  assert.deepEqual(await fresh.loadNotebook(), validateNotebook(data));
  assert.equal(fresh.notebookRevision(), firstSession.notebookRevision());
});

test("web save failures preserve the file and revision; retry saves exactly one answer", async (t) => {
  const path = await directory(t);
  const api = await webStorage(t, path, JSON.stringify(fixture()));
  const session = await api.loadModule();
  const data = await session.loadNotebook();
  const initial = await api.store.read();
  const answer = recordWordReview(
    data,
    "word",
    undefined,
    "good",
    1800000000000,
  );
  api.fail(true);
  await assert.rejects(session.saveNotebook(answer), /ulaşılamadı/);
  assert.deepEqual(await api.store.read(), initial);
  assert.equal(session.notebookRevision(), initial.revision);
  api.fail(false);
  await session.saveNotebook(answer);
  const fresh = await api.loadModule();
  const saved = await fresh.loadNotebook();
  assert.equal(saved.words[0].review.repetitions, 1);
  assert.equal(
    recordWordReview(saved, "word", undefined, "good", 1800000000000),
    saved,
  );
});

test("a stale web session cannot overwrite another session’s answer", async (t) => {
  const path = await directory(t);
  const api = await webStorage(t, path, JSON.stringify(fixture()));
  const first = await api.loadModule();
  const data = await first.loadNotebook();
  const second = await api.loadModule();
  const old = await second.loadNotebook();
  await first.saveNotebook(
    recordWordReview(data, "word", undefined, "good", 1800000000000),
  );
  const saved = await api.store.read();
  await assert.rejects(
    second.saveNotebook(enrollMemorization(old, "word", "2026-10-19")),
    /başka bir pencerede/,
  );
  assert.deepEqual(await api.store.read(), saved);
  const fresh = await second.loadNotebook();
  await second.saveNotebook(enrollMemorization(fresh, "word", "2026-10-19"));
  assert.deepEqual(
    (await api.store.read()).data.words[0].review,
    saved.data.words[0].review,
  );
});

test("unreadable history is reported without replacing the existing file with an empty notebook", async (t) => {
  const path = await directory(t);
  const invalid = fixture();
  invalid.words[0].memorization = { addedOn: "2026-02-30", reviews: [] };
  const raw = JSON.stringify(invalid);
  await writeFile(join(path, "notebook.json"), raw);
  const api = await webStorage(t, path);
  const session = await api.loadModule();
  await assert.rejects(session.loadNotebook(), /ezber/);
  assert.equal(await readFile(join(path, "notebook.json"), "utf8"), raw);
});
