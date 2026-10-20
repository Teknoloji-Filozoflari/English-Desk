import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
import { emptyNotebook } from "../../src/backup-core.ts";
import { exampleTests } from "../../src/exams.ts";
test.use({ timezoneId: "Europe/Istanbul" });
const time = new Date("2026-10-19T12:00:00+03:00");
const word = (id, label) => ({
  id,
  word: label,
  meaning: "anlam",
  type: "noun",
  synonyms: "",
  antonyms: "",
  example: "",
  translation: "",
  storyId: "",
});
async function saved(request) {
  return (await (await request.get("/api/notebook")).json()).data;
}
async function seed(request, data) {
  const { revision } = await (await request.get("/api/notebook")).json();
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
}
function fixture() {
  const data = notebookFixture();
  data.studyPreferences = { dailyNewWordGoal: 1 };
  data.words = [
    {
      ...word("m", "remember"),
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
    },
    {
      ...word("r", "review"),
      review: { due: time.getTime() - 1000, interval: 1, repetitions: 1 },
    },
    {
      ...word("n", "new"),
      memorization: { addedOn: "2026-10-19", reviews: [] },
    },
  ];
  data.grammar = [
    { id: "g", title: "Kendi gramer notum", body: "Personal notes." },
  ];
  data.exams.attempts = [
    {
      id: "a",
      test: data.exams.tests[0],
      mode: "exam",
      answers: { q1: "garden" },
      flags: [],
      position: 0,
      elapsed: 10,
      finished: true,
      created: 1,
    },
  ];
  return data;
}
async function home(page) {
  await page.getByRole("tab", { name: /00.*Bugün/ }).click();
}
test.beforeEach(async ({ page, request }) => {
  await seed(request, fixture());
  await page.clock.install({ time });
  await page.goto("/");
});

test("daily home counts real data, requires saved answers, and preserves goal and progress after restart", async ({
  page,
  request,
}) => {
  await expect(page.getByRole("tab", { name: /00.*Bugün/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Kalan tekrar", { exact: true })).toHaveText(
    "2",
  );
  await expect(
    page.getByLabel("Tamamlanan tekrar", { exact: true }),
  ).toHaveText("0");
  await expect(page.getByLabel("Yeni öğrenilen", { exact: true })).toHaveText(
    "0 / 1",
  );
  await expect(page.getByLabel("Tahmini süre", { exact: true })).toHaveText(
    "3 dk",
  );
  await page.screenshot({
    path: test.info().outputPath("daily-home.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ezber tekrarlarını aç · 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await home(page);
  await expect(
    page.getByLabel("Tamamlanan tekrar", { exact: true }),
  ).toHaveText("0");
  await page
    .getByRole("button", { name: "Ezber tekrarlarını aç · 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hatırladım · Tekrarı kaydet", exact: true })
    .click();
  await home(page);
  await expect(page.getByLabel("Kalan tekrar", { exact: true })).toHaveText(
    "1",
  );
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "33",
  );
  await page
    .getByRole("button", { name: "Tekrar et alanını aç · 1", exact: true })
    .click();
  await expect(page.getByText("review", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page.getByRole("button", { name: "Bildim", exact: true }).click();
  await home(page);
  await expect(
    page.getByLabel("Tamamlanan tekrar", { exact: true }),
  ).toHaveText("2");
  await page
    .getByRole("button", { name: "Ezberlenecekleri aç", exact: true })
    .click();
  await expect(page.getByText("new", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Anlamı göster", exact: true })
    .click();
  await page.getByRole("button", { name: "Ezberledim", exact: true }).click();
  await home(page);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByLabel("Günlük yeni kelime hedefi", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Günlük hedef kaydedildi.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "75",
  );
  await page.reload();
  await expect(
    page.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).toHaveValue("2");
  await expect(
    page.getByLabel("Tamamlanan tekrar", { exact: true }),
  ).toHaveText("2");
  await expect(page.getByLabel("Yeni öğrenilen", { exact: true })).toHaveText(
    "1 / 2",
  );
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "75",
  );
  expect((await saved(request)).words[1].studyActivity.lastReviewedOn).toBe(
    "2026-10-19",
  );
});

test("shortcuts open the actual story, grammar topic and unresolved questions", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Oku: A quiet morning", exact: true })
    .click();
  await expect(
    page.getByText("A quiet morning", { exact: true }),
  ).toBeVisible();
  await home(page);
  await page
    .getByRole("button", { name: "Kendi gramer notum", exact: true })
    .click();
  await expect(
    page.getByText("Personal notes.", { exact: true }),
  ).toBeVisible();
  await home(page);
  await expect(
    page.getByLabel("Bekleyen yanlış soru sayısı", { exact: true }),
  ).toHaveText("2");
  await page
    .getByRole("button", { name: "Tarayıcı test sınavı · 2 soru", exact: true })
    .click();
  await expect(
    page.getByText("2 soru tekrar bekliyor.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yanlışları tekrar et", exact: true }),
  ).toBeVisible();
  await home(page);
  await page
    .getByRole("button", { name: "Hikâye kütüphanesi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "A quiet morning", exact: true }),
  ).toBeVisible();
});

test("invalid goals and a failed save never replace the persisted goal", async ({
  page,
  request,
}) => {
  await page
    .getByLabel("Günlük yeni kelime hedefi", { exact: true })
    .fill("-1");
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("0–100 arasında bir tam sayı yaz.", { exact: true }),
  ).toBeVisible();
  expect((await saved(request)).studyPreferences.dailyNewWordGoal).toBe(1);
  await page.route("**/api/notebook", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { error: "Hedef test hatası" } })
      : route.continue(),
  );
  await page.getByLabel("Günlük yeni kelime hedefi", { exact: true }).fill("7");
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Kaydedilemedi: Hedef test hatası", { exact: true }),
  ).toBeVisible();
  expect((await saved(request)).studyPreferences.dailyNewWordGoal).toBe(1);
  await page.reload();
  await expect(
    page.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).toHaveValue("1");
});

test("empty and sample-only data shows zero live counts and useful starting actions", async ({
  page,
  request,
}) => {
  const sample = emptyNotebook();
  sample.stories = [
    {
      id: "sample",
      title: "Demo",
      text: "Demo.",
      level: "A1",
      read: false,
      sample: true,
    },
  ];
  sample.words = [
    {
      ...word("demo", "demo"),
      storyId: "sample",
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
    },
  ];
  sample.exams = { tests: exampleTests(), attempts: [] };
  await seed(request, sample);
  await page.reload();
  await expect(
    page.getByText("İlk çalışma gününü başlat", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Kalan tekrar", { exact: true })).toHaveText(
    "0",
  );
  await expect(page.getByLabel("Tahmini süre", { exact: true })).toHaveText(
    "0 dk",
  );
  await expect(
    page.getByRole("button", { name: "Kelime eklemeye git", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("local midnight recomputes daily counts while retaining the saved goal", async ({
  page,
  request,
}) => {
  const notebook = emptyNotebook();
  notebook.studyPreferences = { dailyNewWordGoal: 1 };
  notebook.words = [
    {
      ...word("n", "new"),
      memorization: {
        addedOn: "2026-10-19",
        learnedOn: "2026-10-19",
        reviews: [],
      },
    },
  ];
  await seed(request, notebook);
  await page.reload();
  await expect(page.getByLabel("Yeni öğrenilen", { exact: true })).toHaveText(
    "1 / 1",
  );
  await page.clock.fastForward(12 * 3600000 + 1000);
  await expect(page.getByLabel("Yeni öğrenilen", { exact: true })).toHaveText(
    "0 / 1",
  );
  await expect(page.getByLabel("Kalan tekrar", { exact: true })).toHaveText(
    "1",
  );
  await expect(
    page.getByLabel("Günlük yeni kelime hedefi", { exact: true }),
  ).toHaveValue("1");
});
