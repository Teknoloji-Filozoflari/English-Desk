import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";

test.beforeEach(async ({ page, request }) => {
  const { revision } = await (await request.get("/api/notebook")).json();
  expect(
    (
      await request.put("/api/notebook", {
        data: { data: notebookFixture(), revision },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
});

async function contained(page) {
  const overflow = await page
    .locator('button, [role="button"], input, textarea, [role="tab"]')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          if (node.closest('[aria-hidden="true"]')) return false;
          const r = node.getBoundingClientRect();
          return (
            r.width && r.height && (r.left < -1 || r.right > innerWidth + 1)
          );
        })
        .map((node) => ({
          text:
            node.textContent?.slice(0, 90) || node.getAttribute("aria-label"),
          width: node.getBoundingClientRect().width,
        })),
    );
  expect.soft(overflow).toEqual([]);
}

test("main study screens keep controls within a narrow viewport", async ({
  page,
}, info) => {
  if (info.project.name.startsWith("mobile"))
    await page.setViewportSize({ width: 320, height: 640 });
  for (const tab of [
    /00.*Bugün/,
    /02.*Kelimelerim/,
    /03.*Gramer/,
    /04.*Sınavlar/,
    /01.*Hikâyeler/,
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({
      path: info.outputPath(`screen-${tab.source.slice(0, 2)}.png`),
    });
    await contained(page);
  }
  await page.getByRole("tab", { name: /00.*Bugün/ }).click();
  await page
    .getByRole("button", { name: "İlerlemem · İstatistikleri aç" })
    .click();
  await contained(page);
});

test("word editor footer remains inside the dialog at short heights", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page
    .getByRole("button", { name: "+ Kelime ekle", exact: true })
    .click();
  await expect(page.getByLabel("İngilizce kelime veya ifade *")).toBeVisible();
  await contained(page);
  const save = page.getByRole("button", { name: "Kaydet", exact: true });
  await expect(save).toBeInViewport();
  await page
    .getByRole("button", { name: "Pencereyi kapat", exact: true })
    .click();
  await expect(save).toBeHidden();
});

test("many navigation topics stay scrollable without hiding the study area", async ({
  page,
  request,
}, info) => {
  const { data, revision } = await (await request.get("/api/notebook")).json();
  data.grammarTopics = Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i}`,
    title: `Çalışma başlığı ${i + 1}`,
  }));
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
  await page.setViewportSize({
    width: info.project.name.startsWith("mobile") ? 320 : 1280,
    height: 480,
  });
  await page.reload();
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Gramer alt başlık: Çalışma başlığı 20",
      exact: true,
    }),
  ).toBeAttached();
  const nav = page.locator("#study-navigation");
  expect(
    await nav.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBeTruthy();
  await page
    .getByRole("button", {
      name: "Gramer alt başlık: Çalışma başlığı 20",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Gramer alt başlık: Çalışma başlığı 20",
      exact: true,
    }),
  ).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Parçalar yerine otursun." }),
  ).toBeAttached();
  await contained(page);
});

test("keyboard focus is visible and shared actions work with Enter", async ({
  page,
}) => {
  const today = page.getByRole("tab", { name: /00.*Bugün/ });
  await page.keyboard.press("Tab");
  await today.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tab", { name: /01.*Hikâyeler/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(today).toBeFocused();
  expect(await today.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "solid",
  );
  const action = page.getByRole("button", {
    name: "İlerlemem · İstatistikleri aç",
  });
  await action.focus();
  expect(await action.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe(
    "2px",
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Öğrenme istatistiklerin" }),
  ).toBeVisible();
  const field = page.getByLabel("Haftalık başarılı tekrar hedefin");
  await field.focus();
  expect(await field.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "solid",
  );
});

test("long saved titles and word feedback wrap without losing actions", async ({
  page,
  request,
}, info) => {
  const { data, revision } = await (await request.get("/api/notebook")).json();
  data.grammar = [
    {
      id: "long-note",
      title: "Uzun başlık: " + "bağlam ve örnekler ".repeat(8),
      body: "Kendi gramer notum.",
    },
  ];
  data.words = [
    {
      id: "word",
      word: "give up",
      meaning: "vazgeçmek",
      type: "phrasal verb",
      synonyms: "quit",
      antonyms: "continue",
      example: "Do not give up.",
      translation: "Vazgeçme.",
      storyId: "",
      review: { due: 0, interval: 1, repetitions: 0 },
    },
  ];
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
  if (info.project.name.startsWith("mobile"))
    await page.setViewportSize({ width: 320, height: 640 });
  await page.reload();
  await contained(page);
  await page
    .getByRole("button", { name: "İlerlemem · İstatistikleri aç" })
    .click();
  await contained(page);
  await page.screenshot({ path: info.outputPath("progress.png") });
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await page.getByRole("button", { name: "Kartı çevir", exact: true }).click();
  await contained(page);
  for (const name of [
    "Hatırlamadım · Sonraki kart",
    "Zorlandım · Kaydet",
    "Hatırladım · Kaydet",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath("practice-feedback.png") });
});
