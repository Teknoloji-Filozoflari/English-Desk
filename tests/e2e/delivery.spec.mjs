import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBackupArchive } from "../../scripts/backup-archive.mjs";

test.use({ timezoneId: "Europe/Istanbul" });
const learned = new Date("2026-10-20T12:00:00+03:00");
const reviewed = new Date("2026-10-21T12:00:00+03:00");
async function snapshot(request) {
  return (await request.get("/api/notebook")).json();
}

test("CSV to memorization, next-day recall, live reports, fresh browser session and full backup agree", async ({
  page,
  request,
  browser,
}, info) => {
  const { revision } = await snapshot(request);
  expect(
    (
      await request.put("/api/notebook", {
        data: {
          revision,
          data: {
            version: 1,
            words: [],
            stories: [],
            grammar: [],
            studyPreferences: { dailyNewWordGoal: 1 },
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.clock.install({ time: learned });
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page
    .getByRole("button", { name: "CSV / TSV aktarımı", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "CSV / TSV dosyası seç", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "delivery.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Word,Meaning,Example,Level\nremember,hatırlamak,I remember this word.,A1\n",
    ),
  });
  await page
    .getByRole("button", { name: "Aktarım önizlemesini oluştur", exact: true })
    .click();
  expect((await snapshot(request)).data.words).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(1);
  await page
    .getByRole("button", { name: "Kelime aktarımını kapat", exact: true })
    .click();
  await page.getByRole("button", { name: "Ezbere ekle", exact: true }).click();
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page.getByRole("tab", { name: /Ezberlenecekler/ }).click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page.getByRole("button", { name: "Ezberledim", exact: true }).click();
  await page.getByRole("tab", { name: /00.*Bugün/ }).click();
  await expect(page.getByLabel("Yeni öğrenilen", { exact: true })).toHaveText(
    "1 / 1",
  );
  await page.clock.setSystemTime(reviewed);
  await page.reload();
  await expect(page.getByLabel("Kalan tekrar", { exact: true })).toHaveText(
    "1",
  );
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await page.getByRole("button", { name: "Kartı çevir", exact: true }).click();
  expect((await snapshot(request)).data.words[0].memorization.reviews).toEqual(
    [],
  );
  await page
    .getByRole("button", { name: "Hatırladım · Kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () => (await snapshot(request)).data.words[0].memorization.reviews,
    )
    .toEqual(["2026-10-21"]);
  const saved = await snapshot(request);
  expect(saved.data.words[0].memorization.learnedOn).toBe("2026-10-20");
  await page.close();

  // Fresh context: no old React state, cookies, localStorage or browser clock.
  const context = await browser.newContext({
    ...info.project.use,
    baseURL: "http://127.0.0.1:8082",
    timezoneId: "Europe/Istanbul",
  });
  const reopened = await context.newPage();
  await reopened.clock.install({ time: reviewed });
  const folder = await mkdtemp(join(tmpdir(), "english-desk-delivery-"));
  try {
    await reopened.goto("/");
    await expect(
      reopened.getByLabel("Kalan tekrar", { exact: true }),
    ).toHaveText("0");
    await expect(
      reopened.getByLabel("Tamamlanan tekrar", { exact: true }),
    ).toHaveText("1");
    await expect(
      reopened.getByLabel("Yeni öğrenilen", { exact: true }),
    ).toHaveText("0 / 1");
    await reopened
      .getByRole("button", { name: "İlerlemem · İstatistikleri aç" })
      .click();
    await expect(
      reopened.getByLabel("İlk öğrenme kaydı olan", { exact: true }),
    ).toHaveText("1");
    await expect(
      reopened.getByLabel("Başarılı tekrarı bulunan", { exact: true }),
    ).toHaveText("1");
    await expect(
      reopened.getByLabel("Bugün kaydedilen tekrar", { exact: true }),
    ).toHaveText("1");
    await reopened.screenshot({
      path: info.outputPath("delivery-progress.png"),
    });
    await reopened.getByRole("button", { name: /Yedeği indir/ }).click();
    const pending = reopened.waitForEvent("download");
    await reopened
      .getByRole("button", { name: "Yedeği oluştur ve indir", exact: true })
      .click();
    const archive = await readBackupArchive(
      await (await pending).path(),
      folder,
    );
    expect(archive.bundle.data.words).toEqual(saved.data.words);
    expect(archive.bundle.data.studyPreferences).toEqual(
      saved.data.studyPreferences,
    );
    expect(await snapshot(request)).toEqual(saved);
  } finally {
    await context.close();
    await rm(folder, { recursive: true, force: true });
  }
});
