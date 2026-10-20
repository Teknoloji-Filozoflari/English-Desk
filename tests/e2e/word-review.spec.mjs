import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
import { calendarDay } from "../../src/memorization.ts";

async function read(request) {
  return (await (await request.get("/api/notebook")).json()).data.words[0];
}
test.beforeEach(async ({ page, request }) => {
  const { revision } = await (await request.get("/api/notebook")).json();
  const data = notebookFixture();
  data.words = [
    {
      id: "review-word",
      word: "remember",
      meaning: "hatırlamak",
      type: "verb",
      synonyms: "",
      antonyms: "",
      example: "",
      translation: "",
      storyId: "",
      memorization: { addedOn: calendarDay(), reviews: [] },
    },
  ];
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Tekrar et", exact: true }).click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
});

for (const [label, delay, interval, repetitions] of [
  ["Tekrar", 600000, 0, 0],
  ["Zorlandım", 86400000, 1, 1],
  ["Bildim", 86400000, 1, 1],
]) {
  test(`existing review: ${label} handles duplicate clicks once and preserves the schedule on reload`, async ({
    page,
    request,
  }) => {
    const before = Date.now();
    const plan = (await read(request)).memorization;
    await page
      .getByRole("button", { name: label, exact: true })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await expect
      .poll(async () => (await read(request)).review?.interval)
      .toBe(interval);
    const saved = await read(request);
    expect(saved.review.repetitions).toBe(repetitions);
    expect(saved.review.due).toBeGreaterThanOrEqual(before + delay);
    expect(saved.review.due).toBeLessThanOrEqual(Date.now() + delay);
    expect(saved.memorization).toEqual(plan);
    await page.reload();
    await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
    await page.getByRole("tab", { name: "Tekrar et", exact: true }).click();
    await expect(
      page.getByText(/Şimdilik tekrar edilecek kelime yok/),
    ).toBeVisible();
    expect((await read(request)).review).toEqual(saved.review);
  });
}

test("existing review: failed save retains the revealed answer for a safe retry", async ({
  page,
  request,
}) => {
  let rejected = false;
  await page.route("**/api/notebook", (route) => {
    if (route.request().method() === "PUT" && !rejected) {
      rejected = true;
      return route.fulfill({
        status: 503,
        json: { error: "Test tekrar hatası" },
      });
    }
    return route.continue();
  });
  const answer = page.getByRole("button", { name: "Bildim", exact: true });
  await answer.click();
  await expect(
    page.getByText("Kaydedilemedi: Test tekrar hatası", { exact: true }),
  ).toBeVisible();
  await expect(answer).toBeEnabled();
  await expect(page.getByText("hatırlamak", { exact: true })).toBeVisible();
  expect((await read(request)).review).toBeUndefined();
  await answer.click();
  await expect
    .poll(async () => (await read(request)).review?.repetitions)
    .toBe(1);
});
