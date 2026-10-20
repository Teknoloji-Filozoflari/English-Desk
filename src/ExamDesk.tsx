import { TopicManager } from "./notebook/components/TopicManager";
import type { Notebook } from "./model";
import type { Persist } from "./notebook/types";
import {
  ExamLearningScreen,
  WeeklyPracticeScreen,
} from "./notebook/screens/ExamLearningScreen";
import { DEFAULT_EXAM_TOPICS, type Topic } from "./topics";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme as t } from "./theme";
import {
  correct,
  emptyExams,
  examCollection,
  examTopicId,
  examPresentation,
  exampleTests,
  groupExamTests,
  score,
  validateExamTest,
  type ExamAttempt,
  type ExamCollection,
  type ExamData,
  type ExamKind,
  type ExamQuestion,
  type ExamTest,
} from "./exams";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const newQuestion = (): ExamQuestion => ({
  id: uid(),
  prompt: "",
  passage: "",
  kind: "choice",
  options: ["", "", "", ""],
  answer: "",
  explanation: "",
});
function Action({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, primary && s.primary, disabled && { opacity: 0.45 }]}
    >
      <Text style={[s.buttonText, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}
function Input({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        maxLength={multiline ? 100000 : 2000}
        style={[
          s.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function ExamDesk({
  notebook,
  persist,
  data = emptyExams,
  disabled,
  onSave,
  topicId,
  onSelectTopic,
  onSaveTopics,
  initialTab = "tests",
}: {
  notebook: Notebook;
  persist: Persist;
  data?: ExamData;
  disabled: boolean;
  topicId: string;
  onSelectTopic: (id: string) => void;
  onSaveTopics: (topics: Topic[], deleted?: string) => Promise<boolean>;
  onSave: (update: (current: ExamData) => ExamData) => Promise<boolean>;
  initialTab?: "tests" | "wrong";
}) {
  const topics = data.topics ?? DEFAULT_EXAM_TOPICS;
  const topic = topics.find((row) => row.id === topicId);
  const matchesTopic = (test: ExamTest) =>
    (topics.some((t) => t.id === examTopicId(test))
      ? examTopicId(test)
      : "") === topicId;
  const exam: ExamKind = topicId === "ielts" ? "IELTS" : "YDS";
  const collection: ExamCollection = topicId === "osym" ? "osym" : "other";
  const [tab, setTab] = useState<"tests" | "wrong" | "history" | "weekly">(
    initialTab,
  );
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setActiveId(null);
    setQuery("");
    setTab(initialTab);
  }, [topicId, initialTab]);
  const [draft, setDraft] = useState<ExamTest | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const active = data.attempts.find((row) => row.id === activeId);
  const lock = disabled || working;
  async function save(update: (current: ExamData) => ExamData) {
    setWorking(true);
    try {
      return await onSave(update);
    } finally {
      setWorking(false);
    }
  }
  async function start(
    test: ExamTest,
    mode: "study" | "exam",
    questions = test.questions,
  ) {
    const attempt: ExamAttempt = {
      id: uid(),
      test: { ...test, questions },
      mode,
      answers: {},
      flags: [],
      position: 0,
      elapsed: 0,
      finished: false,
      created: Date.now(),
    };
    if (
      await save((current) => ({
        ...current,
        attempts: [...current.attempts, attempt],
      }))
    )
      setActiveId(attempt.id);
  }
  const tests = data.tests.filter(
    (row) =>
      matchesTopic(row) &&
      `${row.title} ${row.section} ${row.source}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const history = data.attempts
    .filter((row) => matchesTopic(row.test) && row.finished)
    .slice()
    .reverse();
  const pending = data.attempts.filter(
    (row) => matchesTopic(row.test) && !row.finished,
  );
  if (active)
    return (
      <ExamSession
        key={active.id}
        attempt={active}
        disabled={lock}
        onUpdate={(patch) =>
          save((current) => ({
            ...current,
            attempts: current.attempts.map((row) =>
              row.id === active.id
                ? {
                    ...row,
                    ...patch,
                    ...(patch.finished === true && !row.finished
                      ? { completedAt: Date.now() }
                      : {}),
                  }
                : row,
            ),
          }))
        }
        onExit={() => setActiveId(null)}
        onRepeat={() => {
          setActiveId(null);
          setTab("wrong");
        }}
      />
    );
  return (
    <View style={s.container}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>SINAV ATÖLYESİ</Text>
        <Text style={s.heading}>Bilgini sınavda kullan.</Text>
        <Text style={s.muted}>
          Kısa testlerle çalış, denemeyle kendini ölç, yanlışlarından tekrar et.
        </Text>
      </View>
      <TopicManager
        topics={topics}
        selected={topicId}
        onSelect={(id) => {
          onSelectTopic(id);
          setActiveId(null);
          setQuery("");
        }}
        onSave={onSaveTopics}
        disabled={lock}
        generalLabel="Genel testler"
        reserved={["Genel testler"]}
      />
      <View style={s.row}>
        {(
          [
            ["tests", "Testler"],
            ["wrong", "Yanlışlarım"],
            ["weekly", "Haftalık karma"],
            ["history", "Geçmiş sonuçlar"],
          ] as const
        ).map(([key, label]) => (
          <Action
            key={key}
            label={label}
            primary={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {tab === "tests" && (
        <>
          {pending.map((row) => (
            <View key={row.id} style={s.resume}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{row.test.title}</Text>
                <Text style={s.muted}>
                  {Object.values(row.answers).filter(Boolean).length} /{" "}
                  {row.test.questions.length} cevap ·{" "}
                  {row.mode === "study" ? "Çalışma" : "Deneme"}
                </Text>
              </View>
              <Action
                label="Devam et"
                primary
                onPress={() => setActiveId(row.id)}
              />
            </View>
          ))}
          <View style={s.between}>
            <Text accessibilityRole="header" style={s.title}>
              {topic?.title ?? "Genel testler"}
            </Text>
            <Action
              label="+ Test ekle"
              primary
              disabled={lock}
              onPress={() => {
                setError("");
                setDraft({
                  id: uid(),
                  exam,
                  collection,
                  topicId,
                  title: "",
                  section: exam === "YDS" ? "Karma" : "Academic Reading",
                  source: "",
                  minutes: 0,
                  questions: [newQuestion()],
                });
              }}
            />
          </View>
          {collection === "osym" && (
            <Text style={s.muted}>
              ÖSYM’nin yayımladığı YDS ve e-YDS soruları. Her testte PDF’de
              bulunan soru sayısı gösterilir.
            </Text>
          )}
          <Input label="Testlerde ara" value={query} onChange={setQuery} />
          {!tests.length &&
            (query.trim() ? (
              <Text style={s.muted}>Aramana uygun test bulunamadı.</Text>
            ) : collection === "osym" ? (
              <Text style={s.muted}>ÖSYM arşivinde henüz test yok.</Text>
            ) : (
              <View style={s.card}>
                <Text style={s.title}>Diğer kaynakların burada.</Text>
                <Text style={s.muted}>
                  Eklediğin denemeler ve alıştırmalar ÖSYM arşivinden ayrı
                  tutulur.
                </Text>
                <Action
                  label="Örnek testleri ekle"
                  disabled={lock}
                  onPress={() => {
                    void save((current) => ({
                      ...current,
                      tests: [
                        ...current.tests,
                        ...exampleTests().filter(
                          (test) =>
                            !current.tests.some((row) => row.id === test.id),
                        ),
                      ],
                    }));
                  }}
                />
              </View>
            ))}
          {groupExamTests(tests).map((group) => (
            <View key={group.year} style={s.yearGroup}>
              <View style={s.yearHeader}>
                <Text accessibilityRole="header" style={s.yearTitle}>
                  {group.year}
                </Text>
                <View style={s.yearLine} />
                <Text style={s.muted}>{group.tests.length} test</Text>
              </View>
              <View style={s.testGrid}>
                {group.tests.map((test) => (
                  <View key={test.id} style={[s.card, s.testCard]}>
                    <Text style={s.testTitle}>
                      {examPresentation(test).title}
                    </Text>
                    <Text style={s.muted}>
                      {test.questions.length} soru
                      {test.minutes ? ` · ${test.minutes} dk` : ""}
                      {test.section !== "Karma" ? ` · ${test.section}` : ""}
                    </Text>
                    <View style={s.row}>
                      <Action
                        label="Çalış"
                        primary
                        disabled={lock}
                        onPress={() => {
                          void start(test, "study");
                        }}
                      />
                      <Action
                        label="Deneme"
                        disabled={lock}
                        onPress={() => {
                          void start(test, "exam");
                        }}
                      />
                      <Action
                        label="Düzenle"
                        disabled={lock}
                        onPress={() => {
                          setError("");
                          setDraft({
                            ...JSON.parse(JSON.stringify(test)),
                            collection: examCollection(test),
                            topicId: topics.some(
                              (t) => t.id === examTopicId(test),
                            )
                              ? examTopicId(test)
                              : "",
                          });
                        }}
                      />
                      <Action
                        label="Sil"
                        disabled={lock}
                        onPress={() => setConfirmDelete(test.id)}
                      />
                    </View>
                    {!!test.source && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: !!sources[test.id] }}
                          onPress={() =>
                            setSources((current) => ({
                              ...current,
                              [test.id]: !current[test.id],
                            }))
                          }
                        >
                          <Text style={s.sourceToggle}>
                            Kaynak {sources[test.id] ? "−" : "+"}
                          </Text>
                        </Pressable>
                        {sources[test.id] && (
                          <Text style={s.muted}>{test.source}</Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
      {tab === "history" && (
        <>
          {!history.length && (
            <Text style={s.muted}>
              Bitirdiğin testlerin sonuçları burada görünecek.
            </Text>
          )}
          {history.map((row) => {
            const result = score(row);
            return (
              <Pressable
                accessibilityRole="button"
                key={row.id}
                onPress={() => setActiveId(row.id)}
                style={s.card}
              >
                <Text style={s.title}>{row.test.title}</Text>
                <Text style={s.muted}>
                  {new Date(row.created).toLocaleDateString("tr-TR")} ·{" "}
                  {result.right} doğru / {result.wrong} yanlış / {result.blank}{" "}
                  boş · {clock(row.elapsed)}
                </Text>
                <Text style={s.tag}>Sonucu incele →</Text>
              </Pressable>
            );
          })}
        </>
      )}
      {tab === "wrong" && (
        <ExamLearningScreen
          key={topicId}
          data={notebook}
          persist={persist}
          disabled={lock}
          topicId={topicId}
          onInspect={setActiveId}
        />
      )}
      {tab === "weekly" && (
        <WeeklyPracticeScreen
          data={notebook}
          persist={persist}
          disabled={lock}
        />
      )}
      <Modal
        visible={!!draft}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!lock) setDraft(null);
        }}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.between}>
              <Text style={s.title}>Test hazırlama</Text>
              <Action
                label="Kapat"
                disabled={lock}
                onPress={() => setDraft(null)}
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 15, paddingVertical: 16 }}
            >
              {draft && (
                <>
                  <Text style={s.muted}>
                    Kaydetmeden önce soruları ve cevap anahtarını kontrol et. Bu
                    sürümde çoktan seçmeli ve kısa cevap soruları desteklenir.
                  </Text>
                  {!!error && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {error}
                    </Text>
                  )}
                  <View style={s.row}>
                    {(["YDS", "IELTS"] as const).map((kind) => (
                      <Action
                        key={kind}
                        label={kind}
                        primary={draft.exam === kind}
                        onPress={() =>
                          setDraft({
                            ...draft,
                            exam: kind,
                            collection:
                              kind === "IELTS"
                                ? "other"
                                : examCollection(draft),
                          })
                        }
                      />
                    ))}
                  </View>
                  <Text style={s.label}>Alt başlık</Text>
                  <View style={s.row}>
                    {[{ id: "", title: "Genel testler" }, ...topics].map(
                      (topic) => (
                        <Pressable
                          key={topic.id}
                          accessibilityRole="radio"
                          accessibilityLabel={`Test alt başlığı: ${topic.title}`}
                          aria-checked={(draft.topicId ?? "") === topic.id}
                          onPress={() =>
                            setDraft({ ...draft, topicId: topic.id })
                          }
                          style={[
                            s.button,
                            draft.topicId === topic.id && s.primary,
                          ]}
                        >
                          <Text
                            style={[
                              s.buttonText,
                              draft.topicId === topic.id && { color: "#fff" },
                            ]}
                          >
                            {topic.title}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <Input
                    label="Test başlığı"
                    value={draft.title}
                    onChange={(title) => setDraft({ ...draft, title })}
                  />
                  <Input
                    label="Bölüm (ör. Bağlaçlar / Academic Reading)"
                    value={draft.section}
                    onChange={(section) => setDraft({ ...draft, section })}
                  />
                  <Input
                    label="Kaynak / yıl"
                    value={draft.source}
                    onChange={(source) => setDraft({ ...draft, source })}
                  />
                  <Input
                    label="Süre (dakika, 0 = süresiz)"
                    value={String(draft.minutes)}
                    onChange={(value) =>
                      setDraft({ ...draft, minutes: Number(value) })
                    }
                  />
                  {draft.questions.map((q, index) => (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      number={index + 1}
                      onChange={(question) =>
                        setDraft({
                          ...draft,
                          questions: draft.questions.map((row) =>
                            row.id === q.id ? question : row,
                          ),
                        })
                      }
                      onRemove={() =>
                        setDraft({
                          ...draft,
                          questions: draft.questions.filter(
                            (row) => row.id !== q.id,
                          ),
                        })
                      }
                    />
                  ))}
                  <Action
                    label="+ Soru ekle"
                    disabled={draft.questions.length >= 200}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        questions: [...draft.questions, newQuestion()],
                      })
                    }
                  />
                </>
              )}
            </ScrollView>
            <Action
              label="Kontrol et ve kaydet"
              primary
              disabled={lock}
              onPress={() => {
                if (!draft) return;
                try {
                  const checked = validateExamTest(draft);
                  setError("");
                  void save((current) => ({
                    ...current,
                    tests: current.tests.some((row) => row.id === checked.id)
                      ? current.tests.map((row) =>
                          row.id === checked.id ? checked : row,
                        )
                      : [...current.tests, checked],
                  })).then((ok) => {
                    if (ok) {
                      onSelectTopic(checked.topicId ?? "");
                      setDraft(null);
                    }
                  });
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Test kaydedilemedi.",
                  );
                }
              }}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!confirmDelete}
        transparent
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.title}>Test silinsin mi?</Text>
            <Text style={s.muted}>
              Test kütüphaneden kaldırılır. Eski sonuçların ve devam eden
              oturumların saklanır.
            </Text>
            <View style={s.row}>
              <Action label="Vazgeç" onPress={() => setConfirmDelete(null)} />
              <Action
                label="Testi sil"
                disabled={lock}
                primary
                onPress={() => {
                  void save((current) => ({
                    ...current,
                    tests: current.tests.filter(
                      (row) => row.id !== confirmDelete,
                    ),
                  })).then((ok) => {
                    if (ok) setConfirmDelete(null);
                  });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuestionEditor({
  question: q,
  number,
  onChange,
  onRemove,
}: {
  question: ExamQuestion;
  number: number;
  onChange: (q: ExamQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.between}>
        <Text style={s.title}>Soru {number}</Text>
        <Action label="Soruyu kaldır" onPress={onRemove} />
      </View>
      <View style={s.row}>
        <Action
          label="Seçenekli"
          primary={q.kind === "choice"}
          onPress={() =>
            onChange({
              ...q,
              kind: "choice",
              options: ["", "", "", ""],
              answer: "",
            })
          }
        />
        <Action
          label="Kısa cevap"
          primary={q.kind === "text"}
          onPress={() =>
            onChange({ ...q, kind: "text", options: [], answer: "" })
          }
        />
        <Action
          label="True / False / Not Given"
          onPress={() =>
            onChange({
              ...q,
              kind: "choice",
              options: ["True", "False", "Not Given"],
              answer: "",
            })
          }
        />
      </View>
      <Input
        label="Paragraf / okuma metni (isteğe bağlı)"
        multiline
        value={q.passage}
        onChange={(passage) => onChange({ ...q, passage })}
      />
      <Input
        label="Soru"
        multiline
        value={q.prompt}
        onChange={(prompt) => onChange({ ...q, prompt })}
      />
      {q.kind === "choice" ? (
        <>
          {q.options.map((option, index) => (
            <View key={index} style={s.field}>
              <Input
                label={`${String.fromCharCode(65 + index)} seçeneği`}
                value={option}
                onChange={(value) => {
                  const options = q.options.map((text, i) =>
                    i === index ? value : text,
                  );
                  onChange({
                    ...q,
                    options,
                    answer: q.answer === option ? value : q.answer,
                  });
                }}
              />
              <Action
                label={
                  q.answer === option && option
                    ? "✓ Doğru cevap"
                    : "Doğru cevap olarak seç"
                }
                primary={!!option && q.answer === option}
                disabled={!option}
                onPress={() => onChange({ ...q, answer: option })}
              />
            </View>
          ))}
          <Action
            label="+ Seçenek"
            disabled={q.options.length >= 8}
            onPress={() => onChange({ ...q, options: [...q.options, ""] })}
          />
        </>
      ) : (
        <Input
          label="Doğru cevap"
          value={q.answer}
          onChange={(answer) => onChange({ ...q, answer })}
        />
      )}
      <Input
        label="Cevap açıklaması (isteğe bağlı)"
        multiline
        value={q.explanation}
        onChange={(explanation) => onChange({ ...q, explanation })}
      />
    </View>
  );
}

function ExamSession({
  attempt: a,
  disabled,
  onUpdate,
  onExit,
  onRepeat,
}: {
  attempt: ExamAttempt;
  disabled: boolean;
  onUpdate: (patch: Partial<ExamAttempt>) => Promise<boolean>;
  onExit: () => void;
  onRepeat: () => void;
}) {
  const [position, setPosition] = useState(a.position);
  const [elapsed, setElapsed] = useState(a.elapsed);
  const [textAnswer, setTextAnswer] = useState(
    a.answers[a.test.questions[a.position].id] ?? "",
  );
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const started = useRef(Date.now());
  const initialElapsed = useRef(a.elapsed);
  const nowElapsed = () =>
    initialElapsed.current + Math.floor((Date.now() - started.current) / 1000);
  const lastCheckpoint = useRef(a.elapsed);
  useEffect(() => {
    if (a.finished) return;
    const timer = setInterval(() => setElapsed(nowElapsed()), 1000);
    return () => clearInterval(timer);
  }, [a.finished]);
  useEffect(() => {
    if (a.finished || disabled) return;
    if (a.mode === "exam" && a.test.minutes && elapsed >= a.test.minutes * 60) {
      void onUpdate({ elapsed, finished: true });
      return;
    }
    if (elapsed - lastCheckpoint.current >= 15) {
      lastCheckpoint.current = elapsed;
      void onUpdate({ elapsed });
    }
  }, [elapsed, disabled, a.finished]);
  const q = a.test.questions[position],
    answer = a.answers[q.id] ?? "",
    result = score(a);
  function navigate(next: number) {
    setPosition(next);
    setTextAnswer(a.answers[a.test.questions[next].id] ?? "");
    if (!a.finished) void onUpdate({ position: next, elapsed: nowElapsed() });
  }
  async function answerQuestion(value: string) {
    if (
      await onUpdate({
        answers: { ...a.answers, [q.id]: value },
        position,
        elapsed: nowElapsed(),
      })
    )
      setRevealed((current) => ({ ...current, [q.id]: true }));
  }
  const showAnswer = a.finished || (a.mode === "study" && revealed[q.id]);
  return (
    <View style={s.container}>
      <View style={s.between}>
        <Action
          label="← Testlere dön"
          disabled={disabled}
          onPress={() => {
            if (a.finished) onExit();
            else
              void onUpdate({ elapsed: nowElapsed(), position }).then((ok) => {
                if (ok) onExit();
              });
          }}
        />
        <Text style={s.tag}>
          {a.finished
            ? "SONUÇ"
            : a.mode === "study"
              ? "ÇALIŞMA MODU"
              : "DENEME MODU"}
        </Text>
      </View>
      <Text style={s.heading}>{a.test.title}</Text>
      {a.finished ? (
        <View style={s.result}>
          <Text style={s.title}>
            {result.right} doğru · {result.wrong} yanlış · {result.blank} boş
          </Text>
          <Text style={s.muted}>
            Başarı: %{Math.round((result.right / result.total) * 100)} · Süre:{" "}
            {clock(a.elapsed)}
          </Text>
          <Text style={s.muted}>
            Bu çalışma sonucu resmî sınav puanı veya IELTS bandı değildir.
          </Text>
          {result.wrong + result.blank > 0 && (
            <Action
              label="Yanlışları tekrar et"
              disabled={disabled}
              onPress={onRepeat}
            />
          )}
        </View>
      ) : (
        <View style={s.between}>
          <Text style={s.muted}>
            {Object.values(a.answers).filter(Boolean).length} /{" "}
            {a.test.questions.length} cevaplandı · Cevaplar dosyaya kaydedilir.
          </Text>
          <Text style={s.title}>
            {a.mode === "exam" && a.test.minutes
              ? `Kalan ${clock(Math.max(0, a.test.minutes * 60 - elapsed))}`
              : clock(elapsed)}
          </Text>
        </View>
      )}
      <View style={s.row}>
        {a.test.questions.map((question, index) => (
          <Pressable
            key={question.id}
            accessibilityRole="button"
            accessibilityLabel={`Soru ${index + 1}`}
            disabled={disabled}
            onPress={() => navigate(index)}
            style={[
              s.number,
              !!a.answers[question.id] && { backgroundColor: "#E6EEE4" },
              a.flags.includes(question.id) && { borderColor: t.amberInk },
              position === index && { borderColor: t.accent, borderWidth: 2 },
            ]}
          >
            <Text style={s.buttonText}>
              {index + 1}
              {a.flags.includes(question.id) ? " ⚑" : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.tag}>
            SORU {position + 1} / {a.test.questions.length}
          </Text>
          {!a.finished && (
            <Action
              label={
                a.flags.includes(q.id) ? "⚑ İşareti kaldır" : "Sonra bakacağım"
              }
              disabled={disabled}
              onPress={() => {
                void onUpdate({
                  flags: a.flags.includes(q.id)
                    ? a.flags.filter((id) => id !== q.id)
                    : [...a.flags, q.id],
                  elapsed: nowElapsed(),
                });
              }}
            />
          )}
        </View>
        {!!q.passage && (
          <View style={s.passage}>
            <Text selectable style={s.reading}>
              {q.passage}
            </Text>
          </View>
        )}
        <Text selectable style={s.reading}>
          {q.prompt}
        </Text>
        {q.kind === "choice" ? (
          q.options.map((option, index) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: answer === option }}
              aria-checked={answer === option}
              disabled={
                disabled || a.finished || (a.mode === "study" && showAnswer)
              }
              key={index}
              onPress={() => {
                void answerQuestion(option);
              }}
              style={[
                s.option,
                answer === option && {
                  borderColor: t.accent,
                  backgroundColor: t.accentSoft,
                },
                showAnswer &&
                  q.answer === option && {
                    borderColor: "#3E6C59",
                    backgroundColor: "#E6EEE4",
                  },
              ]}
            >
              <Text style={s.reading}>
                {String.fromCharCode(65 + index)}. {option}
              </Text>
            </Pressable>
          ))
        ) : (
          <>
            <Input
              label="Cevabın"
              value={a.finished ? answer : textAnswer}
              onChange={setTextAnswer}
            />
            {!a.finished && (
              <Action
                label="Cevabı kaydet"
                disabled={disabled}
                primary
                onPress={() => {
                  void answerQuestion(textAnswer);
                }}
              />
            )}
          </>
        )}
        {showAnswer && (
          <View style={s.result}>
            <Text style={s.title}>
              {correct(q, answer)
                ? "✓ Doğru"
                : answer
                  ? "Yanlış cevap"
                  : "Boş bırakıldı"}
            </Text>
            <Text selectable style={s.reading}>
              Doğru cevap: {q.answer}
            </Text>
            {!!q.explanation && (
              <Text selectable style={s.muted}>
                {q.explanation}
              </Text>
            )}
          </View>
        )}
        <View style={s.between}>
          <Action
            label="← Önceki"
            disabled={disabled || position === 0}
            onPress={() => navigate(position - 1)}
          />
          {position < a.test.questions.length - 1 ? (
            <Action
              label="Sonraki →"
              disabled={disabled}
              primary
              onPress={() => navigate(position + 1)}
            />
          ) : (
            !a.finished && (
              <Action
                label="Testi bitir"
                disabled={disabled}
                primary
                onPress={() => setFinishConfirm(true)}
              />
            )
          )}
        </View>
      </View>
      {!a.finished && position < a.test.questions.length - 1 && (
        <Action
          label="Testi bitir"
          disabled={disabled}
          onPress={() => setFinishConfirm(true)}
        />
      )}
      <Modal
        visible={finishConfirm}
        transparent
        onRequestClose={() => setFinishConfirm(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.title}>Testi bitir?</Text>
            <Text style={s.muted}>
              {result.blank} boş sorunuz var. Kaydedilmemiş kısa cevabınız varsa
              önce cevabı kaydedin.
            </Text>
            <View style={s.row}>
              <Action
                label="Devam et"
                onPress={() => setFinishConfirm(false)}
              />
              <Action
                label="Bitir ve sonucu göster"
                disabled={disabled}
                primary
                onPress={() => {
                  void onUpdate({
                    finished: true,
                    elapsed: nowElapsed(),
                    position,
                  }).then((ok) => {
                    if (ok) setFinishConfirm(false);
                  });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  yearGroup: { gap: 14, marginTop: 8 },
  yearHeader: { flexDirection: "row", alignItems: "center", gap: 16 },
  yearTitle: { fontSize: 21, fontWeight: "600", color: t.ink },
  yearLine: { flex: 1, height: 1, backgroundColor: t.line },
  testGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  testCard: {
    flexBasis: 300,
    flexGrow: 1,
    maxWidth: "100%",
    padding: 18,
    gap: 12,
  },
  testTitle: { fontSize: 17, fontWeight: "600", color: t.ink },
  sourceToggle: { fontSize: 12, color: t.muted, paddingVertical: 6 },
  container: { gap: 20 },
  hero: {
    padding: 28,
    backgroundColor: t.accentSoft,
    borderRadius: 18,
    gap: 15,
  },
  eyebrow: {
    color: t.accent,
    letterSpacing: 2,
    fontWeight: "700",
    fontSize: 11,
  },
  heading: { color: t.ink, fontSize: 32, fontWeight: "600" },
  title: { color: t.ink, fontSize: 20, fontWeight: "600" },
  muted: { color: t.muted, fontSize: 14, lineHeight: 23 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  between: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  card: {
    padding: 23,
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.line,
    gap: 17,
  },
  resume: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#E6EEE4",
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
  },
  tag: { color: t.accent, fontSize: 12, fontWeight: "700" },
  button: {
    maxWidth: "100%",
    flexShrink: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.surface,
  },
  primary: { backgroundColor: t.accent, borderColor: t.accent },
  buttonText: {
    color: t.ink,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  field: { gap: 8 },
  label: { color: t.ink, fontSize: 13, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#B9B3A8",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: t.ink,
    backgroundColor: t.surface,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#202630A6",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "100%",
    maxWidth: 780,
    maxHeight: "92%",
    backgroundColor: t.surface,
    borderRadius: 18,
    padding: 22,
    gap: 16,
  },
  error: {
    padding: 15,
    color: "#A32934",
    backgroundColor: "#FFEBEB",
    borderRadius: 8,
  },
  number: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    backgroundColor: t.surface,
  },
  passage: { backgroundColor: t.background, padding: 20, borderRadius: 10 },
  reading: { fontSize: 18, color: t.ink, lineHeight: 29 },
  option: { padding: 15, borderWidth: 1, borderColor: t.line, borderRadius: 9 },
  result: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#E6EEE4",
    gap: 12,
  },
});
