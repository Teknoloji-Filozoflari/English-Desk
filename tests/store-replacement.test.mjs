import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, rename, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStore,
  replaceNotebookFile,
} from "../scripts/notebook-store.mjs";

const notebook = () => ({ version: 1, words: [], stories: [], grammar: [] });
const locked = (code) => Object.assign(new Error("File is locked"), { code });
for (const code of ["EPERM", "EACCES", "EBUSY"]) {
  test(`transient Windows ${code} retries one atomic replacement without duplicating a write`, async (t) => {
    const folder = await mkdtemp(join(tmpdir(), "english-desk-replace-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    const initial = await createStore(folder).save(notebook(), null);
    let calls = 0;
    const waits = [];
    const store = createStore(folder, {
      replaceFile: (source, target) =>
        replaceNotebookFile(source, target, {
          platform: "win32",
          wait: async (ms) => waits.push(ms),
          renameFile: async (from, to) => {
            calls++;
            if (calls < 3) {
              assert.equal(
                await readFile(to, "utf8"),
                JSON.stringify(initial.data, null, 2) + "\n",
              );
              throw locked(code);
            }
            await rename(from, to);
          },
        }),
    });
    const changed = {
      ...initial.data,
      studyPreferences: { dailyNewWordGoal: 7 },
    };
    const saved = await store.save(changed, initial.revision);
    assert.equal(calls, 3);
    assert.deepEqual(waits, [20, 40]);
    assert.deepEqual(await createStore(folder).read(), saved);
    assert.equal(saved.data.studyPreferences.dailyNewWordGoal, 7);
    assert.equal((await readdir(join(folder, "backups"))).length, 1);
    assert.equal(
      (await readdir(folder)).some((name) => name.endsWith(".tmp")),
      false,
    );
    await assert.rejects(
      store.save(changed, initial.revision),
      /başka bir pencerede/,
    );
    assert.equal(calls, 3);
  });
}

test("persistent Windows lock is bounded, cleans only the temporary file and preserves the original revision", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "english-desk-locked-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const initial = await createStore(folder).save(notebook(), null);
  let calls = 0;
  const waits = [];
  const failure = locked("EPERM");
  let blocked = true;
  const store = createStore(folder, {
    replaceFile: (from, to) =>
      replaceNotebookFile(from, to, {
        platform: "win32",
        wait: async (ms) => waits.push(ms),
        renameFile: async (source, target) => {
          calls++;
          if (blocked) throw failure;
          await rename(source, target);
        },
      }),
  });
  await assert.rejects(
    store.save(
      { ...initial.data, studyPreferences: { dailyNewWordGoal: 9 } },
      initial.revision,
    ),
    (error) => error === failure,
  );
  assert.equal(calls, 6);
  assert.deepEqual(waits, [20, 40, 80, 160, 320]);
  assert.deepEqual(await createStore(folder).read(), initial);
  assert.equal(
    (await readdir(folder)).some((name) => name.endsWith(".tmp")),
    false,
  );
  assert.equal((await readdir(join(folder, "backups"))).length, 1);
  // A failure must release the store queue for the next valid update.
  blocked = false;
  assert.equal(
    (
      await store.save(
        { ...initial.data, studyPreferences: { dailyNewWordGoal: 4 } },
        initial.revision,
      )
    ).data.studyPreferences.dailyNewWordGoal,
    4,
  );
});

test("other errors and non-Windows failures are never retried", async () => {
  for (const [platform, code] of [
    ["win32", "ENOSPC"],
    ["win32", "ENOENT"],
    ["linux", "EPERM"],
    ["darwin", "EBUSY"],
  ]) {
    let calls = 0;
    const failure = locked(code);
    await assert.rejects(
      replaceNotebookFile("source", "target", {
        platform,
        renameFile: async () => {
          calls++;
          throw failure;
        },
        wait: async () => assert.fail("Unexpected retry"),
      }),
      (error) => error === failure,
    );
    assert.equal(calls, 1);
  }
});
