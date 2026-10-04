import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNotebookServer } from "./serve.mjs";
import { createStore } from "./notebook-store.mjs";
import { notebookFixture } from "../tests/e2e/fixture.mjs";

// Each run owns a new temporary directory, independent of data/notebook.json.
const directory = await mkdtemp(join(tmpdir(), "english-desk-e2e-"));
const port = 8082;
await createStore(directory).save(notebookFixture(), null);
const server = createNotebookServer({ directory, port });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void close();
  });
server.once("error", async (error) => {
  console.error(error.message);
  await rm(directory, { recursive: true, force: true });
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`E2E: http://127.0.0.1:${port}`),
);
