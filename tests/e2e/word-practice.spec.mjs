import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
test.use({ timezoneId: "Europe/Istanbul" });
const now = new Date("2026-10-19T12:00:00+03:00");
const word = () => ({
  id: "practice",
  word: "give up",
  meaning: "vazgeçmek; bırakmak",
  type: "phrasal verb",
  synonyms: "quit; surrender",
  antonyms: "continue",
  example: "Do not give up.",
  translation: "Vazgeçme.",
  definition: "To stop trying.",
  storyId: "",
  senses: [
    {
      meaning: "teslim olmak",
      definition: "To surrender.",
      example: "",
      translation: "",
    },
  ],
  memorization: { addedOn: "2026-10-18", learnedOn: "2026-10-18", reviews: [] },
});
async function saved(request) {
  return (await (await request.get("/api/notebook")).json()).data.words[0];
}
async function seed(request, card) {
  const { revision } = await (await request.get("/api/notebook")).json();
  const data = notebookFixture();
  data.words = [card];
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
}
async function open(page, mode) {
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await page.getByRole("tab", { name: mode, exact: true }).click();
}
test.beforeEach(async ({ page, request }) => {
  await seed(request, word());
  await page.clock.install({ time: now });
});
const modes = [
  ["Klasik kart", "Kartı çevir", null, "give up"],
  ["İngilizce → Türkçe", "Cevabı göster", null, "give up"],
  ["Türkçe → İngilizce", "Cevabı göster", null, "vazgeçmek; bırakmak"],
  ["Yazılı cevap", "Cevabı kontrol et", " BIRAKMAK ", "give up"],
  ["Boşluk doldurma", "Cevabı kontrol et", " GIVE   UP ", "Do not _____."],
];
for (const [mode, reveal, input, prompt] of modes) {
  test(`${mode}: recall, feedback, one saved step and reload`, async ({
    page,
    request,
  }) => {
    await open(page, mode);
    await expect(page.getByLabel("Test sorusu", { exact: true })).toHaveText(
      prompt,
    );
    expect((await saved(request)).memorization.reviews).toEqual([]);
    if (input) await page.getByLabel("Cevabın", { exact: true }).fill(input);
    await page.getByRole("button", { name: reveal, exact: true }).click();
    await expect(
      page.getByText("To stop trying.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("To surrender.", { exact: false }),
    ).toBeVisible();
    expect((await saved(request)).memorization.reviews).toEqual([]);
    if (input)
      await expect(
        page.getByText("Doğru cevap.", { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Hatırladım · Kaydet", exact: true })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await expect
      .poll(async () => (await saved(request)).memorization.reviews)
      .toEqual(["2026-10-19"]);
    await expect(
      page.getByText("Bu tur tamamlandı", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
    await page
      .getByRole("tab", { name: "Kelime testleri", exact: true })
      .click();
    await expect(
      page.getByText("Bu modda çalışılacak kelime yok", { exact: true }),
    ).toBeVisible();
    expect((await saved(request)).memorization.reviews).toEqual(["2026-10-19"]);
  });
  test(`${mode}: a miss explains the answer and keeps the fixed step pending`, async ({
    page,
    request,
  }) => {
    await open(page, mode);
    if (input)
      await page.getByLabel("Cevabın", { exact: true }).fill("unrelated");
    await page.getByRole("button", { name: reveal, exact: true }).click();
    if (input) {
      await expect(
        page.getByText("Cevap kayıtlı karşılıkla eşleşmedi.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Hatırladım · Kaydet", exact: true }),
      ).toHaveCount(0);
    }
    await expect(
      page.getByText("To stop trying.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: input
          ? "Yanlışı öğrendim · Sonraki kart"
          : "Hatırlamadım · Sonraki kart",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Bu tur tamamlandı", { exact: true }),
    ).toBeVisible();
    expect((await saved(request)).memorization.reviews).toEqual([]);
    await page
      .getByRole("button", {
        name: "Bekleyenlerle yeni tur başlat",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Test sorusu", { exact: true })).toBeVisible();
  });
}

test("written reverse direction treats a registered synonym as uncertain and allows explicit self evaluation", async ({
  page,
  request,
}) => {
  await open(page, "Yazılı cevap");
  await page
    .getByRole("button", { name: "İngilizce cevap yaz", exact: true })
    .click();
  await expect(page.getByLabel("Test sorusu", { exact: true })).toHaveText(
    "vazgeçmek; bırakmak",
  );
  await page.getByLabel("Cevabın", { exact: true }).fill("quit");
  await page
    .getByRole("button", { name: "Cevabı kontrol et", exact: true })
    .click();
  await expect(
    page.getByText(
      "Bu cevap belirsiz. Kayıtlı bilgilerle karşılaştırıp kendin değerlendir.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await saved(request)).memorization.reviews).toEqual([]);
  await page
    .getByRole("button", { name: "Zorlandım · Kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(request)).memorization.reviews)
    .toEqual(["2026-10-19"]);
});

test("cloze without a whole-word matching example shows an honest empty state", async ({
  page,
  request,
}) => {
  await seed(request, { ...word(), example: "Keep trying.", senses: [] });
  await open(page, "Boşluk doldurma");
  await expect(
    page.getByText("Bu modda çalışılacak kelime yok", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Cevabın", { exact: true })).toHaveCount(0);
  expect((await saved(request)).memorization.reviews).toEqual([]);
});

test("a failed practice save retains feedback and safely retries the same answer", async ({
  page,
  request,
}) => {
  await open(page, "Yazılı cevap");
  await page.getByLabel("Cevabın", { exact: true }).fill("teslim olmak");
  await page
    .getByRole("button", { name: "Cevabı kontrol et", exact: true })
    .click();
  let failed = false;
  await page.route("**/api/notebook", (route) => {
    if (!failed && route.request().method() === "PUT") {
      failed = true;
      return route.fulfill({
        status: 503,
        json: { error: "Test kelime kaydı hatası" },
      });
    }
    return route.continue();
  });
  const save = page.getByRole("button", {
    name: "Hatırladım · Kaydet",
    exact: true,
  });
  await save.click();
  await expect(
    page.getByText("Kaydedilemedi: Test kelime kaydı hatası", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Doğru cevap.", { exact: true })).toBeVisible();
  expect((await saved(request)).memorization.reviews).toEqual([]);
  await save.click();
  await expect
    .poll(async () => (await saved(request)).memorization.reviews)
    .toEqual(["2026-10-19"]);
});

test("a legacy word uses the existing engine, preserving its ten-minute miss interval", async ({
  page,
  request,
}) => {
  await page.clock.setFixedTime(now);
  const card = word();
  delete card.memorization;
  await seed(request, card);
  await open(page, "Boşluk doldurma");
  await page.getByLabel("Cevabın", { exact: true }).fill("wrong");
  await page
    .getByRole("button", { name: "Cevabı kontrol et", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Yanlışı öğrendim · Sonraki kart",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await saved(request)).review?.due)
    .toBe(now.getTime() + 600000);
  expect((await saved(request)).memorization).toBeUndefined();
});
