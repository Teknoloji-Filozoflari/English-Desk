import { useRef, useState } from "react";
import { Text, View } from "react-native";
import type { Notebook, Word } from "../../model";
import {
  savePersonalContext,
  wordContexts,
  type WordContext,
} from "../../word-context";
import { Button, Field } from "./ui";
import { styles } from "../styles";
import { makeId, type Persist } from "../types";
export function WordContextsPanel({
  word,
  data,
  disabled,
  persist,
  onOpenStory,
}: {
  word: Word;
  data: Notebook;
  disabled: boolean;
  persist: Persist;
  onOpenStory: (id: string) => void;
}) {
  const [draft, setDraft] = useState<{
    id?: string;
    sentence: string;
    translation: string;
    meaning: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const contexts = wordContexts(word, data.stories);
  async function save() {
    if (!draft || disabled || lock.current) return;
    lock.current = true;
    setError("");
    setNotice("");
    try {
      const ok = await persist((current) =>
        savePersonalContext(current, word.id, draft, makeId, draft.id),
      );
      if (ok) {
        setDraft(null);
        setNotice("Kişisel örnek kaydedildi.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Örnek kaydedilemedi.");
    } finally {
      lock.current = false;
    }
  }
  function edit(context?: WordContext) {
    setError("");
    setNotice("");
    setDraft(
      context
        ? {
            id: context.id,
            sentence: context.sentence,
            translation: context.translation,
            meaning: context.meaning,
          }
        : { sentence: "", translation: "", meaning: word.meaning },
    );
  }
  return (
    <View style={styles.detailSection}>
      <Text style={styles.label}>Bağlamlar ve kişisel örnekler</Text>
      {!contexts.length && (
        <Text style={styles.hint}>
          Henüz kaynak cümle yok. Kendi örneğini ekle veya hikâyeden bu kelimeyi
          kaydet.
        </Text>
      )}
      {contexts.map((context) => (
        <View
          key={context.id}
          style={[styles.quote, { marginTop: 10, gap: 8 }]}
        >
          <Text style={styles.meta}>
            {context.kind === "story"
              ? `Kaynak: ${context.storyTitle || "Hikâye"}${!context.storyId ? " · Hikâye bağlı değil" : ""}`
              : "Kendi örneğim"}
          </Text>
          <Text selectable style={styles.quoteText}>
            {context.sentence}
          </Text>
          {!!context.meaning && (
            <Text selectable style={styles.muted}>
              Bu bağlamdaki anlam: {context.meaning}
            </Text>
          )}
          {!!context.translation && (
            <Text selectable style={styles.muted}>
              {context.translation}
            </Text>
          )}
          {context.storyId &&
          data.stories.some((story) => story.id === context.storyId) ? (
            <Button
              small
              secondary
              onPress={() => onOpenStory(context.storyId)}
            >{`Kaynak hikâyeyi aç: ${data.stories.find((story) => story.id === context.storyId)!.title}`}</Button>
          ) : null}
          {context.kind === "personal" && (
            <Button
              small
              secondary
              disabled={disabled}
              onPress={() => edit(context)}
            >
              Bu örneği düzenle
            </Button>
          )}
        </View>
      ))}
      <Button small secondary disabled={disabled} onPress={() => edit()}>
        + Kendi örneğimi ekle
      </Button>
      {draft && (
        <View style={{ gap: 10 }}>
          <Field
            label="Kendi örnek cümlen *"
            value={draft.sentence}
            onChange={(sentence) => setDraft({ ...draft, sentence })}
            multiline
          />
          <Field
            label="Örneğinin Türkçe çevirisi"
            value={draft.translation}
            onChange={(translation) => setDraft({ ...draft, translation })}
            multiline
          />
          <Field
            label="Örneğin ait olduğu anlam"
            value={draft.meaning}
            onChange={(meaning) => setDraft({ ...draft, meaning })}
          />
          <View style={styles.actions}>
            {[
              word.meaning,
              ...(word.senses ?? []).map((sense) => sense.meaning),
            ]
              .filter(Boolean)
              .map((meaning, index) => (
                <Button
                  key={index}
                  small
                  secondary
                  onPress={() => setDraft({ ...draft, meaning })}
                >
                  {meaning}
                </Button>
              ))}
          </View>
          <View style={styles.actions}>
            <Button
              disabled={disabled || !draft.sentence.trim()}
              onPress={() => {
                void save();
              }}
            >
              Örneği kaydet
            </Button>
            <Button
              secondary
              disabled={disabled}
              onPress={() => setDraft(null)}
            >
              Örnek düzenlemeyi iptal et
            </Button>
          </View>
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {notice}
        </Text>
      )}
      <Text style={styles.hint}>
        Bu cümleleri Kelime testleri → Boşluk doldurma alanında seçerek
        çalışabilirsin. Özgün kaynak cümle, ana örneği değiştirsen de korunur.
      </Text>
    </View>
  );
}
