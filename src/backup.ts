import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Notebook } from "./model";
import {
  makeBackup,
  parseBackup,
  backupCounts,
  planRestore,
  type BackupImport,
  type BackupOptions,
  type RestoreOptions,
  type RestoreSummary,
} from "./backup-core";
import { saveNotebook } from "./storage";

export async function exportBackup(
  data: Notebook,
  options: BackupOptions,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Bu cihazda dosya paylaşımı desteklenmiyor.");
  const file = new File(Paths.cache, `english-desk-${Date.now()}.json`);
  file.create();
  file.write(
    JSON.stringify(
      makeBackup(data, { ...options, includeAudio: false }),
      null,
      2,
    ),
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "English Desk yedeğini kaydet",
  });
}
export async function chooseBackup(): Promise<BackupImport | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 20_000_000)
    throw Error("JSON yedeği en fazla 20 MB olabilir.");
  const bundle = parseBackup(JSON.parse(await new File(asset.uri).text()));
  return {
    bundle,
    sections: bundle.sections,
    counts: backupCounts(bundle.data, bundle.sections, []),
    warnings: [],
  };
}
export async function previewRestore(
  source: BackupImport,
  options: RestoreOptions,
  current: Notebook,
  signal?: AbortSignal,
): Promise<{ summary: RestoreSummary; warnings: string[] }> {
  if (!source.bundle) throw Error("Yedek bulunamadı.");
  const plan = planRestore(current, source.bundle, options, []);
  return { summary: plan.summary, warnings: plan.warnings };
}
export async function applyBackup(
  source: BackupImport,
  options: RestoreOptions,
  current: Notebook,
): Promise<Notebook> {
  if (!source.bundle) throw Error("Yedek bulunamadı.");
  const plan = planRestore(current, source.bundle, options, []);
  await saveNotebook(plan.data);
  return plan.data;
}

export async function discardBackup(source: BackupImport): Promise<void> {}
