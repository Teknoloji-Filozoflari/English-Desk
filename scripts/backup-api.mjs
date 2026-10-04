import {
  mkdtemp,
  mkdir,
  rm,
  copyFile,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";
import { createReadStream, createWriteStream, constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import {
  makeBackup,
  backupCounts,
  planRestore,
  emptyNotebook,
} from "../src/backup-core.ts";
import {
  MAX_ARCHIVE_BYTES,
  readBackupArchive,
  writeBackupArchive,
} from "./backup-archive.mjs";
const TTL = 30 * 60_000;
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12000) throw Error("İstek çok uzun.");
    chunks.push(chunk);
  }
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw Error("JSON gerekli.");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function upload(req, file) {
  const parser = busboy({
    headers: req.headers,
    limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1, fields: 0, parts: 2 },
  });
  let received = false,
    uploadTask,
    failure;
  const done = new Promise((resolve, reject) => {
    parser.on("file", (name, stream, info) => {
      if (name !== "backup" || !/\.(zip|json)$/i.test(info.filename)) {
        failure = Error("ZIP veya JSON yedeği seç.");
        stream.resume();
        return;
      }
      received = true;
      stream.once("limit", () => {
        failure = Error("Yedek en fazla 2 GB olabilir.");
      });
      uploadTask = pipeline(stream, createWriteStream(file, { flags: "wx" }));
      uploadTask.catch((error) => {
        failure = error;
      });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"])
      parser.on(event, () => {
        failure = Error("Tek bir yedek dosyası seç.");
      });
    parser.once("error", reject);
    parser.once("close", resolve);
  });
  req.once("aborted", () => parser.destroy(Error("Yükleme iptal edildi.")));
  req.pipe(parser);
  await done;
  await uploadTask;
  if (failure) throw failure;
  if (!received) throw Error("Yedek dosyası bulunamadı.");
}

export function createBackupApi({ store, directory, host }) {
  const sessions = new Map();
  let active = 0;
  async function dispose(token) {
    const session = sessions.get(token);
    if (!session) return;
    sessions.delete(token);
    clearTimeout(session.timer);
    await rm(session.directory, { recursive: true, force: true });
  }
  function register(session) {
    const token = randomUUID();
    const expire = () => {
      if (session.busy) {
        session.timer = setTimeout(expire, 60_000);
        session.timer.unref();
      } else {
        void dispose(token).catch(() => {});
      }
    };
    session.timer = setTimeout(expire, TTL);
    session.timer.unref();
    sessions.set(token, session);
    return token;
  }
  function get(token, kind) {
    const session = sessions.get(token);
    if (!session || session.kind !== kind)
      throw Error("Yedek oturumu sona erdi; dosyayı yeniden seç.");
    if (session.busy) throw Error("Bu yedek şu an işleniyor.");
    return session;
  }
  async function audioIds(session) {
    let files = [];
    try {
      files = await readdir(join(directory, "story-audio"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return [
      ...new Set([
        ...session.audioFiles.keys(),
        ...files
          .filter((name) => /^[a-z0-9-]{1,80}\.mp3$/.test(name))
          .map((name) => name.slice(0, -4)),
      ]),
    ];
  }
  async function assertRevision(revision) {
    const current = await store.read();
    if (current.revision !== revision) {
      const error = Error(
        "Kayıtlar başka bir pencerede değişti. Sayfayı yenileyip tekrar dene.",
      );
      error.status = 409;
      throw error;
    }
    return current;
  }
  const json = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  async function handle(req, res) {
    if (!req.url?.startsWith("/api/backups/")) return false;
    if (
      req.headers.host !== host ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      json(res, 403, { error: "Yalnızca yerel uygulama erişebilir." });
      return true;
    }
    let temporary;
    try {
      const pathname = new URL(req.url, `http://${host}`).pathname;
      if (
        pathname.startsWith("/api/backups/download/") &&
        ["GET", "HEAD"].includes(req.method)
      ) {
        const session = get(
          pathname.slice("/api/backups/download/".length),
          "export",
        );
        const info = await stat(session.file);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": info.size,
          "Content-Disposition": `attachment; filename="${session.name}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        if (req.method === "HEAD") res.end();
        else {
          await pipeline(createReadStream(session.file), res);
          await dispose(pathname.slice("/api/backups/download/".length));
        }
        return true;
      }
      if (req.method !== "POST") {
        json(res, 405, { error: "Desteklenmeyen işlem." });
        return true;
      }
      if (pathname === "/api/backups/preview") {
        if (active >= 2 || sessions.size >= 8) {
          json(res, 429, {
            error: "Yedek işlemi meşgul; mevcut işlemi bitirip tekrar dene.",
          });
          return true;
        }
        active++;
        try {
          temporary = await mkdtemp(join(tmpdir(), "english-desk-backup-"));
          const file = join(temporary, "upload");
          await upload(req, file);
          const source = await readBackupArchive(
            file,
            join(temporary, "audio"),
          );
          await unlink(file);
          const token = register({
            kind: "import",
            directory: temporary,
            ...source,
          });
          temporary = undefined;
          json(res, 200, {
            token,
            sections: source.bundle.sections,
            counts: backupCounts(source.bundle.data, source.bundle.sections, [
              ...source.audioFiles.keys(),
            ]),
            warnings: [],
          });
        } finally {
          active--;
        }
        return true;
      }
      const body = await readBody(req);
      if (pathname === "/api/backups/discard") {
        if (sessions.get(body.token)?.busy)
          throw Error("Bu yedek şu an işleniyor.");
        await dispose(body.token);
        json(res, 200, { ok: true });
        return true;
      }
      if (pathname === "/api/backups/export") {
        if (active >= 2 || sessions.size >= 8) {
          json(res, 429, {
            error: "Yedek işlemi meşgul; mevcut işlemi bitirip tekrar dene.",
          });
          return true;
        }
        active++;
        try {
          const current = await assertRevision(body.revision);
          const bundle = makeBackup(current.data ?? emptyNotebook(), body);
          const files = new Map();
          let total = 0;
          if (bundle.includeAudio)
            for (const id of new Set(
              bundle.data.stories.map((s) => s.audioId).filter(Boolean),
            )) {
              const file = join(directory, "story-audio", id + ".mp3");
              let info;
              try {
                info = await stat(file);
              } catch {
                throw Error(
                  "Bir hikâyenin ses dosyası bulunamadı. Sesleri hariç tutarak yeniden dene.",
                );
              }
              if (!info.isFile() || !info.size || info.size > 512_000_000)
                throw Error("Bir hikâyenin ses dosyası boş veya okunamıyor.");
              total += info.size;
              files.set(id, file);
            }
          if (Buffer.byteLength(JSON.stringify(bundle)) > 20_000_000)
            throw Error(
              "JSON içeriği 20 MB sınırını aşıyor; bölümleri ayrı aktar.",
            );
          if (
            total + Buffer.byteLength(JSON.stringify(bundle)) >
            MAX_ARCHIVE_BYTES
          )
            throw Error("Yedek 2 GB sınırını aşıyor; bölümleri ayrı aktar.");
          temporary = await mkdtemp(join(tmpdir(), "english-desk-backup-"));
          const file = join(temporary, "backup.zip");
          await writeBackupArchive(file, bundle, files);
          const name = `english-desk-${bundle.sections.length === 4 ? "tam" : bundle.sections.join("-")}-${new Date().toISOString().slice(0, 10)}.zip`;
          const token = register({
            kind: "export",
            directory: temporary,
            file,
            name,
          });
          temporary = undefined;
          json(res, 200, {
            downloadUrl: "/api/backups/download/" + token,
            name,
          });
        } finally {
          active--;
        }
        return true;
      }
      if (!["/api/backups/plan", "/api/backups/restore"].includes(pathname)) {
        json(res, 404, { error: "Yedek işlemi bulunamadı." });
        return true;
      }
      const session = get(body.token, "import");
      const current = await assertRevision(body.revision);
      const available = await audioIds(session);
      const plan = planRestore(
        current.data ?? emptyNotebook(),
        session.bundle,
        body,
        available,
      );
      if (pathname === "/api/backups/plan") {
        json(res, 200, { summary: plan.summary, warnings: plan.warnings });
        return true;
      }
      session.busy = true;
      const copied = [];
      let result;
      try {
        result = await store.update(body.revision, async (value) => {
          const candidate = planRestore(
            value ?? emptyNotebook(),
            session.bundle,
            body,
            available,
          ).data;
          const existing = new Set((value?.stories ?? []).map((s) => s.id));
          if (body.sections.includes("stories")) {
            await mkdir(join(directory, "story-audio"), { recursive: true });
            for (const story of candidate.stories) {
              if (body.mode !== "replace" && existing.has(story.id)) continue;
              const source = session.audioFiles.get(story.audioId);
              if (!source) continue;
              const id = "restore-" + randomUUID(),
                target = join(directory, "story-audio", id + ".mp3");
              await copyFile(source, target, constants.COPYFILE_EXCL);
              copied.push(target);
              story.audioId = id;
            }
          }
          return candidate;
        });
      } catch (error) {
        await Promise.all(copied.map((file) => unlink(file).catch(() => {})));
        throw error;
      } finally {
        session.busy = false;
      }
      await dispose(body.token).catch(() => {});
      json(res, 200, {
        ...result,
        summary: plan.summary,
        warnings: plan.warnings,
      });
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status ?? 400, {
          error: error.message || "Yedek işlenemedi.",
        });
      else res.destroy();
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
    return true;
  }
  return {
    handle,
    close: async () => {
      await Promise.all([...sessions.keys()].map(dispose));
    },
  };
}
