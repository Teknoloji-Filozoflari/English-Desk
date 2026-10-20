import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { Grammar, Notebook, Word } from "../../model";
import { progressReport, DEFAULT_WEEKLY_REVIEW_GOAL } from "../../progress";
import {
  validateStudyPreferences,
  DEFAULT_NEW_WORD_GOAL,
} from "../../daily-study";
import type { Persist } from "../types";
import { Button, Field } from "./ui";
import { styles } from "../styles";
import { theme } from "../../theme";
export function ProgressPanel({
  data,
  now,
  disabled,
  persist,
  onWord,
  onGrammar,
}: {
  data: Notebook;
  now: number;
  disabled: boolean;
  persist: Persist;
  onWord: (word: Word) => void;
  onGrammar: (note: Grammar) => void;
}) {
  const report = progressReport(data, now),
    [weeklyGoal, setWeeklyGoal] = useState(String(report.weeklyGoal)),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  useEffect(
    () =>
      setWeeklyGoal(
        String(
          data.studyPreferences?.weeklyReviewGoal ?? DEFAULT_WEEKLY_REVIEW_GOAL,
        ),
      ),
    [data.studyPreferences?.weeklyReviewGoal],
  );
  async function saveGoal() {
    if (disabled || lock.current) return;
    setNotice("");
    if (!/^\d{1,4}$/.test(weeklyGoal.trim()) || Number(weeklyGoal) > 1000) {
      setNotice("Haftalık hedef için 0–1000 arasında tam sayı yaz.");
      return;
    }
    lock.current = true;
    try {
      const ok = await persist((current) => ({
        ...current,
        studyPreferences: validateStudyPreferences({
          dailyNewWordGoal:
            current.studyPreferences?.dailyNewWordGoal ?? DEFAULT_NEW_WORD_GOAL,
          ...current.studyPreferences,
          weeklyReviewGoal: Number(weeklyGoal),
        }),
      }));
      if (ok) setNotice("Haftalık tekrar hedefi kaydedildi.");
    } finally {
      lock.current = false;
    }
  }
  function metric(label: string, value: string, hint: string) {
    return (
      <View
        key={label}
        style={[styles.quote, { flex: 1, minWidth: 145, gap: 6 }]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text accessibilityLabel={label} style={styles.h2}>
          {value}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
    );
  }
  function accuracy(value: {
    percent: number | null;
    total: number;
    right: number;
  }) {
    return value.percent === null
      ? "Henüz veri yok"
      : `%${value.percent} · ${value.right}/${value.total}`;
  }
  const difference =
    report.currentAccuracy.percent !== null &&
    report.previousAccuracy.percent !== null
      ? report.currentAccuracy.percent - report.previousAccuracy.percent
      : null;
  return (
    <View style={{ gap: 18 }}>
      <Text accessibilityRole="header" style={styles.h2}>
        Öğrenme istatistiklerin
      </Text>
      <Text style={styles.hint}>
        {report.today} · Haftanın sınırı: {report.week} – {report.weekEnd}.
        Bugünden sonraki kayıtlar hesaplamaya katılmaz. Aynı kelime/tür ve
        yinelenen çalışma kayıtları tekilleştirilir.
      </Text>
      <View style={[styles.actions, { alignItems: "stretch" }]}>
        {metric(
          "Toplam kelime ve ifade",
          String(report.total),
          `${report.phrases} çok kelimeli ifade dahil; örnek hikâyelerin kartları hariç.`,
        )}
        {metric(
          "İlk öğrenme kaydı olan",
          String(report.learned),
          "Öğrenme günü kaydedilen öğeler. Kalıcı hatırlama başarısı anlamına gelmez.",
        )}
        {metric(
          "Başarılı tekrarı bulunan",
          String(report.verified),
          "İlk öğrenmeden sonra en az bir kayıtlı başarılı tekrar.",
        )}
        {metric(
          "Öğrenme kaydı bekleyen",
          String(report.unlearned),
          "Sadece içe aktarılmış bir kart öğrenilmiş sayılmaz.",
        )}
        {metric(
          "Tekrarı gelen kelime ve ifade",
          String(report.pending),
          `${report.grammarPending} gramer kartı ve ${report.mistakePending} sınav yanlışı da çalışılabilir.`,
        )}
      </View>
      <Text style={styles.h2}>Günlük ve haftalık çalışma</Text>
      <View style={[styles.actions, { alignItems: "stretch" }]}>
        {metric(
          "Bugün kaydedilen tekrar",
          String(report.dailyReviews.answered),
          `${report.dailyReviews.successful} başarılı cevap; kelime ilk öğrenmeleri hariç.`,
        )}
        {metric(
          "Bu hafta kaydedilen tekrar",
          String(report.weeklyReviews.answered),
          `${report.weeklyReviews.successful} başarılı cevap; gramer ve yanlış sorular dahil.`,
        )}
        {metric(
          "Bugünkü öğrenme hedefi",
          `${report.todayLearned} / ${report.dailyGoal}`,
          report.dailyProgress === null
            ? "Günlük hedef kapalı."
            : `%${report.dailyProgress} · Hedefini Bugün planından değiştirebilirsin.`,
        )}
        {metric(
          "Haftalık başarılı tekrar hedefi",
          `${report.weeklyReviews.successful} / ${report.weeklyGoal}`,
          report.weeklyProgress === null
            ? "Haftalık hedef kapalı."
            : `%${report.weeklyProgress} · Yalnız kaydedilmiş başarılı tekrar cevapları.`,
        )}
      </View>
      <Text style={styles.hint}>
        Bu hafta {report.weekLearned} öğenin ilk öğrenmesi kaydedildi. Haftalık
        mini sınav: {report.weeklyFinished} tamamlandı,{" "}
        {report.weeklyInProgress} devam ediyor. Mini sınav cevapları ilgili
        geçmişte zaten sayılır; ayrıca eklenmez.
      </Text>
      <Field
        label="Haftalık başarılı tekrar hedefin"
        value={weeklyGoal}
        onChange={setWeeklyGoal}
      />
      <Button
        secondary
        disabled={disabled}
        onPress={() => {
          void saveGoal();
        }}
      >
        Haftalık hedefi kaydet
      </Button>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {notice}
        </Text>
      )}
      <Text style={styles.h2}>Cevap başarısı</Text>
      <View style={[styles.actions, { alignItems: "stretch" }]}>
        {metric(
          "Tüm kayıtlı cevaplarda başarı",
          accuracy(report.accuracy),
          "Yeni ayrıntılı cevap geçmişi; ilk öğrenmeler ve özdeğerlendirmeler dahil.",
        )}
        {metric(
          "Cevap anahtarıyla doğrulanan",
          accuracy(report.objectiveAccuracy),
          "Gramer örnek seçme/cümle tamamlama ve sınav yanlışı cevapları.",
        )}
        {metric(
          "Hatırlama değerlendirmesi",
          accuracy(report.selfAccuracy),
          "Kelime kartlarındaki bildim/zorlandım ve gramer kuralı değerlendirmeleri.",
        )}
      </View>
      <Text style={styles.hint}>
        Son 7 gün: {accuracy(report.currentAccuracy)}. Önceki 7 gün:{" "}
        {accuracy(report.previousAccuracy)}.
        {difference === null
          ? " Karşılaştırma için iki dönemde de kayıt gerekli."
          : ` Değişim: ${difference > 0 ? "+" : ""}${difference} yüzde puan.`}
      </Text>
      <Text style={styles.label}>Son 14 günün cevap başarısı</Text>
      {report.trend.map((day) => (
        <View key={day.day} style={{ gap: 4 }}>
          <Text
            accessibilityLabel={`${day.day} cevap başarısı`}
            style={styles.hint}
          >
            {day.day} · {accuracy(day)}
          </Text>
          <View
            accessible={false}
            style={{ height: 7, backgroundColor: theme.line, borderRadius: 4 }}
          >
            <View
              style={{
                height: 7,
                width: `${day.percent ?? 0}%`,
                backgroundColor: theme.accent,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      ))}
      <Text style={styles.hint}>
        Eski kayıtlardan {report.legacyReviewDays} başarılı ezber günü
        tamamlanma sayısına dahil edildi. Eski yanlış denemeler
        kaydedilmediğinden bu günler başarı oranına katılmaz. Ayrıntılı kelime
        geçmişi bu sürümden sonraki cevaplarda oluşur; bilinmeyen geçmiş
        tamamlanmaz.
      </Text>
      <Text style={styles.h2}>Sık unutulan kelimeler</Text>
      <Text style={styles.hint}>
        En az iki kayıtlı “tekrar/hatırlamadım” cevabı olan öğeler. Yanlış
        geçmişi olmayan eski kartlar hakkında tahmin yapılmaz.
      </Text>
      {!report.difficult.length && (
        <Text style={styles.hint}>Henüz bu ölçüte uyan kelime yok.</Text>
      )}
      {report.difficult.slice(0, 10).map((row) => (
        <View key={row.word.id} style={{ gap: 6 }}>
          <Text style={styles.hint}>
            {row.word.word} · {row.misses}/{row.attempts} cevapta unutuldu ·
            Son: {row.lastMiss}
          </Text>
          <Button
            small
            secondary
            onPress={() => onWord(row.word)}
          >{`Zorlandığım kelimeyi aç: ${row.word.word}`}</Button>
        </View>
      ))}
      <Text style={styles.h2}>Gramerde zorlandığın konular</Text>
      {!report.grammarTopics.length && (
        <Text style={styles.hint}>
          Konu hata raporu için önce gramer çalışmasını kaydet.
        </Text>
      )}
      {report.grammarTopics.map((row) => (
        <View key={row.topic} style={{ gap: 6 }}>
          <Text style={styles.label}>{row.topic}</Text>
          <Text style={styles.hint}>
            {row.wrong}/{row.total} cevap hatalı veya hatırlanamadı · %
            {row.percent} hata
          </Text>
          {row.notes.map((note) => (
            <Button
              key={note.id}
              small
              secondary
              onPress={() => onGrammar(note)}
            >{`Zorlandığım gramer notunu aç: ${note.title}`}</Button>
          ))}
          <Text style={styles.hint}>
            {row.wrong > 0 && !row.notes.length
              ? "İlgili eski not silinmiş; çalışma geçmişi korunuyor."
              : ""}
          </Text>
        </View>
      ))}
      <Text style={styles.h2}>Sınav performansı ve ölçülen süreler</Text>
      <View style={[styles.actions, { alignItems: "stretch" }]}>
        {metric(
          "Tamamlanan kişisel sınav",
          String(report.completedExams),
          "Örnekler ve yarım oturumlar sonuç sayısına eklenmez.",
        )}
        {metric(
          "Sınav cevap doğruluğu",
          report.examPercent === null
            ? "Henüz veri yok"
            : `%${report.examPercent}`,
          `${report.examRight}/${report.examTotal} soru doğru; boşlar toplam soruya dahil.`,
        )}
        {metric(
          "Kaydedilmiş sınav süresi",
          `${Math.floor(report.examSeconds / 60)} dk ${Math.floor(report.examSeconds % 60)} sn`,
          "Tamamlanan ve yarım sınav oturumlarının kaydedilmiş süreleri.",
        )}
      </View>
      <Text style={styles.hint}>
        Kelime, gramer ve haftalık mini sınavlarda kronometre geçmişi yok; bu
        süreler ölçülmüş gibi gösterilmez. Günlük panelin süre tahmini bu
        toplama katılmaz. Eski sınavlarda tamamlanma tarihi yoksa listede
        başlangıç tarihi gösterilir.
      </Text>
      {report.sessions.slice(0, 10).map(({ attempt, day, right, total }) => (
        <Text key={attempt.id} style={styles.hint}>
          {day} · {attempt.test.title} ·{" "}
          {attempt.finished ? `${right}/${total} doğru` : "Yarım oturum"} ·{" "}
          {Math.floor(attempt.elapsed / 60)} dk{" "}
          {Math.floor(attempt.elapsed % 60)} sn
        </Text>
      ))}
    </View>
  );
}
