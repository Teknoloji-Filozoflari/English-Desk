import { useState, type RefObject } from "react";
import { removeStory, type Notebook } from "../../model";
import { type Confirm, type Editor, type Persist } from "../types";

export function useNotebookActions(
  dataRef: RefObject<Notebook>,
  persist: Persist,
  setNotice: (message: string) => void,
  onStoryDeleted: () => void,
) {
  const [confirmation, setConfirmation] = useState<Confirm | null>(null);
  function deleteItem(kind: Editor["kind"], itemId: string) {
    setConfirmation({
      title: "Kayıt silinsin mi?",
      message:
        kind === "stories"
          ? "Hikâye ve bu hikâyeye bağlı notlar silinecek. Kaydettiğin kelimeler Kelimelerim bölümünde kalacak."
          : "Bu kayıt defterinden silinecek. Bu işlem geri alınamaz.",
      label: "Sil",
      run: async () => {
        const ok = await persist((current) =>
          kind === "stories"
            ? removeStory(current, itemId)
            : kind === "words"
              ? {
                  ...current,
                  words: current.words.filter((w) => w.id !== itemId),
                }
              : kind === "storyNotes"
                ? {
                    ...current,
                    storyNotes: (current.storyNotes ?? []).filter(
                      (note) => note.id !== itemId,
                    ),
                  }
                : {
                    ...current,
                    grammar: current.grammar.filter((g) => g.id !== itemId),
                  },
        );
        if (ok) {
          if (kind === "stories") onStoryDeleted();
          setNotice("Kayıt silindi.");
        }
        return ok;
      },
    });
  }
  return { confirmation, setConfirmation, deleteItem };
}
