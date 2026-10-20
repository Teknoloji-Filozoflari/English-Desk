import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
test.use({ timezoneId: "Europe/Istanbul" });
const now = new Date("2026-10-19T12:00:00+03:00");
function fixture() {
  const d = notebookFixture();
  d.grammar = [
    {
      id: "grammar",
      title: "Present simple practice",
      body: "He / she / it ile fiile -s eklenir.",
      exercises: [
        {
          id: "choice",
          mode: "choice",
          prompt: "Doğru geniş zaman örneğini seç.",
          options: ["She reads.", "She read."],
          answer: "She reads.",
          explanation: "She üçüncü tekil şahıstır.",
        },
        {
          id: "complete",
          mode: "completion",
          prompt: "She _____ every day. (read)",
          options: [],
          answer: "reads",
          explanation: "Doğru çekim reads.",
        },
      ],
    },
  ];
  const exam = {
    id: "practice-test",
    exam: "YDS",
    collection: "osym",
    title: "Kişisel gramer sınavı",
    section: "Grammar",
    source: "Kişisel test",
    minutes: 5,
    questions: [
      {
        id: "q1",
        prompt: "She _____ a book.",
        passage: "",
        kind: "choice",
        options: ["reads", "read"],
        answer: "reads",
        explanation: "She ile reads kullanılır.",
      },
      {
        id: "q2",
        prompt: "Write the past of go.",
        passage: "",
        kind: "text",
        options: [],
        answer: "went",
        explanation: "Go fiilinin geçmişi went.",
      },
    ],
  };
  d.exams = {
    tests: [exam],
    attempts: [
      {
        id: "source",
        test: structuredClone(exam),
        mode: "exam",
        answers: { q1: "read" },
        flags: [],
        position: 0,
        elapsed: 30,
        finished: true,
        created: now.getTime() - 100000,
      },
    ],
  };
  return d;
}
async function read(request) {
  return (await (await request.get("/api/notebook")).json()).data;
}
async function seed(request, data) {
  const { revision } = await (await request.get("/api/notebook")).json();
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
}
async function grammar(page) {
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await page
    .getByRole("button", { name: "Gramer tekrarı çalış", exact: true })
    .click();
}
async function exams(page, tab = "Yanlışlarım") {
  await page.getByRole("tab", { name: /04.*Sınavlar/ }).click();
  await page.getByRole("button", { name: tab, exact: true }).click();
}
async function doubleClick(locator) {
  await locator.evaluate((button) => {
    button.click();
    button.click();
  });
}
test.beforeEach(async ({ page, request }) => {
  await seed(request, fixture());
  await page.clock.install({ time: now });
  await page.goto("/");
});

for (const [mode, prompt, correct, wrong] of [
  [
    "Kuralı hatırla",
    "Present simple practice: kuralı ve kullanımını hatırla.",
    null,
    null,
  ],
  [
    "Uygun örneği seç",
    "Doğru geniş zaman örneğini seç.",
    "She reads.",
    "She read.",
  ],
  ["Cümle tamamla", "She _____ every day. (read)", " READS ", "read"],
]) {
  test(`${mode}: wrong feedback, successful retry and reload preserve the original exam`, async ({
    page,
    request,
  }) => {
    const before = await read(request);
    await grammar(page);
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByLabel("Çalışma sorusu", { exact: true })).toHaveText(
      prompt,
    );
    if (mode === "Uygun örneği seç")
      await page.getByRole("button", { name: wrong, exact: true }).click();
    if (mode === "Cümle tamamla")
      await page.getByLabel("Çalışma cevabın", { exact: true }).fill(wrong);
    await page
      .getByRole("button", {
        name:
          mode === "Kuralı hatırla"
            ? "Kuralı göster"
            : "Çalışma cevabını kontrol et",
        exact: true,
      })
      .click();
    expect((await read(request)).learning).toBeUndefined();
    if (mode !== "Kuralı hatırla")
      await expect(
        page.getByText("Yanlış cevap. Açıklamayı incele.", { exact: true }),
      ).toBeVisible();
    await doubleClick(
      page.getByRole("button", {
        name:
          mode === "Kuralı hatırla"
            ? "Kuralı hatırlamadım · Kaydet"
            : "Cevabı kaydet · Sonraki soru",
        exact: true,
      }),
    );
    await expect
      .poll(async () => (await read(request)).learning?.grammarHistory.length)
      .toBe(1);
    expect((await read(request)).learning.grammarHistory[0].correct).toBe(
      false,
    );
    await page
      .getByRole("button", { name: "Gramer turunu yenile", exact: true })
      .click();
    if (mode === "Uygun örneği seç")
      await page.getByRole("button", { name: correct, exact: true }).click();
    if (mode === "Cümle tamamla")
      await page.getByLabel("Çalışma cevabın", { exact: true }).fill(correct);
    await page
      .getByRole("button", {
        name:
          mode === "Kuralı hatırla"
            ? "Kuralı göster"
            : "Çalışma cevabını kontrol et",
        exact: true,
      })
      .click();
    await doubleClick(
      page.getByRole("button", {
        name:
          mode === "Kuralı hatırla"
            ? "Kuralı hatırladım · Kaydet"
            : "Cevabı kaydet · Sonraki soru",
        exact: true,
      }),
    );
    await expect
      .poll(async () => (await read(request)).learning?.grammarHistory.length)
      .toBe(2);
    await page.reload();
    await grammar(page);
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(
      page.getByText("Bu modda bekleyen gramer kartı yok", { exact: true }),
    ).toBeVisible();
    const after = await read(request);
    expect(after.exams).toEqual(before.exams);
    expect(after.words).toEqual(before.words);
    expect(after.learning.mistakeHistory).toEqual([]);
  });
}
test("authored grammar exercises can be added and edited with the actual note and survive reload", async ({
  page,
  request,
}) => {
  await grammar(page);
  await page
    .getByRole("button", { name: "Gramer alıştırması hazırla", exact: true })
    .click();
  await page
    .getByLabel("Gramer alıştırma sorusu", { exact: true })
    .fill("Choose a habitual action.");
  await page
    .getByLabel("Gramer seçenekleri (her satıra bir seçenek)", { exact: true })
    .fill("I read daily.\nI reading daily.");
  await page
    .getByLabel("Gramer doğru cevabı", { exact: true })
    .fill("I read daily.");
  await page
    .getByLabel("Gramer cevap açıklaması", { exact: true })
    .fill("Geniş zaman alışkanlık belirtir.");
  await page
    .getByRole("button", { name: "Gramer alıştırmasını kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).grammar[0].exercises.length)
    .toBe(3);
  await page
    .getByRole("button", { name: "Gramer alıştırması hazırla", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Alıştırmayı düzenle: Choose a habitual action.",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Gramer cevap açıklaması", { exact: true })
    .fill("Düzenlenmiş açıklama.");
  await page
    .getByRole("button", { name: "Gramer alıştırmasını kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () => (await read(request)).grammar[0].exercises.at(-1).explanation,
    )
    .toBe("Düzenlenmiş açıklama.");
  await page.reload();
  await grammar(page);
  await page
    .getByRole("button", { name: "Gramer alıştırması hazırla", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Alıştırmayı düzenle: Choose a habitual action.",
      exact: true,
    }),
  ).toBeVisible();
  expect((await read(request)).grammar[0].body).toBe(fixture().grammar[0].body);
});
test("wrong choice and blank text questions are really re-solved; original scores and daily counters stay consistent", async ({
  page,
  request,
}) => {
  const before = await read(request);
  await exams(page);
  await page
    .getByRole("button", { name: "Yanlışları tekrar et", exact: true })
    .click();
  await expect(page.getByLabel("Çalışma sorusu", { exact: true })).toHaveText(
    "She _____ a book.",
  );
  await page.getByRole("button", { name: "reads", exact: true }).click();
  await page
    .getByRole("button", { name: "Çalışma cevabını kontrol et", exact: true })
    .click();
  expect((await read(request)).learning).toBeUndefined();
  await expect(
    page.getByText("She ile reads kullanılır.", { exact: true }),
  ).toBeVisible();
  await doubleClick(
    page.getByRole("button", {
      name: "Cevabı kaydet · Sonraki soru",
      exact: true,
    }),
  );
  await expect
    .poll(async () => (await read(request)).learning?.mistakeHistory.length)
    .toBe(1);
  await expect(page.getByLabel("Çalışma sorusu", { exact: true })).toHaveText(
    "Write the past of go.",
  );
  await page.getByLabel("Çalışma cevabın", { exact: true }).fill("WENT");
  await page
    .getByRole("button", { name: "Çalışma cevabını kontrol et", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cevabı kaydet · Sonraki soru", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).learning?.mistakeHistory.length)
    .toBe(2);
  await page.reload();
  await exams(page);
  await expect(
    page.getByText("Tekrar bekleyen yanlış soru yok", { exact: true }),
  ).toBeVisible();
  const after = await read(request);
  expect(after.exams).toEqual(before.exams);
  expect(after.learning.grammarHistory).toEqual([]);
  await page.getByRole("tab", { name: /Bugün/ }).click();
  await expect(
    page.getByLabel("Bekleyen yanlış soru sayısı", { exact: true }),
  ).toHaveText("0");
});
test("a failed review save retains feedback for retry and never changes the source result", async ({
  page,
  request,
}) => {
  const before = await read(request);
  await exams(page);
  await page
    .getByRole("button", { name: "Yanlışları tekrar et", exact: true })
    .click();
  await page.getByRole("button", { name: "read", exact: true }).click();
  await page
    .getByRole("button", { name: "Çalışma cevabını kontrol et", exact: true })
    .click();
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
    .getByRole("button", { name: "Cevabı kaydet · Sonraki soru", exact: true })
    .click();
  await expect(
    page.getByText(
      "Cevap kaydedilemedi veya soru değişti. Bilgiler korunuyor; yeniden deneyebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await read(request)).learning).toBeUndefined();
  await page
    .getByRole("button", { name: "Cevabı kaydet · Sonraki soru", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).learning?.mistakeHistory.length)
    .toBe(1);
  const after = await read(request);
  expect(after.learning.mistakeHistory[0].correct).toBe(false);
  expect(after.exams).toEqual(before.exams);
  await page
    .getByRole("button", { name: "Yanlış soru havuzuna dön", exact: true })
    .click();
  await expect(
    page.getByText("2 soru tekrar bekliyor.", { exact: true }),
  ).toBeVisible();
});
test("weekly mixed exam resumes from its saved question, finishes under separate histories and creates a fresh next week", async ({
  page,
  request,
}) => {
  const before = await read(request);
  await exams(page, "Haftalık karma");
  await page
    .getByRole("button", {
      name: "Bu haftanın mini sınavını başlat",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await read(request)).learning?.weekly.length)
    .toBe(1);
  const session = (await read(request)).learning.weekly[0];
  expect(session.cards).toHaveLength(5);
  for (let index = 0; index < session.cards.length; index++) {
    const card = session.cards[index];
    await expect(page.getByLabel("Çalışma sorusu", { exact: true })).toHaveText(
      card.prompt,
    );
    if (card.mode === "recall")
      await page
        .getByRole("button", { name: "Kuralı göster", exact: true })
        .click();
    else {
      if (card.options.length)
        await page
          .getByRole("button", { name: card.answer, exact: true })
          .click();
      else
        await page
          .getByLabel("Çalışma cevabın", { exact: true })
          .fill(card.answer);
      await page
        .getByRole("button", {
          name: "Çalışma cevabını kontrol et",
          exact: true,
        })
        .click();
    }
    await doubleClick(
      page.getByRole("button", {
        name:
          card.mode === "recall"
            ? "Kuralı hatırladım · Kaydet"
            : "Cevabı kaydet · Sonraki soru",
        exact: true,
      }),
    );
    await expect
      .poll(async () => (await read(request)).learning.weekly[0].answers.length)
      .toBe(index + 1);
    if (index === 0) {
      await page.reload();
      await exams(page, "Haftalık karma");
      await expect(
        page.getByLabel("Haftalık sınav ilerlemesi", { exact: true }),
      ).toHaveText("1 / 5 cevap kaydedildi");
    }
  }
  await expect(
    page.getByText("Haftalık mini sınav tamamlandı", { exact: true }),
  ).toBeVisible();
  const after = await read(request);
  expect(after.learning.grammarHistory).toHaveLength(3);
  expect(after.learning.mistakeHistory).toHaveLength(2);
  expect(after.exams).toEqual(before.exams);
  await page.clock.setFixedTime(new Date("2026-10-26T12:00:00+03:00"));
  await page.clock.runFor(30001);
  await page
    .getByRole("button", {
      name: "Bu haftanın mini sınavını başlat",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await read(request)).learning.weekly.length)
    .toBe(2);
});
test("empty sources show useful states and never generate a fake weekly exam", async ({
  page,
  request,
}) => {
  const d = notebookFixture();
  d.grammar = [];
  d.exams = { tests: [], attempts: [] };
  await seed(request, d);
  await page.reload();
  await grammar(page);
  await expect(
    page.getByText("Bu modda bekleyen gramer kartı yok", { exact: true }),
  ).toBeVisible();
  await exams(page);
  await expect(
    page.getByText("Tekrar bekleyen yanlış soru yok", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Haftalık karma", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Bu haftanın mini sınavını başlat",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Önce kişisel gramer notu ekle veya bir sınav tamamla.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await read(request)).learning).toBeUndefined();
});
