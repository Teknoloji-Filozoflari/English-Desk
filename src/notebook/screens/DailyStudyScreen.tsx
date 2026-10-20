import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ExamAttempt } from "../../exams";
import type { Grammar, Notebook, Story, Word } from "../../model";
import { ProgressPanel } from "../components/ProgressPanel";
import { dailyStudy, validateStudyPreferences } from "../../daily-study";
import { theme } from "../../theme";
import { StudyHeader } from "../../StudyHeader";
import { Blank, Button, Field } from "../components/ui";
import { useStudyClock } from "../hooks/useStudyClock";
import type { Persist } from "../types";

type Props = {
  data: Notebook;
  desktop: boolean;
  disabled: boolean;
  storageError: string;
  persist: Persist;
  onWords: () => void;
  onWord: (word: Word) => void;
  onNewWords: () => void;
  onMemory: () => void;
  onReview: () => void;
  onGrammar: (note?: Grammar) => void;
  onWrong: (attempt: ExamAttempt) => void;
  onStories: () => void;
  onStory: (story: Story) => void;
  onImport: () => void;
};
export function DailyStudyScreen(props: Props) {
  const now = useStudyClock();
  const plan = dailyStudy(props.data, now);
  const [progress, setProgress] = useState(false);
  const [goal, setGoal] = useState(String(plan.goal));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saving = useRef(false);
  useEffect(() => {
    setGoal(String(plan.goal));
  }, [plan.goal]);
  async function saveGoal() {
    if (saving.current || props.disabled) return;
    setError("");
    setMessage("");
    let preferences;
    try {
      if (!/^\d{1,3}$/.test(goal.trim()))
        throw Error("0–100 arasında bir tam sayı yaz.");
      preferences = validateStudyPreferences({
        dailyNewWordGoal: Number(goal),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Hedef kaydedilemedi.");
      return;
    }
    saving.current = true;
    try {
      if (
        await props.persist((current) => ({
          ...current,
          studyPreferences: { ...current.studyPreferences, ...preferences },
        }))
      )
        setMessage("Günlük hedef kaydedildi.");
    } finally {
      saving.current = false;
    }
  }
  if (props.storageError)
    return (
      <Blank
        title="Günlük plan okunamadı"
        description="Kayıt sorunu giderildiğinde günlük planın mevcut verilerinden yeniden hesaplanacak. Yedekten geri yükleme seçeneğini kullanabilirsin."
      />
    );
  if (progress)
    return (
      <View style={s.stack}>
        <View style={s.row}>
          <Button secondary onPress={() => setProgress(false)}>
            Bugünkü plana dön
          </Button>
        </View>
        <ProgressPanel
          data={props.data}
          now={now}
          disabled={props.disabled}
          persist={props.persist}
          onWord={props.onWord}
          onGrammar={props.onGrammar}
        />
      </View>
    );
  const empty =
    !plan.personalWords &&
    !plan.stories.length &&
    !props.data.grammar.length &&
    !plan.wrongCount;
  function stat(label: string, value: string, hint: string) {
    return (
      <View style={s.stat}>
        <Text style={s.label}>{label}</Text>
        <Text accessibilityLabel={label} style={s.number}>
          {value}
        </Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
    );
  }
  return (
    <View style={s.stack}>
      <StudyHeader
        eyebrow="GÜNLÜK ÇALIŞMA MASAN"
        title="Bugün bir adım daha."
        description={new Date(now).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          weekday: "long",
        })}
        count={plan.pending}
        unit="kelime tekrar bekliyor"
        wide={props.desktop}
      />
      <View style={s.row}>
        <Button secondary onPress={() => setProgress(true)}>
          İlerlemem · İstatistikleri aç
        </Button>
      </View>
      {empty && (
        <View style={s.panel}>
          <Blank
            title="İlk çalışma gününü başlat"
            description="Henüz kişisel çalışma kaydın yok. Kelimelerini ekle veya bir hikâye içe aktar; planın kendi kayıtlarınla oluşacak."
          />
          <View style={s.row}>
            <Button onPress={props.onWords}>Kelime eklemeye git</Button>
            <Button
              secondary
              disabled={props.disabled}
              onPress={props.onImport}
            >
              Hikâye içe aktar
            </Button>
          </View>
        </View>
      )}
      <View style={s.grid}>
        {stat(
          "Kalan tekrar",
          String(plan.pending),
          "Zamanı gelen ve geciken kelimeler",
        )}
        {stat(
          "Tamamlanan tekrar",
          String(plan.completed),
          "Bugün cevaplanıp kaydedilen kelimeler",
        )}
        {stat(
          "Yeni öğrenilen",
          `${plan.learned} / ${plan.goal}`,
          `${plan.remainingNew} kelime hedefin kaldı`,
        )}
        {stat(
          "Tahmini süre",
          `${plan.estimatedMinutes} dk`,
          "Kalan kelime çalışması için",
        )}
      </View>
      <View style={s.panel}>
        <View style={s.row}>
          <Text style={s.title}>Günlük kelime ilerlemen</Text>
          <Text style={s.percent}>%{plan.progress}</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Günlük kelime ilerlemesi"
          accessibilityValue={{ min: 0, max: 100, now: plan.progress }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={plan.progress}
          style={s.track}
        >
          <View style={[s.fill, { width: `${plan.progress}%` }]} />
        </View>
        <Text style={s.hint}>
          İlerleme, tamamlanan tekrarlar ve yeni kelime hedefinden hesaplanır.
          Kartı açmak veya anlamı göstermek yeterli değildir.
        </Text>
        {!!plan.memoryDue && !!plan.reviewDue && (
          <Text style={s.hint}>
            İki tekrar alanında bekleyen aynı kelime bir kez sayılır;
            tamamlanması için bekleyen iki adımı da cevapla.
          </Text>
        )}
        <View style={s.row}>
          <Button
            secondary
            disabled={!plan.memoryDue}
            onPress={props.onMemory}
          >{`Ezber tekrarlarını aç · ${plan.memoryDue}`}</Button>
          <Button
            secondary
            disabled={!plan.reviewDue}
            onPress={props.onReview}
          >{`Tekrar et alanını aç · ${plan.reviewDue}`}</Button>
        </View>
        <Text style={s.hint}>
          Süre tahmini: her tekrar adımı için 30 sn, yeni kelime için 90 sn.
          Gramer ve okuma bu tahmine dahil değildir.
        </Text>
      </View>
      <View style={s.panel}>
        <Text style={s.title}>Yeni kelime hedefin</Text>
        <Text style={s.hint}>
          İlk kez öğrenip kaydettiğin kelimeler sayılır. Ezber ve Tekrar et
          alanında aynı kelime iki kez sayılmaz. Hedefi değiştirmek tekrar
          tarihlerini değiştirmez.
        </Text>
        <Field
          label="Günlük yeni kelime hedefi"
          value={goal}
          onChange={(value) => {
            setGoal(value);
            setMessage("");
            setError("");
          }}
          placeholder="0–100"
        />
        <View style={s.row}>
          <Button
            disabled={props.disabled}
            onPress={() => {
              void saveGoal();
            }}
          >
            Hedefi kaydet
          </Button>
          <Button
            secondary
            disabled={!plan.pendingLearning}
            onPress={props.onNewWords}
          >
            Ezberlenecekleri aç
          </Button>
          <Button secondary onPress={props.onWords}>
            Yeni kelimeleri seç
          </Button>
        </View>
        <Text style={s.hint}>
          {plan.availableNew} kelime öğrenmeye hazır.{" "}
          {plan.remainingNew > plan.availableNew
            ? "Hedefini tamamlamak için koleksiyonuna anlamı kayıtlı kelimeler ekleyebilirsin."
            : "Hazır olduğunda bir kelimeyi çalışıp öğrendiğini kaydet."}
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={s.accent}>
            {message}
          </Text>
        )}
      </View>
      <View style={s.grid}>
        <View style={s.section}>
          <Text style={s.title}>Gramerden bir konu</Text>
          <Text style={s.hint}>
            {plan.grammarPending} gramer kartı bugün çalışılabilir. Gramer
            ekranındaki “Gramer tekrarı çalış” düğmesini kullan.
          </Text>
          <Text style={s.hint}>
            {props.data.grammar.length
              ? `${props.data.grammar.length} kişisel notundan çalışmaya devam et.`
              : "Kişisel gramer notun yok. Hazır Tense ve Modality rehberlerinden başlayabilirsin."}
          </Text>
          {props.data.grammar.slice(0, 3).map((note) => (
            <Button
              key={note.id}
              secondary
              onPress={() => props.onGrammar(note)}
            >
              {note.title}
            </Button>
          ))}
          <Button secondary onPress={() => props.onGrammar()}>
            Gramer konularını aç
          </Button>
        </View>
        <View style={s.section}>
          <Text style={s.title}>Yanlışlarından öğren</Text>
          <Text
            accessibilityLabel="Bekleyen yanlış soru sayısı"
            style={s.number}
          >
            {plan.wrongCount}
          </Text>
          <Text style={s.hint}>
            {plan.wrongCount
              ? "Son tamamlanan cevaplara göre yanlış veya boş kalan sorular. Doğru cevaplanan tekrarlar bu listeden düşer."
              : "Tekrar bekleyen yanlış soru yok. Tamamladığın kişisel testlerdeki yanlışlar burada görünecek."}
          </Text>
          {plan.wrong.slice(0, 3).map((group) => (
            <Button
              key={group.attempt.id}
              secondary
              onPress={() => props.onWrong(group.attempt)}
            >{`${group.attempt.test.title} · ${group.questions.length} soru`}</Button>
          ))}
        </View>
        <View style={s.section}>
          <Text style={s.title}>Bir hikâyeye dön</Text>
          <Text style={s.hint}>
            {plan.stories.length
              ? `${plan.stories.filter((story) => !story.read).length} okunmamış hikâyen var. Bağlam içinde yeni kelimeler keşfet.`
              : "Kendi hikâyeni ekleyerek okuma ve kelime seçme özelliklerini kullan."}
          </Text>
          {plan.stories
            .filter((story) => !story.read)
            .slice(0, 3)
            .map((story) => (
              <Button
                key={story.id}
                secondary
                onPress={() => props.onStory(story)}
              >{`Oku: ${story.title}`}</Button>
            ))}
          <View style={s.row}>
            <Button secondary onPress={props.onStories}>
              Hikâye kütüphanesi
            </Button>
            <Button
              secondary
              disabled={props.disabled}
              onPress={props.onImport}
            >
              Hikâye içe aktar
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  panel: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 14,
  },
  stat: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 16,
    gap: 8,
  },
  section: {
    flex: 1,
    minWidth: 250,
    backgroundColor: theme.surface,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 18,
    gap: 14,
  },
  title: { color: theme.ink, fontSize: 21, lineHeight: 28, fontWeight: "600" },
  label: { color: theme.muted, fontSize: 13, lineHeight: 20 },
  number: { color: theme.ink, fontSize: 30, fontWeight: "600" },
  hint: { color: theme.muted, fontSize: 14, lineHeight: 22 },
  percent: { color: theme.accent, fontSize: 25, fontWeight: "700" },
  accent: { color: theme.accent, fontSize: 14 },
  error: { color: "#a52a36", fontSize: 14 },
  track: {
    height: 10,
    backgroundColor: theme.accentSoft,
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: { height: 10, backgroundColor: theme.accent, borderRadius: 5 },
});
