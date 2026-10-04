import { readBackupArchive } from "../../scripts/backup-archive.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";

async function savedNotebook(request) {
  const response = await request.get("/api/notebook");
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function openWords(page) {
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
}
async function uploadBackup(page, contents) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Yedekten geri yükle/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(contents)),
  });
}

test.beforeEach(async ({ page, request }) => {
  const { revision } = await savedNotebook(request);
  const reset = await request.put("/api/notebook", {
    data: { data: notebookFixture(), revision },
  });
  expect(reset.ok()).toBeTruthy();
  // Only the dictionary is stubbed. Notebook reads/writes use the real file API.
  await page.route("**/api/words/lookup", (route) =>
    route.fulfill({
      json: {
        word: "quiet",
        meaning: "sessiz",
        definition: "Making little noise.",
        type: "adjective",
        synonyms: "",
        antonyms: "",
        example: "The garden is quiet.",
        translation: "Bahçe sessiz.",
        level: "A1",
        levelSource: "Test fixture",
        sources: "Test fixture",
        warnings: [],
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "A quiet morning", exact: true }),
  ).toBeVisible();
});

test("hikâyeden kelime kaydetme, düzenleme ve yenileme sonrası koruma", async ({
  page,
  request,
}) => {
  await page
    .getByRole("button", { name: "A quiet morning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "quiet kelimesini seç", exact: true })
    .click();
  await expect(page.getByLabel("İngilizce kelime veya ifade *")).toHaveValue(
    "quiet",
  );
  await expect(page.getByLabel("İlk anlamın örnek cümlesi")).toHaveValue(
    "The garden is quiet.",
  );
  await page.getByLabel("İlk Türkçe anlam / açıklama").fill("sakin");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Durdur", exact: true }),
  ).toBeHidden();
  await openWords(page);
  await page.getByRole("button", { name: "quiet", exact: true }).click();
  await expect(page.getByText("sakin", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Making little noise.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page.getByLabel("İlk Türkçe anlam / açıklama").fill("sessiz ve sakin");
  await page.getByRole("button", { name: "+ Anlam ekle", exact: true }).click();
  await page.getByLabel("Türkçe anlam *", { exact: true }).fill("huzurlu");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Durdur", exact: true }),
  ).toBeHidden();
  await expect
    .poll(async () => (await savedNotebook(request)).data.words[0]?.meaning)
    .toBe("sessiz ve sakin");
  await page.reload();
  await openWords(page);
  await page.getByRole("button", { name: "quiet", exact: true }).click();
  await expect(
    page.getByText("sessiz ve sakin", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2. huzurlu", { exact: true })).toBeVisible();
  const { data } = await savedNotebook(request);
  expect(data.words).toHaveLength(1);
  expect(data.words[0].storyId).toBe("story-test");
  expect(data.words[0].senses[0].meaning).toBe("huzurlu");
});

test("yedek indirilebilir, onayla geri yüklenir ve yenilemede korunur", async ({
  page,
  request,
}) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Yedeği indir/ }).click();
  await page
    .getByRole("button", { name: "Yedeği oluştur ve indir", exact: true })
    .click();
  const file = await download;
  const stage = await mkdtemp(join(tmpdir(), "e2e-export-"));
  let exported;
  try {
    exported = (await readBackupArchive(await file.path(), stage)).bundle.data;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  expect(exported.stories[0].title).toBe("A quiet morning");
  expect(exported.exams.tests).toHaveLength(1);
  const backup = notebookFixture();
  backup.stories[0].title = "Restored story";
  backup.grammar = [
    {
      id: "grammar-backup",
      title: "Backup note",
      body: "A personal grammar note.",
    },
  ];
  await uploadBackup(page, backup);
  await expect(
    page.getByRole("button", { name: "Yedeği yükle", exact: true }),
  ).toBeVisible();
  expect((await savedNotebook(request)).data.stories[0].title).toBe(
    "A quiet morning",
  );
  await page
    .getByRole("radio", { name: "Seçili bölümleri değiştir", exact: true })
    .click();
  await page.getByRole("button", { name: "Yedeği yükle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restored story", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restored story", exact: true }),
  ).toBeVisible();
  expect((await savedNotebook(request)).data.grammar).toEqual(backup.grammar);
});

test("geçersiz yedek mevcut defteri değiştirmez", async ({ page, request }) => {
  const before = await savedNotebook(request);
  await uploadBackup(page, { version: 999, stories: [] });
  await expect(page.getByText(/Yedek açılamadı:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yedeği yükle", exact: true }),
  ).toBeHidden();
  const after = await savedNotebook(request);
  expect(after.revision).toBe(before.revision);
  expect(after.data).toEqual(before.data);
});

test("sınav cevapları, işaret ve konum yenileme sonrası devam eder", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: /04.*Sınavlar/ }).click();
  await page.getByRole("button", { name: "Deneme", exact: true }).click();
  await page.getByRole("radio", { name: "A. book", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "A. book", exact: true }),
  ).toBeChecked();
  await expect
    .poll(
      async () =>
        (await savedNotebook(request)).data.exams.attempts[0]?.answers.q1,
    )
    .toBe("book");
  await page.getByRole("button", { name: "Sonraki →", exact: true }).click();
  await page
    .getByRole("button", { name: "Sonra bakacağım", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "⚑ İşareti kaldır", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("tab", { name: /04.*Sınavlar/ }).click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByText("Choose the word for bahçe.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "⚑ İşareti kaldır", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← Önceki", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "A. book", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Sonraki →", exact: true }).click();
  await page.getByRole("radio", { name: "A. garden", exact: true }).click();
  await page.getByRole("button", { name: "Testi bitir", exact: true }).click();
  await page
    .getByRole("button", { name: "Bitir ve sonucu göster", exact: true })
    .click();
  await expect(
    page.getByText("2 doğru · 0 yanlış · 0 boş", { exact: true }),
  ).toBeVisible();
  const { data } = await savedNotebook(request);
  expect(data.exams.attempts).toHaveLength(1);
  expect(data.exams.attempts[0]).toMatchObject({
    finished: true,
    position: 1,
    answers: { q1: "book", q2: "garden" },
    flags: ["q2"],
  });
});

test("başarısız kayıt formu açık tutar ve dosyayı değiştirmez", async ({
  page,
  request,
}) => {
  await openWords(page);
  await page
    .getByRole("button", { name: "+ Kelime ekle", exact: true })
    .click();
  await page.getByLabel("İngilizce kelime veya ifade *").fill("quiet");
  await page.getByLabel("İlk Türkçe anlam / açıklama").fill("sessiz");
  const before = await savedNotebook(request);
  await page.route("**/api/notebook", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 409,
        json: { error: "Kayıtlar başka bir pencerede değişti." },
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kaydedilemedi:");
  await expect(page.getByLabel("İngilizce kelime veya ifade *")).toHaveValue(
    "quiet",
  );
  expect((await savedNotebook(request)).revision).toBe(before.revision);
  await page.unroute("**/api/notebook");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect
    .poll(async () => (await savedNotebook(request)).data.words.length)
    .toBe(1);
});

test("hikâye notları ve gramer konuları doğru bölümlerde saklanır", async ({
  page,
  request,
}) => {
  await page
    .getByRole("button", { name: "A quiet morning", exact: true })
    .click();
  await page.getByRole("button", { name: "Cümleyi seç", exact: true }).click();
  await page
    .getByRole("button", { name: "quiet kelimesini seç", exact: true })
    .click();
  await page.getByLabel("Not başlığı *").fill("Morning note");
  await page
    .getByLabel("Etiketler (virgülle ayır: past simple, bağlaç)")
    .fill("reading, adjective");
  await page
    .getByLabel("Açıklaman / gramer notun *")
    .fill("Quiet describes the garden.");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Morning note", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "← Hikâyelerime dön", exact: true })
    .click();
  await page.getByLabel("Hikâye notlarında ara").fill("adjective");
  await expect(page.getByText("Morning note", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await page.getByRole("button", { name: "+ Konu ekle", exact: true }).click();
  await page.getByLabel("Not başlığı *").fill("My grammar");
  await page.getByLabel("Notların *").fill("An adjective describes a noun.");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("My grammar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /English Tense/ }).click();
  await page.getByRole("button", { name: /01.*Present Simple/ }).click();
  await page
    .getByRole("button", { name: "Present Simple için not ekle", exact: true })
    .click();
  await page.getByLabel("Not başlığı *").fill("Daily habits");
  await page.getByLabel("Notların *").fill("Emma reads every morning.");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Daily habits", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await expect(page.getByText("My grammar", { exact: true })).toBeVisible();
  const { data } = await savedNotebook(request);
  expect(data.words).toHaveLength(0);
  expect(data.storyNotes[0]).toMatchObject({
    storyId: "story-test",
    selection: "The garden is quiet.",
    tags: ["reading", "adjective"],
  });
  expect(data.grammar.find((note) => note.title === "Daily habits").tense).toBe(
    "Present Simple",
  );
});

test("ekran değiştirirken okuma görünümü ve not filtreleri korunur", async ({
  page,
}) => {
  await page.getByLabel("Hikâye notlarında ara").fill("remember my filter");
  await page
    .getByRole("button", { name: "A quiet morning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Okuma görünümü", exact: true })
    .click();
  await page.getByRole("button", { name: "Yazı büyüt", exact: true }).click();
  await expect(page.getByText("24 px", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "← Hikâyelerime dön", exact: true })
    .click();
  await expect(page.getByLabel("Hikâye notlarında ara")).toHaveValue(
    "remember my filter",
  );
  await openWords(page);
  await page.getByRole("tab", { name: /01.*Hikâyeler/ }).click();
  await expect(page.getByLabel("Hikâye notlarında ara")).toHaveValue(
    "remember my filter",
  );
  await page
    .getByRole("button", { name: "A quiet morning", exact: true })
    .click();
  await expect(page.getByText("24 px", { exact: true })).toBeVisible();
});
