import { useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { BrowserState } from "../../CollectionBrowser";
import type { Notebook, Story, StoryNoteCategory } from "../../model";
import { STORY_NOTE_CATEGORIES } from "../../model";
import { StoryLibrary } from "../../StoryLibrary";
import { Blank, Button } from "../components/ui";
import type { StudyView } from "../hooks/useStudyView";
import { styles } from "../styles";
import { storyNoteLabels, type Editor } from "../types";
type Props = {
  noteFilters: StudyView["noteFilters"];
  data: Notebook;
  desktop: boolean;
  storyBrowser: BrowserState;
  setStoryBrowser: (state: BrowserState) => void;
  busy: boolean;
  storageError: string;
  importStatus: string | null;
  importStory: () => Promise<void>;
  openEditor: (
    kind: Editor["kind"],
    row?: Story,
    preset?: Record<string, string>,
  ) => void;
  onRead: (story: Story) => void;
  onOpenNote: (id: string) => void;
};
export function StoriesScreen({
  noteFilters,
  data,
  desktop,
  storyBrowser,
  setStoryBrowser,
  busy,
  storageError,
  importStatus,
  importStory,
  openEditor,
  onRead,
  onOpenNote,
}: Props) {
  const {
    noteSearch,
    setNoteSearch,
    noteCategory,
    setNoteCategory,
    notePage,
    setNotePage,
  } = noteFilters;
  const matchedNotes = useMemo(
    () =>
      (data.storyNotes ?? []).filter(
        (note) =>
          (noteCategory === "all" || note.category === noteCategory) &&
          `${note.title} ${note.body} ${note.selection} ${(note.tags ?? []).join(" ")} ${data.stories.find((s) => s.id === note.storyId)?.title ?? ""}`
            .toLocaleLowerCase("tr")
            .includes(noteSearch.trim().toLocaleLowerCase("tr")),
      ),
    [data.storyNotes, data.stories, noteCategory, noteSearch],
  );
  const notePages = Math.max(1, Math.ceil(matchedNotes.length / 20));
  return (
    <>
      <StoryLibrary
        stories={data.stories}
        wide={desktop}
        browserState={storyBrowser}
        onBrowserStateChange={setStoryBrowser}
        disabled={busy || !!storageError || !!importStatus}
        onImport={() => {
          void importStory();
        }}
        onAdd={(level) =>
          openEditor("stories", undefined, { level: level ?? "" })
        }
        onEdit={(row) => openEditor("stories", row)}
        onRead={onRead}
      />
      <View style={styles.sectionHeading}>
        <Text style={styles.h2}>Hikâye notlarım</Text>
        <Text style={styles.meta}>{data.storyNotes?.length ?? 0} kayıt</Text>
      </View>
      <TextInput
        accessibilityLabel="Hikâye notlarında ara"
        placeholder="Başlık, not, seçili ifade veya etiket ara…"
        value={noteSearch}
        onChangeText={(value) => {
          setNoteSearch(value);
          setNotePage(1);
        }}
        style={styles.input}
      />
      <View style={styles.levels}>
        {["all", ...STORY_NOTE_CATEGORIES].map((category) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityState={{ selected: noteCategory === category }}
            onPress={() => {
              setNoteCategory(category);
              setNotePage(1);
            }}
            style={[
              styles.level,
              noteCategory === category && styles.activeNav,
            ]}
          >
            <Text
              style={
                noteCategory === category ? styles.activeText : styles.meta
              }
            >
              {category === "all"
                ? "Tümü"
                : storyNoteLabels[category as StoryNoteCategory]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.meta}>{matchedNotes.length} sonuç</Text>
      {matchedNotes
        .slice(
          (Math.min(notePage, notePages) - 1) * 20,
          Math.min(notePage, notePages) * 20,
        )
        .map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="button"
            onPress={() => {
              onOpenNote(note.storyId);
            }}
            style={[styles.card, { marginBottom: 10, padding: 16 }]}
          >
            <Text style={styles.meta}>
              {storyNoteLabels[note.category]} ·{" "}
              {data.stories.find((s) => s.id === note.storyId)?.title}
            </Text>
            <Text style={styles.h2}>{note.title}</Text>
            <Text style={styles.muted}>
              {(note.tags ?? []).map((tag) => `#${tag}`).join("  ")}
            </Text>
          </Pressable>
        ))}
      {notePages > 1 && (
        <View style={styles.actions}>
          <Button
            secondary
            disabled={notePage <= 1}
            onPress={() => setNotePage((page) => page - 1)}
          >
            ← Önceki
          </Button>
          <Text style={styles.meta}>
            Sayfa {notePage} / {notePages}
          </Text>
          <Button
            secondary
            disabled={notePage >= notePages}
            onPress={() => setNotePage((page) => page + 1)}
          >
            Sonraki →
          </Button>
        </View>
      )}
      {!(data.storyNotes ?? []).length && (
        <Blank
          title="Henüz hikâye notun yok"
          description="Hikâyede ifade veya cümle seçerek not ekle; etiketlediğin notları burada bul."
        />
      )}
    </>
  );
}
