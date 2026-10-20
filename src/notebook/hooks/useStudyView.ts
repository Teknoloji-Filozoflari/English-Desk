import { useState } from "react";

// Keep view preferences alive when switching between screens.
export function useStudyView() {
  const [wordSection, setWordSection] = useState<
    "cards" | "review" | "memorization" | "practice"
  >("cards");
  const [memorizationFilter, setMemorizationFilter] = useState<
    "due" | "learning"
  >("due");
  const [scheduledOnly, setScheduledOnly] = useState(false);
  const [readerSize, setReaderSize] = useState(22);
  const [readerSpacing, setReaderSpacing] = useState(1.9);
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteCategory, setNoteCategory] = useState("all");
  const [notePage, setNotePage] = useState(1);
  return {
    wordReview: {
      wordSection,
      setWordSection,
      memorizationFilter,
      setMemorizationFilter,
      scheduledOnly,
      setScheduledOnly,
    },
    readerSettings: {
      readerSize,
      setReaderSize,
      readerSpacing,
      setReaderSpacing,
      readerSettingsOpen,
      setReaderSettingsOpen,
    },
    noteFilters: {
      noteSearch,
      setNoteSearch,
      noteCategory,
      setNoteCategory,
      notePage,
      setNotePage,
    },
  };
}
export type StudyView = ReturnType<typeof useStudyView>;
