import { validateNotebook, type Notebook } from "./model.ts";
import { initialNotebook } from "./sample.ts";
let revision: string | null = null;
async function request(method: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch("/api/notebook", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Yerel kayıt sunucusuna ulaşılamadı. Uygulamayı yerel başlatıcıyla aç.",
    );
  }
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  )
    throw new Error("Dosya kaydı için uygulamayı yerel başlatıcıyla aç.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Dosyaya kaydedilemedi.");
  return result;
}
export async function loadNotebook(): Promise<Notebook> {
  const saved = await request("GET");
  revision = saved.revision;
  if (saved.data !== null) return validateNotebook(saved.data);
  const raw = localStorage.getItem("english-desk-native-v1");
  const data =
    raw === null ? initialNotebook : validateNotebook(JSON.parse(raw));
  const result = await request("PUT", { data, revision });
  revision = result.revision;
  return validateNotebook(result.data);
}
export async function saveNotebook(data: Notebook): Promise<void> {
  const result = await request("PUT", {
    data: validateNotebook(data),
    revision,
  });
  revision = result.revision;
}

export const notebookRevision = () => revision;
export function acceptSavedNotebook(result: {
  data: unknown;
  revision: string;
}): Notebook {
  const checked = validateNotebook(result.data);
  revision = result.revision;
  return checked;
}
