import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createStore } from "./notebook-store.mjs";
import { lookupWord } from "./dictionary.mjs";
import { createBackupApi } from "./backup-api.mjs";
import { translationReady } from "./translator.mjs";
export function createNotebookServer({
  directory = fileURLToPath(new URL("../data/", import.meta.url)),
  port = 8081,
} = {}) {
  let activeLookups = 0;
  const host = `127.0.0.1:${port}`;
  const store = createStore(directory);
  const root = fileURLToPath(new URL("../dist/", import.meta.url));
  const instanceId = createHash("sha256")
    .update(fileURLToPath(new URL("../", import.meta.url)))
    .digest("hex");
  const audioRoot = resolve(directory, "story-audio");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
  };
  const backups = createBackupApi({ store, directory, host });
  const server = http.createServer(async (req, res) => {
    try {
      if (await backups.handle(req, res)) return;
      if (req.url?.startsWith("/api/story-audio/")) {
        if (
          req.headers.host !== host ||
          (req.headers.origin && req.headers.origin !== `http://${host}`)
        ) {
          res.writeHead(403);
          res.end();
          return;
        }
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405);
          res.end();
          return;
        }
        const audioId = new URL(req.url, `http://${host}`).pathname.slice(
          "/api/story-audio/".length,
        );
        if (!/^[a-z0-9-]{1,80}$/.test(audioId)) {
          res.writeHead(400);
          res.end();
          return;
        }
        const file = resolve(audioRoot, `${audioId}.mp3`);
        const info = await stat(file);
        if (!info.isFile() || !info.size) {
          res.writeHead(404);
          res.end();
          return;
        }
        let start = 0,
          end = info.size - 1;
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match || (!match[1] && !match[2])) {
            res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
            res.end();
            return;
          }
          if (!match[1]) {
            const suffix = Number(match[2]);
            start = Math.max(0, info.size - suffix);
          } else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(end, Number(match[2]));
          }
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= info.size ||
            (start === info.size && !match[1])
          ) {
            res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
            res.end();
            return;
          }
        }
        res.writeHead(range ? 206 : 200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": end - start + 1,
          "Accept-Ranges": "bytes",
          ...(range
            ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
            : {}),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        if (req.method === "HEAD") res.end();
        else
          createReadStream(file, { start, end })
            .on("error", () => res.destroy())
            .pipe(res);
        return;
      }
      if (req.url?.startsWith("/api/words/")) {
        const send = (status, body) => {
          res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify(body));
        };
        if (
          req.headers.host !== host ||
          (req.headers.origin && req.headers.origin !== `http://${host}`)
        ) {
          send(403, { error: "Yalnızca yerel uygulama erişebilir." });
          return;
        }
        if (req.url === "/api/words/status" && req.method === "GET") {
          send(200, { translationReady: translationReady(), instanceId });
          return;
        }
        if (req.url !== "/api/words/lookup" || req.method !== "POST") {
          send(405, { error: "Desteklenmeyen işlem." });
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          send(415, { error: "JSON gerekli." });
          return;
        }
        if (activeLookups >= 2) {
          send(429, {
            error: "Sözlük meşgul; mevcut işlem bitince tekrar dene.",
          });
          return;
        }
        activeLookups++;
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 12000) {
              send(413, { error: "Sorgu çok uzun." });
              return;
            }
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (
            !body ||
            typeof body !== "object" ||
            typeof body.word !== "string"
          )
            throw new Error("Kelime gerekli.");
          send(200, await lookupWord(body));
        } catch (error) {
          send(400, { error: error.message });
        } finally {
          activeLookups--;
        }
        return;
      }
      if (req.url === "/api/notebook") {
        const origin = req.headers.origin;
        if (
          req.headers.host !== host ||
          (origin && origin !== `http://${host}`)
        ) {
          res.writeHead(403);
          res.end();
          return;
        }
        const send = (status, body) => {
          res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify(body));
        };
        try {
          if (req.method === "GET") {
            send(200, await store.read());
            return;
          }
          if (req.method !== "PUT") {
            send(405, { error: "Desteklenmeyen işlem." });
            return;
          }
          if (!req.headers["content-type"]?.startsWith("application/json")) {
            send(415, { error: "JSON gerekli." });
            return;
          }
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 20_000_000) {
              send(413, { error: "Kayıt 20 MB sınırını aşıyor." });
              return;
            }
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          send(200, await store.save(body.data, body.revision));
        } catch (error) {
          send(error.status ?? 400, { error: error.message });
        }
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(resolve(root) + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error("Not a file");
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Content-Length": content.length,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.on("close", () => {
    void backups.close();
  });
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createNotebookServer();
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "8081 portu kullanimda. Uygulama zaten aciksa ayni adresi kullanin."
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(8081, "127.0.0.1", () =>
    console.log("English Desk: http://127.0.0.1:8081"),
  );
}
