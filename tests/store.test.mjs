import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../scripts/notebook-store.mjs";
test("Dosya kaydı, tekrar okuma, yedekleme ve çakışma koruması", async () => {
  const dir = await mkdtemp(join(tmpdir(), "english-desk-test-"));
  const store = createStore(dir);
  const data = {
    version: 1,
    stories: [],
    words: [],
    grammar: [],
    storyNotes: [],
    audioTimings: {},
  };
  const first = await store.save(data, null);
  assert.deepEqual((await createStore(dir).read()).data, data);
  await assert.rejects(store.save(data, null), /başka bir pencerede/);
  const next = {
    ...data,
    stories: [
      {
        id: "s",
        title: "Test",
        text: "This is a test.",
        level: "A1",
        read: false,
        sample: false,
        audioId: "s",
      },
    ],
    grammar: [{ id: "g", title: "Test", body: "Note" }],
    storyNotes: [
      {
        id: "n",
        storyId: "s",
        selection: "This is a test.",
        category: "grammar",
        title: "Cümle",
        body: "Örnek not",
        tags: ["örnek"],
      },
    ],
    audioTimings: { s: [0] },
  };
  await store.save(next, first.revision);
  assert.equal((await readdir(join(dir, "backups"))).length, 1);
  assert.deepEqual(
    JSON.parse(await readFile(join(dir, "notebook.json"), "utf8")),
    next,
  );
  await assert.rejects(store.save({ version: 2 }, null));
  assert.deepEqual((await store.read()).data, next);
});

test("transaction updater preserves the file on failure and rejects concurrent stale updates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "english-desk-transaction-"));
  const store = createStore(dir);
  const data = {
    version: 1,
    stories: [],
    words: [],
    grammar: [],
    storyNotes: [],
    audioTimings: {},
  };
  const first = await store.save(data, null);
  await assert.rejects(
    store.update(first.revision, async () => {
      throw Error("Audio copy failed");
    }),
    /Audio copy/,
  );
  assert.equal((await store.read()).revision, first.revision);
  const update = store.update(first.revision, async (current) => ({
    ...current,
    grammar: [{ id: "g", title: "Note", body: "Saved" }],
  }));
  const stale = store.update(first.revision, (current) => current);
  await update;
  await assert.rejects(stale, /başka bir pencerede/);
  assert.equal((await store.read()).data.grammar[0].title, "Note");
});
