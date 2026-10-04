import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { validateTopics, type Topic } from "../../topics";
import { makeId } from "../types";
import { styles } from "../styles";
import { Button, Field } from "./ui";
type Props = {
  topics: Topic[];
  selected: string;
  onSelect: (id: string) => void;
  onSave: (topics: Topic[], deleted?: string) => Promise<boolean>;
  disabled: boolean;
  reserved?: string[];
  generalLabel?: string;
  showSelector?: boolean;
};
export function TopicManager({
  topics,
  selected,
  onSelect,
  onSave,
  disabled,
  reserved = [],
  generalLabel = "Genel konular",
  showSelector = true,
}: Props) {
  const [opened, setOpened] = useState(false),
    [title, setTitle] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [deleting, setDeleting] = useState<Topic | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const locked = disabled || working;
  async function submit() {
    setError("");
    try {
      const name = title.trim();
      if (
        reserved.some(
          (t) => t.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
        )
      )
        throw Error("Bu başlık zaten kullanılıyor.");
      const id = editing ?? makeId();
      const next = validateTopics(
        editing
          ? topics.map((t) => (t.id === editing ? { ...t, title: name } : t))
          : [...topics, { id, title: name }],
      );
      setWorking(true);
      if (await onSave(next)) {
        setTitle("");
        setEditing(null);
        onSelect(id);
      } else setError("Başlık kaydedilemedi. Tekrar deneyebilirsin.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başlık kaydedilemedi.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <View style={{ gap: 12, marginBottom: 18 }}>
      <View style={styles.levels}>
        {showSelector &&
          [{ id: "", title: generalLabel }, ...topics].map((topic) => (
            <Pressable
              key={topic.id}
              accessibilityRole="button"
              accessibilityLabel={`Alt başlık: ${topic.title}`}
              accessibilityState={{ selected: selected === topic.id }}
              onPress={() => onSelect(topic.id)}
              style={[styles.level, selected === topic.id && styles.activeNav]}
            >
              <Text
                style={selected === topic.id ? styles.activeText : styles.meta}
              >
                {topic.title}
              </Text>
            </Pressable>
          ))}
        <Button
          secondary
          disabled={locked}
          onPress={() => {
            setError("");
            setTitle("");
            setEditing(null);
            setDeleting(null);
            setOpened(true);
          }}
        >
          Alt başlıkları yönet
        </Button>
      </View>
      <Modal
        visible={opened}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!locked) setOpened(false);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.h2}>Alt başlıkları yönet</Text>
              <Button
                secondary
                disabled={locked}
                onPress={() => setOpened(false)}
              >
                Kapat
              </Button>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <Text style={styles.muted}>
                Kendi konu başlıklarını oluştur, adlarını değiştir veya kaldır.
                Başlığı silmek içerikleri silmez; içerikler genel bölümüne
                taşınır.
              </Text>
              {!!error && (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              )}
              <Field
                label="Alt başlık adı"
                value={title}
                onChange={(v) => {
                  setTitle(v);
                  setError("");
                }}
              />
              <View style={styles.actions}>
                <Button
                  disabled={locked}
                  onPress={() => {
                    void submit();
                  }}
                >
                  {editing ? "Adı kaydet" : "+ Alt başlık oluştur"}
                </Button>
                {!!editing && (
                  <Button
                    secondary
                    disabled={locked}
                    onPress={() => {
                      setEditing(null);
                      setTitle("");
                    }}
                  >
                    Düzenlemeyi bırak
                  </Button>
                )}
              </View>
              {topics.map((topic) => (
                <View key={topic.id} style={[styles.card, { marginTop: 12 }]}>
                  <Text style={styles.h2}>{topic.title}</Text>
                  <View style={styles.actions}>
                    <Button
                      secondary
                      disabled={locked}
                      onPress={() => {
                        setEditing(topic.id);
                        setTitle(topic.title);
                        setDeleting(null);
                      }}
                    >
                      Adını değiştir
                    </Button>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${topic.title} alt başlığını sil`}
                      disabled={locked}
                      onPress={() => {
                        setDeleting(topic);
                        setError("");
                      }}
                      style={[styles.button, styles.dangerButton]}
                    >
                      <Text style={[styles.buttonText, { color: "#a52a36" }]}>
                        Sil
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {deleting && (
                <View style={[styles.errorBox, { marginTop: 16 }]}>
                  <Text style={styles.h2}>
                    {deleting.title} başlığı silinsin mi?
                  </Text>
                  <Text style={styles.muted}>
                    İçerikler ve sınav sonuçları korunur, genel bölümünde
                    görünür.
                  </Text>
                  <View style={styles.actions}>
                    <Button
                      secondary
                      disabled={locked}
                      onPress={() => setDeleting(null)}
                    >
                      Vazgeç
                    </Button>
                    <Button
                      danger
                      disabled={locked}
                      onPress={() => {
                        setWorking(true);
                        void onSave(
                          topics.filter((t) => t.id !== deleting.id),
                          deleting.id,
                        )
                          .then((ok) => {
                            if (ok) {
                              if (selected === deleting.id) onSelect("");
                              if (editing === deleting.id) {
                                setEditing(null);
                                setTitle("");
                              }
                              setDeleting(null);
                            } else
                              setError("Başlık silinemedi; içerikler korundu.");
                          })
                          .catch(() =>
                            setError("Başlık silinemedi; içerikler korundu."),
                          )
                          .finally(() => setWorking(false));
                      }}
                    >
                      Başlığı sil
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
