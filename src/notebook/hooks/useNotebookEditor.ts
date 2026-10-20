import { useState, type RefObject } from "react";
import { Platform } from "react-native";
import {
  wordLevel,
  type Grammar,
  type Notebook,
  type Story,
  type StoryNote,
  type Word,
  type WordSense,
} from "../../model";
import { applyEditor } from "../services/editor";
import {
  errorMessage,
  makeId as id,
  type Editor,
  type Persist,
} from "../types";

export function useNotebookEditor(
  dataRef: RefObject<Notebook>,
  persist: Persist,
  enrichCards: (ids: string[]) => Promise<void>,
  setNotice: (message: string) => void,
  setFormError: (message: string) => void,
) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [extraSenses, setExtraSenses] = useState<WordSense[]>([]);
  function openEditor(
    kind: Editor["kind"],
    row?: Story | Word | Grammar | StoryNote,
    preset: Record<string, string> = {},
    importNotes: string[] = [],
  ) {
    setFormError("");
    setExtraSenses(
      kind === "words"
        ? ((row as Word | undefined)?.senses ?? []).map((sense) => ({
            ...sense,
          }))
        : [],
    );
    const values: Record<string, string> =
      kind === "stories"
        ? { title: "", text: "", level: "" }
        : kind === "words"
          ? {
              word: "",
              meaning: "",
              type: "",
              synonyms: "",
              antonyms: "",
              example: "",
              translation: "",
              storyId: "",
              level: "",
            }
          : kind === "storyNotes"
            ? {
                storyId: "",
                selection: "",
                category: "grammar",
                title: "",
                body: "",
              }
            : { title: "", body: "" };
    const strings = row
      ? Object.fromEntries(
          Object.entries(row).filter(([, v]) => typeof v === "string"),
        )
      : {};
    const forms =
      kind === "words" ? (row as Word | undefined)?.verbForms : undefined;
    setEditor({
      kind,
      id: row?.id,
      values: {
        ...values,
        ...strings,
        ...(kind === "words" && row
          ? { level: wordLevel(row as Word, dataRef.current.stories) }
          : {}),
        ...(forms
          ? {
              verbBase: forms.base,
              verbPast: forms.past,
              verbParticiple: forms.participle,
              verbRegularity: forms.regularity,
            }
          : {}),
        ...((kind === "storyNotes" || kind === "words") && row
          ? { tags: ((row as StoryNote | Word).tags ?? []).join(", ") }
          : {}),
        ...preset,
      } as Record<string, string>,
      importNotes,
    });
  }
  async function submitEditor() {
    if (!editor) return;
    let result: ReturnType<typeof applyEditor>;
    try {
      result = applyEditor(dataRef.current, editor, extraSenses, id);
    } catch (error) {
      setFormError(errorMessage(error));
      return;
    }
    const ok = await persist(() => result.data);
    if (ok) {
      setEditor(null);
      setNotice("Kaydedildi.");
      if (editor.kind === "words" && Platform.OS === "web")
        void enrichCards([result.recordId]);
    }
  }
  return {
    editor,
    setEditor,
    extraSenses,
    setExtraSenses,
    openEditor,
    submitEditor,
  };
}
