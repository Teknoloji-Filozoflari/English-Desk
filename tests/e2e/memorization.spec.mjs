import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
import { addDays, calendarDay } from "../../src/memorization.ts";

test.use({ timezoneId: "Europe/Istanbul" });

const word = {
  id: "memory-word",
  word: "remember",
  meaning: "hatırlamak",
  type: "verb",
  synonyms: "",
  antonyms: "",
  example: "I remember this word.",
  translation: "Bu kelimeyi hatırlıyorum.",
  storyId: "",
  level: "A1",
};
async function seed(request, memorization) {
  const { revision } = await (await request.get("/api/notebook")).json();
  const response = await request.put("/api/notebook", {
    data: {
      revision,
      data: {
        ...notebookFixture(),
        words: [{ ...word, ...(memorization ? { memorization } : {}) }],
      },
    },
  });
  expect(response.ok()).toBeTruthy();
}
async function open(page) {
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
}
async function savedPlan(request) {
  return (await (await request.get("/api/notebook")).json()).data.words[0]
    .memorization;
}
test("select a word, record the learning day, and preserve the plan on reload", async ({
  page,
  request,
}) => {
  await seed(request);
  await open(page);
  await page.getByRole("button", { name: "Ezbere ekle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "✓ Ezber listesinde" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page.getByRole("tab", { name: /Ezberlenecekler/ }).click();
  await expect(page.getByText("remember", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ezberledim", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await expect(page.getByText("hatırlamak", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ezberledim", exact: true }).click();
  await expect
    .poll(async () => (await savedPlan(request)).learnedOn)
    .toBe(calendarDay());
  await page.reload();
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page.getByRole("tab", { name: /Yaklaşan/ }).click();
  await expect(page.getByText("remember", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tekrarı kaydet/ }),
  ).toHaveCount(0);
  expect((await savedPlan(request)).reviews).toEqual([]);
});
test("an overdue review records the actual day and moves out of today’s queue", async ({
  page,
  request,
}) => {
  const today = calendarDay();
  await seed(request, {
    addedOn: addDays(today, -20),
    learnedOn: addDays(today, -20),
    reviews: [],
  });
  await open(page);
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await expect(page.getByText(/Geciken tekrar:/)).toBeVisible();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hatırladım · Tekrarı kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await savedPlan(request)).reviews)
    .toEqual([today]);
  await expect(page.getByText("remember", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: /Yaklaşan/ }).click();
  await expect(
    page.getByText("Bugünkü tekrar kaydedildi. Sonraki adım yarın açılacak."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tekrarı kaydet/ }),
  ).toHaveCount(0);
});

test("two immediate clicks record one answer and a reload preserves it", async ({
  page,
  request,
}) => {
  const today = calendarDay();
  await seed(request, {
    addedOn: addDays(today, -20),
    learnedOn: addDays(today, -20),
    reviews: [],
  });
  await open(page);
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hatırladım · Tekrarı kaydet", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect
    .poll(async () => (await savedPlan(request)).reviews)
    .toEqual([today]);
  await page.reload();
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page.getByRole("tab", { name: /Yaklaşan/ }).click();
  await expect(
    page.getByText("Bugünkü tekrar kaydedildi. Sonraki adım yarın açılacak."),
  ).toBeVisible();
  expect((await savedPlan(request)).reviews).toEqual([today]);
});

test("failed saving keeps the answer available and a retry writes it once", async ({
  page,
  request,
}) => {
  const today = calendarDay();
  await seed(request, {
    addedOn: addDays(today, -2),
    learnedOn: addDays(today, -2),
    reviews: [],
  });
  await open(page);
  let rejected = false;
  await page.route("**/api/notebook", (route) => {
    if (route.request().method() === "PUT" && !rejected) {
      rejected = true;
      return route.fulfill({
        status: 503,
        json: { error: "Test kayıt hatası" },
      });
    }
    return route.continue();
  });
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "Hatırladım · Tekrarı kaydet",
    exact: true,
  });
  await save.click();
  await expect(
    page.getByText("Kaydedilemedi: Test kayıt hatası", { exact: true }),
  ).toBeVisible();
  await expect(save).toBeEnabled();
  expect((await savedPlan(request)).reviews).toEqual([]);
  await save.click();
  await expect
    .poll(async () => (await savedPlan(request)).reviews)
    .toEqual([today]);
});

test("an open screen moves the word to today’s queue at local midnight", async ({
  page,
  request,
}) => {
  await seed(request, {
    addedOn: "2026-10-19",
    learnedOn: "2026-10-19",
    reviews: [],
  });
  await page.clock.install({ time: new Date("2026-10-19T23:59:50+03:00") });
  await open(page);
  await page.getByRole("tab", { name: "Ezber", exact: true }).click();
  await page.getByRole("tab", { name: /Yaklaşan/ }).click();
  await expect(page.getByText("remember", { exact: true })).toBeVisible();
  await page.clock.fastForward(11000);
  await page.getByRole("tab", { name: /Bugünkü tekrarlar/ }).click();
  await expect(page.getByText("remember", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bugünkü tekrar:/)).toBeVisible();
  expect((await savedPlan(request)).reviews).toEqual([]);
});
