import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yazl from "yazl";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../scripts/backup-archive.mjs";
import { emptyNotebook, makeBackup, planRestore } from "../src/backup-core.ts";
async function legacyZip(file, entries) {
  const zip = new yazl.ZipFile();
  const writing = pipeline(zip.outputStream, createWriteStream(file));
  for (const [name, bytes] of entries) zip.addBuffer(Buffer.from(bytes), name);
  zip.end();
  await writing;
}

test("ZIP round-trip preserves both repetition schedules and merges without replacing current progress", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-repetition-test-"));
  try {
    const data = emptyNotebook();
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
    data.words = [
      {
        ...word,
        review: { due: 1800000000000, interval: 7, repetitions: 3 },
        memorization: {
          addedOn: "2026-10-01",
          learnedOn: "2026-10-01",
          reviews: ["2026-10-02"],
        },
      },
    ];
    data.studyPreferences = { dailyNewWordGoal: 7 };
    data.words[0].studyActivity = {
      firstLearnedOn: "2026-10-01",
      lastReviewedOn: "2026-10-02",
    };
    for (const sections of [
      ["words"],
      ["stories", "words", "grammar", "exams"],
    ]) {
      const bundle = makeBackup(data, { sections, includeAudio: false });
      const zip = join(dir, `${sections.length}.zip`);
      await writeBackupArchive(zip, bundle);
      const restored = await readBackupArchive(
        zip,
        join(dir, `stage-${sections.length}`),
      );
      const replacement = planRestore(
        emptyNotebook(),
        restored.bundle,
        { sections, mode: "replace" },
        [],
      ).data;
      assert.deepEqual(replacement.words, data.words);
      assert.deepEqual(replacement.studyPreferences, data.studyPreferences);
      const current = structuredClone(data);
      current.words[0].memorization.reviews.push("2026-10-04");
      const merged = planRestore(
        current,
        restored.bundle,
        { sections, mode: "merge" },
        [],
      );
      assert.deepEqual(merged.data.words, current.words);
    }
    const oldZip = join(dir, "old-words.zip");
    await legacyZip(oldZip, [
      ["words.json", JSON.stringify({ version: 1, words: [word] })],
    ]);
    const old = await readBackupArchive(oldZip, join(dir, "old-stage"));
    assert.equal(old.bundle.data.words[0].memorization, undefined);
    assert.deepEqual(old.bundle.data.words[0], word);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ZIP backup carries byte-identical audio, stories, notes and sentence timings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-archive-test-"));
  try {
    const data = emptyNotebook();
    data.stories = [
      {
        id: "s",
        title: "Audio story",
        text: "Test story.",
        level: "A1",
        read: false,
        audioId: "audio",
      },
    ];
    data.audioTimings = { s: [0, 1.5] };
    const bytes = Buffer.from("synthetic audio bytes"),
      audio = join(dir, "source.mp3");
    await writeFile(audio, bytes);
    const bundle = makeBackup(data, {
        sections: ["stories"],
        includeAudio: true,
      }),
      zip = join(dir, "backup.zip");
    await writeBackupArchive(zip, bundle, new Map([["audio", audio]]));
    const result = await readBackupArchive(zip, join(dir, "stage"));
    assert.deepEqual(result.bundle.data.stories, bundle.data.stories);
    assert.deepEqual(result.bundle.data.audioTimings, data.audioTimings);
    assert.deepEqual(await readFile(result.audioFiles.get("audio")), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("previous story, word, exam and recovery ZIP layouts remain readable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-legacy-test-"));
  try {
    const data = emptyNotebook();
    data.stories = [
      { id: "s", title: "Story", text: "Text.", level: "A1", read: false },
    ];
    const layouts = [
      ["stories.json", { version: 1, stories: data.stories }, "stories"],
      ["words.json", { version: 1, words: [] }, "words"],
      ["exams.json", { tests: [], attempts: [] }, "exams"],
      ["data/notebook.json", data, "stories"],
    ];
    for (let i = 0; i < layouts.length; i++) {
      const [name, payload, section] = layouts[i],
        zip = join(dir, i + ".zip");
      await legacyZip(zip, [[name, JSON.stringify(payload)]]);
      assert.ok(
        (
          await readBackupArchive(zip, join(dir, "stage" + i))
        ).bundle.sections.includes(section),
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("corrupt ZIP JSON is rejected before any application data is written", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-bad-test-"));
  try {
    const zip = join(dir, "bad.zip");
    await legacyZip(zip, [["backup.json", "invalid JSON"]]);
    await assert.rejects(readBackupArchive(zip, join(dir, "stage")));
    const plain = join(dir, "bad.json");
    await writeFile(plain, '{"version":99,"stories":[]}');
    await assert.rejects(
      readBackupArchive(plain, join(dir, "other")),
      /sürümü/,
    );
    const unrelated = join(dir, "unrelated.zip");
    await legacyZip(unrelated, [["file.txt", "text"]]);
    await assert.rejects(
      readBackupArchive(unrelated, join(dir, "unrelated")),
      /desteklenen/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
