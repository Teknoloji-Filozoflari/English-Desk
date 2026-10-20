import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkTransferFile,
  decodeTransferBytes,
  parseWordTable,
  tableColumns,
  suggestMapping,
  planWordImport,
  applyWordImport,
  exportWordTable,
  MAX_TRANSFER_BYTES,
} from "../src/word-transfer.ts";
import {
  emptyNotebook,
  makeBackup,
  parseBackup,
  planRestore,
  BACKUP_SECTIONS,
} from "../src/backup-core.ts";
import { validateNotebook } from "../src/model.ts";
import { progressReport } from "../src/progress.ts";
import { createStore } from "../scripts/notebook-store.mjs";
import {
  writeBackupArchive,
  readBackupArchive,
} from "../scripts/backup-archive.mjs";
let sequence = 0;
const uid = () => `import-${++sequence}`;
const card = (id = "w", word = "quiet") => ({
  id,
  word,
  meaning: "sessiz",
  type: "adjective",
  synonyms: "",
  antonyms: "",
  example: "The garden is quiet.",
  translation: "Bahçe sessiz.",
  storyId: "",
  level: "B1",
  tags: ["eski etiket"],
  review: { due: 1800000000000, interval: 7, repetitions: 3 },
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
});
const notebook = (words = []) => ({ ...emptyNotebook(), words });
const parse = (text) => parseWordTable(text);
const plan = (data, table, extra = {}) =>
  planWordImport(data, table, {
    mapping: suggestMapping(table, table.headerSuggested),
    header: table.headerSuggested,
    duplicates: "skip",
    tags: table.anki ? "anki" : "auto",
    ...extra,
  });
test("strict UTF-8 preserves Turkish, emoji and BOM and rejects invalid encodings rather than corrupting text", () => {
  const text = "Kelime,Anlam\r\nışık,İĞÜŞÖÇ ı 😀\r\n";
  assert.equal(
    decodeTransferBytes(new Uint8Array(Buffer.from("\ufeff" + text))),
    text,
  );
  for (const bytes of [
    [0xff, 0xfe, 0x41, 0],
    [0xc0, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe2, 0x82],
    [0x80],
    [0],
  ])
    assert.throws(() => decodeTransferBytes(Uint8Array.from(bytes)));
  assert.throws(() =>
    decodeTransferBytes(new Uint8Array(MAX_TRANSFER_BYTES + 1)),
  );
  assert.throws(() => decodeTransferBytes(new Uint8Array()));
});
test("only bounded text formats are accepted; APKG and spreadsheets are explicitly refused", () => {
  for (const name of ["words.CSV", "words.tsv", "anki.txt"])
    assert.doesNotThrow(() => checkTransferFile(name, 10));
  for (const name of ["deck.apkg", "words.xlsx", "backup.zip", "file.csv.exe"])
    assert.throws(() => checkTransferFile(name, 10));
  for (const size of [0, -1, NaN, MAX_TRANSFER_BYTES + 1])
    assert.throws(() => checkTransferFile("a.csv", size));
});
for (const separator of [",", "\t", ";"])
  test(`quoted ${JSON.stringify(separator)} fields preserve separators, CRLF, doubled quotes, blank cells and trailing fields`, () => {
    const text = `Word${separator}Meaning${separator}Example${separator}Tags${separator}Level\r\nquiet${separator}"sessiz${separator} sakin"${separator}"She said ""quiet"".\r\nKeep quiet."${separator}${separator}\r\n`;
    const table = parse(text);
    assert.equal(table.separator, separator);
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[1][1], `sessiz${separator} sakin`);
    assert.equal(table.rows[1][2], 'She said "quiet".\r\nKeep quiet.');
    assert.deepEqual(table.rows[1].slice(3), ["", ""]);
    const p = plan(notebook(), table);
    assert.equal(p.added, 1);
    assert.equal(p.rows[0].record.level, "");
  });
test("LF and CR row endings, missing cells and unequal column widths are visible and preserved safely", () => {
  for (const newline of ["\n", "\r"]) {
    const table = parse(
      `Word,Meaning,Example${newline}quiet,sessiz${newline}give up,vazgeçmek,Do not give up.,unused${newline}`,
    );
    assert.equal(table.rows.length, 3);
    assert.ok(table.warnings.some((w) => w.includes("sütun")));
    assert.equal(tableColumns(table, true).length, 4);
    const p = plan(notebook(), table);
    assert.equal(p.added, 2);
    assert.equal(p.rows[0].record.example, "");
  }
});
test("malformed quotes, binary content, too many fields and excessive record counts fail before any write", () => {
  for (const text of [
    'Word,Meaning\n"quiet,sessiz',
    'Word,Meaning\n"quiet"bad,sessiz',
    'Word,Meaning\nqu"iet,sessiz',
    "a\0,b",
    Array(66).fill("x").join(","),
    "word\n" + Array(10001).fill("quiet").join("\n"),
  ])
    assert.throws(() => parseWordTable(text, ","));
  assert.throws(() => parse(""));
  assert.throws(() => parse("#separator:Pipe\na|b"));
});
test("headerless Anki text directives are not imported as vocabulary and supply column names and global tags", () => {
  const table = parse(
    '#separator:Tab\r\n#html:true\r\n#columns:Front\tBack\tTags\r\n#tags:global_tag\r\n#deck:Example\r\n"#quiet"\t"<b>sessiz</b>"\t"günlük gramer::tense"\r\n',
  );
  assert.equal(table.rows.length, 1);
  assert.equal(table.headerSuggested, false);
  assert.equal(table.anki, true);
  assert.deepEqual(table.columns, ["Front", "Back", "Tags"]);
  const p = plan(notebook(), table);
  assert.equal(p.added, 1);
  assert.equal(p.rows[0].record.word, "#quiet");
  assert.equal(p.rows[0].record.meaning, "<b>sessiz</b>");
  assert.deepEqual(p.rows[0].record.tags, [
    "günlük",
    "gramer::tense",
    "global_tag",
  ]);
  assert.ok(table.warnings.some((w) => w.includes("HTML")));
});
test("Turkish and English header aliases map required and optional fields and manual mapping accepts unknown headings", () => {
  const table = parse(
    "İNGİLİZCE;TÜRKÇE;ÖRNEK CÜMLE;ETİKETLER;SEVİYE;KELİME TÜRÜ;CÜMLE ÇEVİRİSİ\nquiet;sessiz;Keep quiet.;tense;b1;adjective;Sessiz ol.",
  );
  assert.equal(table.headerSuggested, true);
  assert.deepEqual(suggestMapping(table, true), {
    word: 0,
    meaning: 1,
    example: 2,
    tags: 3,
    level: 4,
    type: 5,
    translation: 6,
  });
  const result = plan(notebook(), table);
  assert.equal(result.rows[0].record.level, "B1");
  assert.equal(result.rows[0].record.translation, "Sessiz ol.");
  const unknown = parse("Answer\tPrompt\ncevap\tword");
  const mapping = {
    word: 1,
    meaning: 0,
    example: null,
    tags: null,
    level: null,
    type: null,
    translation: null,
  };
  assert.equal(
    plan(notebook(), unknown, { mapping, header: true }).rows[0].record.word,
    "word",
  );
  assert.throws(() => plan(notebook(), unknown));
  assert.throws(() =>
    plan(notebook(), unknown, {
      mapping: { ...mapping, example: 1 },
      header: true,
    }),
  );
  assert.throws(() =>
    plan(notebook(), unknown, {
      mapping: { ...mapping, word: 99 },
      header: true,
    }),
  );
});
test("default duplicate policy preserves existing records byte-for-byte and skips repeats within the file", () => {
  const d = notebook([card()]),
    before = structuredClone(d);
  const table = parse(
    "Word,Meaning,Type\n QUIET ,değişen anlam,adjective\ngive up,vazgeçmek,phrasal verb\nGIVE   UP,bırakmak,phrasal verb",
  );
  const p = plan(d, table);
  assert.deepEqual(
    [p.added, p.matched, p.skipped, p.invalid, p.duplicates],
    [1, 0, 2, 0, 2],
  );
  assert.deepEqual(d, before);
  const applied = applyWordImport(d, p, uid);
  assert.deepEqual(applied.words[0], d.words[0]);
  assert.equal(applied.words.length, 2);
  assert.deepEqual(d, before);
  const repeat = plan(applied, table);
  assert.equal(repeat.added, 0);
  assert.equal(repeat.skipped, 3);
});
test("fill mode completes only empty fields and unions tags, preserving schedules, senses and source relations", () => {
  const w = card();
  w.example = "";
  w.translation = "";
  w.level = "";
  w.contexts = [
    {
      id: "context",
      kind: "personal",
      storyId: "",
      storyTitle: "",
      selection: "quiet",
      sentence: "Keep quiet.",
      meaning: "sakin",
      translation: "Sessiz ol.",
    },
  ];
  const d = notebook([w]),
    before = structuredClone(d);
  const table = parse(
    'Word,Meaning,Example,Tags,Level,Type,Sentence translation\nquiet,yeni anlam,"Quiet please.",yeni,B2,adjective,Lütfen sessiz.',
  );
  const p = plan(d, table, { duplicates: "fill" });
  assert.equal(p.matched, 1);
  assert.ok(p.rows[0].changes.includes("Örnek cümle"));
  assert.ok(!p.rows[0].changes.includes("Anlam"));
  const updated = applyWordImport(d, p, uid).words[0];
  assert.equal(updated.meaning, "sessiz");
  assert.equal(updated.example, "Quiet please.");
  assert.equal(updated.level, "B2");
  assert.deepEqual(updated.tags, ["eski etiket", "yeni"]);
  for (const key of [
    "memorization",
    "review",
    "answerHistory",
    "senses",
    "contexts",
  ])
    assert.deepEqual(updated[key], w[key]);
  assert.deepEqual(d, before);
});
test("repeated existing rows in fill mode use only the first valid row and leave invalid unions out of the transaction", () => {
  const w = card();
  w.example = "";
  const d = notebook([w]);
  let p = plan(
    d,
    parse("Word,Example\nquiet,First example.\nquiet,Second example."),
    { duplicates: "fill" },
  );
  assert.equal(p.matched, 1);
  assert.equal(p.skipped, 1);
  assert.equal(applyWordImport(d, p, uid).words[0].example, "First example.");
  d.words[0].tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  p = plan(
    d,
    parse(
      "Word,Example,Tags\nquiet,Invalid example.,overflow\nquiet,Valid example.,tag1",
    ),
    { duplicates: "fill" },
  );
  assert.equal(p.invalid, 1);
  assert.equal(p.matched, 1);
  assert.equal(applyWordImport(d, p, uid).words[0].example, "Valid example.");
});
test("a literal Anki tab separator and excessive global tags are handled before writing any rows", () => {
  const t = parse("#separator:\t\n#columns:Front\tBack\nquiet\tsessiz");
  assert.equal(plan(notebook(), t).added, 1);
  const bad = parse(
    "#tags:" +
      Array.from({ length: 21 }, (_, i) => `tag${i}`).join(" ") +
      "\nWord,Meaning\nquiet,sessiz",
  );
  assert.throws(() => plan(notebook(), bad));
});
test("inherited CEFR level is not silently replaced as an empty field", () => {
  const w = card();
  delete w.level;
  w.storyId = "story";
  const d = {
    ...notebook([w]),
    stories: [
      {
        id: "story",
        title: "Source",
        text: "Source story.",
        level: "A1",
        read: false,
      },
    ],
  };
  const p = plan(d, parse("Word,Level\nquiet,B2"), { duplicates: "fill" });
  assert.equal(p.matched, 0);
  assert.equal(p.skipped, 1);
  assert.equal(d.words[0].level, undefined);
});
test("different types remain distinct; ambiguous missing type is skipped and noncanonical types do not collide", () => {
  const d = notebook([
    { ...card("noun", "run"), type: "noun" },
    { ...card("verb", "run"), type: "verb" },
    { ...card("idiom", "thing"), type: "idiom" },
  ]);
  const p = plan(
    d,
    parse(
      "Word,Meaning,Type\nrun,koşmak,\nrun,koşu,noun\nrun,hareket,adverb\nthing,bir şey,abbreviation",
    ),
  );
  assert.deepEqual([p.added, p.skipped], [2, 2]);
  assert.ok(p.rows[0].reason.includes("Birden fazla"));
});
test("invalid rows have visible reasons; valid blank-meaning rows remain unlearned", () => {
  const d = notebook();
  const p = plan(
    d,
    parse(
      'Word,Meaning,Level,Tags\n,anlam,A1,\nquiet,sessiz,B9,\ngive up,,B1,günlük\nx,anlam,A1,"[not-json]"',
    ),
  );
  assert.equal(p.added, 1);
  assert.equal(p.invalid, 3);
  assert.ok(
    p.rows.filter((r) => r.status === "invalid").every((r) => r.reason),
  );
  const next = applyWordImport(d, p, uid);
  assert.equal(next.words[0].meaning, "");
  assert.equal(next.words[0].review, undefined);
  assert.equal(next.words[0].memorization, undefined);
  assert.equal(progressReport(next).learned, 0);
});
test("preview snapshots reject stale collections and a second application; errors are atomic", () => {
  const d = notebook(),
    p = plan(d, parse("Word,Meaning\na,b\nc,d"));
  const changed = notebook([card()]);
  assert.throws(() => applyWordImport(changed, p, uid));
  const applied = applyWordImport(d, p, uid);
  assert.throws(() => applyWordImport(applied, p, uid));
  assert.throws(() => applyWordImport(d, p, () => "same-id"));
  assert.equal(d.words.length, 0);
});
test("preview-only ID strings cannot overwrite existing unrelated records", () => {
  const d = notebook([card("transfer-preview-0", "unrelated")]);
  const p = plan(
    d,
    parse("Word,Meaning\nnewword,newmeaning\nnewword,secondmeaning"),
    { duplicates: "fill" },
  );
  assert.equal(p.added, 1);
  assert.equal(p.skipped, 1);
  const applied = applyWordImport(d, p, uid);
  assert.deepEqual(applied.words[0], d.words[0]);
  assert.equal(applied.words[1].meaning, "newmeaning");
});
for (const format of ["csv", "tsv"])
  test(`${format}: export/reimport preserves UTF-8, all selected fields, JSON tags with spaces, punctuation and multiline examples`, () => {
    const w = {
      ...card(),
      word: "#quiet",
      meaning: 'sessiz, "sakin"; huzurlu',
      example: 'She said "quiet".\r\nKeep quiet.\tNow.',
      tags: ["past simple", "a;b", "çığlık"],
      translation: '"Sessiz ol", dedi.\nBitti.',
    };
    const before = notebook([w]);
    const output = exportWordTable(before, format);
    assert.ok(output.text.startsWith("\ufeff"));
    assert.equal(output.extension, format);
    const decoded = decodeTransferBytes(
      new Uint8Array(Buffer.from(output.text)),
    );
    const table = parse(decoded);
    const after = applyWordImport(notebook(), plan(notebook(), table), uid)
      .words[0];
    for (const key of [
      "word",
      "meaning",
      "example",
      "tags",
      "level",
      "type",
      "translation",
    ])
      assert.deepEqual(after[key], w[key]);
    assert.equal(after.review, undefined);
    assert.equal(after.senses, undefined);
    assert.deepEqual(before.words[0], w);
  });
test("Anki TSV is explicitly text: headers and basic fields work while multiword tag conversion is warned and nonmutating", () => {
  const d = notebook([card()]),
    before = structuredClone(d);
  const output = exportWordTable(d, "anki");
  assert.ok(output.text.includes("#separator:Tab"));
  assert.ok(output.text.includes("#html:false"));
  assert.equal(output.warnings.length, 1);
  const table = parse(output.text),
    p = plan(notebook(), table);
  assert.equal(p.added, 1);
  assert.equal(p.rows[0].record.word, "quiet");
  assert.deepEqual(p.rows[0].record.tags, ["eski_etiket"]);
  assert.deepEqual(d, before);
});
test("only a header is a valid empty export; overlarge exports fail clearly rather than produce unreimportable files", () => {
  const output = exportWordTable(notebook(), "csv"),
    table = parse(output.text),
    p = plan(notebook(), table);
  assert.equal(p.added, 0);
  assert.equal(p.rows.length, 0);
  assert.equal(applyWordImport(notebook(), p, uid).words.length, 0);
  const w = card();
  w.example = "x".repeat(MAX_TRANSFER_BYTES);
  assert.throws(() => exportWordTable(notebook([w]), "csv"));
});
test("10,000-row planning is bounded and detects duplicates without quadratic full-collection scans", () => {
  const text =
    "Word,Meaning\n" +
    Array.from({ length: 10000 }, (_, i) => `word${i},anlam`).join("\n");
  const table = parse(text);
  const p = plan(notebook(), table);
  assert.equal(p.added, 10000);
  assert.equal(p.invalid, 0);
  const full = notebook(
    Array.from({ length: 10000 }, (_, i) => ({
      ...card(String(i), `word${i}`),
      type: "",
    })),
  );
  const repeats = plan(full, table);
  assert.equal(repeats.skipped, 10000);
  assert.equal(repeats.added, 0);
  assert.throws(() => plan(full, parse("Word,Meaning\nnew,anlam")));
});
test("imported data persists across store reopen and full JSON/ZIP backups remain lossless", async () => {
  const dir = await mkdtemp(join(tmpdir(), "word-transfer-"));
  try {
    const initial = notebook([card()]);
    initial.grammar = [{ id: "g", title: "Personal", body: "Original rule." }];
    const data = applyWordImport(
      initial,
      plan(
        initial,
        parse(
          'Word,Meaning,Example,Tags,Level\ngive up,vazgeçmek,Do not give up.,"[""past simple""]",B1',
        ),
      ),
      uid,
    );
    validateNotebook(data);
    const path = join(dir, "store");
    await createStore(path).save(data, null);
    assert.deepEqual((await createStore(path).read()).data.words, data.words);
    const bundle = parseBackup(
      JSON.parse(
        JSON.stringify(
          makeBackup(data, { sections: BACKUP_SECTIONS, includeAudio: false }),
        ),
      ),
    );
    assert.deepEqual(
      planRestore(
        emptyNotebook(),
        bundle,
        { sections: BACKUP_SECTIONS, mode: "replace" },
        [],
      ).data.words,
      data.words,
    );
    const file = join(dir, "backup.zip");
    await writeBackupArchive(file, bundle);
    const loaded = await readBackupArchive(file, join(dir, "stage"));
    assert.deepEqual(
      planRestore(
        emptyNotebook(),
        loaded.bundle,
        { sections: BACKUP_SECTIONS, mode: "replace" },
        [],
      ).data.words,
      data.words,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
