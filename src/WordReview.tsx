import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Word } from "./model";
import { isDue } from "./review";
import { theme } from "./theme";
import { useStudyClock } from "./notebook/hooks/useStudyClock";
import { WordCardBack } from "./notebook/components/WordCardBack";

export function WordReview({
  words,
  disabled,
  onReview,
}: {
  words: Word[];
  disabled: boolean;
  onReview: (
    id: string,
    result: "again" | "hard" | "good",
    expected: Word["review"],
  ) => Promise<boolean>;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const now = useStudyClock();
  const due = words.filter((word) => isDue(word, now));
  const current = due[0];
  const key = current
    ? JSON.stringify([current.id, current.review ?? null])
    : "";
  async function answer(result: "again" | "hard" | "good") {
    if (!current || disabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (await onReview(current.id, result, current.review)) setRevealed(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Kelime tekrarı</Text>
      <Text style={styles.hint}>
        {due.length} kelime tekrar bekliyor. Anlamı kayıtlı kelimeler burada
        sırayla görünür.
      </Text>
      {current ? (
        <View style={styles.card}>
          <Text style={styles.word}>{current.word}</Text>
          {revealed !== key ? (
            <Pressable
              style={styles.button}
              accessibilityRole="button"
              onPress={() => setRevealed(key)}
            >
              <Text style={styles.buttonText}>Anlamı göster</Text>
            </Pressable>
          ) : (
            <>
              <WordCardBack word={current} showWord={false} />
              <View style={styles.actions}>
                {(
                  [
                    ["again", "Tekrar"],
                    ["hard", "Zorlandım"],
                    ["good", "Bildim"],
                  ] as const
                ).map(([result, label]) => (
                  <Pressable
                    key={result}
                    disabled={disabled || saving}
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={() => {
                      void answer(result);
                    }}
                  >
                    <Text style={styles.buttonText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>
          Şimdilik tekrar edilecek kelime yok. Yeni kelimeler eklediğinde veya
          tekrar zamanı geldiğinde burada görünür.
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    padding: 22,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: 14,
    gap: 12,
  },
  title: { fontSize: 23, fontWeight: "700", color: theme.ink },
  hint: { fontSize: 15, lineHeight: 23, color: theme.muted },
  card: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
    gap: 16,
  },
  word: { fontSize: 30, color: theme.ink, fontWeight: "600" },
  meaning: { fontSize: 21, color: theme.accent },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  button: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.accent,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
