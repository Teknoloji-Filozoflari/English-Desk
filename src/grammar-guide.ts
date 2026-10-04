import { isTenseName, type TenseName } from "./tenses.ts";
import { isModalityTopic, type ModalityTopic } from "./modality.ts";
import type { Notebook } from "./model.ts";
export type HiddenGrammarTopics = {
  tenses: TenseName[];
  modality: ModalityTopic[];
};
export function validateHiddenGrammarTopics(
  value: unknown,
): HiddenGrammarTopics {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Gramer rehberi ayarları geçersiz.");
  const row = value as HiddenGrammarTopics;
  if (
    !Array.isArray(row.tenses) ||
    !Array.isArray(row.modality) ||
    row.tenses.length > 12 ||
    row.modality.length > 16 ||
    row.tenses.some((t) => !isTenseName(t)) ||
    row.modality.some((t) => !isModalityTopic(t))
  )
    throw Error("Gramer rehberi başlıkları geçersiz.");
  return {
    tenses: [...new Set(row.tenses)],
    modality: [...new Set(row.modality)],
  };
}
export function removeGuideTopic(
  data: Notebook,
  section: "tenses" | "modality",
  topic: TenseName | ModalityTopic,
): Notebook {
  const hidden = validateHiddenGrammarTopics({
    ...{ tenses: [], modality: [] },
    ...data.hiddenGrammarTopics,
    [section]: [...(data.hiddenGrammarTopics?.[section] ?? []), topic],
  });
  const field = section === "tenses" ? "tense" : "modality";
  return {
    ...data,
    hiddenGrammarTopics: hidden,
    grammar: data.grammar.map((note) => {
      if (note[field] !== topic) return note;
      const copy = { ...note };
      delete copy[field];
      return copy;
    }),
  };
}
export function restoreGuideTopic(
  data: Notebook,
  section: "tenses" | "modality",
  topic: TenseName | ModalityTopic,
): Notebook {
  return {
    ...data,
    hiddenGrammarTopics: validateHiddenGrammarTopics({
      ...{ tenses: [], modality: [] },
      ...data.hiddenGrammarTopics,
      [section]: (data.hiddenGrammarTopics?.[section] ?? []).filter(
        (t) => t !== topic,
      ),
    }),
  };
}
