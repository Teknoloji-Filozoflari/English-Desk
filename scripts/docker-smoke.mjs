import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeBackup } from "../src/backup-core.ts";
import { writeBackupArchive, readBackupArchive } from "./backup-archive.mjs";
import { notebookFixture } from "../tests/e2e/fixture.mjs";
const image = process.argv[process.argv.indexOf("--image") + 1];
if (!process.argv.includes("--image") || !image)
  throw Error("Kullanım: npm run test:docker -- --image english-desk:ci");
const port = Number(process.env.ENGLISH_DESK_DOCKER_TEST_PORT ?? 18081);
const env = {
  ...process.env,
  ENGLISH_DESK_IMAGE: image,
  ENGLISH_DESK_PORT: String(port),
};
const project = "english-desk-smoke-" + randomUUID().slice(0, 8);
const base = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(join(tmpdir(), "english-desk-docker-"));
function docker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("Docker işlemi başarısız: " + args.join(" "))),
    );
  });
}
const compose = (args) =>
  docker(["compose", "-p", project, "-f", "compose.yaml", ...args]);
async function json(path, body, headers = {}) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
try {
  await compose([
    "up",
    "-d",
    "--no-build",
    "--pull",
    "never",
    "--wait",
    "--wait-timeout",
    "90",
  ]);
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /English Desk/);
  assert.equal((await json("/api/health")).status, "ok");
  assert.equal(
    (await json("/api/notebook")).data,
    null,
    "Image must start without personal records",
  );
  assert.equal(
    (await json("/api/notebook", undefined, { host: `localhost:${port}` }))
      .data,
    null,
  );
  for (const path of [
    "/api/notebook",
    "/api/words/status",
    "/api/backups/export",
    "/api/story-audio/test",
  ]) {
    const response = await fetch(base + path, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(response.status, 403);
  }
  const data = notebookFixture();
  data.stories[0].audioId = "docker-test-audio";
  data.audioTimings = { "story-test": [0, 2] };
  data.grammarTopics = [{ id: "topic", title: "Docker test konusu" }];
  data.grammar = [
    {
      id: "note",
      title: "Korunan not",
      body: "Container yenilendiğinde kalır.",
      topicId: "topic",
    },
  ];
  const bytes = Buffer.from("synthetic Docker audio fixture");
  const audio = join(directory, "source.mp3");
  await writeFile(audio, bytes);
  const archive = join(directory, "source.zip");
  await writeBackupArchive(
    archive,
    makeBackup(data, {
      sections: ["stories", "words", "grammar", "exams"],
      includeAudio: true,
    }),
    new Map([["docker-test-audio", audio]]),
  );
  const form = new FormData();
  form.append(
    "backup",
    new Blob([await readFile(archive)], { type: "application/zip" }),
    "backup.zip",
  );
  const previewResponse = await fetch(base + "/api/backups/preview", {
    method: "POST",
    body: form,
  });
  assert.equal(
    previewResponse.status,
    200,
    await previewResponse.clone().text(),
  );
  const source = await previewResponse.json();
  const restored = await json("/api/backups/restore", {
    token: source.token,
    sections: source.sections,
    mode: "replace",
    revision: null,
  });
  assert.equal(restored.data.grammar[0].body, data.grammar[0].body);
  const range = await fetch(
    base + "/api/story-audio/" + restored.data.stories[0].audioId,
    { headers: { Range: "bytes=0-7" } },
  );
  assert.equal(range.status, 206);
  assert.deepEqual(
    Buffer.from(await range.arrayBuffer()),
    bytes.subarray(0, 8),
  );
  // A new container must reuse the same volumes, including notes, audio and revision.
  await compose(["down", "--timeout", "30"]);
  await compose([
    "up",
    "-d",
    "--no-build",
    "--pull",
    "never",
    "--wait",
    "--wait-timeout",
    "90",
  ]);
  const persisted = await json("/api/notebook");
  assert.deepEqual(
    persisted,
    restored.data
      ? { data: restored.data, revision: restored.revision }
      : restored,
  );
  const fullAudio = await fetch(
    base + "/api/story-audio/" + persisted.data.stories[0].audioId,
  );
  assert.deepEqual(Buffer.from(await fullAudio.arrayBuffer()), bytes);
  const changed = {
    ...persisted.data,
    grammar: [{ ...persisted.data.grammar[0], body: "İkinci kayıt" }],
  };
  const update = await fetch(base + "/api/notebook", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ data: changed, revision: persisted.revision }),
  });
  assert.equal(update.status, 200);
  await docker([
    "compose",
    "-p",
    project,
    "-f",
    "compose.yaml",
    "exec",
    "-T",
    "english-desk",
    "node",
    "--input-type=module",
    "-e",
    "import {readdir} from 'node:fs/promises';if(!(await readdir('/app/data/backups')).length)process.exit(1);if(process.getuid()===0)process.exit(1);",
  ]);
  const current = await json("/api/notebook");
  const exported = await json("/api/backups/export", {
    sections: ["stories", "words", "grammar", "exams"],
    includeAudio: true,
    revision: current.revision,
  });
  const download = await fetch(base + exported.downloadUrl);
  assert.equal(download.status, 200);
  const output = join(directory, "download.zip");
  await writeFile(output, Buffer.from(await download.arrayBuffer()));
  const checked = await readBackupArchive(output, join(directory, "stage"));
  assert.equal(checked.bundle.data.grammar[0].body, "İkinci kayıt");
  assert.equal(checked.audioFiles.size, 1);
  console.log(
    "Docker checks passed: non-root startup, host/origin guards, ZIP/audio restore, volume persistence, automatic backups and ZIP export.",
  );
} catch (error) {
  await compose(["logs", "--tail", "100"]).catch(() => {});
  throw error;
} finally {
  await compose(["down", "--volumes", "--remove-orphans", "--timeout", "30"]);
  await rm(directory, { recursive: true, force: true });
}
