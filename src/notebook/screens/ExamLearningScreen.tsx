import { useState } from "react";
import { Text, View } from "react-native";
import type { Notebook } from "../../model";
import { DEFAULT_EXAM_TOPICS } from "../../topics";
import { examTopicId } from "../../exams";
import {
  cardKey,
  historyStamp,
  learningMistakes,
  learningWrongGroups,
  mistakePatterns,
  recordLearning,
  startWeekly,
  weekStart,
  type LearningCard,
} from "../../learning";
import { calendarDay } from "../../memorization";
import { LearningRound } from "../components/LearningRound";
import { Blank, Button } from "../components/ui";
import { styles } from "../styles";
import { makeId, type Persist } from "../types";
import { useStudyClock } from "../hooks/useStudyClock";

type Props = {
  data: Notebook;
  persist: Persist;
  disabled: boolean;
  topicId: string;
  onInspect: (id: string) => void;
};
export function ExamLearningScreen({
  data,
  persist,
  disabled,
  topicId,
  onInspect,
}: Props) {
  const [round, setRound] = useState<LearningCard[] | null>(null),
    [handled, setHandled] = useState<string[]>([]);
  const topics = data.exams?.topics ?? DEFAULT_EXAM_TOPICS;
  const matches = (id: string) =>
    (topics.some((t) => t.id === id) ? id : "") === topicId;
  const groups = learningWrongGroups(data).filter((g) =>
    matches(examTopicId(g.attempt.test)),
  );
  const pool = learningMistakes(
    data.exams?.attempts ?? [],
    data.learning?.mistakeHistory,
  );
  const current = round?.find((c) => !handled.includes(cardKey(c)));
  const history = data.learning?.mistakeHistory ?? [];
  function begin(sourceId: string) {
    setRound(pool.filter((r) => r.attempt.id === sourceId).map((r) => r.card));
    setHandled([]);
  }
  return (
    <View style={{ gap: 18 }}>
      <Text style={styles.h2}>Yanlış soru tekrar havuzu</Text>
      <Text style={styles.hint}>
        Yanlış ve boş cevaplar kaynak sınavın soru kopyalarıyla çalışılır. Bir
        tekrar cevabı eski sınav sonucunu değiştirmez; doğru kaydedilen soru
        havuzdan çıkar.
      </Text>
      {round ? (
        <>
          {current ? (
            <LearningRound
              key={cardKey(current)}
              card={current}
              disabled={disabled}
              onSave={async (answer, recalled) => {
                const eventId = makeId(),
                  expected = historyStamp(data, current);
                let applied = false;
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
              title="Yanlış soru turu tamamlandı"
              description="Kaydedilen doğru cevaplar havuzdan çıkarıldı. Yanlış kalanları yeni bir turda yeniden çözebilirsin."
            />
          )}
          <Button
            secondary
            onPress={() => {
              setRound(null);
              setHandled([]);
            }}
          >
            Yanlış soru havuzuna dön
          </Button>
        </>
      ) : (
        <>
          {!groups.length && (
            <Blank
              title="Tekrar bekleyen yanlış soru yok"
              description="Tamamladığın kişisel sınavların yanlış ve boş cevapları burada çalışılabilir. Örnek sınavlar bu havuza dahil edilmez."
            />
          )}
          {groups.map(({ attempt, questions }) => (
            <View key={attempt.id} style={[styles.quote, { gap: 10 }]}>
              <Text style={styles.h2}>{attempt.test.title}</Text>
              <Text style={styles.hint}>
                {questions.length} soru tekrar bekliyor.
              </Text>
              <View style={styles.actions}>
                <Button secondary onPress={() => onInspect(attempt.id)}>
                  İncele
                </Button>
                <Button disabled={disabled} onPress={() => begin(attempt.id)}>
                  Yanlışları tekrar et
                </Button>
              </View>
            </View>
          ))}
        </>
      )}
      <Text style={styles.h2}>Konu bazında hata örüntüleri</Text>
      <Text style={styles.hint}>
        Konu ve bölüm, sınavda kayıtlı başlıklardan alınır. Yanlış ve boş
        cevaplar hata sayılır; tekrar başarısı ayrıca gösterilir.
      </Text>
      {mistakePatterns(data).map((p) => (
        <View key={p.topic} style={{ gap: 4 }}>
          <Text style={styles.label}>
            {p.topic
              .split(" · ")
              .map((part) => topics.find((t) => t.id === part)?.title ?? part)
              .join(" · ")}
          </Text>
          <Text style={styles.hint}>
            {p.wrong}/{p.total} sınav cevabı yanlış/boş · %
            {p.total ? Math.round((p.wrong / p.total) * 100) : 0} hata ·{" "}
            {p.pending} soru bekliyor · Tekrar: {p.reviewRight} doğru,{" "}
            {p.reviewWrong} yanlış
          </Text>
        </View>
      ))}
      <Text style={styles.h2}>Yanlış soru tekrar geçmişi</Text>
      {!history.length && (
        <Text style={styles.hint}>
          Henüz kaydedilmiş yanlış soru çalışması yok.
        </Text>
      )}
      {history
        .slice(-10)
        .reverse()
        .map((e) => (
          <Text key={e.id} style={styles.hint}>
            {e.day} · {e.card.title} · {e.correct ? "Doğru" : "Yanlış"} ·{" "}
            {e.card.prompt}
          </Text>
        ))}
    </View>
  );
}

export function WeeklyPracticeScreen({
  data,
  persist,
  disabled,
}: {
  data: Notebook;
  persist: Persist;
  disabled: boolean;
}) {
  const now = useStudyClock(),
    week = weekStart(calendarDay(new Date(now)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const session = selectedId
    ? data.learning?.weekly.find((s) => s.id === selectedId)
    : data.learning?.weekly.find((s) => s.week === week);
  const current = session?.cards[session.answers.length];
  const [notice, setNotice] = useState("");
  return (
    <View style={{ gap: 18 }}>
      <Text style={styles.h2}>Haftalık karma mini sınav</Text>
      <Text style={styles.hint}>
        {session?.week ?? week} haftası · Kişisel gramer kartların ve sınav
        yanlışlarından en fazla 10 soru. Kaynaklar sırayla karıştırılır; az veri
        varsa daha kısa bir çalışma oluşturulur. Kural kartları kendi
        değerlendirmeni kullanır.
      </Text>
      {selectedId && (
        <Button secondary onPress={() => setSelectedId(null)}>
          Bu haftaya dön
        </Button>
      )}
      {!session ? (
        <>
          <Button
            disabled={disabled}
            onPress={() => {
              void persist((latest) => {
                const next = startWeekly(latest, makeId());
                if (
                  next === latest &&
                  !latest.learning?.weekly.some((s) => s.week === week)
                )
                  setNotice(
                    "Önce kişisel gramer notu ekle veya bir sınav tamamla.",
                  );
                return next;
              });
            }}
          >
            Bu haftanın mini sınavını başlat
          </Button>
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {notice}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text
            accessibilityLabel="Haftalık sınav ilerlemesi"
            style={styles.label}
          >
            {session.answers.length} / {session.cards.length} cevap kaydedildi
          </Text>
          {current ? (
            <LearningRound
              key={`${session.id}:${session.answers.length}`}
              card={current}
              disabled={disabled}
              onSave={async (answer, recalled) => {
                let applied = false;
                const eventId = makeId();
                const ok = await persist((latest) => {
                  const next = recordLearning(
                    latest,
                    current,
                    answer,
                    recalled,
                    eventId,
                    "",
                    Date.now(),
                    session.id,
                  );
                  applied = next !== latest;
                  return next;
                });
                return ok && applied;
              }}
            />
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.h2}>Haftalık mini sınav tamamlandı</Text>
              <Text style={styles.hint}>
                {session.answers.filter((a) => a.correct).length} doğru /{" "}
                {session.cards.length} soru. Bu bir çalışma sonucudur; asıl
                sınav puanlarına eklenmez.
              </Text>
            </View>
          )}
        </>
      )}
      <Text style={styles.h2}>Haftalık çalışma geçmişi</Text>
      {(data.learning?.weekly ?? [])
        .slice()
        .reverse()
        .map((s) => (
          <View key={s.id} style={{ gap: 4 }}>
            <Text style={styles.label}>
              {s.week} ·{" "}
              {s.answers.length === s.cards.length
                ? "Tamamlandı"
                : "Devam ediyor"}{" "}
              · {s.answers.filter((a) => a.correct).length} doğru /{" "}
              {s.answers.length} cevap
            </Text>
            {s.answers.length < s.cards.length && s.id !== session?.id && (
              <Button
                small
                secondary
                onPress={() => setSelectedId(s.id)}
              >{`${s.week} haftasına devam et`}</Button>
            )}
            {s.answers.length === s.cards.length &&
              s.cards.map((c, index) => (
                <Text key={index} style={styles.hint}>
                  {c.kind === "grammar" ? "Gramer" : "Sınav yanlışı"} ·{" "}
                  {c.prompt} ·{" "}
                  {s.answers[index].correct ? "Doğru" : "Yeniden çalışılacak"} ·
                  Cevap: {c.answer}
                </Text>
              ))}
          </View>
        ))}
    </View>
  );
}
