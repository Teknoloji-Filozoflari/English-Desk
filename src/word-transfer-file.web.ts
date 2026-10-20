import * as DocumentPicker from "expo-document-picker";
import {
  checkTransferFile,
  decodeTransferBytes,
  exportWordTable,
} from "./word-transfer";
import type { Notebook } from "./model";
export async function chooseWordTable(): Promise<{
  name: string;
  text: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      ".csv",
      ".tsv",
      ".txt",
      "text/csv",
      "text/tab-separated-values",
      "text/plain",
    ],
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.file) throw Error("Kelime dosyası okunamadı.");
  checkTransferFile(asset.name, asset.file.size);
  return {
    name: asset.name,
    text: decodeTransferBytes(new Uint8Array(await asset.file.arrayBuffer())),
  };
}
export async function downloadWordTable(
  data: Notebook,
  format: "csv" | "tsv" | "anki",
): Promise<void> {
  const result = exportWordTable(data, format);
  const blob = new Blob([result.text], {
      type: `${result.mime};charset=utf-8`,
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `english-desk-${format}-${Date.now()}.${result.extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
