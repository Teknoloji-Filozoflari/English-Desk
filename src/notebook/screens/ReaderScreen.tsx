import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Notebook, Story, StoryNote, Token, Word } from "../../model";
import { ReadingText } from "../../ReadingText";
import { StoryAudio } from "../../StoryAudio";
import { StorySeriesPanel } from "../../StorySeriesPanel";
import { Blank, Button } from "../components/ui";
import type { StudyView } from "../hooks/useStudyView";
import { styles } from "../styles";
import { storyNoteLabels, type Editor, type Persist } from "../types";
type Props = {
  readerSettings: StudyView["readerSettings"];
  data: Notebook;
  story: Story;
  desktop: boolean;
  busy: boolean;
  editor: Editor | null;
  selectedWord: Word | undefined;
  readingText: string;
  phraseMode: boolean;
  setPhraseMode: (value: boolean) => void;
  phraseStart: Token | null;
  setPhraseStart: (value: Token | null) => void;
  sentenceMode: boolean;
  setSentenceMode: (value: boolean) => void;
  persist: Persist;
  onBack: () => void;
  openEditor: (kind: Editor["kind"], row?: Story | StoryNote) => void;
  deleteItem: (kind: Editor["kind"], id: string) => void;
  openChapter: (story: Story) => void;
  pickToken: (token: Token) => void;
  wordCard: (word: Word) => React.ReactNode;
};
export function ReaderScreen({
  readerSettings,
  data,
  story,
  desktop,
  busy,
  editor,
  selectedWord,
  readingText,
  phraseMode,
  setPhraseMode,
  phraseStart,
  setPhraseStart,
  sentenceMode,
  setSentenceMode,
  persist,
  onBack,
  openEditor,
  deleteItem,
  openChapter,
  pickToken,
  wordCard,
}: Props) {
  const {
    readerSize,
    setReaderSize,
    readerSpacing,
    setReaderSpacing,
    readerSettingsOpen,
    setReaderSettingsOpen,
  } = readerSettings;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={styles.back}
        onPress={() => onBack()}
      >
        <Text style={styles.textButtonLabel}>← Hikâyelerime dön</Text>
      </Pressable>
      <View style={[styles.reader, !desktop && { padding: 22 }]}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {story.level}
            {story.sample ? " · Örnek hikâye" : ""}
          </Text>
        </View>
        <Text style={styles.readerTitle}>{story.title}</Text>
        <Text style={styles.hint}>
          Tek kelimeye dokunarak kelime kartı aç. İfade veya cümle seçerek
          yalnızca bu hikâyeye bağlı gramer ve kalıp notu ekle.
        </Text>
        <View style={styles.actions}>
          <Button
            secondary
            onPress={() => setReaderSettingsOpen((value) => !value)}
          >
            Okuma görünümü
          </Button>
        </View>
        {readerSettingsOpen && (
          <View style={styles.tip}>
            <Text style={styles.hint}>
              Yalnızca okuma metninin görünümünü değiştirir.
            </Text>
            <View style={styles.actions}>
              <Button
                secondary
                onPress={() => setReaderSize((size) => Math.max(18, size - 2))}
              >
                Yazı küçült
              </Button>
              <Text style={styles.meta}>{readerSize} px</Text>
              <Button
                secondary
                onPress={() => setReaderSize((size) => Math.min(30, size + 2))}
              >
                Yazı büyüt
              </Button>
              <Button
                secondary
                onPress={() =>
                  setReaderSpacing((value) => (value === 1.9 ? 2.2 : 1.9))
                }
              >
                {readerSpacing === 1.9
                  ? "Satır aralığını aç"
                  : "Satır aralığını daralt"}
              </Button>
              <Button
                secondary
                onPress={() => {
                  setReaderSize(22);
                  setReaderSpacing(1.9);
                }}
              >
                Varsayılana dön
              </Button>
            </View>
          </View>
        )}
        <View style={styles.actions}>
          <Button
            secondary
            onPress={() => {
              setPhraseMode(!phraseMode);
              setPhraseStart(null);
              setSentenceMode(false);
            }}
          >
            {phraseMode ? "Seçimi iptal et" : "İfade seç"}
          </Button>
          <Button
            secondary
            onPress={() => {
              setSentenceMode(!sentenceMode);
              setPhraseMode(false);
              setPhraseStart(null);
            }}
          >
            {sentenceMode ? "Cümle seçimini iptal et" : "Cümleyi seç"}
          </Button>
          <Button
            secondary
            disabled={busy}
            onPress={() => {
              void persist((current) => ({
                ...current,
                stories: current.stories.map((s) =>
                  s.id === story.id ? { ...s, read: !s.read } : s,
                ),
              }));
            }}
          >
            {story.read ? "✓ Okundu · Geri al" : "Okudum"}
          </Button>
          <Button secondary onPress={() => openEditor("stories", story)}>
            Düzenle
          </Button>
          <Button danger onPress={() => deleteItem("stories", story.id)}>
            Sil
          </Button>
        </View>
        {phraseMode && (
          <View style={styles.tip}>
            <Text accessibilityLiveRegion="polite" style={styles.tipText}>
              {phraseStart
                ? `“${phraseStart.text}” seçildi. Şimdi ifadenin son kelimesine dokun.`
                : "Not almak istediğin ifadenin ilk ve son kelimesine dokun. Tek kelimelik bağlaç için aynı kelimeye iki kez dokun."}
            </Text>
          </View>
        )}
        {sentenceMode && (
          <View style={styles.tip}>
            <Text accessibilityLiveRegion="polite" style={styles.tipText}>
              Not almak istediğin cümlenin içindeki herhangi bir kelimeye dokun.
            </Text>
          </View>
        )}
        <StorySeriesPanel
          stories={data.stories}
          currentId={story.id}
          onOpen={openChapter}
        />
        {!!story.audioId && (
          <StoryAudio
            key={story.id}
            audioId={story.audioId}
            pauseForEditor={!!editor || !!selectedWord}
          />
        )}
        <ReadingText
          text={readingText}
          savedWords={data.words.filter(
            (w) => w.storyId === story.id || w.storyIds?.includes(story.id),
          )}
          savedNotes={(data.storyNotes ?? []).filter(
            (note) => note.storyId === story.id,
          )}
          selectedStart={phraseStart?.start}
          onPick={pickToken}
          fontSize={readerSize}
          lineHeight={readerSpacing}
        />
        <StorySeriesPanel
          compact
          stories={data.stories}
          currentId={story.id}
          onOpen={openChapter}
        />
      </View>
      <View style={styles.sectionHeading}>
        <Text style={styles.h2}>Bu hikâyeden kelimeler</Text>
        <Text style={styles.meta}>
          {
            data.words.filter(
              (w) => w.storyId === story.id || w.storyIds?.includes(story.id),
            ).length
          }{" "}
          kayıt
        </Text>
      </View>
      <View style={styles.cards}>
        {data.words
          .filter(
            (w) => w.storyId === story.id || w.storyIds?.includes(story.id),
          )
          .map(wordCard)}
      </View>
      {!data.words.some(
        (w) => w.storyId === story.id || w.storyIds?.includes(story.id),
      ) && (
        <Blank
          title="Kelimelerin burada birikecek"
          description="Hikâyedeki bir kelimeye dokunup Türkçe anlamını ekle."
        />
      )}
      <View style={styles.sectionHeading}>
        <Text style={styles.h2}>Bu hikâyeden notlar</Text>
        <Text style={styles.meta}>
          {
            (data.storyNotes ?? []).filter((note) => note.storyId === story.id)
              .length
          }{" "}
          kayıt
        </Text>
      </View>
      {(data.storyNotes ?? [])
        .filter((note) => note.storyId === story.id)
        .map((note) => (
          <View key={note.id} style={[styles.card, { marginBottom: 16 }]}>
            <Text style={styles.meta}>{storyNoteLabels[note.category]}</Text>
            <Text style={[styles.h2, { marginTop: 8 }]}>{note.title}</Text>
            {!!note.tags?.length && (
              <Text style={styles.muted}>
                {note.tags.map((tag) => `#${tag}`).join("  ")}
              </Text>
            )}
            <View style={styles.quote}>
              <Text selectable style={styles.quoteText}>
                “{note.selection}”
              </Text>
            </View>
            <Text selectable style={styles.grammarText}>
              {note.body}
            </Text>
            <View style={styles.actions}>
              <Button secondary onPress={() => openEditor("storyNotes", note)}>
                Düzenle
              </Button>
              <Button danger onPress={() => deleteItem("storyNotes", note.id)}>
                Sil
              </Button>
            </View>
          </View>
        ))}
      {!(data.storyNotes ?? []).some((note) => note.storyId === story.id) && (
        <Blank
          title="Hikâye notların burada birikecek"
          description="İfade veya cümle seçerek gramer, kelime kalıbı ve bağlaç notlarını bu hikâyeye kaydet."
        />
      )}
    </>
  );
}
