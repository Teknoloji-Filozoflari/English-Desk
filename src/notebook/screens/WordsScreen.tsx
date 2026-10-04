import { Platform, Pressable, Text, View } from "react-native";
import { CollectionBrowser } from "../../CollectionBrowser";
import { StudyHeader } from "../../StudyHeader";
import { WordReview } from "../../WordReview";
import type { Notebook, Word } from "../../model";
import { wordLevel } from "../../model";
import { reviewWord } from "../../review";
import { Button } from "../components/ui";
import type { StudyView } from "../hooks/useStudyView";
import { styles } from "../styles";
import { type Editor, type Persist } from "../types";
type Props = {
  wordReview: StudyView["wordReview"];
  data: Notebook;
  desktop: boolean;
  busy: boolean;
  storageError: string;
  wordStatus: string | null;
  wordMessages: string[];
  setWordMessages: (messages: string[]) => void;
  persist: Persist;
  enrichCards: (ids: string[]) => Promise<void>;
  openEditor: (
    kind: Editor["kind"],
    row?: Word,
    preset?: Record<string, string>,
  ) => void;
  onOpenWord: (id: string) => void;
};
export function WordsScreen({
  wordReview,
  data,
  desktop,
  busy,
  storageError,
  wordStatus,
  wordMessages,
  setWordMessages,
  persist,
  enrichCards,
  openEditor,
  onOpenWord,
}: Props) {
  const { wordSection, setWordSection } = wordReview;
  return (
    <>
      <StudyHeader
        eyebrow="KELİME ATÖLYESİ"
        title="Kelimelerle büyü."
        description="Bir kelime, yeni bir düşünce. Kendi sözlüğünü adım adım oluştur."
        count={data.words.length}
        unit="kelime kartı"
        wide={desktop}
      />
      <View style={[styles.levels, { marginBottom: 24 }]}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: wordSection === "cards" }}
          onPress={() => setWordSection("cards")}
          style={[styles.level, wordSection === "cards" && styles.activeNav]}
        >
          <Text
            style={wordSection === "cards" ? styles.activeText : styles.meta}
          >
            Kelimelerim
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: wordSection === "review" }}
          onPress={() => setWordSection("review")}
          style={[styles.level, wordSection === "review" && styles.activeNav]}
        >
          <Text
            style={wordSection === "review" ? styles.activeText : styles.meta}
          >
            Tekrar et
          </Text>
        </Pressable>
      </View>
      {wordSection === "review" ? (
        <WordReview
          words={data.words}
          disabled={busy || !!storageError}
          onReview={(wordId, result) => {
            void persist((current) => ({
              ...current,
              words: current.words.map((word) =>
                word.id === wordId ? reviewWord(word, result) : word,
              ),
            }));
          }}
        />
      ) : (
        <>
          {wordMessages.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.h2}>Sözlük notları</Text>
              {wordMessages.slice(0, 8).map((message, i) => (
                <Text key={i} style={styles.hint}>
                  {message}
                </Text>
              ))}
              {wordMessages.length > 8 && (
                <Text style={styles.hint}>
                  {wordMessages.length - 8} ek uyarı var. Eksik alanlar
                  kartlarda görünür.
                </Text>
              )}
              <Button small secondary onPress={() => setWordMessages([])}>
                Bildirimi kapat
              </Button>
            </View>
          )}
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.h1}>Kelime koleksiyonum</Text>
              <Text style={styles.muted}>
                Bir kart seç, anlamını ve kullanımını keşfet.
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {Platform.OS === "web" && (
                <Button
                  small
                  secondary
                  disabled={
                    busy || !!storageError || !!wordStatus || !data.words.length
                  }
                  onPress={() => {
                    void enrichCards(
                      data.words
                        .filter((w) => !w.meaning || !w.definition || !w.level)
                        .map((w) => w.id),
                    );
                  }}
                >
                  Eksik bilgileri tamamla
                </Button>
              )}
              <Button
                onPress={() => openEditor("words", undefined, { level: "" })}
              >
                + Kelime ekle
              </Button>
            </View>
          </View>
          <CollectionBrowser
            kind="words"
            wide={desktop}
            items={data.words.map((word) => ({
              id: word.id,
              title: word.word,
              search: [
                word.word,
                word.meaning,
                ...(word.senses ?? []).map((sense) => sense.meaning),
              ].join(" "),
              level: wordLevel(word, data.stories),
              wordType: word.type,
              verbRegularity: word.verbForms?.regularity,
            }))}
            onOpen={onOpenWord}
          />
        </>
      )}
    </>
  );
}
