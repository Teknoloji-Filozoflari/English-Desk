import { Platform, Pressable, Text, View } from "react-native";
import { CollectionBrowser } from "../../CollectionBrowser";
import { StudyHeader } from "../../StudyHeader";
import { WordReview } from "../../WordReview";
import type { Notebook, Word } from "../../model";
import { wordLevel } from "../../model";
import { Button } from "../components/ui";
import type { StudyView } from "../hooks/useStudyView";
import { styles } from "../styles";
import { type Editor, type Persist } from "../types";
import { MemorizationScreen } from "./MemorizationScreen";
import { enrollMemorization, recordWordReview } from "../services/repetition";
import { WordPracticeScreen } from "./WordPracticeScreen";
import { useState } from "react";
import { WordTransferModal } from "../components/WordTransferModal";
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
  const [transfer, setTransfer] = useState(false);
  return (
    <>
      {transfer && (
        <WordTransferModal
          data={data}
          persist={persist}
          disabled={busy || !!storageError}
          onClose={() => setTransfer(false)}
        />
      )}
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
          aria-selected={wordSection === "practice"}
          accessibilityState={{ selected: wordSection === "practice" }}
          onPress={() => setWordSection("practice")}
          style={[styles.level, wordSection === "practice" && styles.activeNav]}
        >
          <Text
            style={wordSection === "practice" ? styles.activeText : styles.meta}
          >
            Kelime testleri
          </Text>
        </Pressable>
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
          onPress={() => {
            wordReview.setScheduledOnly(false);
            setWordSection("review");
          }}
          style={[styles.level, wordSection === "review" && styles.activeNav]}
        >
          <Text
            style={wordSection === "review" ? styles.activeText : styles.meta}
          >
            Tekrar et
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: wordSection === "memorization" }}
          onPress={() => {
            wordReview.setMemorizationFilter("due");
            setWordSection("memorization");
          }}
          style={[
            styles.level,
            wordSection === "memorization" && styles.activeNav,
          ]}
        >
          <Text
            style={
              wordSection === "memorization" ? styles.activeText : styles.meta
            }
          >
            Ezber
          </Text>
        </Pressable>
      </View>
      {wordSection === "practice" ? (
        <WordPracticeScreen
          data={data}
          persist={persist}
          disabled={busy || !!storageError}
        />
      ) : wordSection === "memorization" ? (
        <MemorizationScreen
          key={wordReview.memorizationFilter}
          initialFilter={wordReview.memorizationFilter}
          words={data.words}
          disabled={busy || !!storageError}
          persist={persist}
          onChooseWords={() => setWordSection("cards")}
          onOpenWord={onOpenWord}
        />
      ) : wordSection === "review" ? (
        <WordReview
          words={
            wordReview.scheduledOnly
              ? data.words.filter((word) => !!word.review)
              : data.words
          }
          disabled={busy || !!storageError}
          onReview={(wordId, result, expected) =>
            persist((current) =>
              recordWordReview(current, wordId, expected, result),
            )
          }
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
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                flexWrap: "wrap",
                maxWidth: "100%",
              }}
            >
              <Button
                small
                secondary
                disabled={busy || !!storageError}
                onPress={() => setTransfer(true)}
              >
                CSV / TSV aktarımı
              </Button>
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
            renderAction={(id) => {
              const enrolled = !!data.words.find((word) => word.id === id)
                ?.memorization;
              return (
                <Button
                  small
                  secondary
                  disabled={enrolled || busy || !!storageError}
                  onPress={() => {
                    void persist((current) => enrollMemorization(current, id));
                  }}
                >
                  {enrolled ? "✓ Ezber listesinde" : "Ezbere ekle"}
                </Button>
              );
            }}
            wide={desktop}
            items={data.words.map((word) => ({
              id: word.id,
              title: word.word,
              search: [
                word.word,
                word.meaning,
                word.example,
                ...(word.examples ?? []).map((example) => example.example),
                ...(word.senses ?? []).map((sense) => sense.meaning),
                ...(word.tags ?? []),
                ...(word.contexts ?? []).flatMap((context) => [
                  context.sentence,
                  context.meaning,
                  context.storyTitle,
                ]),
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
