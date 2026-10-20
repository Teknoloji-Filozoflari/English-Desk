import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Notebook, Word } from "../../model";
import {
  PRACTICE_MODES,
  clozeExample,
  clozeExamples,
  evaluateAnswer,
  practiceSnapshot,
  type Direction,
  type Evaluation,
  type PracticeMode,
} from "../../word-practice";
import {
  practiceAvailability,
  recordPractice,
  type PracticeOutcome,
} from "../services/practice";
import { useStudyClock } from "../hooks/useStudyClock";
import { Blank, Button } from "../components/ui";
import { WordCardBack } from "../components/WordCardBack";
import { theme } from "../../theme";
import type { Persist } from "../types";

export function WordPracticeScreen({
  data,
  persist,
  disabled,
}: {
  data: Notebook;
  persist: Persist;
  disabled: boolean;
}) {
  const [mode, setMode] = useState<PracticeMode>("classic");
  const [direction, setDirection] = useState<Direction>("en-tr");
  const [handled, setHandled] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const now = useStudyClock();
  const eligible = data.words.filter((word) => practiceAvailability(word, now));
  const usable =
    mode === "cloze" ? eligible.filter((word) => clozeExample(word)) : eligible;
  const current = usable.find((word) => !handled.includes(word.id));
  const reset = () => {
    setHandled([]);
    setNotice("");
  };
  return (
    <View style={s.stack}>
      <Text style={s.title}>Aktif hatırlama</Text>
      <Text style={s.hint}>
        Ezber listendeki kelimeler 1–3–7–14–30–60 takvimini kullanır. Diğer
        kelimeler mevcut Tekrar et motoruna kaydedilir. Henüz zamanı gelmeyen
        kelimeler gösterilmez.
      </Text>
      <View style={s.row}>
        {PRACTICE_MODES.map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            aria-selected={mode === key}
            accessibilityState={{ selected: mode === key }}
            style={[s.tab, mode === key && s.selected]}
            onPress={() => {
              setMode(key);
              reset();
            }}
          >
            <Text style={[s.hint, mode === key && { color: "#fff" }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === "written" && (
        <View style={s.row}>
          {(
            [
              ["en-tr", "Türkçe cevap yaz"],
              ["tr-en", "İngilizce cevap yaz"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              secondary={direction !== key}
              onPress={() => {
                setDirection(key);
                reset();
              }}
            >
              {label}
            </Button>
          ))}
        </View>
      )}
      <Text style={s.hint}>
        {usable.length} uygun kelime · {handled.length} kart işlendi
        {mode === "cloze"
          ? ` · ${eligible.length - usable.length} kelimede hedefi içeren uygun cümle yok`
          : ""}
      </Text>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.hint}>
          {notice}
        </Text>
      )}
      {current ? (
        <PracticeCard
          key={`${current.id}:${mode}:${direction}:${practiceSnapshot(current)}`}
          word={current}
          mode={mode}
          direction={direction}
          disabled={disabled}
          onAnswer={async (outcome) => {
            let status: "saved" | "retry" | "stale" = "stale";
            const expected = practiceSnapshot(current);
            const ok = await persist((latest) => {
              const result = recordPractice(
                latest,
                current.id,
                expected,
                outcome,
              );
              status = result.status;
              return result.data;
            });
            if (!ok) return false;
            if (status === "stale") {
              setNotice(
                "Kart değişmiş veya bu adım zaten işlenmiş. Güncel kartla devam et.",
              );
              return false;
            }
            setHandled((ids) => [...new Set([...ids, current.id])]);
            setNotice(
              status === "retry"
                ? "Bu kelime yeniden çalışılacak. Ezber tarihi ve tekrar adımı ilerletilmedi."
                : "Cevap kaydedildi. Tekrar tarihi güncellendi.",
            );
            return true;
          }}
        />
      ) : (
        <View style={s.panel}>
          <Blank
            title={
              handled.length
                ? "Bu tur tamamlandı"
                : "Bu modda çalışılacak kelime yok"
            }
            description={
              mode === "cloze"
                ? "Kayıtlı örnek cümlede hedef kelimenin kendisi bulunmalı. Kartına uygun bir örnek ekleyebilir veya başka bir mod seçebilirsin."
                : "Anlamı kayıtlı yeni kelimeler ve tekrar zamanı gelenler burada görünür. İşlenen kart sayısı, başarılı tekrar sayısı değildir."
            }
          />
          <Button secondary onPress={reset}>
            Bekleyenlerle yeni tur başlat
          </Button>
        </View>
      )}
    </View>
  );
}
function PracticeCard({
  word,
  mode,
  direction,
  disabled,
  onAnswer,
}: {
  word: Word;
  mode: PracticeMode;
  direction: Direction;
  disabled: boolean;
  onAnswer: (outcome: PracticeOutcome) => Promise<boolean>;
}) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Evaluation | "revealed" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [contextIndex, setContextIndex] = useState(0);
  const contexts = mode === "cloze" ? clozeExamples(word) : [];
  const cloze = contexts[contextIndex] ?? null;
  const actualDirection =
    mode === "tr-en" || mode === "cloze"
      ? "tr-en"
      : mode === "written"
        ? direction
        : "en-tr";
  const written = mode === "written" || mode === "cloze";
  const prompt =
    cloze?.sentence ?? (actualDirection === "tr-en" ? word.meaning : word.word);
  async function commit(outcome: PracticeOutcome) {
    if (disabled || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      await onAnswer(outcome);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={s.panel}>
      <Text style={s.hint}>
        {mode === "classic"
          ? "Kelimeyi hatırla, sonra kartı çevir."
          : actualDirection === "en-tr"
            ? "Türkçe anlamını hafızandan bul."
            : "İngilizce kelimeyi hafızandan üret."}
      </Text>
      <Text selectable accessibilityLabel="Test sorusu" style={s.prompt}>
        {prompt}
      </Text>
      {mode === "cloze" && !feedback && contexts.length > 1 && (
        <View style={s.row}>
          {contexts.map((context, index) => (
            <Button
              key={index}
              small
              secondary={index !== contextIndex}
              onPress={() => {
                setContextIndex(index);
                setAnswer("");
              }}
            >{`Cümle ${index + 1}${context.source ? ` · ${context.source}` : ""}`}</Button>
          ))}
        </View>
      )}
      {!feedback ? (
        <>
          {written ? (
            <>
              <TextInput
                accessibilityLabel="Cevabın"
                placeholder="Cevabını yaz…"
                value={answer}
                onChangeText={setAnswer}
                editable={!disabled}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                maxLength={500}
                style={s.input}
                onSubmitEditing={() => {
                  if (answer.trim() && !disabled)
                    setFeedback(
                      evaluateAnswer(
                        word,
                        answer,
                        actualDirection,
                        mode === "cloze",
                      ),
                    );
                }}
              />
              <Button
                disabled={disabled || !answer.trim()}
                onPress={() =>
                  setFeedback(
                    evaluateAnswer(
                      word,
                      answer,
                      actualDirection,
                      mode === "cloze",
                    ),
                  )
                }
              >
                Cevabı kontrol et
              </Button>
            </>
          ) : (
            <Button disabled={disabled} onPress={() => setFeedback("revealed")}>
              {mode === "classic" ? "Kartı çevir" : "Cevabı göster"}
            </Button>
          )}
        </>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite" style={s.feedback}>
            {feedback === "correct"
              ? "Doğru cevap."
              : feedback === "incorrect"
                ? "Cevap kayıtlı karşılıkla eşleşmedi."
                : feedback === "uncertain"
                  ? "Bu cevap belirsiz. Kayıtlı bilgilerle karşılaştırıp kendin değerlendir."
                  : "Cevabını kayıtlı bilgilerle karşılaştır."}
          </Text>
          {written && <Text style={s.hint}>Cevabın: {answer}</Text>}
          <Text style={s.hint}>
            Kayıtlı cevap:{" "}
            {actualDirection === "en-tr"
              ? [
                  word.meaning,
                  ...(word.senses ?? []).map((sense) => sense.meaning),
                ]
                  .filter(Boolean)
                  .join("; ")
              : word.word}
          </Text>
          <WordCardBack word={word} />
          {!!cloze?.meaning && (
            <Text style={s.hint}>Bu cümledeki anlam: {cloze.meaning}</Text>
          )}
          {cloze && cloze.original !== word.example && (
            <Text selectable style={s.hint}>
              {cloze.original}
              {cloze.translation ? ` · ${cloze.translation}` : ""}
            </Text>
          )}
          <Text style={s.hint}>
            {word.memorization
              ? "Hatırlamadığın kelime beklemeye devam eder. Hatırladıysan bu ezber adımı bir kez kaydedilir."
              : "Cevabını kaydettiğinde mevcut Tekrar et aralığı uygulanır."}
          </Text>
          {feedback === "incorrect" ? (
            <Button
              disabled={disabled || saving}
              onPress={() => {
                void commit("again");
              }}
            >
              Yanlışı öğrendim · Sonraki kart
            </Button>
          ) : (
            <View style={s.row}>
              <Button
                secondary
                disabled={disabled || saving}
                onPress={() => {
                  void commit("again");
                }}
              >
                Hatırlamadım · Sonraki kart
              </Button>
              <Button
                secondary
                disabled={disabled || saving}
                onPress={() => {
                  void commit("hard");
                }}
              >
                Zorlandım · Kaydet
              </Button>
              <Button
                disabled={disabled || saving}
                onPress={() => {
                  void commit("good");
                }}
              >
                Hatırladım · Kaydet
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  panel: {
    padding: 22,
    gap: 16,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 18,
  },
  title: { fontSize: 25, fontWeight: "700", color: theme.ink },
  hint: { fontSize: 14, lineHeight: 22, color: theme.muted },
  prompt: { fontSize: 28, lineHeight: 38, color: theme.ink, fontWeight: "600" },
  tab: {
    minHeight: 44,
    borderRadius: 22,
    padding: 12,
    backgroundColor: theme.surface,
  },
  selected: { backgroundColor: theme.accent },
  feedback: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.accent,
    fontWeight: "600",
  },
  input: {
    minHeight: 52,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
    backgroundColor: theme.background,
    fontSize: 18,
    color: theme.ink,
  },
});
