import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import yauzl from "yauzl";
import yazl from "yazl";
import crc32 from "crc-32";
import { parseBackup } from "../src/backup-core.ts";

export const MAX_ARCHIVE_BYTES = 2_000_000_000;
export const MAX_JSON_BYTES = 20_000_000;
const MAX_AUDIO_BYTES = 512_000_000;
const AUDIO_PATH = /^(?:data\/)?story-audio\/([a-z0-9-]{1,80})\.mp3$/;
const JSON_NAMES = [
  "backup.json",
  "data/notebook.json",
  "notebook.json",
  "stories.json",
  "words.json",
  "exams.json",
  "notebook-exams.json",
];

function checkedStream(entry) {
  let bytes = 0,
    crc = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > entry.uncompressedSize)
        return callback(Error("ZIP dosya boyutu geçersiz."));
      crc = crc32.buf(chunk, crc);
      callback(null, chunk);
    },
    flush(callback) {
      callback(
        bytes !== entry.uncompressedSize || crc >>> 0 !== entry.crc32
          ? Error("ZIP dosyası bozuk; bütünlük kontrolü başarısız.")
          : undefined,
      );
    },
  });
}
const openZip = (path) =>
  new Promise((resolve, reject) =>
    yauzl.open(
      path,
      {
        lazyEntries: true,
        autoClose: false,
        strictFileNames: true,
        validateEntrySizes: true,
      },
      (error, zip) => (error ? reject(error) : resolve(zip)),
    ),
  );
const openEntry = (zip, entry) =>
  new Promise((resolve, reject) =>
    zip.openReadStream(entry, (error, stream) =>
      error ? reject(error) : resolve(stream),
    ),
  );
async function collectEntries(zip) {
  return new Promise((resolve, reject) => {
    const entries = new Map();
    let total = 0;
    zip.once("error", reject);
    zip.on("entry", (entry) => {
      try {
        const name = entry.fileName;
        if (
          name.length > 1024 ||
          name.includes("\\") ||
          name.includes("\0") ||
          name.startsWith("/") ||
          name.split("/").includes("..") ||
          /^[a-z]:/i.test(name) ||
          ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000
        )
          throw Error("ZIP içinde güvenli olmayan dosya yolu bulundu.");
        if (entries.has(name) || entries.size >= 20000)
          throw Error("ZIP içinde tekrarlanan veya çok fazla dosya var.");
        if (
          !Number.isSafeInteger(entry.uncompressedSize) ||
          entry.uncompressedSize < 0
        )
          throw Error("ZIP boyutu geçersiz.");
        total += entry.uncompressedSize;
        if (total > MAX_ARCHIVE_BYTES)
          throw Error("Açılmış ZIP içeriği 2 GB sınırını aşıyor.");
        if (
          JSON_NAMES.includes(name) &&
          entry.uncompressedSize > MAX_JSON_BYTES
        )
          throw Error("Yedek JSON içeriği 20 MB sınırını aşıyor.");
        if (
          AUDIO_PATH.test(name) &&
          (!entry.uncompressedSize || entry.uncompressedSize > MAX_AUDIO_BYTES)
        )
          throw Error("Ses dosyası boş veya 512 MB sınırını aşıyor.");
        if (entry.generalPurposeBitFlag & 1)
          throw Error("Şifreli ZIP yedekleri desteklenmiyor.");
        entries.set(name, entry);
        zip.readEntry();
      } catch (error) {
        reject(error);
        zip.close();
      }
    });
    zip.once("end", () => resolve(entries));
    zip.readEntry();
  });
}
async function readJsonEntry(zip, entry) {
  if (entry.uncompressedSize > MAX_JSON_BYTES)
    throw Error("JSON içeriği 20 MB sınırını aşıyor.");
  const chunks = [];
  const sink = new Transform({
    transform(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  await pipeline(await openEntry(zip, entry), checkedStream(entry), sink);
  return JSON.parse(
    Buffer.concat(chunks)
      .toString("utf8")
      .replace(/^\uFEFF/, ""),
  );
}
export async function readBackupArchive(path, stagingDirectory) {
  const info = await stat(path);
  if (!info.size || info.size > MAX_ARCHIVE_BYTES)
    throw Error("Yedek dosyası boş veya 2 GB sınırını aşıyor.");
  const headerStream = createReadStream(path, { start: 0, end: 3 });
  const headerParts = [];
  for await (const chunk of headerStream) headerParts.push(chunk);
  const header = Buffer.concat(headerParts);
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    if (info.size > MAX_JSON_BYTES)
      throw Error("JSON yedeği en fazla 20 MB olabilir.");
    const bundle = parseBackup(
      JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, "")),
    );
    return { bundle, audioFiles: new Map() };
  }
  const zip = await openZip(path);
  try {
    const entries = await collectEntries(zip);
    const name = JSON_NAMES.find((name) => entries.has(name));
    if (!name)
      throw Error(
        "ZIP içinde desteklenen defter veya bölüm yedeği bulunamadı.",
      );
    const references = entries.has("story-links.json")
      ? await readJsonEntry(zip, entries.get("story-links.json"))
      : [];
    const bundle = parseBackup(
      await readJsonEntry(zip, entries.get(name)),
      references,
    );
    const needed = new Set(
      bundle.data.stories.map((s) => s.audioId).filter(Boolean),
    );
    const audioFiles = new Map();
    await mkdir(stagingDirectory, { recursive: true });
    for (const [entryName, entry] of entries) {
      const match = AUDIO_PATH.exec(entryName);
      if (!match || !needed.has(match[1])) continue;
      const id = match[1];
      if (audioFiles.has(id))
        throw Error("ZIP içinde tekrarlanan ses kimliği bulundu.");
      const file = join(stagingDirectory, id + ".mp3");
      await pipeline(
        await openEntry(zip, entry),
        checkedStream(entry),
        createWriteStream(file, { flags: "wx" }),
      );
      audioFiles.set(id, file);
    }
    return { bundle, audioFiles };
  } finally {
    zip.close();
  }
}
export async function writeBackupArchive(file, bundle, audioFiles = new Map()) {
  const zip = new yazl.ZipFile();
  const output = createWriteStream(file, { flags: "wx" });
  const writing = pipeline(zip.outputStream, output);
  zip.on("error", (error) => zip.outputStream.destroy(error));
  zip.addBuffer(
    Buffer.from(JSON.stringify(bundle, null, 2) + "\n"),
    "backup.json",
  );
  zip.addBuffer(
    Buffer.from(
      "English Desk yedeği\n\nUygulamada Yedekten geri yükle düğmesiyle bu ZIP dosyasını seç. Bölümleri ve ekleme/değiştirme işlemini önizlemeden seçebilirsin.\nHikâye notları ve ses zamanlamaları hikâyelerle, oturumlar ve sonuçlar sınavlarla birlikte taşınır.\n",
    ),
    "README.txt",
  );
  for (const [id, path] of audioFiles) {
    if (!/^[a-z0-9-]{1,80}$/.test(id)) throw Error("Ses kimliği geçersiz.");
    zip.addFile(path, "story-audio/" + id + ".mp3", { compress: false });
  }
  zip.end();
  await writing;
}
