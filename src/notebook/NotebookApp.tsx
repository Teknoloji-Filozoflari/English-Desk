import { removeGuideTopic, restoreGuideTopic } from "../grammar-guide";
import { DEFAULT_EXAM_TOPICS, type Topic } from "../topics";
import { removeExamTopic } from "../exams";
import { BackupModal } from "./components/BackupModal";
import { useBackup } from "./hooks/useBackup";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { initialBrowserState, type BrowserState } from "../CollectionBrowser";
import { ExamDesk } from "../ExamDesk";
import { emptyExams } from "../exams";
import type { ModalityTopic } from "../modality";
import { sentenceAt, Story, Token, Word } from "../model";
import { reflowPdfText } from "../reading-text";
import type { TenseName } from "../tenses";
import { EditorModal } from "./components/EditorModal";
import { Navigation } from "./components/Navigation";
import { WordDetailsModal } from "./components/WordDetailsModal";
import { Button } from "./components/ui";
import { useNotebook } from "./hooks/useNotebook";
import { useNotebookActions } from "./hooks/useNotebookActions";
import { useNotebookEditor } from "./hooks/useNotebookEditor";
import { useStoryImport } from "./hooks/useStoryImport";
import { useStudyView } from "./hooks/useStudyView";
import { useWordEnrichment } from "./hooks/useWordEnrichment";
import { GrammarScreen } from "./screens/GrammarScreen";
import { ReaderScreen } from "./screens/ReaderScreen";
import { StoriesScreen } from "./screens/StoriesScreen";
import { WordsScreen } from "./screens/WordsScreen";
import { colors, styles } from "./styles";
import { type Page } from "./types";
export function NotebookApp() {
  const { wordReview, readerSettings, noteFilters } = useStudyView();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const { data, dataRef, ready, storageError, busy, persist, commit } =
    useNotebook(setNotice, setFormError);
  const {
    wordStatus,
    wordMessages,
    setWordMessages,
    wordController,
    enrichCards,
    refreshTurkishMeaning,
  } = useWordEnrichment(dataRef, persist, storageError, setNotice);
  const [page, setPage] = useState<Page>("stories");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [storyBrowser, setStoryBrowser] =
    useState<BrowserState>(initialBrowserState);
  const [grammarSection, setGrammarSection] = useState<
    "notes" | "tenses" | "modality"
  >("notes");
  const [grammarTopicId, setGrammarTopicId] = useState("");
  const [examTopicId, setExamTopicId] = useState("osym");
  const [examsExpanded, setExamsExpanded] = useState(false);
  const [grammarExpanded, setGrammarExpanded] = useState(false);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const selectedWord = data.words.find((word) => word.id === selectedWordId);
  const {
    editor,
    setEditor,
    extraSenses,
    setExtraSenses,
    openEditor,
    submitEditor,
  } = useNotebookEditor(dataRef, persist, enrichCards, setNotice, setFormError);
  const {
    importStatus,
    importError,
    setImportError,
    importController,
    importStory,
  } = useStoryImport(dataRef, openEditor);
  const backupController = useBackup(dataRef, commit, setNotice, () =>
    go("stories"),
  );
  const { confirmation, setConfirmation, deleteItem } = useNotebookActions(
    dataRef,
    persist,
    setNotice,
    () => setStoryId(null),
  );
  const [phraseMode, setPhraseMode] = useState(false);
  const [phraseStart, setPhraseStart] = useState<Token | null>(null);
  const [sentenceMode, setSentenceMode] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const currentScrollY = useRef(0);
  const storyListScrollY = useRef(0);
  const openedFromStoryList = useRef(false);
  const restoreStoryScrollY = useRef<number | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function go(next: Page) {
    const returningToStoryList =
      next === "stories" &&
      page === "stories" &&
      !!storyId &&
      openedFromStoryList.current;
    restoreStoryScrollY.current = returningToStoryList
      ? storyListScrollY.current
      : null;
    openedFromStoryList.current = false;
    setPage(next);
    if (next === "grammar") {
      setGrammarSection("notes");
      setGrammarTopicId("");
      setGrammarExpanded(true);
    }
    if (next === "exams") setExamsExpanded(true);
    setStoryId(null);
    setPhraseMode(false);
    setPhraseStart(null);
    setSentenceMode(false);
    if (!returningToStoryList)
      scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function goToGrammarTopic(id: string) {
    go("grammar");
    setGrammarTopicId(id);
  }
  function goToExamTopic(id: string) {
    go("exams");
    setExamTopicId(id);
  }
  async function saveGrammarTopics(topics: Topic[], deleted?: string) {
    return persist((current) => ({
      ...current,
      grammarTopics: topics,
      grammar: current.grammar.map((g) => {
        if (g.topicId !== deleted || !deleted) return g;
        const { topicId, ...note } = g;
        return note;
      }),
    }));
  }
  async function saveExamTopics(topics: Topic[], deleted?: string) {
    return persist((current) => ({
      ...current,
      exams: {
        ...(deleted
          ? removeExamTopic(current.exams ?? emptyExams, deleted)
          : (current.exams ?? emptyExams)),
        topics,
      },
    }));
  }
  useEffect(() => {
    if (
      grammarTopicId &&
      !data.grammarTopics?.some((t) => t.id === grammarTopicId)
    )
      setGrammarTopicId("");
    if (
      examTopicId &&
      !(data.exams?.topics ?? DEFAULT_EXAM_TOPICS).some(
        (t) => t.id === examTopicId,
      )
    )
      setExamTopicId("");
  }, [data.grammarTopics, data.exams?.topics, grammarTopicId, examTopicId]);
  function deleteGuideTopic(
    section: "tenses" | "modality",
    topic: TenseName | ModalityTopic,
  ) {
    setConfirmation({
      title: "Konu başlığı silinsin mi?",
      message: `${topic} başlığı kaldırılacak. İçindeki kişisel notlar silinmeden Genel konular bölümüne taşınacak.`,
      label: "Başlığı sil",
      run: () =>
        persist((current) => removeGuideTopic(current, section, topic)),
    });
  }
  function restoreGuideTitle(
    section: "tenses" | "modality",
    topic: TenseName | ModalityTopic,
  ) {
    return persist((current) => restoreGuideTopic(current, section, topic));
  }
  function goToTenses() {
    setPage("grammar");
    setGrammarSection("tenses");
    setGrammarExpanded(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function goToModality() {
    setPage("grammar");
    setGrammarSection("modality");
    setGrammarExpanded(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function addTenseNote(tense: TenseName) {
    openEditor("grammar", undefined, { tense });
  }
  function addModalityNote(modality: ModalityTopic) {
    openEditor("grammar", undefined, { modality });
  }
  const story = data.stories.find((s) => s.id === storyId);
  const readingText = story
    ? /\.pdf$/i.test(story.sourceName ?? "")
      ? reflowPdfText(story.text)
      : story.text
    : "";
  function pickToken(token: Token) {
    if (!story) return;
    let start = token.start,
      end = token.end;
    if (sentenceMode) {
      setSentenceMode(false);
      const selection = sentenceAt(readingText, start, end);
      if (selection.length > 5000) {
        setNotice("Daha kısa bir cümle seç.");
        return;
      }
      openEditor("storyNotes", undefined, {
        storyId: story.id,
        selection,
        title: selection.slice(0, 80),
      });
      return;
    }
    if (phraseMode) {
      if (!phraseStart) {
        setPhraseStart(token);
        return;
      }
      start = Math.min(phraseStart.start, token.start);
      end = Math.max(phraseStart.end, token.end);
      setPhraseStart(null);
      setPhraseMode(false);
      const selection = readingText.slice(start, end).trim();
      if (selection.length > 5000) {
        setNotice("Daha kısa bir ifade seç.");
        return;
      }
      openEditor("storyNotes", undefined, {
        storyId: story.id,
        selection,
        title: selection.slice(0, 80),
      });
      return;
    }
    const word = readingText.slice(start, end);
    if (word.length > 500) {
      setNotice("Daha kısa bir ifade seç; en fazla 500 karakter.");
      return;
    }
    const existing = data.words.find(
      (w) =>
        (w.storyId === story.id || w.storyIds?.includes(story.id)) &&
        w.word.toLowerCase() === word.toLowerCase(),
    );
    openEditor(
      "words",
      existing,
      existing
        ? {}
        : {
            word,
            level: "",
            storyId: story.id,
            example: sentenceAt(readingText, start, end),
          },
    );
  }
  function openChapter(row: Story) {
    setStoryId(row.id);
    setPhraseMode(false);
    setPhraseStart(null);
    setSentenceMode(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function wordCard(word: Word) {
    return (
      <Pressable
        key={word.id}
        accessibilityRole="button"
        accessibilityLabel={word.word}
        accessibilityHint="Kelime kartının ayrıntılarını aç"
        onPress={() => {
          setSelectedWordId(word.id);
        }}
        style={({ pressed }) => [styles.wordTile, pressed && styles.activeNav]}
      >
        <Text style={styles.wordTileTitle}>{word.word}</Text>
      </Pressable>
    );
  }
  if (!ready)
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.muted}>Defterin açılıyor…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.shell, !desktop && { flexDirection: "column" }]}>
        <Navigation
          desktop={desktop}
          page={page}
          grammarSection={grammarSection}
          grammarTopicId={grammarTopicId}
          grammarTopics={data.grammarTopics ?? []}
          examTopics={data.exams?.topics ?? DEFAULT_EXAM_TOPICS}
          examTopicId={examTopicId}
          examsExpanded={examsExpanded}
          setExamsExpanded={setExamsExpanded}
          goToGrammarTopic={goToGrammarTopic}
          goToExamTopic={goToExamTopic}
          grammarExpanded={grammarExpanded}
          setGrammarExpanded={setGrammarExpanded}
          go={go}
          goToTenses={goToTenses}
          goToModality={goToModality}
          storageError={storageError}
          busy={busy}
          backup={backupController.backup}
          restore={backupController.restore}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.main}
          contentContainerStyle={[
            styles.mainContent,
            !desktop && { padding: 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(event) => {
            currentScrollY.current = event.nativeEvent.contentOffset.y;
          }}
          onContentSizeChange={() => {
            if (
              restoreStoryScrollY.current !== null &&
              page === "stories" &&
              !story
            ) {
              const y = restoreStoryScrollY.current;
              restoreStoryScrollY.current = null;
              requestAnimationFrame(() =>
                scrollRef.current?.scrollTo({ y, animated: false }),
              );
            }
          }}
        >
          <View style={styles.topbar}>
            <Text style={styles.topbarText}>
              DEFTERİM /{" "}
              {page === "stories"
                ? "OKUMA"
                : page === "words"
                  ? "KELİMELER"
                  : page === "exams"
                    ? "SINAVLAR"
                    : "GRAMER"}
            </Text>
            <Text style={styles.topbarStatus}>● Kişisel kütüphane</Text>
          </View>
          {!!storageError && (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{storageError}</Text>
            </View>
          )}
          {!!importError && (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{importError}</Text>
              <View style={styles.actions}>
                <Button
                  secondary
                  onPress={() => {
                    void importStory();
                  }}
                >
                  Başka dosya seç
                </Button>
                <Button secondary onPress={() => setImportError("")}>
                  Kapat
                </Button>
              </View>
            </View>
          )}
          {page === "stories" && !story && (
            <StoriesScreen
              noteFilters={noteFilters}
              data={data}
              desktop={desktop}
              storyBrowser={storyBrowser}
              setStoryBrowser={setStoryBrowser}
              busy={busy}
              storageError={storageError}
              importStatus={importStatus}
              importStory={importStory}
              openEditor={openEditor}
              onRead={(row) => {
                storyListScrollY.current = currentScrollY.current;
                openedFromStoryList.current = true;
                openChapter(row);
              }}
              onOpenNote={(id) => {
                setStoryId(id);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              }}
            />
          )}
          {page === "stories" && story && (
            <ReaderScreen
              readerSettings={readerSettings}
              data={data}
              story={story}
              desktop={desktop}
              busy={busy}
              editor={editor}
              selectedWord={selectedWord}
              readingText={readingText}
              phraseMode={phraseMode}
              setPhraseMode={setPhraseMode}
              phraseStart={phraseStart}
              setPhraseStart={setPhraseStart}
              sentenceMode={sentenceMode}
              setSentenceMode={setSentenceMode}
              persist={persist}
              onBack={() => go("stories")}
              openEditor={openEditor}
              deleteItem={deleteItem}
              openChapter={openChapter}
              pickToken={pickToken}
              wordCard={wordCard}
            />
          )}
          {page === "words" && (
            <WordsScreen
              wordReview={wordReview}
              data={data}
              desktop={desktop}
              busy={busy}
              storageError={storageError}
              wordStatus={wordStatus}
              wordMessages={wordMessages}
              setWordMessages={setWordMessages}
              persist={persist}
              enrichCards={enrichCards}
              openEditor={openEditor}
              onOpenWord={setSelectedWordId}
            />
          )}
          {page === "grammar" && (
            <GrammarScreen
              data={data}
              desktop={desktop}
              grammarSection={grammarSection}
              topicId={grammarTopicId}
              onSelectTopic={goToGrammarTopic}
              onSaveTopics={saveGrammarTopics}
              disabled={busy || !!storageError}
              goToTenses={goToTenses}
              goToModality={goToModality}
              deleteGuideTopic={deleteGuideTopic}
              restoreGuideTopic={restoreGuideTitle}
              addTenseNote={addTenseNote}
              addModalityNote={addModalityNote}
              openEditor={openEditor}
              deleteItem={deleteItem}
            />
          )}
          {page === "exams" && (
            <ExamDesk
              data={data.exams}
              topicId={examTopicId}
              onSelectTopic={setExamTopicId}
              onSaveTopics={saveExamTopics}
              disabled={busy || !!storageError}
              onSave={(update) =>
                persist((current) => ({
                  ...current,
                  exams: update(current.exams ?? emptyExams),
                }))
              }
            />
          )}
        </ScrollView>
      </View>
      <WordDetailsModal
        key={selectedWordId ?? "closed"}
        selectedWord={selectedWord}
        data={data}
        busy={busy}
        storageError={storageError}
        wordStatus={wordStatus}
        setSelectedWordId={setSelectedWordId}
        persist={persist}
        enrichCards={enrichCards}
        refreshTurkishMeaning={refreshTurkishMeaning}
        openEditor={openEditor}
        deleteItem={deleteItem}
        onOpenStory={(id) => {
          openedFromStoryList.current = false;
          setPage("stories");
          setStoryId(id);
          setPhraseMode(false);
          setPhraseStart(null);
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        }}
      />
      <Modal
        visible={wordStatus !== null}
        transparent
        animationType="fade"
        onRequestClose={() => wordController.current?.abort()}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.confirmModal]}>
            <ActivityIndicator color={colors.ink} />
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.h2, { marginVertical: 20 }]}
            >
              {wordStatus}
            </Text>
            <Text style={styles.hint}>
              İlk çeviri biraz sürebilir. Sözlük için yalnızca kelime internete
              gönderilir; Türkçe çeviri bu bilgisayarda yapılır. Tamamlanan
              kartlar dosyaya kaydedilir.
            </Text>
            <View style={styles.actions}>
              <Button secondary onPress={() => wordController.current?.abort()}>
                Durdur
              </Button>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={importStatus !== null}
        transparent
        animationType="fade"
        onRequestClose={() => importController.current?.abort()}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.confirmModal]}>
            <ActivityIndicator color={colors.ink} size="large" />
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.h2, { marginTop: 20 }]}
            >
              {importStatus}
            </Text>
            <Text style={[styles.hint, { marginVertical: 16 }]}>
              Dosya bu cihazda işleniyor. İşlem bitince metni kontrol
              edebilirsin.
            </Text>
            <Button secondary onPress={() => importController.current?.abort()}>
              İptal
            </Button>
          </View>
        </View>
      </Modal>
      {!!notice && (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <Text style={styles.toastText}>{notice}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bildirimi kapat"
            onPress={() => setNotice("")}
          >
            <Text style={styles.toastClose}>×</Text>
          </Pressable>
        </View>
      )}
      <BackupModal controller={backupController} data={data} disabled={busy} />
      <EditorModal
        editor={editor}
        grammarTopics={data.grammarTopics ?? []}
        setEditor={setEditor}
        extraSenses={extraSenses}
        setExtraSenses={setExtraSenses}
        busy={busy}
        storageError={storageError}
        formError={formError}
        setFormError={setFormError}
        submitEditor={submitEditor}
      />
      <Modal
        visible={!!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmation(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.confirmModal]}>
            <Text style={styles.h2}>{confirmation?.title}</Text>
            <Text style={[styles.muted, { marginVertical: 20 }]}>
              {confirmation?.message}
            </Text>
            <View style={styles.actions}>
              <Button
                secondary
                disabled={busy}
                onPress={() => setConfirmation(null)}
              >
                Vazgeç
              </Button>
              <Button
                danger
                disabled={busy}
                onPress={() => {
                  void confirmation?.run().then((ok) => {
                    if (ok) setConfirmation(null);
                  });
                }}
              >
                {busy ? "İşleniyor…" : (confirmation?.label ?? "Onayla")}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
