import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { wordLevel, type Notebook, type Word } from "../../model";
import { normalizeWord } from "../../word-enrichment";
import { addFamilyCard } from "../../word-family";
import { WORD_TYPES, isVerbType, wordTypeKey } from "../../word-types";
import { styles } from "../styles";
import { makeId as id, type Editor, type Persist } from "../types";
import { Button } from "./ui";
import { WordContextsPanel } from "./WordContextsPanel";
import { wordContexts } from "../../word-context";
type Props = {
  selectedWord: Word | undefined;
  data: Notebook;
  busy: boolean;
  storageError: string;
  wordStatus: string | null;
  setSelectedWordId: (id: string | null) => void;
  persist: Persist;
  enrichCards: (ids: string[]) => Promise<void>;
  refreshTurkishMeaning: (word: Word) => Promise<void>;
  openEditor: (kind: Editor["kind"], row?: Word) => void;
  deleteItem: (kind: Editor["kind"], id: string) => void;
  onOpenStory: (id: string) => void;
};
export function WordDetailsModal({
  selectedWord,
  data,
  busy,
  storageError,
  wordStatus,
  setSelectedWordId,
  persist,
  enrichCards,
  refreshTurkishMeaning,
  openEditor,
  deleteItem,
  onOpenStory,
}: Props) {
  const [sourceCard, setSourceCard] = useState<string | null>(null);
  return (
    <Modal
      visible={!!selectedWord}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedWordId(null)}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.meta}>
                {selectedWord
                  ? wordLevel(selectedWord, data.stories) || "Seviye bekliyor"
                  : ""}
              </Text>
              {selectedWord?.levelSource?.includes("Tahmini") && (
                <Text style={styles.meta}>{"Tahmini seviye"}</Text>
              )}
              <Text style={styles.detailTitle}>{selectedWord?.word}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kelime kartını kapat"
              onPress={() => setSelectedWordId(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {selectedWord && (
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingTop: 20 }]}
            >
              {!!selectedWord.type && (
                <Text style={styles.meta}>{selectedWord.type}</Text>
              )}
              {!!selectedWord.tags?.length && (
                <Text style={styles.meta}>
                  Etiketler: {selectedWord.tags.join(", ")}
                </Text>
              )}
              <WordContextsPanel
                key={selectedWord.id}
                word={selectedWord}
                data={data}
                disabled={busy || !!storageError}
                persist={persist}
                onOpenStory={(id) => {
                  setSelectedWordId(null);
                  onOpenStory(id);
                }}
              />
              {isVerbType(selectedWord.type) && selectedWord.verbForms && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>
                    Fiilin halleri{" "}
                    {selectedWord.verbForms.regularity === "regular"
                      ? "· Düzenli"
                      : selectedWord.verbForms.regularity === "irregular"
                        ? "· Düzensiz"
                        : ""}
                  </Text>
                  <Text selectable style={styles.detailText}>
                    V1 {selectedWord.verbForms.base || selectedWord.word} → V2{" "}
                    {selectedWord.verbForms.past || "—"} → V3{" "}
                    {selectedWord.verbForms.participle || "—"}
                  </Text>
                </View>
              )}
              <Text selectable style={styles.meaning}>
                {selectedWord.meaning || "Türkçe anlam bekliyor"}
              </Text>
              {!!selectedWord.definition && (
                <Text selectable style={styles.muted}>
                  {selectedWord.definition}
                </Text>
              )}
              {!!selectedWord.synonyms && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>Eş anlamlılar</Text>
                  <Text selectable style={styles.detailText}>
                    {selectedWord.synonyms
                      .split(",")
                      .map((item) => item.trim())
                      .join(", ")}
                  </Text>
                </View>
              )}
              {!!selectedWord.antonyms && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>Zıt anlamlılar</Text>
                  <Text selectable style={styles.detailText}>
                    {selectedWord.antonyms
                      .split(",")
                      .map((item) => item.trim())
                      .join(", ")}
                  </Text>
                </View>
              )}
              {!!selectedWord.example &&
                !wordContexts(selectedWord, data.stories).some(
                  (context) =>
                    context.sentence === selectedWord.example &&
                    context.translation === selectedWord.translation,
                ) && (
                  <View style={styles.quote}>
                    <Text selectable style={styles.quoteText}>
                      {selectedWord.example}
                    </Text>
                    {!!selectedWord.translation && (
                      <Text
                        selectable
                        style={[styles.muted, { marginTop: 10 }]}
                      >
                        {selectedWord.translation}
                      </Text>
                    )}
                  </View>
                )}
              {!!selectedWord.examples?.length && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>PDF örnekleri</Text>
                  {selectedWord.examples.map((item, index) => (
                    <View key={index} style={[styles.quote, { marginTop: 10 }]}>
                      <Text selectable style={styles.quoteText}>
                        {item.example}
                      </Text>
                      <Text selectable style={styles.muted}>
                        {item.translation}
                      </Text>
                      <Text selectable style={styles.meta}>
                        {item.source}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {!!selectedWord.senses?.length && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>Diğer anlamlar</Text>
                  {selectedWord.senses.map((sense, index) => (
                    <View key={index} style={[styles.quote, { marginTop: 10 }]}>
                      <Text selectable style={styles.meaning}>
                        {index + 2}. {sense.meaning}
                      </Text>
                      {!!sense.definition && (
                        <Text selectable style={styles.muted}>
                          {sense.definition}
                        </Text>
                      )}
                      {!!sense.example && (
                        <Text selectable style={styles.quoteText}>
                          {sense.example}
                        </Text>
                      )}
                      {!!sense.translation && (
                        <Text selectable style={styles.muted}>
                          {sense.translation}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {!!selectedWord.family?.length && (
                <View style={styles.detailSection}>
                  <Text style={styles.label}>Kelime ailesi</Text>
                  <Text style={styles.hint}>
                    İlgili yapıları burada incele; ayrı çalışmak istediklerini
                    kelimelerine ekle.
                  </Text>
                  {selectedWord.family.map((member, index) => {
                    const existing = data.words.find(
                      (w) =>
                        normalizeWord(w.word) === normalizeWord(member.word) &&
                        wordTypeKey(w.type) === wordTypeKey(member.type),
                    );
                    return (
                      <View
                        key={`${member.word}-${index}`}
                        style={[styles.quote, { marginTop: 10 }]}
                      >
                        <Text selectable style={styles.h2}>
                          {member.word}
                        </Text>
                        <Text style={styles.meta}>
                          {WORD_TYPES.find(
                            ([key]) => key === member.type,
                          )?.[1] ?? member.type}
                          {member.level ? ` · ${member.level}` : ""}
                        </Text>
                        <Text selectable style={styles.detailText}>
                          {member.meaning}
                        </Text>
                        <Button
                          small
                          secondary
                          disabled={busy || !!storageError}
                          onPress={() => {
                            if (existing) {
                              setSelectedWordId(existing.id);
                              return;
                            }
                            let cardId = "";
                            void persist((current) => {
                              const result = addFamilyCard(
                                current,
                                selectedWord,
                                member,
                                id,
                              );
                              cardId = result.card.id;
                              return result.data;
                            }).then((saved) => {
                              if (saved) {
                                setSelectedWordId(cardId);
                                setSourceCard(null);
                                if (Platform.OS === "web")
                                  void enrichCards([cardId]);
                              }
                            });
                          }}
                        >
                          {existing ? "Kartı aç" : "Kelimelerime ekle"}
                        </Button>
                      </View>
                    );
                  })}
                </View>
              )}
              {!!selectedWord.generatedFrom && (
                <Text style={styles.meta}>
                  “{selectedWord.generatedFrom}” kelimesinden oluşturuldu.
                </Text>
              )}
              {(!!selectedWord.sources || !!selectedWord.levelSource) && (
                <View style={styles.detailSection}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: sourceCard === selectedWord.id,
                    }}
                    onPress={() =>
                      setSourceCard(
                        sourceCard === selectedWord.id ? null : selectedWord.id,
                      )
                    }
                    style={styles.sourcesToggle}
                  >
                    <Text style={styles.textButtonLabel}>Kaynaklar</Text>
                    <Text style={styles.meta}>
                      {sourceCard === selectedWord.id ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {sourceCard === selectedWord.id && (
                    <View style={{ gap: 12, paddingTop: 12 }}>
                      {!!selectedWord.levelSource && (
                        <Text selectable style={styles.meta}>
                          Seviye kaynağı: {selectedWord.levelSource}
                        </Text>
                      )}
                      {!!selectedWord.sources && (
                        <Text selectable style={styles.meta}>
                          {selectedWord.sources}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
              <View style={styles.actions}>
                <Button
                  secondary
                  onPress={() => {
                    setSelectedWordId(null);
                    openEditor("words", selectedWord);
                  }}
                >
                  Düzenle
                </Button>
                {Platform.OS === "web" && (
                  <Button
                    secondary
                    disabled={busy || !!storageError || !!wordStatus}
                    onPress={() => {
                      setSelectedWordId(null);
                      void refreshTurkishMeaning(selectedWord);
                    }}
                  >
                    Türkçe anlamı yenile
                  </Button>
                )}
                {Platform.OS === "web" && (
                  <Button
                    secondary
                    disabled={busy || !!storageError || !!wordStatus}
                    onPress={() => {
                      setSelectedWordId(null);
                      void enrichCards([selectedWord.id]);
                    }}
                  >
                    Sözlükten tamamla
                  </Button>
                )}
                {!!selectedWord.storyId && (
                  <Button
                    secondary
                    onPress={() => {
                      setSelectedWordId(null);
                      onOpenStory(selectedWord.storyId);
                    }}
                  >
                    Hikâyeye git
                  </Button>
                )}
                <Button
                  danger
                  onPress={() => {
                    setSelectedWordId(null);
                    deleteItem("words", selectedWord.id);
                  }}
                >
                  Sil
                </Button>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
