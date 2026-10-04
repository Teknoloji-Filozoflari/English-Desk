import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
async function saved(request) {
  return (await request.get("/api/notebook")).json();
}
async function createTopic(page, name) {
  await page
    .getByRole("button", { name: "Alt başlıkları yönet", exact: true })
    .click();
  await page.getByLabel("Alt başlık adı", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "+ Alt başlık oluştur", exact: true })
    .click();
  await expect(page.getByLabel("Alt başlık adı", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
}
test.beforeEach(async ({ page, request }) => {
  const { revision } = await saved(request);
  const data = notebookFixture();
  data.exams.attempts = [
    {
      id: "attempt",
      test: data.exams.tests[0],
      mode: "study",
      answers: { q1: "book" },
      flags: ["q2"],
      position: 1,
      elapsed: 12,
      finished: true,
      created: 100,
    },
  ];
  expect(
    (await request.put("/api/notebook", { data: { revision, data } })).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("tab", { name: /03.*Gramer/ })).toBeVisible();
});
test("custom grammar headings support creation, rename, note placement and deletion without losing notes", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await createTopic(page, "Bağlaçlar");
  await expect(
    page.getByRole("button", {
      name: "Gramer başlığı: Bağlaçlar",
      exact: true,
    }),
  ).toContainText("0 not");
  await page
    .getByRole("button", { name: "Gramer başlığı: English Tense", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Alt başlıkları yönet", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Gramer başlığı: Bağlaçlar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bağlaçlar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Konu ekle", exact: true }).click();
  await page.getByLabel("Not başlığı *", { exact: true }).fill("Although");
  await page.getByLabel("Notların *", { exact: true }).fill("Zıtlık bağlacı.");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect
    .poll(async () => (await saved(request)).data.grammar[0]?.topicId)
    .toBeTruthy();
  await expect(
    page.getByRole("button", {
      name: "Gramer başlığı: Bağlaçlar",
      exact: true,
    }),
  ).toContainText("1 not");
  await page.reload();
  await page.getByRole("tab", { name: /03.*Gramer/ }).click();
  await page
    .getByRole("button", { name: "Gramer alt başlık: Bağlaçlar", exact: true })
    .click();
  await expect(
    page.getByText("Zıtlık bağlacı.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Alt başlıkları yönet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adını değiştir", exact: true })
    .click();
  await page
    .getByLabel("Alt başlık adı", { exact: true })
    .fill("Bağlaç notları");
  await page.getByRole("button", { name: "Adı kaydet", exact: true }).click();
  await expect(page.getByLabel("Alt başlık adı")).toHaveValue("");
  await page
    .getByRole("button", {
      name: "Bağlaç notları alt başlığını sil",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect((await saved(request)).data.grammarTopics).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Bağlaç notları alt başlığını sil",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Başlığı sil", exact: true }).click();
  await expect
    .poll(async () => (await saved(request)).data.grammarTopics.length)
    .toBe(0);
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(
    page.getByText("Zıtlık bağlacı.", { exact: true }),
  ).toBeVisible();
  expect((await saved(request)).data.grammar[0].topicId).toBeUndefined();
});
test("exam sidebar headings accept custom test placement and built-in deletion preserves results", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: /04.*Sınavlar/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Sınavlar alt başlık: IELTS",
      exact: true,
    }),
  ).toBeVisible();
  await createTopic(page, "Haftalık denemeler");
  await page
    .getByRole("button", { name: "Sınavlar alt başlık: ÖSYM", exact: true })
    .click();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page
    .getByRole("radio", {
      name: "Test alt başlığı: Haftalık denemeler",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Kontrol et ve kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(request)).data.exams.tests[0].topicId)
    .toBeTruthy();
  await expect(
    page.getByText("Tarayıcı test sınavı", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /04.*Sınavlar/ }).click();
  await page
    .getByRole("button", {
      name: "Sınavlar alt başlık: Haftalık denemeler",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Tarayıcı test sınavı", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Alt başlıkları yönet", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Haftalık denemeler alt başlığını sil",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Başlığı sil", exact: true }).click();
  await expect
    .poll(async () => (await saved(request)).data.exams.tests[0].topicId)
    .toBe("");
  await page
    .getByRole("button", { name: "ÖSYM alt başlığını sil", exact: true })
    .click();
  await page.getByRole("button", { name: "Başlığı sil", exact: true }).click();
  await expect
    .poll(async () =>
      (await saved(request)).data.exams.topics.some((t) => t.id === "osym"),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  const data = (await saved(request)).data;
  expect(data.exams.attempts[0].answers).toEqual({ q1: "book" });
  expect(data.exams.attempts[0].test.topicId).toBe("");
  await page
    .getByRole("button", { name: "Geçmiş sonuçlar", exact: true })
    .click();
  await expect(
    page.getByText("Tarayıcı test sınavı", { exact: true }),
  ).toBeVisible();
});

for (const [card, section, field, topic] of [
  ["English Tense", "tenses", "tense", "Present Simple"],
  ["Modality", "modality", "modality", "3.1 Ability (yetenek)"],
]) {
  test(`${card} supports confirmed note deletion and removable topic headings`, async ({
    page,
    request,
  }) => {
    let current = await saved(request);
    current.data.grammar = [
      {
        id: "guide-note",
        title: "Kişisel deneme notu",
        body: "Silme testi",
        [field]: topic,
      },
    ];
    expect(
      (
        await request.put("/api/notebook", {
          data: { revision: current.revision, data: current.data },
        })
      ).ok(),
    ).toBeTruthy();
    async function open() {
      await page.reload();
      await page.getByRole("tab", { name: /03.*Gramer/ }).click();
      await page
        .getByRole("button", { name: `Gramer başlığı: ${card}`, exact: true })
        .click();
    }
    await open();
    await page
      .getByRole("button", {
        name: new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .filter({ hasText: topic })
      .first()
      .click();
    await page
      .getByRole("button", {
        name: "Kişisel deneme notu notunu sil",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
    expect((await saved(request)).data.grammar).toHaveLength(1);
    await page
      .getByRole("button", {
        name: "Kişisel deneme notu notunu sil",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Sil", exact: true }).click();
    await expect
      .poll(async () => (await saved(request)).data.grammar.length)
      .toBe(0);
    current = await saved(request);
    current.data.grammar = [
      {
        id: "remaining-note",
        title: "Korunan not",
        body: "Genel konulara taşınır",
        [field]: topic,
      },
    ];
    expect(
      (
        await request.put("/api/notebook", {
          data: { revision: current.revision, data: current.data },
        })
      ).ok(),
    ).toBeTruthy();
    await open();
    await page
      .getByRole("button", {
        name: new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .filter({ hasText: topic })
      .first()
      .click();
    await page
      .getByRole("button", { name: `${topic} konu başlığını sil`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Başlığı sil", exact: true })
      .click();
    await expect
      .poll(
        async () => (await saved(request)).data.hiddenGrammarTopics?.[section],
      )
      .toContain(topic);
    await open();
    await expect(
      page.getByRole("button", {
        name: `${topic} başlığını geri ekle`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Gramer başlığı: Genel konular",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Genel konulara taşınır", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Gramer başlığı: ${card}`, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `${topic} başlığını geri ekle`,
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () => (await saved(request)).data.hiddenGrammarTopics[section],
      )
      .toEqual([]);
  });
}
