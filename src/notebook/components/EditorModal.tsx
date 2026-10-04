import type { Topic } from "../../topics";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { isModalityTopic } from "../../modality";
import { LEVELS, STORY_NOTE_CATEGORIES, type WordSense } from "../../model";
import { isTenseName } from "../../tenses";
import { isVerbType } from "../../word-types";
import { WordTypePicker } from "../../WordTypePicker";
import { styles } from "../styles";
import { storyNoteLabels, type Editor } from "../types";
import { Button, Field } from "./ui";
type Props = {
  editor: Editor | null;
  grammarTopics: Topic[];
  setEditor: React.Dispatch<React.SetStateAction<Editor | null>>;
  extraSenses: WordSense[];
  setExtraSenses: React.Dispatch<React.SetStateAction<WordSense[]>>;
  busy: boolean;
  storageError: string;
  formError: string;
  setFormError: (message: string) => void;
  submitEditor: () => Promise<void>;
};
export function EditorModal({
  editor,
  grammarTopics,
  setEditor,
  extraSenses,
  setExtraSenses,
  busy,
  storageError,
  formError,
  setFormError,
  submitEditor,
}: Props) {
  const field = (
    name: string,
    label: string,
    multiline = false,
    large = false,
  ) => (
    <React.Fragment key={name}>
      {name === "word" &&
        !!editor?.values.storyId &&
        !!editor.values.example && (
          <View style={styles.quote}>
            <Text style={styles.label}>Hikâyedeki cümle</Text>
            <Text selectable style={styles.quoteText}>
              {editor.values.example}
            </Text>
          </View>
        )}
      <Field
        label={label}
        value={editor?.values[name] ?? ""}
        multiline={multiline}
        large={large}
        onChange={(value) => {
          setFormError("");
          setEditor((current) =>
            current
              ? { ...current, values: { ...current.values, [name]: value } }
              : null,
          );
        }}
      />
    </React.Fragment>
  );
  return (
    <Modal
      visible={!!editor}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) setEditor(null);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.h2}>
              {editor?.id
                ? "Kaydı düzenle"
                : editor?.importNotes.length
                  ? "Dosya önizlemesi"
                  : editor?.kind === "stories"
                    ? "Yeni hikâye"
                    : editor?.kind === "words"
                      ? "Kelime ekle"
                      : editor?.kind === "storyNotes"
                        ? "Hikâye notu ekle"
                        : "Yeni gramer konusu"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pencereyi kapat"
              disabled={busy}
              onPress={() => setEditor(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {!!formError && (
            <View
              style={[
                styles.errorBox,
                {
                  marginHorizontal: 24,
                  marginTop: 12,
                  marginBottom: 0,
                  padding: 12,
                },
              ]}
            >
              <Text
                accessibilityRole="alert"
                style={[styles.errorText, { marginTop: 0 }]}
              >
                {formError}
              </Text>
            </View>
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}
          >
            {editor?.kind === "stories" && (
              <>
                {editor.importNotes.length > 0 && (
                  <View style={styles.tip}>
                    {editor.importNotes.map((note, index) => (
                      <Text
                        key={index}
                        style={[styles.tipText, { marginBottom: 8 }]}
                      >
                        {note}
                      </Text>
                    ))}
                  </View>
                )}
                {field("title", "Hikâye başlığı *")}
                <Text style={styles.label}>Seviye *</Text>
                <View style={styles.levels}>
                  {LEVELS.map((level) => (
                    <Pressable
                      key={level}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: editor.values.level === level,
                      }}
                      onPress={() =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                values: { ...current.values, level },
                              }
                            : null,
                        )
                      }
                      style={[
                        styles.level,
                        editor.values.level === level && styles.activeNav,
                      ]}
                    >
                      <Text
                        style={
                          editor.values.level === level
                            ? styles.activeText
                            : styles.meta
                        }
                      >
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {field("text", "İngilizce hikâye *", true, true)}
              </>
            )}
            {editor?.kind === "words" && (
              <>
                {field("word", "İngilizce kelime veya ifade *")}
                {field("meaning", "İlk Türkçe anlam / açıklama")}
                {field("definition", "İlk İngilizce sözlük açıklaması", true)}
                <Text style={styles.label}>Seviye (isteğe bağlı)</Text>
                <View style={styles.levels}>
                  {LEVELS.map((level) => (
                    <Pressable
                      key={level}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: editor.values.level === level,
                      }}
                      onPress={() =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                values: {
                                  ...current.values,
                                  level,
                                  levelSource: "",
                                },
                              }
                            : null,
                        )
                      }
                      style={[
                        styles.level,
                        editor.values.level === level && styles.activeNav,
                      ]}
                    >
                      <Text
                        style={
                          editor.values.level === level
                            ? styles.activeText
                            : styles.meta
                        }
                      >
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>
                  Yalnızca kelimeyi yazıp kaydedebilirsin. Boş alanlar sözlükten
                  tamamlanır; yazdığın bilgiler korunur. Seviye boşsa yerel
                  listeden aranır. Otomatik sonuçlar ilk anlama eklenir; diğer
                  anlamları sen ayrı girersin.
                </Text>
                <Button
                  small
                  secondary
                  onPress={() =>
                    setEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: {
                              ...current.values,
                              level: "",
                              levelSource: "",
                            },
                          }
                        : null,
                    )
                  }
                >
                  Seviyeyi otomatik bul
                </Button>
                <WordTypePicker
                  value={editor.values.type}
                  onChange={(type) =>
                    setEditor((current) =>
                      current
                        ? { ...current, values: { ...current.values, type } }
                        : null,
                    )
                  }
                />
                {isVerbType(editor.values.type) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.label}>Fiilin halleri</Text>
                    <View style={styles.levels}>
                      {(
                        [
                          ["", "Belirlenmemi?"],
                          ["regular", "D?zenli"],
                          ["irregular", "D?zensiz"],
                        ] as const
                      ).map(([value, label]) => (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked:
                              (editor.values.verbRegularity || "") === value,
                          }}
                          onPress={() =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    values: {
                                      ...current.values,
                                      verbRegularity: value,
                                    },
                                  }
                                : null,
                            )
                          }
                          style={[
                            styles.level,
                            (editor.values.verbRegularity || "") === value &&
                              styles.activeNav,
                          ]}
                        >
                          <Text
                            style={
                              (editor.values.verbRegularity || "") === value
                                ? styles.activeText
                                : styles.meta
                            }
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {field("verbBase", "V1 ? Mastar (bo?sa karttaki kelime)")}
                    {field("verbPast", "V2 ? Ge?mi? zaman")}
                    {field("verbParticiple", "V3 ? ???nc? h?l")}
                  </View>
                )}
                {field("synonyms", "Eş anlamlılar (virgülle ayır)")}
                {field("antonyms", "Zıt anlamlılar (virgülle ayır)")}
                <Text style={styles.hint}>
                  Yalnızca bu alanlara yazdığın kelimeler için kart oluşturulur.
                  Boş bırakırsan ek kart oluşmaz.
                </Text>
                {field("example", "İlk anlamın örnek cümlesi", true)}
                {field("translation", "Cümlenin Türkçe çevirisi", true)}
                <Text style={styles.label}>Diğer anlamlar</Text>
                {extraSenses.map((sense, index) => (
                  <View key={index} style={[styles.quote, { marginTop: 10 }]}>
                    <Text style={styles.h2}>{index + 2}. anlam</Text>
                    {(
                      [
                        "meaning",
                        "definition",
                        "example",
                        "translation",
                      ] as const
                    ).map((key) => (
                      <Field
                        key={key}
                        label={
                          {
                            meaning: "Türkçe anlam *",
                            definition: "İngilizce açıklama",
                            example: "Örnek cümle",
                            translation: "Örneğin çevirisi",
                          }[key]
                        }
                        value={sense[key]}
                        multiline={key === "example" || key === "translation"}
                        onChange={(value) =>
                          setExtraSenses((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, [key]: value } : item,
                            ),
                          )
                        }
                      />
                    ))}
                    <Button
                      danger
                      onPress={() =>
                        setExtraSenses((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Bu anlamı sil
                    </Button>
                  </View>
                ))}
                <Button
                  small
                  secondary
                  onPress={() =>
                    setExtraSenses((current) => [
                      ...current,
                      {
                        meaning: "",
                        definition: "",
                        example: "",
                        translation: "",
                      },
                    ])
                  }
                >
                  + Anlam ekle
                </Button>
              </>
            )}
            {editor?.kind === "grammar" && (
              <>
                {isTenseName(editor.values.tense) && (
                  <Text style={[styles.meta, { marginTop: 18 }]}>
                    {editor.values.tense} için not
                  </Text>
                )}
                {isModalityTopic(editor.values.modality) && (
                  <Text style={[styles.meta, { marginTop: 18 }]}>
                    {editor.values.modality} için not
                  </Text>
                )}
                {!editor.values.tense && !editor.values.modality && (
                  <>
                    <Text style={styles.label}>Alt başlık</Text>
                    <View style={styles.levels}>
                      {[
                        { id: "", title: "Genel konular" },
                        ...grammarTopics,
                      ].map((topic) => (
                        <Pressable
                          key={topic.id}
                          accessibilityRole="radio"
                          accessibilityLabel={`Not alt başlığı: ${topic.title}`}
                          aria-checked={
                            (editor.values.topicId ?? "") === topic.id
                          }
                          onPress={() =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    values: {
                                      ...current.values,
                                      topicId: topic.id,
                                    },
                                  }
                                : null,
                            )
                          }
                          style={[
                            styles.level,
                            (editor.values.topicId ?? "") === topic.id &&
                              styles.activeNav,
                          ]}
                        >
                          <Text style={styles.meta}>{topic.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {field("title", "Not başlığı *")}
                {field("body", "Notların *", true, true)}
              </>
            )}
            {editor?.kind === "storyNotes" && (
              <>
                <Text style={styles.label}>Seçilen metin</Text>
                <View style={styles.quote}>
                  <Text selectable style={styles.quoteText}>
                    “{editor.values.selection}”
                  </Text>
                </View>
                <Text style={styles.hint}>
                  Bu not yalnızca hikâyenin altında saklanır; Kelimelerim
                  bölümüne eklenmez.
                </Text>
                <Text style={styles.label}>Not türü</Text>
                <View style={styles.levels}>
                  {STORY_NOTE_CATEGORIES.map((category) => (
                    <Pressable
                      key={category}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: editor.values.category === category,
                      }}
                      onPress={() =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                values: { ...current.values, category },
                              }
                            : null,
                        )
                      }
                      style={[
                        styles.level,
                        editor.values.category === category && styles.activeNav,
                      ]}
                    >
                      <Text
                        style={
                          editor.values.category === category
                            ? styles.activeText
                            : styles.meta
                        }
                      >
                        {storyNoteLabels[category]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {field("title", "Not başlığı *")}
                {field(
                  "tags",
                  "Etiketler (virgülle ayır: past simple, bağlaç)",
                )}
                {field("body", "Açıklaman / gramer notun *", true, true)}
              </>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button secondary disabled={busy} onPress={() => setEditor(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={busy || !!storageError}
              onPress={() => {
                void submitEditor();
              }}
            >
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
