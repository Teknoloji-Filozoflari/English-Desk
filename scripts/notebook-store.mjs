import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  rm,
} from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validateNotebook } from "../src/model.ts";
// On Windows a scanner or an open reader can briefly block atomic replacement.
// Retry the same rename; never delete/truncate the destination to get past a lock.
export async function replaceNotebookFile(
  source,
  destination,
  { renameFile = rename, platform = process.platform, wait = delay } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFile(source, destination);
      return;
    } catch (error) {
      if (
        platform !== "win32" ||
        !["EPERM", "EACCES", "EBUSY"].includes(error.code) ||
        attempt >= 5
      )
        throw error;
      await wait(20 * 2 ** attempt);
    }
  }
}

export function createStore(
  directory,
  { replaceFile = replaceNotebookFile } = {},
) {
  const file = join(directory, "notebook.json");
  let queue = Promise.resolve();
  const revision = (text) => createHash("sha256").update(text).digest("hex");
  async function read() {
    try {
      const raw = await readFile(file, "utf8");
      return {
        data: validateNotebook(JSON.parse(raw)),
        revision: revision(raw),
      };
    } catch (error) {
      if (error.code === "ENOENT") return { data: null, revision: null };
      throw error;
    }
  }
  function update(expectedRevision, updater) {
    const operation = queue.then(async () => {
      const current = await read();
      if (current.revision !== expectedRevision) {
        const error = new Error(
          "Kayıtlar başka bir pencerede değişti. Sayfayı yenileyip tekrar dene.",
        );
        error.status = 409;
        throw error;
      }
      const checked = validateNotebook(await updater(current.data));
      await mkdir(directory, { recursive: true });
      if (current.data) {
        await mkdir(join(directory, "backups"), { recursive: true });
        await copyFile(
          file,
          join(directory, "backups", `${Date.now()}-${randomUUID()}.json`),
        );
      }
      const raw = JSON.stringify(checked, null, 2) + "\n";
      const temporary = join(directory, `.notebook-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, raw, { flag: "wx", flush: true });
        await replaceFile(temporary, file);
      } catch (error) {
        // Keep the original error and previous notebook even if cleanup fails.
        await rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
      return { data: checked, revision: revision(raw) };
    });
    queue = operation.catch(() => {});
    return operation;
  }
  function save(data, expectedRevision) {
    return update(expectedRevision, () => data);
  }
  return { read, save, update };
}
