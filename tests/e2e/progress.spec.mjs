import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
import {
  grammarCards,
  recordLearning,
  historyStamp,
} from "../../src/learning.ts";
test.use({ timezoneId: "Europe/Istanbul" });
const now = new Date("2026-10-19T12:00:00+03:00");
function fixture() {
  let d = notebookFixture();
  d.words = [
    {
      id: "w",
      word: "remember",
      meaning: "hatırlamak",
      type: "verb",
      synonyms: "",
      antonyms: "",
      example: "I remember.",
      translation: "",
      storyId: "",
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
      answerHistory: [
        {
          id: "miss1",
          day: "2026-10-19",
          outcome: "again",
          activity: "review",
          engine: "memory",
        },
        {
          id: "miss2",
          day: "2026-10-19",
          outcome: "again",
          activity: "review",
          engine: "memory",
        },
      ],
    },
    {
      id: "phrase",
      word: "give up",
      meaning: "vazgeçmek",
      type: "phrasal verb",
      synonyms: "",
      antonyms: "",
      example: "Do not give up.",
      translation: "",
      storyId: "",
    },
  ];
  d.grammar = [
    {
      id: "g",
      title: "Present simple progress",
      body: "She ile geniş zamanda reads kullanılır.",
      exercises: [
        {
          id: "choice",
          mode: "choice",
          prompt: "Doğru örneği seç.",
          options: ["She reads.", "She read."],
          answer: "She reads.",
          explanation: "Üçüncü tekil şahıs.",
        },
      ],
    },
  ];
  const cards = grammarCards(d);
  d = recordLearning(
    d,
    cards[0],
    "",
    false,
    "grammar-miss",
    historyStamp(d, cards[0]),
    now.getTime(),
  );
  d = recordLearning(
    d,
    cards[1],
    "She reads.",
    true,
    "grammar-right",
    historyStamp(d, cards[1]),
    now.getTime(),
  );
  const t = {
    id: "t",
    exam: "YDS",
    collection: "osym",
    title: "Progress exam",
    section: "Grammar",
    source: "Personal",
    minutes: 5,
    questions: [
      {
        id: "q",
        prompt: "She _____ a book.",
        passage: "",
        kind: "choice",
        options: ["reads", "read"],
        answer: "reads",
        explanation: "Use reads.",
      },
    ],
  };
  d.exams = {
    tests: [t],
    attempts: [
      {
        id: "a",
        test: t,
        mode: "exam",
        answers: { q: "read" },
        flags: [],
        position: 0,
        elapsed: 125,
        finished: true,
        created: now.getTime() - 10000,
        completedAt: now.getTime() - 1000,
      },
    ],
  };
  return d;
}
async function read(request) {
  return (await (await request.get("/api/notebook")).json()).data;
}
async function seed(request, d) {
  const { revision } = await (await request.get("/api/notebook")).json();
  expect(
    (await request.put("/api/notebook", { data: { data: d, revision } })).ok(),
  ).toBeTruthy();
}
async function progress(page) {
  await page
    .getByRole("button", { name: "İlerlemem · İstatistikleri aç", exact: true })
    .click();
}
test.beforeEach(async ({ page, request }) => {
  await seed(request, fixture());
  await page.clock.install({ time: now });
  await page.goto("/");
});
test("real records produce honest learning, review, answer, exam and duration metrics with working shortcuts", async ({
  page,
  request,
}) => {
  await progress(page);
  for (const [label, value] of [
    ["Toplam kelime ve ifade", "2"],
    ["İlk öğrenme kaydı olan", "1"],
    ["Başarılı tekrarı bulunan", "0"],
    ["Öğrenme kaydı bekleyen", "1"],
    ["Bugün kaydedilen tekrar", "4"],
    ["Bu hafta kaydedilen tekrar", "4"],
    ["Tüm kayıtlı cevaplarda başarı", "%25 · 1/4"],
    ["Cevap anahtarıyla doğrulanan", "%100 · 1/1"],
    ["Tamamlanan kişisel sınav", "1"],
    ["Kaydedilmiş sınav süresi", "2 dk 5 sn"],
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveText(value);
  await page
    .getByRole("button", {
      name: "Zorlandığım kelimeyi aç: remember",
      exact: true,
    })
    .click();
  await expect(page.getByText("hatırlamak", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Kelime kartını kapat", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Zorlandığım gramer notunu aç: Present simple progress",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("She ile geniş zamanda reads kullanılır.", { exact: true }),
  ).toBeVisible();
  expect((await read(request)).exams).toEqual(fixture().exams);
});
test("weekly goal changes survive reload and daily goal changes preserve the independent weekly goal", async ({
  page,
  request,
}) => {
  await progress(page);
  await page
    .getByLabel("Haftalık başarılı tekrar hedefin", { exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Haftalık hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Haftalık tekrar hedefi kaydedildi.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Haftalık başarılı tekrar hedefi", { exact: true }),
  ).toHaveText("1 / 2");
  await page.reload();
  await progress(page);
  await expect(
    page.getByLabel("Haftalık başarılı tekrar hedefin", { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "Bugünkü plana dön", exact: true })
    .click();
  await page.getByLabel("Günlük yeni kelime hedefi", { exact: true }).fill("7");
  await page
    .getByRole("button", { name: "Hedefi kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).studyPreferences?.dailyNewWordGoal)
    .toBe(7);
  expect((await read(request)).studyPreferences.weeklyReviewGoal).toBe(2);
  await progress(page);
  await expect(
    page.getByLabel("Bugünkü öğrenme hedefi", { exact: true }),
  ).toHaveText("0 / 7");
});
test("duplicate imported copies and unstudied items do not inflate reports across reload", async ({
  page,
  request,
}) => {
  const d = fixture();
  d.words.push({
    ...structuredClone(d.words[0]),
    id: "duplicate-word",
    word: " REMEMBER ",
  });
  d.exams.attempts.push({
    ...structuredClone(d.exams.attempts[0]),
    id: "duplicate-exam",
  });
  d.learning.grammarHistory.push({
    ...structuredClone(d.learning.grammarHistory[0]),
    id: "duplicate-event",
  });
  await seed(request, d);
  await page.reload();
  await progress(page);
  await expect(
    page.getByLabel("Toplam kelime ve ifade", { exact: true }),
  ).toHaveText("2");
  await expect(
    page.getByLabel("Bugün kaydedilen tekrar", { exact: true }),
  ).toHaveText("4");
  await expect(
    page.getByLabel("Tamamlanan kişisel sınav", { exact: true }),
  ).toHaveText("1");
  await expect(
    page.getByLabel("Kaydedilmiş sınav süresi", { exact: true }),
  ).toHaveText("2 dk 5 sn");
  await expect(
    page.getByLabel("Başarılı tekrarı bulunan", { exact: true }),
  ).toHaveText("0");
});
test("recording a real word review updates retention and success history while preserving its fixed plan", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await expect(page.getByLabel("Test sorusu", { exact: true })).toHaveText(
    "remember",
  );
  await page.getByRole("button", { name: "Kartı çevir", exact: true }).click();
  await page
    .getByRole("button", { name: "Hatırladım · Kaydet", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect
    .poll(async () => (await read(request)).words[0].answerHistory.length)
    .toBe(3);
  await page.getByRole("tab", { name: /Bugün/ }).click();
  await progress(page);
  await expect(
    page.getByLabel("Başarılı tekrarı bulunan", { exact: true }),
  ).toHaveText("1");
  await expect(
    page.getByLabel("Bugün kaydedilen tekrar", { exact: true }),
  ).toHaveText("5");
  await expect(
    page.getByLabel("Tüm kayıtlı cevaplarda başarı", { exact: true }),
  ).toHaveText("%40 · 2/5");
  expect((await read(request)).words[0].memorization).toEqual({
    addedOn: "2026-10-18",
    learnedOn: "2026-10-18",
    reviews: ["2026-10-19"],
  });
});
test("invalid and failed weekly goal saves leave the persisted target intact", async ({
  page,
  request,
}) => {
  await progress(page);
  await page
    .getByLabel("Haftalık başarılı tekrar hedefin", { exact: true })
    .fill("-1");
  await page
    .getByRole("button", { name: "Haftalık hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Haftalık hedef için 0–1000 arasında tam sayı yaz.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await read(request)).studyPreferences).toBeUndefined();
  await page
    .getByLabel("Haftalık başarılı tekrar hedefin", { exact: true })
    .fill("9");
  let reject = true;
  await page.route("**/api/notebook", (route) => {
    if (route.request().method() === "PUT" && reject) {
      reject = false;
      return route.fulfill({
        status: 503,
        json: { error: "Temporary test failure" },
      });
    }
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Haftalık hedefi kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Haftalık tekrar hedefi kaydedildi.", { exact: true }),
  ).toHaveCount(0);
  expect((await read(request)).studyPreferences).toBeUndefined();
  await page
    .getByRole("button", { name: "Haftalık hedefi kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).studyPreferences?.weeklyReviewGoal)
    .toBe(9);
});
test("midnight refreshes daily counts and empty data never shows fabricated success percentages", async ({
  page,
  request,
}) => {
  await progress(page);
  await page.clock.setFixedTime(new Date("2026-10-20T00:00:01+03:00"));
  await page.clock.runFor(30001);
  await expect(
    page.getByLabel("Bugün kaydedilen tekrar", { exact: true }),
  ).toHaveText("0");
  await expect(
    page.getByLabel("Bu hafta kaydedilen tekrar", { exact: true }),
  ).toHaveText("4");
  const d = notebookFixture();
  d.words = [];
  d.grammar = [];
  d.exams = { tests: [], attempts: [] };
  await seed(request, d);
  await page.reload();
  await progress(page);
  await expect(
    page.getByLabel("Toplam kelime ve ifade", { exact: true }),
  ).toHaveText("0");
  await expect(
    page.getByLabel("Tüm kayıtlı cevaplarda başarı", { exact: true }),
  ).toHaveText("Henüz veri yok");
  await expect(
    page.getByLabel("Kaydedilmiş sınav süresi", { exact: true }),
  ).toHaveText("0 dk 0 sn");
});
