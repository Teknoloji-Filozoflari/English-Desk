import { useState } from "react";
import { Text, View } from "react-native";
import type { Notebook } from "../../model";
import {
  cardKey,
  grammarCards,
  grammarDue,
  historyStamp,
  recordLearning,
  validateGrammarExercises,
  type GrammarExercise,
} from "../../learning";
import { calendarDay } from "../../memorization";
import { LearningRound } from "../components/LearningRound";
import { Blank, Button, Field } from "../components/ui";
import { styles } from "../styles";
import { makeId, type Persist } from "../types";
import { useStudyClock } from "../hooks/useStudyClock";

export function GrammarPracticeScreen({
  data,
  persist,
  disabled,
}: {
  data: Notebook;
  persist: Persist;
  disabled: boolean;
}) {
  const now = useStudyClock(),
    today = calendarDay(new Date(now));
  const [mode, setMode] = useState<"recall" | "choice" | "completion">(
      "recall",
    ),
    [handled, setHandled] = useState<string[]>([]),
    [configure, setConfigure] = useState(false);
  const [noteId, setNoteId] = useState(data.grammar[0]?.id ?? ""),
    [draft, setDraft] = useState<GrammarExercise>({
      id: makeId(),
      mode: "choice",
      prompt: "",
      options: [],
      answer: "",
      explanation: "",
    }),
    [options, setOptions] = useState(""),
    [error, setError] = useState("");
  const history = data.learning?.grammarHistory ?? [];
  const cards = grammarCards(data).filter(
    (c) => c.mode === mode && grammarDue(c, history, today),
  );
  const current = cards.find((c) => !handled.includes(cardKey(c)));
  const note = data.grammar.find((n) => n.id === noteId);
  const modes = [
    ["recall", "Kuralı hatırla"],
    ["choice", "Uygun örneği seç"],
    ["completion", "Cümle tamamla"],
  ] as const;
  function resetDraft() {
    setDraft({
      id: makeId(),
      mode: "choice",
      prompt: "",
      options: [],
      answer: "",
      explanation: "",
    });
    setOptions("");
    setError("");
  }
  async function saveExercise() {
    if (!note || disabled) return;
    try {
      const exercise = validateGrammarExercises([
        {
          ...draft,
          prompt: draft.prompt.trim(),
          answer: draft.answer.trim(),
          explanation: draft.explanation.trim(),
          options:
            draft.mode === "choice"
              ? options
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        },
      ])[0];
      const ok = await persist((latest) => {
        if (!latest.grammar.some((n) => n.id === note.id))
          throw Error("Gramer notu bulunamadı.");
        return {
          ...latest,
          grammar: latest.grammar.map((n) =>
            n.id !== note.id
              ? n
              : {
                  ...n,
                  exercises: validateGrammarExercises([
                    ...(n.exercises ?? []).filter((e) => e.id !== exercise.id),
                    exercise,
                  ]),
                },
          ),
        };
      });
      if (ok) {
        resetDraft();
        setConfigure(false);
        setHandled([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Alıştırma kaydedilemedi.");
    }
  }
  return (
    <View style={{ gap: 18, marginBottom: 24 }}>
      <Text style={styles.h2}>Gramer çalışması</Text>
      <Text style={styles.hint}>
        Not başlığından kuralı hatırla. Örnek seçme ve cümle tamamlama soruları
        kendi notuna bağlanır; doğru cevaplarını sen belirlersin.
      </Text>
      <View style={styles.actions}>
        {modes.map(([id, title]) => (
          <Button
            key={id}
            secondary={mode !== id}
            onPress={() => {
              setMode(id);
              setHandled([]);
            }}
          >
            {title}
          </Button>
        ))}
      </View>
      <Text accessibilityLabel="Bekleyen gramer kartı" style={styles.meta}>
        {cards.length} kart bugün çalışılabilir ·{" "}
        {history.filter((e) => e.day === today).length} cevap bugün kaydedildi
      </Text>
      {current ? (
        <LearningRound
          key={cardKey(current)}
          card={current}
          disabled={disabled}
          onSave={async (answer, recalled) => {
            let applied = false;
            const eventId = makeId(),
              expected = historyStamp(data, current);
            const ok = await persist((latest) => {
              const next = recordLearning(
                latest,
                current,
                answer,
                recalled,
                eventId,
                expected,
              );
              applied = next !== latest;
              return next;
            });
            if (!ok || !applied) return false;
            setHandled((rows) => [...rows, cardKey(current)]);
            return true;
          }}
        />
      ) : (
        <Blank
          title={
            handled.length
              ? "Gramer turu tamamlandı"
              : "Bu modda bekleyen gramer kartı yok"
          }
          description="Kural kartları kişisel notlarından hazırlanır. Diğer modlar için notuna alıştırma ekle; tekrar zamanı gelmeyen doğru cevaplar sırada gösterilmez."
        />
      )}
      <View style={styles.actions}>
        <Button secondary onPress={() => setHandled([])}>
          Gramer turunu yenile
        </Button>
        <Button
          secondary
          disabled={disabled || !data.grammar.length}
          onPress={() => {
            setConfigure(!configure);
            resetDraft();
          }}
        >
          Gramer alıştırması hazırla
        </Button>
      </View>
      {configure && (
        <View style={{ gap: 12 }}>
          <Text style={styles.label}>Alıştırmanın kaynak notu</Text>
          <View style={styles.actions}>
            {data.grammar.map((n) => (
              <Button
                key={n.id}
                small
                secondary={noteId !== n.id}
                onPress={() => {
                  setNoteId(n.id);
                  resetDraft();
                }}
              >{`Not seç: ${n.title}`}</Button>
            ))}
          </View>
          {note && (
            <Text selectable style={styles.grammarText}>
              {note.body}
            </Text>
          )}
          {(note?.exercises ?? []).map((e) => (
            <Button
              key={e.id}
              small
              secondary
              onPress={() => {
                setDraft({ ...e });
                setOptions(e.options.join("\n"));
              }}
            >{`Alıştırmayı düzenle: ${e.prompt}`}</Button>
          ))}
          <View style={styles.actions}>
            {(["choice", "completion"] as const).map((m) => (
              <Button
                key={m}
                secondary={draft.mode !== m}
                onPress={() => setDraft({ ...draft, mode: m })}
              >
                {m === "choice"
                  ? "Örnek seçme sorusu"
                  : "Cümle tamamlama sorusu"}
              </Button>
            ))}
          </View>
          <Field
            label="Gramer alıştırma sorusu"
            value={draft.prompt}
            onChange={(prompt) => setDraft({ ...draft, prompt })}
            multiline
          />
          {draft.mode === "choice" ? (
            <Field
              label="Gramer seçenekleri (her satıra bir seçenek)"
              value={options}
              onChange={setOptions}
              multiline
            />
          ) : (
            <Text style={styles.hint}>
              Cümlede cevap yerine _____ yaz. Tam cümleyi ve doğru biçimi açıkça
              kaydet.
            </Text>
          )}
          <Field
            label="Gramer doğru cevabı"
            value={draft.answer}
            onChange={(answer) => setDraft({ ...draft, answer })}
          />
          <Field
            label="Gramer cevap açıklaması"
            value={draft.explanation}
            onChange={(explanation) => setDraft({ ...draft, explanation })}
            multiline
          />
          {!!error && (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          )}
          <Button
            disabled={disabled || !note}
            onPress={() => {
              void saveExercise();
            }}
          >
            Gramer alıştırmasını kaydet
          </Button>
        </View>
      )}
      <Text style={styles.h2}>Konu bazında gramer hataları</Text>
      <Text style={styles.hint}>
        Kural hatırlama sonuçları kendi değerlendirmeni kullanır. Örnek seçme ve
        cümle tamamlama kayıtlı cevap anahtarıyla değerlendirilir.
      </Text>
      {[...new Set(history.map((e) => e.card.topic))].map((topic) => {
        const rows = history.filter((e) => e.card.topic === topic),
          wrong = rows.filter((e) => !e.correct).length;
        return (
          <Text key={topic} style={styles.hint}>
            {topic} · {wrong}/{rows.length} cevap yeniden çalışılmalı · %
            {Math.round((wrong / rows.length) * 100)} hata
          </Text>
        );
      })}
      <Text style={styles.h2}>Gramer tekrar geçmişi</Text>
      {!history.length && (
        <Text style={styles.hint}>Henüz kaydedilmiş gramer cevabı yok.</Text>
      )}
      {history
        .slice(-10)
        .reverse()
        .map((e) => (
          <Text key={e.id} style={styles.hint}>
            {e.day} · {e.card.title} · {e.card.topic} ·{" "}
            {e.correct ? "Doğru / hatırlandı" : "Yeniden çalışılacak"}
          </Text>
        ))}
    </View>
  );
}
