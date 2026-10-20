import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Word } from "../../model";
import {
  addDays,
  calendarDay,
  MEMORIZATION_DAYS,
  memorizationDue,
  nextMemorizationDate,
  type Memorization,
} from "../../memorization";
import { pageSlice } from "../../pagination";
import { theme } from "../../theme";
import { Blank, Button, Field } from "../components/ui";
import type { Persist } from "../types";
import { recordMemorization } from "../services/repetition";
import { useStudyClock } from "../hooks/useStudyClock";

type Filter = "due" | "learning" | "upcoming" | "complete" | "all";
const dateLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function MemorizationScreen({
  words,
  disabled,
  persist,
  onChooseWords,
  onOpenWord,
  initialFilter = "due",
}: {
  words: Word[];
  disabled: boolean;
  persist: Persist;
  onChooseWords: () => void;
  onOpenWord: (id: string) => void;
  initialFilter?: "due" | "learning";
}) {
  const now = useStudyClock();
  const today = calendarDay(new Date(now));
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState("");
  const enrolled = words.filter((word) => word.memorization);
  const status = (word: Word): Filter => {
    const plan = word.memorization!;
    return !plan.learnedOn
      ? "learning"
      : plan.reviews.length === MEMORIZATION_DAYS.length
        ? "complete"
        : memorizationDue(plan, today)
          ? "due"
          : "upcoming";
  };
  const tabs: [Filter, string][] = [
    ["due", "Bugünkü tekrarlar"],
    ["learning", "Ezberlenecekler"],
    ["upcoming", "Yaklaşan"],
    ["complete", "Tamamlanan"],
    ["all", "Tümü"],
  ];
  const matches = enrolled
    .filter(
      (word) =>
        (filter === "all" || status(word) === filter) &&
        `${word.word} ${word.meaning}`
          .toLocaleLowerCase("tr")
          .includes(query.trim().toLocaleLowerCase("tr")),
    )
    .sort((a, b) =>
      (
        nextMemorizationDate(a.memorization!) ?? a.memorization!.addedOn
      ).localeCompare(
        nextMemorizationDate(b.memorization!) ?? b.memorization!.addedOn,
      ),
    );
  const result = pageSlice(matches, page);
  async function record(id: string, expected: Memorization, initial: boolean) {
    if (savingRef.current || disabled) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const answerDay = calendarDay();
      let changed = false;
      const ok = await persist((current) => {
        const next = recordMemorization(
          current,
          id,
          expected,
          initial ? "learn" : "review",
          answerDay,
        );
        changed = next !== current;
        return next;
      });
      if (ok && changed) {
        setRevealed(null);
        setNotice(
          initial
            ? "Ezber tarihi kaydedildi. İlk tekrar yarın."
            : "Tekrar tarihi kaydedildi.",
        );
      } else if (ok) {
        setRevealed(null);
        setNotice(
          "Bu adım zaten kaydedilmiş veya tekrar zamanı henüz gelmemiş.",
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={s.stack}>
      <View style={s.panel}>
        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 200, gap: 8 }}>
            <Text style={s.eyebrow}>ARALIKLI TEKRAR</Text>
            <Text style={s.title}>Ezber</Text>
            <Text style={s.hint}>
              Kelimelerini seç, ezberlediğin günü kaydet, zamanı geldiğinde
              tekrar et.
            </Text>
          </View>
          <Button onPress={onChooseWords} secondary>
            Kelimelerim’den ekle
          </Button>
        </View>
        <View style={s.row}>
          {MEMORIZATION_DAYS.map((day) => (
            <View key={day} style={s.step}>
              <Text style={s.stepText}>{day}. gün</Text>
            </View>
          ))}
        </View>
        <Text style={s.hint}>
          Günler, “Ezberledim” dediğin tarihten itibaren hesaplanır. Geciken
          tekrarlar burada bekler. Her gün en fazla bir adım tamamlanır.
        </Text>
        <Text style={s.hint}>
          {enrolled.length} kelime ·{" "}
          {enrolled.filter((w) => status(w) === "due").length} tekrar bekliyor ·{" "}
          {enrolled.filter((w) => status(w) === "complete").length} tamamlandı
        </Text>
      </View>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.hint}>
          {notice}
        </Text>
      )}
      {enrolled.length === 0 ? (
        <Blank
          title="İlk kelimeni ezbere ekle"
          description="Kelimelerim sekmesindeki kartların Ezbere ekle düğmesini kullan. Kelimeyi çalıştıktan sonra burada Ezberledim diyerek tekrar takvimini başlat."
        />
      ) : (
        <>
          <View style={s.row}>
            {tabs.map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === key }}
                onPress={() => {
                  setFilter(key);
                  setPage(1);
                }}
                style={[s.tab, filter === key && s.selected]}
              >
                <Text style={[s.hint, filter === key && { color: "#fff" }]}>
                  {label} ·{" "}
                  {key === "all"
                    ? enrolled.length
                    : enrolled.filter((w) => status(w) === key).length}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Ezber listesinde ara"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Kelime veya Türkçe anlam…"
          />
          {matches.length === 0 && (
            <Blank
              title="Bu listede kelime yok"
              description="Diğer sekmelerden ezberlenecek veya yaklaşan kelimelerine bakabilirsin. Geciken tekrarlar Bugünkü tekrarlar listesine dahildir."
            />
          )}
          {result.rows.map((word) => {
            const plan = word.memorization!;
            const due = nextMemorizationDate(plan);
            const state = status(word);
            const revealKey = `${word.id}:${plan.learnedOn ?? "new"}:${plan.reviews.length}`;
            const show = revealed === revealKey;
            const lastToday = plan.reviews.at(-1) === today;
            return (
              <View key={word.id} style={s.panel}>
                <View style={s.row}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.word}>{word.word}</Text>
                    <Text style={s.hint}>
                      {!plan.learnedOn
                        ? `Listeye eklendi: ${dateLabel(plan.addedOn)}`
                        : `Ezber tarihi: ${dateLabel(plan.learnedOn)} · ${plan.reviews.length}/6 tekrar`}
                    </Text>
                  </View>
                  <Button small secondary onPress={() => onOpenWord(word.id)}>
                    Kartı aç
                  </Button>
                </View>
                <Text style={s.accent}>
                  {state === "complete"
                    ? "✓ 60 günlük tekrar planı tamamlandı"
                    : !due
                      ? "Çalıştıktan sonra ezber tarihini kaydet."
                      : lastToday && due <= today
                        ? "Bugünkü tekrar kaydedildi. Sonraki adım yarın açılacak."
                        : `${due < today ? "Geciken tekrar" : due === today ? "Bugünkü tekrar" : "Sonraki tekrar"}: ${dateLabel(due)}`}
                </Text>
                {show ? (
                  <View style={s.answer}>
                    <Text selectable style={s.meaning}>
                      {word.meaning ||
                        "Bu kelimenin anlamı henüz eklenmemiş. Kartı açarak ekleyebilirsin."}
                    </Text>
                    {!!word.example && (
                      <Text selectable style={s.hint}>
                        {word.example}
                      </Text>
                    )}
                    {!!word.translation && (
                      <Text selectable style={s.hint}>
                        {word.translation}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Button
                    small
                    secondary
                    onPress={() => setRevealed(revealKey)}
                  >
                    Anlamı göster
                  </Button>
                )}
                {(state === "learning" || state === "due") && show && (
                  <View style={s.row}>
                    <Button
                      disabled={disabled || saving || !word.meaning.trim()}
                      onPress={() => {
                        void record(word.id, plan, state === "learning");
                      }}
                    >
                      {state === "learning"
                        ? "Ezberledim"
                        : "Hatırladım · Tekrarı kaydet"}
                    </Button>
                    <Button
                      secondary
                      onPress={() => {
                        setRevealed(null);
                        setNotice(
                          "Biraz daha çalış; hazır olduğunda anlamı açıp tekrarını kaydedebilirsin.",
                        );
                      }}
                    >
                      Biraz daha çalış
                    </Button>
                  </View>
                )}
                <View style={s.row}>
                  {MEMORIZATION_DAYS.map((day, index) => (
                    <View
                      key={day}
                      style={[s.milestone, !!plan.reviews[index] && s.finished]}
                    >
                      <Text style={s.stepText}>
                        {plan.reviews[index] ? "✓ " : ""}
                        {day}. gün
                      </Text>
                      <Text style={s.small}>
                        {plan.reviews[index]
                          ? `Yapıldı: ${dateLabel(plan.reviews[index])}`
                          : plan.learnedOn
                            ? dateLabel(addDays(plan.learnedOn, day))
                            : "Ezber bekliyor"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          {result.pages > 1 && (
            <View style={s.row}>
              <Button
                small
                secondary
                disabled={result.page === 1}
                onPress={() => setPage(result.page - 1)}
              >
                Önceki
              </Button>
              <Text style={s.hint}>
                {result.page} / {result.pages}
              </Text>
              <Button
                small
                secondary
                disabled={result.page === result.pages}
                onPress={() => setPage(result.page + 1)}
              >
                Sonraki
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 18 },
  panel: {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: { color: theme.ink, fontSize: 28, fontWeight: "700" },
  word: { color: theme.ink, fontSize: 27, fontWeight: "600" },
  hint: { color: theme.muted, fontSize: 14, lineHeight: 22 },
  step: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  stepText: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: theme.surface,
  },
  selected: { backgroundColor: theme.accent },
  accent: {
    color: theme.accent,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  answer: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
    gap: 8,
  },
  meaning: { color: theme.ink, fontSize: 21, lineHeight: 30 },
  milestone: {
    padding: 10,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
    gap: 5,
    minWidth: 130,
  },
  finished: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accentSoft,
  },
  small: { color: theme.muted, fontSize: 12, lineHeight: 18 },
});
