import type { HiddenGrammarTopics } from "./grammar-guide";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";
import type { Grammar } from "./model";
import { TENSE_GROUPS, type TenseName } from "./tenses";
import { MODALITY_TOPICS, type ModalityTopic } from "./modality";

type Props = {
  section: "tenses" | "modality";
  hidden?: HiddenGrammarTopics;
  disabled: boolean;
  onDeleteTopic: (topic: TenseName | ModalityTopic) => void;
  onRestoreTopic: (topic: TenseName | ModalityTopic) => void;
  notes: Grammar[];
  onAdd: (tense: TenseName) => void;
  onAddModality: (modality: ModalityTopic) => void;
  onEdit: (note: Grammar) => void;
  onDelete: (note: Grammar) => void;
};

export function TenseGuide({
  section,
  hidden,
  disabled,
  onDeleteTopic,
  onRestoreTopic,
  notes,
  onAdd,
  onAddModality,
  onEdit,
  onDelete,
}: Props) {
  const [selected, setSelected] = useState<TenseName | ModalityTopic | null>(
    null,
  );

  const removed = hidden?.[section] ?? [];
  function topicRow(
    topic: TenseName | ModalityTopic,
    number: string,
    modality = false,
  ) {
    if (removed.some((t) => t === topic)) return null;
    const expanded = selected === topic;
    const topicNotes = notes.filter((note) =>
      modality ? note.modality === topic : note.tense === topic,
    );
    return (
      <View key={topic} style={[styles.tense, expanded && styles.tenseOpen]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setSelected(expanded ? null : topic)}
          style={({ pressed }) => [
            styles.tenseButton,
            pressed && styles.pressed,
          ]}
        >
          {!modality && <Text style={styles.number}>{number}</Text>}
          <Text style={styles.tenseTitle}>{topic}</Text>
          {topicNotes.length > 0 && (
            <Text style={styles.noteCount}>{topicNotes.length} not</Text>
          )}
          <Text style={styles.chevron}>{expanded ? "−" : "+"}</Text>
        </Pressable>
        {expanded && (
          <View style={styles.detail}>
            <View style={styles.noteActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${topic} konu başlığını sil`}
                disabled={disabled}
                onPress={() => onDeleteTopic(topic)}
                style={styles.action}
              >
                <Text style={styles.actionText}>Konu başlığını sil</Text>
              </Pressable>
            </View>
            {topicNotes.map((note) => (
              <View key={note.id} style={styles.note}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text selectable style={styles.noteBody}>
                  {note.body}
                </Text>
                <View style={styles.noteActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${note.title} notunu düzenle`}
                    disabled={disabled}
                    onPress={() => onEdit(note)}
                    style={styles.action}
                  >
                    <Text style={styles.actionText}>Düzenle</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${note.title} notunu sil`}
                    disabled={disabled}
                    onPress={() => onDelete(note)}
                    style={styles.action}
                  >
                    <Text style={styles.actionText}>Sil</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {topicNotes.length === 0 && (
              <Text style={styles.empty}>Henüz not eklenmedi.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${topic} için not ekle`}
              disabled={disabled}
              onPress={() =>
                modality
                  ? onAddModality(topic as ModalityTopic)
                  : onAdd(topic as TenseName)
              }
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Not ekle</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.kicker}>
            GRAMER REHBERİ ·{" "}
            {section === "tenses"
              ? `${12 - removed.length} ZAMAN`
              : `${16 - removed.length} MODAL KONU`}
          </Text>
          <Text style={styles.title}>
            {section === "tenses" ? "English Tense" : "Modality"}
          </Text>
          <Text style={styles.description}>
            {section === "tenses"
              ? "Zamanlar için kendi notlarını ekle."
              : "Modal konuları için kendi notlarını ekle."}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        {section === "tenses" &&
          TENSE_GROUPS.map((group, groupIndex) => (
            <View key={group.title} style={styles.group}>
              <View style={styles.groupHeading}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
              </View>
              {group.tenses.map((tense, index) =>
                topicRow(
                  tense,
                  String(groupIndex * 4 + index + 1).padStart(2, "0"),
                ),
              )}
            </View>
          ))}
        {section === "modality" && (
          <View style={styles.group}>
            {MODALITY_TOPICS.map((topic) => topicRow(topic, "", true))}
          </View>
        )}
        {!!removed.length && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Kaldırılan başlıklar</Text>
            <Text style={styles.empty}>
              Başlığı geri eklemek genel bölüme taşınmış notların yerini
              değiştirmez.
            </Text>
            {removed.map((topic) => (
              <Pressable
                key={topic}
                accessibilityRole="button"
                accessibilityLabel={`${topic} başlığını geri ekle`}
                disabled={disabled}
                onPress={() => onRestoreTopic(topic)}
                style={styles.action}
              >
                <Text style={styles.actionText}>+ {topic} · Geri ekle</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 22,
  },
  heading: {
    minHeight: 138,
    backgroundColor: theme.sidebar,
    padding: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headingCopy: { flex: 1, gap: 6 },
  kicker: {
    color: "#E6B16A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" },
  description: { color: "#DBDFE6", fontSize: 14, lineHeight: 21 },
  body: { padding: 16, gap: 22 },
  group: { gap: 8 },
  groupHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  groupTitle: { fontSize: 18, fontWeight: "700", color: theme.accent },
  groupSubtitle: { fontSize: 13, color: theme.muted },
  tense: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  tenseOpen: { borderColor: theme.accent },
  tenseButton: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  number: { fontSize: 12, fontWeight: "700", color: theme.muted },
  tenseTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.ink },
  chevron: { fontSize: 22, color: theme.accent },
  detail: {
    borderTopWidth: 1,
    borderTopColor: theme.line,
    padding: 16,
    gap: 12,
    backgroundColor: theme.background,
  },
  pressed: { opacity: 0.78 },
  noteCount: { fontSize: 12, color: theme.muted },
  note: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    gap: 8,
  },
  noteTitle: { fontSize: 17, fontWeight: "700", color: theme.ink },
  noteBody: { fontSize: 16, lineHeight: 26, color: theme.ink },
  noteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 8,
  },
  action: { minHeight: 44, justifyContent: "center" },
  actionText: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  empty: { color: theme.muted, fontSize: 14 },
  addButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.accent,
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
