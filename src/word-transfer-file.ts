import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Notebook } from "./model";
import {
  checkTransferFile,
  decodeTransferBytes,
  exportWordTable,
} from "./word-transfer";
export async function chooseWordTable(): Promise<{
  name: string;
  text: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "text/csv",
      "text/tab-separated-values",
      "text/plain",
      "application/octet-stream",
    ],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0],
    file = new File(asset.uri);
  checkTransferFile(asset.name, asset.size ?? file.size);
  return { name: asset.name, text: decodeTransferBytes(await file.bytes()) };
}
export async function downloadWordTable(
  data: Notebook,
  format: "csv" | "tsv" | "anki",
): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Bu cihazda dosya paylaşımı desteklenmiyor.");
  const result = exportWordTable(data, format),
    file = new File(
      Paths.cache,
      `english-desk-${format}-${Date.now()}.${result.extension}`,
    );
  file.create();
  file.write(result.text);
  await Sharing.shareAsync(file.uri, {
    mimeType: result.mime,
    UTI: "public.plain-text",
    dialogTitle: "Kelime metnini kaydet",
  });
}
