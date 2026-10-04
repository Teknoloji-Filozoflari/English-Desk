import type { Notebook, StoryNoteCategory } from "../model";
export type Page = "stories" | "words" | "grammar" | "exams";
export type Editor = {
  kind: "stories" | "words" | "grammar" | "storyNotes";
  id?: string;
  values: Record<string, string>;
  importNotes: string[];
};
export const storyNoteLabels: Record<StoryNoteCategory, string> = {
  grammar: "Gramer",
  pattern: "Kelime kalıbı",
  connector: "Bağlaç",
  other: "Diğer",
};
export type Confirm = {
  title: string;
  message: string;
  run: () => Promise<boolean>;
  label: string;
};

export type Persist = (
  update: (current: Notebook) => Notebook,
  recovery?: boolean,
) => Promise<boolean>;
export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "İşlem tamamlanamadı.";
