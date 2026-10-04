import { useEffect, useRef, useState, type RefObject } from "react";
import type { Notebook, Story } from "../../model";
import { chooseStoryFile, readStoryFile } from "../../story-import";
import { errorMessage, type Editor } from "../types";
type OpenEditor = (
  kind: Editor["kind"],
  row?: Story,
  preset?: Record<string, string>,
  notes?: string[],
) => void;
export function useStoryImport(
  dataRef: RefObject<Notebook>,
  openEditor: OpenEditor,
) {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState("");
  const importController = useRef<AbortController | null>(null);
  const choosingFile = useRef(false);
  useEffect(() => () => importController.current?.abort(), []);
  async function importStory() {
    if (choosingFile.current || importController.current) return;
    choosingFile.current = true;
    setImportError("");
    try {
      const source = await chooseStoryFile();
      if (!source) return;
      const controller = new AbortController();
      importController.current = controller;
      setImportStatus("Dosya okunuyor…");
      const draft = await readStoryFile(
        source,
        setImportStatus,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        const duplicate = dataRef.current.stories.find(
          (row) =>
            row.title.trim().toLocaleLowerCase("tr") ===
              draft.title.trim().toLocaleLowerCase("tr") ||
            row.sourceName === draft.sourceName,
        );
        openEditor(
          "stories",
          undefined,
          {
            title: draft.title,
            text: draft.text,
            sourceName: draft.sourceName,
            level: "",
          },
          [
            `${draft.sourceName}${draft.pageCount ? ` · ${draft.pageCount} sayfa` : ""}`,
            ...(duplicate
              ? [
                  `Dikkat: “${duplicate.title}” zaten kütüphanede olabilir. Kaydetmeden önce karşılaştır.`,
                ]
              : []),
            "Metni kontrol et, seviyeyi seç ve kaydet. Başlık, sayfa numarası veya alıştırmalar varsa metinden çıkarabilirsin. Asıl dosyan değişmez; buraya yalnızca metni kaydedilir.",
            ...draft.warnings,
          ],
        );
      }
    } catch (error) {
      if (!importController.current?.signal.aborted)
        setImportError(errorMessage(error));
    } finally {
      importController.current = null;
      choosingFile.current = false;
      setImportStatus(null);
    }
  }
  return {
    importStatus,
    importError,
    setImportError,
    importController,
    importStory,
  };
}
