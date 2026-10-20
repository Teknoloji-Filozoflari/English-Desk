import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { notebookFixture } from "./fixture.mjs";
import {
  decodeTransferBytes,
  parseWordTable,
  suggestMapping,
  planWordImport,
} from "../../src/word-transfer.ts";
function fixture() {
  const d = notebookFixture();
  d.words = [
    {
      id: "existing",
      word: "quiet",
      meaning: "sessiz",
      type: "adjective",
      synonyms: "",
      antonyms: "",
      example: "",
      translation: "",
      storyId: "story-test",
      level: "B1",
      tags: ["eski etiket"],
      review: { due: 1900000000000, interval: 3, repetitions: 2 },
      memorization: {
        addedOn: "2026-10-01",
        learnedOn: "2026-10-01",
        reviews: ["2026-10-02"],
      },
      answerHistory: [
        {
          id: "answer",
          day: "2026-10-02",
          outcome: "good",
          activity: "review",
          engine: "memory",
        },
      ],
      senses: [
        {
          meaning: "sakin",
          definition: "Calm.",
          example: "Keep quiet.",
          translation: "Sessiz ol.",
        },
      ],
    },
  ];
  return d;
}
async function snapshot(request) {
  return (await request.get("/api/notebook")).json();
}
async function seed(request, data) {
  const { revision } = await snapshot(request);
  expect(
    (await request.put("/api/notebook", { data: { data, revision } })).ok(),
  ).toBeTruthy();
}
async function upload(page, name, text) {
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", {
      name: /^(?:CSV \/ TSV dosyası seç|Başka kelime dosyası seç)$/,
    })
    .click();
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: name.endsWith(".csv") ? "text/csv" : "text/plain",
    buffer: Buffer.isBuffer(text) ? text : Buffer.from(text),
  });
}
async function preview(page) {
  await page
    .getByRole("button", { name: "Aktarım önizlemesini oluştur", exact: true })
    .click();
}
test.beforeEach(async ({ page, request }) => {
  await seed(request, fixture());
  await page.goto("/");
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page
    .getByRole("button", { name: "CSV / TSV aktarımı", exact: true })
    .click();
});
test("CSV preview reports adds, existing/file duplicates and invalid rows, then imports only after explicit confirmation", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(
    page,
    "kelimeler.csv",
    '\ufeffWord,Meaning,Example,Tags,Level,Type,Sentence translation\r\nquiet,yeni anlam,Quiet please.,yeni,B2,adjective,Sessiz ol.\r\ngive up,vazgeçmek,"Do not give up.\r\nTry again.","[""past simple"",""seyahat""]",B1,phrasal verb,Vazgeçme.\r\nGIVE UP,bırakmak,,,,phrasal verb,\r\n,anlam,,,,,\r\nbadlevel,anlam,,,B9,,\r\n',
  );
  await preview(page);
  await expect(
    page.getByLabel("Aktarım kayıt özeti", { exact: true }),
  ).toHaveText("1 eklenecek · 0 tamamlanacak · 2 atlanacak · 2 geçersiz");
  expect(await snapshot(request)).toEqual(before);
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(2);
  const after = await snapshot(request);
  expect(after.data.words[0]).toEqual(before.data.words[0]);
  expect(after.data.words[1]).toMatchObject({
    word: "give up",
    meaning: "vazgeçmek",
    tags: ["past simple", "seyahat"],
    level: "B1",
    example: "Do not give up.\r\nTry again.",
  });
  expect(after.data.words[1].memorization).toBeUndefined();
  expect(after.data.words[1].review).toBeUndefined();
  expect(after.data.stories).toEqual(before.data.stories);
  expect(after.data.exams).toEqual(before.data.exams);
  await page
    .getByRole("button", { name: "Kelime aktarımını kapat", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: /02.*Kelimelerim/ }).click();
  await page.getByRole("button", { name: "give up", exact: true }).click();
  await expect(page.getByText("vazgeçmek", { exact: true })).toBeVisible();
});
test("unknown headers can be mapped manually; changing a mapping invalidates the prior plan", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(
    page,
    "custom.csv",
    "Türkçe metin,English phrase,Example,Tags,Level\nçığlık,cry out,They cry out.,günlük,B1",
  );
  await page
    .getByRole("checkbox", { name: "İlk satır sütun başlığı", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Kelime sütunu: Alma", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Kelime eşleştir: Sütun 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Anlam sütunu: Alma", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Anlam eşleştir: Sütun 1", exact: true })
    .click();
  await preview(page);
  await expect(
    page.getByLabel("Aktarım kayıt özeti", { exact: true }),
  ).toHaveText("1 eklenecek · 0 tamamlanacak · 0 atlanacak · 0 geçersiz");
  expect(await snapshot(request)).toEqual(before);
  await page
    .getByRole("button", {
      name: "Anlam sütunu: 1 · Türkçe metin",
      exact: true,
    })
    .click();
  await page
    .getByRole("radio", { name: "Anlam eşleştir: Alma", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    }),
  ).toHaveCount(0);
  await preview(page);
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(2);
  const added = (await snapshot(request)).data.words[1];
  expect(added.word).toBe("cry out");
  expect(added.meaning).toBe("");
  expect(added.level).toBe("B1");
});
test("fill mode adds only empty fields and tags while preserving existing meaning and repetition history", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(
    page,
    "fill.tsv",
    "Word\tMeaning\tExample\tTags\tLevel\tType\tSentence translation\nquiet\tyeni anlam\tQuiet please.\tyeni\tB2\tadjective\tLütfen sessiz.",
  );
  await page
    .getByRole("button", {
      name: "Yalnız boş alanları ve etiketleri tamamla",
      exact: true,
    })
    .click();
  await preview(page);
  await expect(
    page.getByLabel("Aktarım kayıt özeti", { exact: true }),
  ).toHaveText("0 eklenecek · 1 tamamlanacak · 0 atlanacak · 0 geçersiz");
  expect(await snapshot(request)).toEqual(before);
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await snapshot(request)).data.words[0].example)
    .toBe("Quiet please.");
  const after = (await snapshot(request)).data.words[0],
    old = before.data.words[0];
  expect(after.meaning).toBe(old.meaning);
  expect(after.level).toBe("B1");
  expect(after.tags).toEqual(["eski etiket", "yeni"]);
  for (const key of [
    "review",
    "memorization",
    "answerHistory",
    "senses",
    "storyId",
  ])
    expect(after[key]).toEqual(old[key]);
});
test("canceling a preview leaves the entire notebook and revision unchanged", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(page, "cancel.csv", "Word,Meaning\nnew,anlam");
  await preview(page);
  await page
    .getByRole("button", { name: "Kelime aktarımını kapat", exact: true })
    .click();
  expect(await snapshot(request)).toEqual(before);
});
test("a failed import save leaves records intact and safely retries the same confirmed plan", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(page, "retry.csv", "Word,Meaning\nnew,anlam");
  await preview(page);
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
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Aktarım kaydedilemedi. Mevcut kartlar korundu; yeniden deneyebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await snapshot(request)).toEqual(before);
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(2);
});
test("a concurrent external edit invalidates the file revision instead of letting an old import overwrite it", async ({
  page,
  request,
}) => {
  await upload(page, "stale.csv", "Word,Meaning\nnew,anlam");
  await preview(page);
  const current = await snapshot(request);
  current.data.words[0].meaning = "Başka oturumda düzenlendi";
  expect(
    (
      await request.put("/api/notebook", {
        data: { data: current.data, revision: current.revision },
      })
    ).ok(),
  ).toBeTruthy();
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Aktarım kaydedilemedi. Mevcut kartlar korundu; yeniden deneyebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  const after = await snapshot(request);
  expect(after.data.words).toHaveLength(1);
  expect(after.data.words[0].meaning).toBe("Başka oturumda düzenlendi");
});
test("malformed UTF-8, broken CSV and APKG fail visibly without changing the notebook", async ({
  page,
  request,
}) => {
  const before = await snapshot(request);
  await upload(page, "invalid.csv", Buffer.from([0xff, 0xfe, 0x41, 0]));
  await expect(page.getByRole("alert")).toContainText("UTF-8");
  expect(await snapshot(request)).toEqual(before);
  await upload(page, "broken.csv", 'Word,Meaning\n"not closed,anlam');
  await expect(page.getByRole("alert")).toContainText("tırnak");
  await upload(page, "deck.apkg", "not a package");
  await expect(page.getByRole("alert")).toContainText(".apkg");
  expect(await snapshot(request)).toEqual(before);
});
test("Anki text headers and whitespace tags can be previewed and imported without claiming package support", async ({
  page,
  request,
}) => {
  await upload(
    page,
    "anki.txt",
    "#separator:Tab\n#html:false\n#columns:Front\tBack\tTags\nlook after\tilgilenmek\tgunluk phrasal::verb\n",
  );
  await preview(page);
  await expect(
    page.getByLabel("Aktarım kayıt özeti", { exact: true }),
  ).toHaveText("1 eklenecek · 0 tamamlanacak · 0 atlanacak · 0 geçersiz");
  await page
    .getByRole("button", {
      name: "Önizlemeyi onayla ve içe aktar",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await snapshot(request)).data.words.length)
    .toBe(2);
  expect((await snapshot(request)).data.words[1].tags).toEqual([
    "gunluk",
    "phrasal::verb",
  ]);
});
for (const format of ["csv", "tsv", "anki"])
  test(`${format} download contains valid text and does not alter the notebook`, async ({
    page,
    request,
  }) => {
    const before = await snapshot(request);
    await page
      .getByRole("button", {
        name:
          format === "anki"
            ? "Anki TSV hazırla"
            : `${format.toUpperCase()} hazırla`,
        exact: true,
      })
      .click();
    if (format === "anki")
      await expect(
        page.getByText(
          /kartın Anki etiketlerindeki boşluklar alt çizgiye dönüştürülür/,
        ),
      ).toBeVisible();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Hazırlanan kelime dosyasını kaydet",
        exact: true,
      })
      .click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`\\.${format === "csv" ? "csv" : "tsv"}$`),
    );
    const bytes = new Uint8Array(await readFile(await download.path()));
    expect(Array.from(bytes.slice(0, 3))).toEqual([239, 187, 191]);
    const table = parseWordTable(decodeTransferBytes(bytes));
    const plan = planWordImport({ ...before.data, words: [] }, table, {
      mapping: suggestMapping(table, table.headerSuggested),
      header: table.headerSuggested,
      duplicates: "skip",
      tags: table.anki ? "anki" : "auto",
    });
    expect(plan.added).toBe(1);
    expect(plan.rows[0].record.meaning).toBe("sessiz");
    expect(plan.rows[0].record.tags).toEqual(
      format === "anki" ? ["eski_etiket"] : ["eski etiket"],
    );
    expect(await snapshot(request)).toEqual(before);
  });
