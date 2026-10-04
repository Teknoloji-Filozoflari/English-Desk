import { acceptSavedNotebook, notebookRevision } from "./storage.web";
import type { Notebook } from "./model";
import type {
  BackupImport,
  BackupOptions,
  RestoreOptions,
  RestoreSummary,
} from "./backup-core";

async function api(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/backups/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Yedek işlemleri için uygulamayı yerel başlatıcıyla aç.");
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "Yedek işlemi başarısız.");
  return result;
}
export async function exportBackup(
  data: Notebook,
  options: BackupOptions,
): Promise<void> {
  const result = await api("export", {
    ...options,
    revision: notebookRevision(),
  });
  const link = document.createElement("a");
  link.href = result.downloadUrl;
  link.download = result.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
export async function chooseBackup(): Promise<BackupImport | null> {
  const { getDocumentAsync } = await import("expo-document-picker");
  const result = await getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "text/plain",
    ],
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.file) throw Error("Dosya okunamadı.");
  if (asset.file.size > 2_000_000_000)
    throw Error("Yedek en fazla 2 GB olabilir.");
  const form = new FormData();
  form.append("backup", asset.file, asset.name);
  const response = await fetch("/api/backups/preview", {
    method: "POST",
    body: form,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Yedek için yerel uygulama sunucusu gerekli.");
  const source = await response.json();
  if (!response.ok) throw Error(source.error ?? "Yedek okunamadı.");
  return source;
}
export async function previewRestore(
  source: BackupImport,
  options: RestoreOptions,
  current: Notebook,
  signal?: AbortSignal,
): Promise<{ summary: RestoreSummary; warnings: string[] }> {
  return api(
    "plan",
    { token: source.token, ...options, revision: notebookRevision() },
    signal,
  );
}
export async function applyBackup(
  source: BackupImport,
  options: RestoreOptions,
  current: Notebook,
): Promise<Notebook> {
  const result = await api("restore", {
    token: source.token,
    ...options,
    revision: notebookRevision(),
  });
  return acceptSavedNotebook(result);
}

export async function discardBackup(source: BackupImport): Promise<void> {
  if (source.token) await api("discard", { token: source.token });
}
