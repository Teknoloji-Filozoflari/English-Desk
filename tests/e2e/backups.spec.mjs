import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../../scripts/backup-archive.mjs";
import { makeBackup, emptyNotebook } from "../../src/backup-core.ts";
import { notebookFixture } from "./fixture.mjs";

async function snapshot(request) {
  const response = await request.get("/api/notebook");
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function seed(request, data) {
  const { revision } = await snapshot(request);
  const response = await request.put("/api/notebook", {
    data: { data, revision },
  });
  expect(response.ok()).toBeTruthy();
}
async function upload(page, file) {
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Yedekten geri yükle/ }).click();
  await (await picker).setFiles(file);
}
async function download(page, directory) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Yedeği oluştur ve indir", exact: true })
    .click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.zip$/);
  return readBackupArchive(await file.path(), directory);
}
const card = () => ({
  id: "card-test",
  word: "quiet",
  meaning: "sessiz",
  type: "adjective",
  synonyms: "",
  antonyms: "",
  example: "The garden is quiet.",
  translation: "Bahçe sessiz.",
  storyId: "story-test",
  senses: [{ meaning: "sakin", definition: "", example: "", translation: "" }],
  review: { due: 1900000000000, interval: 3, repetitions: 2 },
});

test.beforeEach(async ({ page, request }) => {
  await seed(request, notebookFixture());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "A quiet morning", exact: true }),
  ).toBeVisible();
});

test("only selected sections are exported with all card fields and story references", async ({
  page,
  request,
}) => {
  const data = notebookFixture();
  data.words = [card()];
  data.grammar = [{ id: "g", title: "My grammar", body: "Note" }];
  await seed(request, data);
  await page.reload();
  await page.getByRole("button", { name: /Yedeği indir/ }).click();
  await page.getByRole("button", { name: "Bölüm seç", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Yedeği oluştur ve indir", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Kelimelerim", exact: true })
    .click();
  const directory = await mkdtemp(join(tmpdir(), "e2e-selective-export-"));
  try {
    const result = await download(page, directory);
    expect(result.bundle.sections).toEqual(["words"]);
    expect(result.bundle.data.words[0]).toMatchObject(card());
    expect(result.bundle.data.stories).toHaveLength(0);
    expect(result.bundle.data.grammar).toHaveLength(0);
    expect(result.bundle.data.exams.tests).toHaveLength(0);
    expect(result.bundle.storyReferences).toEqual([
      { id: "story-test", title: "A quiet morning", level: "A1" },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("old word archives merge without duplicates and preserve existing sections", async ({
  page,
  request,
}) => {
  const directory = await mkdtemp(join(tmpdir(), "e2e-old-words-"));
  try {
    const file = join(directory, "words.zip"),
      zip = new yazl.ZipFile();
    const writing = pipeline(zip.outputStream, createWriteStream(file));
    zip.addBuffer(
      Buffer.from(JSON.stringify({ version: 1, words: [card()] })),
      "words.json",
    );
    zip.addBuffer(
      Buffer.from(
        JSON.stringify([
          { id: "story-test", title: "A quiet morning", level: "A1" },
        ]),
      ),
      "story-links.json",
    );
    zip.end();
    await writing;
    await upload(page, file);
    await expect(
      page.getByRole("radio", { name: "Mevcutlara ekle", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Hikâyeler", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Yedeği yükle", exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(request)).data.words.length)
      .toBe(1);
    await upload(page, file);
    await expect(
      page.getByText("Kelimelerim: 0 kayıt yüklenecek · 1 kayıt zaten var", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Yedeği yükle", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Yedeği yükle", exact: true }),
    ).toBeHidden();
    const { data } = await snapshot(request);
    expect(data.words).toHaveLength(1);
    expect(data.words[0].storyId).toBe("story-test");
    expect(data.words[0].senses).toEqual(card().senses);
    expect(data.exams.tests).toHaveLength(1);
    expect(data.stories).toHaveLength(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ZIP story restoration saves audio and timings while replacing only stories", async ({
  page,
  request,
}) => {
  const directory = await mkdtemp(join(tmpdir(), "e2e-audio-restore-"));
  try {
    const current = notebookFixture();
    current.words = [card()];
    await seed(request, current);
    await page.reload();
    const incoming = emptyNotebook();
    incoming.stories = [
      {
        id: "audio-story",
        title: "Audio backup story",
        text: "A garden at dawn.",
        level: "B1",
        read: false,
        audioId: "backup-audio",
      },
    ];
    incoming.audioTimings = { "audio-story": [0, 2] };
    incoming.storyNotes = [
      {
        id: "audio-note",
        storyId: "audio-story",
        selection: "garden",
        category: "other",
        title: "Garden note",
        body: "A note.",
      },
    ];
    const audio = join(directory, "source.mp3"),
      bytes = Buffer.from("synthetic-mp3-file-for-round-trip");
    await writeFile(audio, bytes);
    const file = join(directory, "stories.zip");
    await writeBackupArchive(
      file,
      makeBackup(incoming, { sections: ["stories"], includeAudio: true }),
      new Map([["backup-audio", audio]]),
    );
    await upload(page, file);
    const before = await snapshot(request);
    await expect(page.getByText(/yedekte 1 ses dosyası/)).toBeVisible();
    expect(before.data.stories[0].title).toBe("A quiet morning");
    await page
      .getByRole("radio", { name: "Seçili bölümleri değiştir", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Yedeği yükle", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Audio backup story", exact: true }),
    ).toBeVisible();
    const { data } = await snapshot(request);
    expect(data.stories).toHaveLength(1);
    expect(data.exams.tests).toHaveLength(1);
    expect(data.words[0].meaning).toBe("sessiz");
    expect(data.words[0].storyId).toBe("");
    expect(data.words[0].level).toBe("A1");
    expect(data.audioTimings["audio-story"]).toEqual([0, 2]);
    expect(data.storyNotes[0].title).toBe("Garden note");
    expect(data.stories[0].audioId).toMatch(/^restore-/);
    const response = await request.get(
      "/api/story-audio/" + data.stories[0].audioId,
      { headers: { Range: "bytes=0-4" } },
    );
    expect(response.status()).toBe(206);
    expect(await response.body()).toEqual(bytes.subarray(0, 5));
    await page.getByRole("button", { name: /Yedeği indir/ }).click();
    await expect(
      page.getByRole("checkbox", { name: "Sesleri de ekle", exact: true }),
    ).toBeChecked();
    const exported = await download(page, join(directory, "exported"));
    expect(exported.audioFiles.size).toBe(1);
    expect(exported.bundle.data.audioTimings).toEqual(data.audioTimings);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("canceling a preview and a stale-revision restore cannot change current records", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  const bundle = makeBackup(notebookFixture(), {
    sections: ["stories"],
    includeAudio: false,
  });
  bundle.data.stories[0].title = "Incoming title";
  const file = {
    name: "selected.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  };
  await upload(page, file);
  await expect(
    page.getByRole("button", { name: "Yedeği yükle", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect((await snapshot(request)).revision).toBe(before.revision);
  await upload(page, file);
  await page
    .getByRole("radio", { name: "Seçili bölümleri değiştir", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yedeği yükle", exact: true }),
  ).toBeEnabled();
  const changed = notebookFixture();
  changed.grammar = [
    {
      id: "external",
      title: "Concurrent note",
      body: "Saved in another window.",
    },
  ];
  await seed(request, changed);
  const external = await snapshot(request);
  await page.getByRole("button", { name: "Yedeği yükle", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("başka bir pencerede");
  expect((await snapshot(request)).revision).toBe(external.revision);
  expect((await snapshot(request)).data.stories[0].title).toBe(
    "A quiet morning",
  );
});
