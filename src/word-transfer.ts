import {
  isLevel,
  validateNotebook,
  wordLevel,
  type Notebook,
  type Word,
} from "./model.ts";
import { normalizeWord } from "./word-enrichment.ts";
import { wordTypeKey } from "./word-types.ts";
import { validateWordTags } from "./word-context.ts";
export const MAX_TRANSFER_BYTES = 5_000_000,
  MAX_TRANSFER_ROWS = 10000,
  MAX_TRANSFER_COLUMNS = 64;
export type Separator = "," | "\t" | ";";
export const TRANSFER_FIELDS = [
  ["word", "Kelime"],
  ["meaning", "Anlam"],
  ["example", "Örnek cümle"],
  ["tags", "Etiket"],
  ["level", "Seviye"],
  ["type", "Kelime türü"],
  ["translation", "Cümle çevirisi"],
] as const;
export type TransferField = (typeof TRANSFER_FIELDS)[number][0];
export type ColumnMapping = Record<TransferField, number | null>;
export type ParsedTable = {
  rows: string[][];
  separator: Separator;
  warnings: string[];
  columns: string[];
  globalTags: string[];
  headerSuggested: boolean;
  anki: boolean;
};
export type TransferOptions = {
  mapping: ColumnMapping;
  header: boolean;
  duplicates: "skip" | "fill";
  tags: "auto" | "anki";
};
export type TransferRow = {
  row: number;
  word: string;
  status: "add" | "match" | "skip" | "invalid";
  reason: string;
  targetId?: string;
  record?: Word;
  changes?: string[];
};
export type TransferPlan = {
  rows: TransferRow[];
  added: number;
  matched: number;
  skipped: number;
  invalid: number;
  duplicates: number;
  signature: string;
};
const label = (field: TransferField) =>
  TRANSFER_FIELDS.find(([key]) => key === field)![1];
const normalizeHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<TransferField, string[]> = {
  word: [
    "word",
    "kelime",
    "ifade",
    "english",
    "ingilizce",
    "front",
    "on",
    "term",
  ],
  meaning: [
    "meaning",
    "anlam",
    "turkce",
    "translation",
    "back",
    "arka",
    "definition",
  ],
  example: [
    "example",
    "example sentence",
    "sentence",
    "ornek",
    "ornek cumle",
    "cumle",
  ],
  tags: ["tags", "tag", "etiket", "etiketler"],
  level: ["level", "seviye", "cefr"],
  type: ["type", "pos", "word type", "kelime turu", "tur"],
  translation: [
    "example translation",
    "sentence translation",
    "cumle cevirisi",
    "ornek cevirisi",
  ],
};
export function checkTransferFile(name: string, size: number) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (!["csv", "tsv", "txt"].includes(extension ?? ""))
    throw Error(
      "Yalnız CSV, TSV veya UTF-8 TXT metni seç. Anki .apkg paketleri ve Excel .xlsx desteklenmiyor.",
    );
  if (!Number.isFinite(size) || size <= 0 || size > MAX_TRANSFER_BYTES)
    throw Error("Kelime dosyası boş olmamalı ve en fazla 5 MB olmalı.");
}
// Strict UTF-8 decoding also works on native engines without TextDecoder.
export function decodeTransferBytes(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > MAX_TRANSFER_BYTES)
    throw Error("Kelime dosyası boş olmamalı ve en fazla 5 MB olmalı.");
  let part = "",
    parts: string[] = [];
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    let code = first,
      count = 0,
      min = 0;
    if (first >= 0xc2 && first <= 0xdf) {
      code = first & 31;
      count = 1;
      min = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      code = first & 15;
      count = 2;
      min = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      code = first & 7;
      count = 3;
      min = 0x10000;
    } else if (first >= 0x80)
      throw Error(
        "Dosya geçerli UTF-8 değil. UTF-8 biçiminde yeniden dışa aktar.",
      );
    for (let n = 0; n < count; n++) {
      const next = bytes[i++];
      if (next === undefined || (next & 0xc0) !== 0x80)
        throw Error(
          "Dosya geçerli UTF-8 değil. UTF-8 biçiminde yeniden dışa aktar.",
        );
      code = (code << 6) | (next & 63);
    }
    if (
      code < min ||
      code > 0x10ffff ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0
    )
      throw Error(
        "Dosya geçerli UTF-8 metni değil. UTF-8 biçiminde yeniden dışa aktar.",
      );
    part += String.fromCodePoint(code);
    if (part.length >= 8192) {
      parts.push(part);
      part = "";
    }
  }
  parts.push(part);
  return parts.join("").replace(/^\uFEFF/, "");
}
function delimited(
  text: string,
  separator: Separator,
): { rows: string[][]; comments: string[] } {
  const rows: string[][] = [],
    comments: string[] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1;
  function pushField() {
    row.push(field);
    field = "";
    closed = false;
    if (row.length > MAX_TRANSFER_COLUMNS)
      throw Error("Dosyada en fazla 64 sütun olabilir.");
  }
  function pushRow() {
    pushField();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > MAX_TRANSFER_ROWS + 1)
      throw Error("Bir dosyada en fazla 10.000 kelime satırı olabilir.");
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\0") throw Error("Dosyada geçersiz sıfır karakteri var.");
    if (!quoted && !closed && !row.length && !field && char === "#") {
      let end = i;
      while (end < text.length && !/[\r\n]/.test(text[end])) end++;
      comments.push(text.slice(i, end));
      i = end - 1;
      continue;
    }
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += char;
        if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line++;
      }
      continue;
    }
    if (char === separator) {
      pushField();
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      line++;
      startLine = line;
      continue;
    }
    if (closed)
      throw Error(`${line}. satırda kapanan tırnaktan sonra ayraç bekleniyor.`);
    if (char === '"') {
      if (field.length)
        throw Error(
          `${line}. satırda tırnak alanın başında olmalı. İç tırnakları çift yaz.`,
        );
      quoted = true;
      startLine = line;
    } else field += char;
  }
  if (quoted) throw Error(`${startLine}. satırdan başlayan tırnak kapanmamış.`);
  if (field.length || row.length || closed) pushRow();
  return { rows, comments };
}
export function parseWordTable(
  text: string,
  separator: Separator | "auto" = "auto",
): ParsedTable {
  if (text.length > MAX_TRANSFER_BYTES || !text.trim())
    throw Error("Kelime dosyası boş veya çok büyük.");
  text = text.replace(/^\uFEFF/, "");
  let specified: Separator | undefined;
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (!line.startsWith("#")) break;
    const found = line.match(/^#separator:(.*)$/i);
    if (found) {
      const value = found[1] === "\t" ? "tab" : found[1].trim().toLowerCase();
      specified = (
        {
          tab: "\t",
          comma: ",",
          semicolon: ";",
          "\t": "\t",
          ",": ",",
          ";": ";",
        } as Record<string, Separator>
      )[value];
      if (!specified)
        throw Error(
          "Bu Anki ayıracı desteklenmiyor. Virgül, noktalı virgül veya sekme ile dışa aktar.",
        );
    }
  }
  let chosen: Separator = separator === "auto" ? (specified ?? ",") : separator;
  if (separator === "auto" && !specified) {
    const candidates = ([",", "\t", ";"] as Separator[])
      .map((s) => {
        try {
          const parsed = delimited(text, s);
          const widths = parsed.rows.map((r) => r.length);
          const max = Math.max(0, ...widths);
          const same = widths.filter((w) => w === max).length;
          return {
            s,
            score:
              max > 1 ? (same / Math.max(1, widths.length)) * 100 + max : -1,
          };
        } catch {
          return { s, score: -2 };
        }
      })
      .sort((a, b) => b.score - a.score);
    chosen = candidates[0].s;
  }
  const { rows, comments } = delimited(text, chosen);
  if (!rows.length) throw Error("Dosyada kelime satırı yok.");
  const metadata = (key: string) =>
    comments
      .find((line) => line.toLowerCase().startsWith(`#${key}:`))
      ?.slice(key.length + 2);
  const columnsValue = metadata("columns");
  const columns = columnsValue
    ? (delimited(columnsValue, chosen).rows[0] ?? [])
    : [];
  const warnings: string[] = [];
  if (comments.length)
    warnings.push(
      "Anki/açıklama satırları kelime olarak alınmadı. Deste, not türü, GUID, medya ve tekrar zamanları aktarılmaz.",
    );
  if (metadata("html")?.trim().toLowerCase() === "true")
    warnings.push(
      "HTML alanları düz metin olarak korunur; etiketler çalıştırılmaz. Anki cloze şablonları dönüştürülmez.",
    );
  const widths = new Set(rows.map((r) => r.length));
  if (widths.size > 1)
    warnings.push(
      "Satırlardaki sütun sayıları farklı. Eksik hücreler boş kabul edilir; fazla sütunlar önizlemede eşleştirilebilir.",
    );
  const headerSuggested =
    !columns.length &&
    rows[0].some((v) =>
      aliases.word.map(normalizeHeader).includes(normalizeHeader(v)),
    ) &&
    rows[0].filter((v) =>
      Object.values(aliases).some((list) =>
        list.map(normalizeHeader).includes(normalizeHeader(v)),
      ),
    ).length >= 2;
  return {
    rows,
    separator: chosen,
    warnings,
    columns,
    globalTags: (metadata("tags") ?? "").trim().split(/\s+/).filter(Boolean),
    headerSuggested,
    anki: comments.some((line) =>
      /^#(?:separator|columns|tags|html):/i.test(line),
    ),
  };
}
export function tableColumns(table: ParsedTable, header: boolean): string[] {
  const count = Math.max(
    table.columns.length,
    ...table.rows.map((r) => r.length),
  );
  return Array.from(
    { length: count },
    (_, index) =>
      (header ? table.rows[0][index] : table.columns[index]) ??
      `Sütun ${index + 1}`,
  );
}
export function suggestMapping(
  table: ParsedTable,
  header: boolean,
): ColumnMapping {
  const names = tableColumns(table, header);
  const used = new Set<number>();
  const mapping = {} as ColumnMapping;
  for (const [key] of TRANSFER_FIELDS) {
    const index = names.findIndex(
      (name, i) =>
        !used.has(i) &&
        aliases[key].some(
          (alias) => normalizeHeader(alias) === normalizeHeader(name),
        ),
    );
    mapping[key] = index < 0 ? null : index;
    if (index >= 0) used.add(index);
  }
  return mapping;
}
function tagsFromCell(value: string, mode: TransferOptions["tags"]): string[] {
  if (!value.trim()) return [];
  if (mode === "auto" && value.trim().startsWith("[")) {
    try {
      return validateWordTags(JSON.parse(value));
    } catch {
      throw Error("Etiket JSON listesi geçersiz.");
    }
  }
  return validateWordTags(
    value
      .split(mode === "anki" ? /\s+/ : /[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
}
function typeIdentity(type: string) {
  const key = wordTypeKey(type);
  return key === "other" ? normalizeWord(type) : key;
}
export function transferSignature(data: Notebook): string {
  return JSON.stringify(data.words);
}
export function planWordImport(
  data: Notebook,
  table: ParsedTable,
  options: TransferOptions,
): TransferPlan {
  const count = tableColumns(table, options.header).length;
  if (options.mapping.word === null) throw Error("Kelime sütununu eşleştir.");
  const selected = Object.values(options.mapping).filter(
    (i): i is number => i !== null,
  );
  if (
    selected.some((i) => !Number.isInteger(i) || i < 0 || i >= count) ||
    new Set(selected).size !== selected.length
  )
    throw Error("Her alan için farklı ve geçerli bir sütun seç.");
  const source = table.rows.slice(options.header ? 1 : 0);
  if (source.length > MAX_TRANSFER_ROWS)
    throw Error("Bir dosyada en fazla 10.000 kelime satırı olabilir.");
  const globalTags = validateWordTags(table.globalTags);
  const rows: TransferRow[] = [],
    newRecords = new Set<Word>(),
    seenTargets = new Set<string>(),
    lookup = new Map<string, Word[]>();
  for (const word of data.words) {
    const key = normalizeWord(word.word),
      group = lookup.get(key) ?? [];
    group.push(word);
    lookup.set(key, group);
  }
  for (let index = 0; index < source.length; index++) {
    const values = Object.fromEntries(
      TRANSFER_FIELDS.map(([key]) => [
        key,
        options.mapping[key] === null
          ? ""
          : (source[index][options.mapping[key]!] ?? ""),
      ]),
    ) as Record<TransferField, string>;
    const base = {
      row: index + 1 + (options.header ? 1 : 0),
      word: values.word.trim(),
    };
    try {
      if (!base.word) throw Error("Kelime boş.");
      if (
        base.word.length > 500 ||
        values.meaning.length > 10000 ||
        values.example.length > 10000 ||
        values.translation.length > 10000 ||
        values.type.length > 100
      )
        throw Error("Kelime/alan uzunluk sınırı aşıldı.");
      const level = values.level.trim().toUpperCase();
      if (level && !isLevel(level))
        throw Error("Seviye A1, A2, B1, B2, C1 veya C2 olmalı.");
      const tags = validateWordTags([
        ...new Set([...tagsFromCell(values.tags, options.tags), ...globalTags]),
      ]);
      const record: Word = {
        id: `transfer-preview-${index}`,
        word: base.word,
        meaning: values.meaning.trim(),
        type: values.type.trim(),
        synonyms: "",
        antonyms: "",
        example: values.example,
        translation: values.translation,
        storyId: "",
        level,
        ...(tags.length ? { tags } : {}),
      };
      const key = normalizeWord(record.word),
        group = lookup.get(key) ?? [];
      const candidates = group.filter(
        (w) =>
          !record.type || typeIdentity(w.type) === typeIdentity(record.type),
      );
      if (candidates.length > 1) {
        rows.push({
          ...base,
          status: "skip",
          reason:
            "Birden fazla mevcut tür/kart eşleşiyor. Tür sütununu eşleştir veya mevcut kartı tek tek düzenle.",
        });
        continue;
      }
      const existing = candidates[0];
      if (!existing) {
        group.push(record);
        lookup.set(key, group);
        newRecords.add(record);
        rows.push({
          ...base,
          status: "add",
          reason: "Yeni kelime kartı.",
          record,
        });
        continue;
      }
      if (newRecords.has(existing)) {
        rows.push({
          ...base,
          status: "skip",
          reason:
            "Dosya içinde yinelenen kelime/tür. İlk geçerli satır korunur.",
        });
        continue;
      }
      if (seenTargets.has(existing.id)) {
        rows.push({
          ...base,
          status: "skip",
          targetId: existing.id,
          reason:
            "Dosya içinde aynı mevcut kart yineleniyor. İlk geçerli satır korunur.",
        });
        continue;
      }
      if (options.duplicates === "skip") {
        seenTargets.add(existing.id);
        rows.push({
          ...base,
          status: "skip",
          targetId: existing.id,
          reason: "Mevcut kart eşleşti; değiştirilmeden atlanacak.",
        });
        continue;
      }
      const next = { ...existing };
      const changes: string[] = [];
      for (const field of [
        "meaning",
        "example",
        "translation",
        "level",
        "type",
      ] as const)
        if (
          !(
            field === "level" ? wordLevel(existing, data.stories) : next[field]
          )?.trim() &&
          record[field]?.trim()
        ) {
          next[field] = record[field];
          changes.push(label(field));
        }
      const union = validateWordTags([
        ...new Set([...(existing.tags ?? []), ...tags]),
      ]);
      if (JSON.stringify(union) !== JSON.stringify(existing.tags ?? [])) {
        next.tags = union;
        changes.push("Etiket");
      }
      if (!changes.length) {
        seenTargets.add(existing.id);
        rows.push({
          ...base,
          status: "skip",
          targetId: existing.id,
          reason: "Mevcut kartta tamamlanacak boş alan veya yeni etiket yok.",
        });
        continue;
      }
      group[group.indexOf(existing)] = next;
      seenTargets.add(existing.id);
      rows.push({
        ...base,
        status: "match",
        targetId: existing.id,
        reason: "Yalnız boş alanlar ve yeni etiketler tamamlanacak.",
        record: next,
        changes,
      });
    } catch (error) {
      rows.push({
        ...base,
        status: "invalid",
        reason: error instanceof Error ? error.message : "Satır geçersiz.",
      });
    }
  }
  const added = rows.filter((r) => r.status === "add").length;
  if (data.words.length + added > 10000)
    throw Error(
      "İçe aktarma toplam 10.000 kelime kartı sınırını aşar. Dosyayı küçült.",
    );
  return {
    rows,
    added,
    matched: rows.filter((r) => r.status === "match").length,
    skipped: rows.filter((r) => r.status === "skip").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    duplicates: rows.filter((r) => r.status === "skip" || r.status === "match")
      .length,
    signature: transferSignature(data),
  };
}
export function applyWordImport(
  data: Notebook,
  plan: TransferPlan,
  makeId: () => string,
): Notebook {
  if (transferSignature(data) !== plan.signature)
    throw Error(
      "Kelime koleksiyonu önizlemeden sonra değişti. Önizlemeyi yenile ve yeniden onayla.",
    );
  if (!plan.added && !plan.matched) return data;
  const words = [...data.words];
  const ids = new Set(words.map((w) => w.id));
  for (const row of plan.rows) {
    if (row.status === "add" && row.record) {
      const id = makeId();
      if (!id || ids.has(id))
        throw Error("Yeni kelime kimliği çakıştı. Yeniden dene.");
      ids.add(id);
      words.push({ ...row.record, id });
    } else if (row.status === "match" && row.targetId && row.record) {
      const index = words.findIndex((w) => w.id === row.targetId);
      if (index < 0) throw Error("Eşleşen kart bulunamadı. Önizlemeyi yenile.");
      words[index] = { ...row.record, id: row.targetId };
    }
  }
  return validateNotebook({ ...data, words });
}
export function exportWordTable(
  data: Notebook,
  format: "csv" | "tsv" | "anki",
): { text: string; extension: string; mime: string; warnings: string[] } {
  const separator = format === "csv" ? "," : "\t";
  const headers = [
    "Word",
    "Meaning",
    "Example",
    "Tags",
    "Level",
    "Type",
    "Sentence translation",
  ];
  const quote = (value: string) =>
    /["\r\n]/.test(value) || value.includes(separator) || value.startsWith("#")
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  let changedTags = 0;
  const rows = data.words.map((w) => {
    let tags = JSON.stringify(w.tags ?? []);
    if (format === "anki") {
      if (w.tags?.some((t) => /\s/.test(t))) changedTags++;
      tags = (w.tags ?? []).map((t) => t.replace(/\s+/g, "_")).join(" ");
    }
    return [
      w.word,
      w.meaning,
      w.example,
      tags,
      wordLevel(w, data.stories),
      w.type,
      w.translation,
    ]
      .map(quote)
      .join(separator);
  });
  const preamble =
    format === "anki"
      ? `#separator:Tab\r\n#html:false\r\n#columns:${headers.join("\t")}\r\n`
      : headers.join(separator) + "\r\n";
  const text =
    "\uFEFF" + preamble + rows.join("\r\n") + (rows.length ? "\r\n" : "");
  let size = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    size += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
    if (size > MAX_TRANSFER_BYTES)
      throw Error(
        "Metin aktarımı 5 MB sınırını aşıyor. Tam koleksiyon için JSON/ZIP yedeğini kullan.",
      );
  }
  return {
    text,
    extension: format === "csv" ? "csv" : "tsv",
    mime: format === "csv" ? "text/csv" : "text/tab-separated-values",
    warnings: changedTags
      ? [
          `${changedTags} kartın Anki etiketlerindeki boşluklar alt çizgiye dönüştürülür; uygulamadaki etiketler değişmez.`,
        ]
      : [],
  };
}
