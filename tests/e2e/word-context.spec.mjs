import { test, expect } from "@playwright/test";
import { notebookFixture } from "./fixture.mjs";
async function read(request) {
  return (await (await request.get("/api/notebook")).json()).data;
}
async function words(page) {
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
}
test.beforeEach(async ({ page, request }) => {
  const { revision } = await (await request.get("/api/notebook")).json();
  const data = notebookFixture();
  data.stories = [
    {
      id: "s1",
      title: "First source",
      text: "Never give up.",
      level: "A1",
      read: false,
    },
    {
      id: "s2",
      title: "Second source",
      text: "They give up their seats.",
      level: "B1",
      read: false,
    },
  ];
  data.words = [
    {
      id: "w",
      word: "give up",
      meaning: "vazgeçmek",
      type: "phrasal verb",
      synonyms: "",
      antonyms: "",
      example: "Never give up.",
      translation: "Asla vazgeçme.",
      storyId: "s1",
      storyIds: ["s1"],
      level: "B1",
      memorization: {
        addedOn: "2026-10-18",
        learnedOn: "2026-10-18",
        reviews: [],
      },
    },
  ];
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
  await page.route("**/api/words/lookup", (r) =>
    r.fulfill({
      json: { ...data.words[0], warnings: [], sources: "Test fixture" },
    }),
  );
  await page.clock.install({ time: new Date("2026-10-19T12:00:00+03:00") });
  await page.goto("/");
});
test("phrase selection preserves two sources, contextual meanings, type and tags across reload", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: /01.*Hikâyeler/ }).click();
  await page
    .getByRole("button", { name: "Second source", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kelime/ifade kaydet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "give kelimesini seç", exact: true })
    .click();
  await page
    .getByRole("button", { name: "up kelimesini seç", exact: true })
    .click();
  await expect(page.getByLabel("İngilizce kelime veya ifade *")).toHaveValue(
    "give up",
  );
  await expect(page.getByLabel("İlk anlamın örnek cümlesi")).toHaveValue(
    "Never give up.",
  );
  await page
    .getByLabel("Bu bağlamdaki anlam (isteğe bağlı)")
    .fill("yerini bırakmak");
  await page
    .getByLabel("Kelime etiketleri (virgülle ayır)")
    .fill("seyahat, günlük");
  await page
    .getByRole("radio", { name: "Eşdizim (collocation)", exact: true })
    .click();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect
    .poll(async () => (await read(request)).words[0].contexts?.length)
    .toBe(2);
  let d = await read(request);
  expect(d.words).toHaveLength(1);
  expect(d.words[0].type).toBe("collocation");
  expect(d.words[0].contexts.map((c) => c.storyId)).toEqual(["s1", "s2"]);
  expect(d.words[0].memorization.reviews).toEqual([]);
  await page.reload();
  await words(page);
  for (const query of ["seyahat", "their seats", "yerini bırakmak"]) {
    await page.getByLabel("Kelimelerde ara").fill(query);
    await expect(
      page.getByRole("button", { name: "give up", exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Kelime türü: Tüm türler", exact: true })
    .click();
  await page.getByRole("button", { name: /Eşdizim \(collocation\)/ }).click();
  await expect(
    page.getByRole("button", { name: "give up", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "give up", exact: true }).click();
  await expect(
    page.getByText("Kaynak: First source", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Kaynak: Second source", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Kaynak hikâyeyi aç: First source",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Never kelimesini seç", exact: true }),
  ).toBeVisible();
});
test("personal examples can be saved, edited, searched and used for cloze with a persistent review", async ({
  page,
  request,
}) => {
  await words(page);
  await page.getByRole("button", { name: "give up", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Kendi örneğimi ekle", exact: true })
    .click();
  await page
    .getByLabel("Kendi örnek cümlen *")
    .fill("I will give up my ticket.");
  await page
    .getByLabel("Örneğinin Türkçe çevirisi")
    .fill("Biletimi bırakacağım.");
  await page.getByLabel("Örneğin ait olduğu anlam").fill("biletini bırakmak");
  await page
    .getByRole("button", { name: "Örneği kaydet", exact: true })
    .click();
  await expect(
    page.getByText("Kişisel örnek kaydedildi.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bu örneği düzenle", exact: true })
    .click();
  await page.getByLabel("Kendi örnek cümlen *").fill("We give up our tickets.");
  await page
    .getByRole("button", { name: "Örneği kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).words[0].contexts?.at(-1).sentence)
    .toBe("We give up our tickets.");
  await page.reload();
  await words(page);
  await page.getByLabel("Kelimelerde ara").fill("our tickets");
  await expect(
    page.getByRole("button", { name: "give up", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kelime testleri", exact: true }).click();
  await page.getByRole("tab", { name: "Boşluk doldurma", exact: true }).click();
  await page
    .getByRole("button", { name: "Cümle 2 · Kendi örneğim", exact: true })
    .click();
  await expect(page.getByLabel("Test sorusu", { exact: true })).toHaveText(
    "We _____ our tickets.",
  );
  await page.getByLabel("Cevabın", { exact: true }).fill("GIVE UP");
  await page
    .getByRole("button", { name: "Cevabı kontrol et", exact: true })
    .click();
  await expect(
    page.getByText("Bu cümledeki anlam: biletini bırakmak", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hatırladım · Kaydet", exact: true })
    .click();
  await expect
    .poll(async () => (await read(request)).words[0].memorization.reviews)
    .toEqual(["2026-10-19"]);
  expect((await read(request)).words[0].contexts).toHaveLength(2);
});
