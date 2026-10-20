import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { checkLearningAnswer, type LearningCard } from "../../learning";
import { Button } from "./ui";
import { styles } from "../styles";

export function LearningRound({
  card,
  disabled,
  onSave,
}: {
  card: LearningCard;
  disabled: boolean;
  onSave: (answer: string, recalled: boolean) => Promise<boolean>;
}) {
  const [answer, setAnswer] = useState(""),
    [revealed, setRevealed] = useState(false),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function save(recalled: boolean) {
    if (lock.current || disabled) return;
    lock.current = true;
    setSaving(true);
    setNotice("");
    try {
      if (!(await onSave(answer, recalled)))
        setNotice(
          "Cevap kaydedilemedi veya soru değişti. Bilgiler korunuyor; yeniden deneyebilirsin.",
        );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const right = checkLearningAnswer(card, answer);
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.meta}>
        {card.kind === "grammar" ? "GRAMER TEKRARI" : "YANLIŞ SORU TEKRARI"} ·{" "}
        {card.topic}
      </Text>
      <Text style={styles.h2}>{card.title}</Text>
      {!!card.passage && (
        <Text selectable style={styles.grammarText}>
          {card.passage}
        </Text>
      )}
      <Text
        selectable
        accessibilityLabel="Çalışma sorusu"
        style={styles.meaning}
      >
        {card.prompt}
      </Text>
      {!revealed ? (
        <>
          {card.mode !== "recall" &&
            (card.options.length ? (
              <View style={{ gap: 8 }}>
                {card.options.map((option) => (
                  <Button
                    key={option}
                    secondary={answer !== option}
                    disabled={disabled}
                    onPress={() => setAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </View>
            ) : (
              <TextInput
                accessibilityLabel="Çalışma cevabın"
                value={answer}
                onChangeText={setAnswer}
                editable={!disabled}
                maxLength={2000}
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.input}
              />
            ))}
          <Button
            disabled={disabled || (card.mode !== "recall" && !answer.trim())}
            onPress={() => setRevealed(true)}
          >
            {card.mode === "recall"
              ? "Kuralı göster"
              : "Çalışma cevabını kontrol et"}
          </Button>
        </>
      ) : (
        <>
          {card.mode !== "recall" && (
            <Text accessibilityLiveRegion="polite" style={styles.h2}>
              {right ? "Doğru cevap." : "Yanlış cevap. Açıklamayı incele."}
            </Text>
          )}
          <Text selectable style={styles.grammarText}>
            Doğru cevap: {card.answer}
          </Text>
          {!!card.explanation && card.explanation !== card.answer && (
            <Text selectable style={styles.grammarText}>
              {card.explanation}
            </Text>
          )}
          <Text style={styles.hint}>
            Sonraki soruya geçerken çalışma geçmişin kaydedilir.
          </Text>
          <View style={styles.actions}>
            {card.mode === "recall" ? (
              <>
                <Button
                  disabled={disabled || saving}
                  onPress={() => {
                    void save(true);
                  }}
                >
                  Kuralı hatırladım · Kaydet
                </Button>
                <Button
                  secondary
                  disabled={disabled || saving}
                  onPress={() => {
                    void save(false);
                  }}
                >
                  Kuralı hatırlamadım · Kaydet
                </Button>
              </>
            ) : (
              <Button
                disabled={disabled || saving}
                onPress={() => {
                  void save(right);
                }}
              >
                Cevabı kaydet · Sonraki soru
              </Button>
            )}
          </View>
        </>
      )}
      {!!notice && (
        <Text accessibilityRole="alert" style={styles.hint}>
          {notice}
        </Text>
      )}
    </View>
  );
}
