import { TopicManager } from "../components/TopicManager";
import type { Topic } from "../../topics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ModalityTopic } from "../../modality";
import type { Grammar, Notebook } from "../../model";
import { theme } from "../../theme";
import { StudyHeader } from "../../StudyHeader";
import { TenseGuide } from "../../TenseGuide";
import type { TenseName } from "../../tenses";
import { Blank, Button } from "../components/ui";
import { styles } from "../styles";
import { type Editor } from "../types";
import type { Persist } from "../types";
import { useState } from "react";
import { GrammarPracticeScreen } from "./GrammarPracticeScreen";
type Props = {
  data: Notebook;
  persist: Persist;
  desktop: boolean;
  topicId: string;
  onSelectTopic: (id: string) => void;
  onSaveTopics: (topics: Topic[], deleted?: string) => Promise<boolean>;
  disabled: boolean;
  grammarSection: "notes" | "tenses" | "modality";
  goToTenses: () => void;
  goToModality: () => void;
  deleteGuideTopic: (
    section: "tenses" | "modality",
    topic: TenseName | ModalityTopic,
  ) => void;
  restoreGuideTopic: (
    section: "tenses" | "modality",
    topic: TenseName | ModalityTopic,
  ) => Promise<boolean>;
  addTenseNote: (tense: TenseName) => void;
  addModalityNote: (modality: ModalityTopic) => void;
  openEditor: (
    kind: Editor["kind"],
    row?: Grammar,
    preset?: Record<string, string>,
  ) => void;
  deleteItem: (kind: Editor["kind"], id: string) => void;
};
export function GrammarScreen({
  data,
  persist,
  desktop,
  topicId,
  onSelectTopic,
  onSaveTopics,
  disabled,
  grammarSection,
  goToTenses,
  goToModality,
  deleteGuideTopic,
  restoreGuideTopic,
  addTenseNote,
  addModalityNote,
  openEditor,
  deleteItem,
}: Props) {
  const [practice, setPractice] = useState(false);
  const notes = data.grammar.filter(
    (g) => !g.tense && !g.modality && (g.topicId ?? "") === topicId,
  );
  const topic = data.grammarTopics?.find((t) => t.id === topicId);
  const sections = [
    {
      id: "general",
      title: "Genel konular",
      description: "Başlığa bağlanmamış notlar",
      count: data.grammar.filter((g) => !g.tense && !g.modality && !g.topicId)
        .length,
      selected: grammarSection === "notes" && !topicId,
      action: () => onSelectTopic(""),
    },
    {
      id: "tenses",
      title: "English Tense",
      description: "12 zaman · kişisel konu notları",
      count: data.grammar.filter((g) => g.tense).length,
      selected: grammarSection === "tenses",
      action: goToTenses,
    },
    {
      id: "modality",
      title: "Modality",
      description: "16 modal konu · kişisel örnekler",
      count: data.grammar.filter((g) => g.modality).length,
      selected: grammarSection === "modality",
      action: goToModality,
    },
    ...(data.grammarTopics ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: "Kendi konu notların",
      count: data.grammar.filter((g) => g.topicId === t.id).length,
      selected: grammarSection === "notes" && topicId === t.id,
      action: () => onSelectTopic(t.id),
    })),
  ];
  return (
    <>
      <StudyHeader
        eyebrow="DİLİN YAPISI"
        title="Parçalar yerine otursun."
        description="Bir başlık seç, notlarını aynı yerde düzenli tut."
        count={data.grammar.length}
        unit="kişisel not"
        wide={desktop}
      />
      <View style={styles.headingRow}>
        <Button secondary onPress={() => setPractice(!practice)}>
          {practice ? "Gramer notlarına dön" : "Gramer tekrarı çalış"}
        </Button>
      </View>
      {practice && (
        <GrammarPracticeScreen
          data={data}
          persist={persist}
          disabled={disabled}
        />
      )}
      <View style={practice ? { display: "none" } : styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.h2}>
            Gramer başlıkları
          </Text>
          <Text style={styles.muted}>
            Tense, Modality ve kendi başlıkların.
          </Text>
        </View>
        <TopicManager
          topics={data.grammarTopics ?? []}
          selected={topicId}
          onSelect={onSelectTopic}
          onSave={onSaveTopics}
          disabled={disabled}
          reserved={["Genel konular", "Tense", "English Tense", "Modality"]}
          showSelector={false}
        />
      </View>
      <View style={[s.grid, practice && { display: "none" }]}>
        {sections.map((section, index) => (
          <Pressable
            key={section.id}
            accessibilityRole="button"
            accessibilityLabel={`Gramer başlığı: ${section.title}`}
            accessibilityState={{ selected: section.selected }}
            onPress={section.action}
            style={[s.portal, section.selected && s.selected]}
          >
            <View style={s.row}>
              <Text style={styles.eyebrow}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={s.count}>{section.count} not</Text>
            </View>
            <Text style={styles.h2}>{section.title}</Text>
            <Text style={styles.muted}>{section.description}</Text>
            <Text style={s.link}>
              {section.selected ? "Seçili başlık" : "Notları aç →"}
            </Text>
          </Pressable>
        ))}
      </View>
      {!practice && grammarSection === "notes" && (
        <View style={s.guide}>
          <View style={s.header}>
            <Text style={s.kicker}>GRAMER DEFTERİ · {notes.length} NOT</Text>
            <Text accessibilityRole="header" style={s.title}>
              {topic?.title ?? "Genel konular"}
            </Text>
            <Text style={s.description}>
              Bu başlığa ait notlarını ekle ve düzenle.
            </Text>
          </View>
          <View style={s.body}>
            <View style={styles.headingRow}>
              <Text style={styles.h2}>Konu notları</Text>
              <Button
                disabled={disabled}
                onPress={() => openEditor("grammar", undefined, { topicId })}
              >
                + Konu ekle
              </Button>
            </View>
            {notes.map((g) => (
              <View key={g.id} style={s.note}>
                <Text style={styles.h2}>{g.title}</Text>
                <Text selectable style={styles.grammarText}>
                  {g.body}
                </Text>
                <View style={styles.actions}>
                  <Button
                    secondary
                    disabled={disabled}
                    onPress={() => openEditor("grammar", g)}
                  >
                    Düzenle
                  </Button>
                  <Button
                    danger
                    disabled={disabled}
                    onPress={() => deleteItem("grammar", g.id)}
                  >
                    Sil
                  </Button>
                </View>
              </View>
            ))}
            {!notes.length && (
              <Blank
                title="Bu başlık için ilk notunu ekle"
                description="Konu ekle düğmesiyle yazdığın notlar burada birikir."
              />
            )}
          </View>
        </View>
      )}
      {!practice && grammarSection !== "notes" && (
        <TenseGuide
          section={grammarSection}
          disabled={disabled}
          hidden={data.hiddenGrammarTopics}
          onDeleteTopic={(topic) => deleteGuideTopic(grammarSection, topic)}
          onRestoreTopic={(topic) => {
            void restoreGuideTopic(grammarSection, topic);
          }}
          notes={data.grammar}
          onAdd={addTenseNote}
          onAddModality={addModalityNote}
          onEdit={(note) => openEditor("grammar", note)}
          onDelete={(note) => deleteItem("grammar", note.id)}
        />
      )}
    </>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 24 },
  portal: {
    flexBasis: 250,
    flexGrow: 1,
    maxWidth: "100%",
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 14,
    backgroundColor: theme.surface,
  },
  selected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  count: { color: theme.muted, fontSize: 12 },
  link: { color: theme.accent, fontSize: 13, fontWeight: "600" },
  guide: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 22,
  },
  header: {
    minHeight: 138,
    backgroundColor: theme.sidebar,
    padding: 28,
    gap: 6,
  },
  kicker: {
    color: "#E6B16A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  description: { color: "#DBDFE6", fontSize: 14, lineHeight: 21 },
  body: { padding: 16, gap: 16 },
  note: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.background,
    gap: 12,
  },
});
