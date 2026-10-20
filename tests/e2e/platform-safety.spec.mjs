import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { notebookFixture } from "./fixture.mjs";

async function snapshot(request) {
  const response = await request.get("/api/notebook");
  expect(response.ok()).toBeTruthy();
  return response.json();
}
test.beforeEach(async ({ request }) => {
  const { revision } = await snapshot(request);
  expect(
    (
      await request.put("/api/notebook", {
        data: { data: notebookFixture(), revision },
      })
    ).ok(),
  ).toBeTruthy();
});

test("local study, manual words and exports work without external services", async ({
  page,
  context,
  request,
}) => {
  // Keep loopback available: web offline usage requires its local server.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.route("**/api/words/lookup", (route) =>
    route.fulfill({ status: 503, json: { error: "Sözlük çevrimdışı" } }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page
    .getByRole("button", { name: "+ Kelime ekle", exact: true })
    .click();
  await page.getByLabel("İngilizce kelime veya ifade *").fill("remember");
  await page.getByLabel("İlk Türkçe anlam / açıklama").fill("hatırlamak");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(1);
  await expect(page.getByText(/remember: Sözlük çevrimdışı/)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("button", { name: "remember", exact: true }).click();
  await expect(page.getByText("hatırlamak", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Kelime kartını kapat", exact: true })
    .click();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await page.getByRole("button", { name: "Kartı çevir", exact: true }).click();
  await page
    .getByRole("button", { name: "Hatırladım · Kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () => (await snapshot(request)).data.words[0].answerHistory?.length,
    )
    .toBe(1);
  const saved = await snapshot(request);
  await page.getByRole("tab", { name: "Kelimelerim", exact: true }).click();
  await page
    .getByRole("button", { name: "CSV / TSV aktarımı", exact: true })
    .click();
  await page.getByRole("button", { name: "CSV hazırla", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Hazırlanan kelime dosyasını kaydet",
      exact: true,
    })
    .click();
  const csv = await pending;
  expect(await readFile(await csv.path(), "utf8")).toContain("hatırlamak");
  await page
    .getByRole("button", { name: "Kelime aktarımını kapat", exact: true })
    .click();
  await page.getByRole("button", { name: /Yedeği indir/ }).click();
  const backup = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Yedeği oluştur ve indir", exact: true })
    .click();
  expect((await backup).suggestedFilename()).toMatch(/\.zip$/);
  expect(await snapshot(request)).toEqual(saved);
});

test("losing the local server never falls back to stale browser data or reports a successful save", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Günlük yeni kelime hedefi", { exact: true }).fill("7");
  const before = await snapshot(request);
  await page.route("**/api/notebook", (route) =>
    route.abort("connectionrefused"),
  );
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText(/Kaydedilemedi: Yerel kayıt sunucusuna ulaşılamadı/),
  ).toBeVisible();
  expect(await snapshot(request)).toEqual(before);
  await page.evaluate(() =>
    localStorage.setItem(
      "english-desk-native-v1",
      JSON.stringify({
        version: 1,
        stories: [],
        words: [],
        grammar: [],
        studyPreferences: { dailyNewWordGoal: 99 },
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Kayıtlar okunamadı");
  await expect(
    page.getByText("Günlük plan okunamadı", { exact: true }),
  ).toBeVisible();
  expect(await snapshot(request)).toEqual(before);
  await page.unroute("**/api/notebook");
  await page.reload();
  await expect(
    page.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).not.toHaveValue("99");
  expect(await snapshot(request)).toEqual(before);
});

test("two real windows reject a stale write and recover by reloading without merging", async ({
  page,
  context,
  request,
}) => {
  const second = await context.newPage();
  await Promise.all([page.goto("/"), second.goto("/")]);
  await expect(
    second.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Günlük yeni kelime hedefi", { exact: true }).fill("7");
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot(request)).data.studyPreferences?.dailyNewWordGoal,
    )
    .toBe(7);
  const first = await snapshot(request);
  await second
    .getByLabel("Günlük yeni kelime hedefi", { exact: true })
    .fill("8");
  await second
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect(
    second.getByText(/Kaydedilemedi: Kayıtlar başka bir pencerede değişti/),
  ).toBeVisible();
  expect(await snapshot(request)).toEqual(first);
  await second.reload();
  await expect(
    second.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).toHaveValue("7");
  expect(await snapshot(request)).toEqual(first);
  await second.close();
});
