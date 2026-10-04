import type { Topic } from "../../topics";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import type { Page } from "../types";
const navigation: { key: Page; title: string; number: string }[] = [
  { key: "stories", title: "Hikâyeler", number: "01" },
  { key: "words", title: "Kelimelerim", number: "02" },
  { key: "grammar", title: "Gramer", number: "03" },
  { key: "exams", title: "Sınavlar", number: "04" },
];
type Props = {
  desktop: boolean;
  page: Page;
  grammarSection: "notes" | "tenses" | "modality";
  grammarExpanded: boolean;
  grammarTopicId: string;
  grammarTopics: Topic[];
  examTopics: Topic[];
  examTopicId: string;
  examsExpanded: boolean;
  setExamsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  goToGrammarTopic: (id: string) => void;
  goToExamTopic: (id: string) => void;
  setGrammarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  go: (page: Page) => void;
  goToTenses: () => void;
  goToModality: () => void;
  storageError: string;
  busy: boolean;
  backup: () => void;
  restore: () => void;
};
export function Navigation({
  desktop,
  page,
  grammarSection,
  grammarExpanded,
  grammarTopicId,
  grammarTopics,
  examTopics,
  examTopicId,
  examsExpanded,
  setExamsExpanded,
  goToGrammarTopic,
  goToExamTopic,
  setGrammarExpanded,
  go,
  goToTenses,
  goToModality,
  storageError,
  busy,
  backup,
  restore,
}: Props) {
  const grammarItems = [
    {
      key: "notes",
      label: "Genel konular",
      active: grammarSection === "notes" && !grammarTopicId,
      action: () => goToGrammarTopic(""),
    },
    {
      key: "tenses",
      label: "Tense",
      active: grammarSection === "tenses",
      action: goToTenses,
    },
    {
      key: "modality",
      label: "Modality",
      active: grammarSection === "modality",
      action: goToModality,
    },
    ...grammarTopics.map((t) => ({
      key: t.id,
      label: t.title,
      active: grammarSection === "notes" && grammarTopicId === t.id,
      action: () => goToGrammarTopic(t.id),
    })),
  ];
  const examItems = [{ id: "", title: "Genel testler" }, ...examTopics].map(
    (t) => ({
      key: t.id,
      label: t.title,
      active: examTopicId === t.id,
      action: () => goToExamTopic(t.id),
    }),
  );
  function submenu(section: "grammar" | "exams", mobile = false) {
    return (
      <View style={mobile ? styles.mobileSubnav : styles.subNavigation}>
        {(section === "grammar" ? grammarItems : examItems).map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${section === "grammar" ? "Gramer" : "Sınavlar"} alt başlık: ${item.label}`}
            accessibilityState={{ selected: page === section && item.active }}
            onPress={item.action}
            style={[
              mobile ? styles.mobileSubnavItem : styles.subNavItem,
              page === section && item.active && styles.activeNav,
            ]}
          >
            <Text
              style={[
                styles.subNavLabel,
                page === section && item.active && styles.activeText,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.sidebar, !desktop && styles.mobileHeader]}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>ed.</Text>
        </View>
        <View>
          <Text style={styles.brand}>English Desk</Text>
          <Text style={styles.brandSubtitle}>KİŞİSEL ÇALIŞMA ALANI</Text>
        </View>
      </View>
      {desktop && <Text style={styles.navCaption}>ÇALIŞMA MASAM</Text>}
      <View style={[styles.navigation, !desktop && styles.mobileNavigation]}>
        {navigation.map((tab) => (
          <View key={tab.key} style={!desktop && styles.mobileNavGroup}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: page === tab.key }}
              onPress={() =>
                tab.key === "grammar" && page === "grammar"
                  ? setGrammarExpanded((value) => !value)
                  : tab.key === "exams" && page === "exams"
                    ? setExamsExpanded((value) => !value)
                    : go(tab.key)
              }
              style={[
                styles.navItem,
                !desktop && styles.mobileNavItem,
                page === tab.key && styles.activeNav,
              ]}
            >
              <Text
                style={[
                  styles.navNumber,
                  page === tab.key && styles.activeText,
                ]}
              >
                {tab.number}
              </Text>
              <Text
                style={[styles.navLabel, page === tab.key && styles.activeText]}
              >
                {tab.title}
              </Text>
              {(tab.key === "grammar" || tab.key === "exams") && (
                <Text style={styles.navChevron}>
                  {(tab.key === "grammar" ? grammarExpanded : examsExpanded)
                    ? "⌄"
                    : "›"}
                </Text>
              )}
            </Pressable>
            {desktop &&
              tab.key === "grammar" &&
              grammarExpanded &&
              submenu("grammar")}
            {desktop &&
              tab.key === "exams" &&
              examsExpanded &&
              submenu("exams")}
          </View>
        ))}
      </View>
      {!desktop &&
        page === "grammar" &&
        grammarExpanded &&
        submenu("grammar", true)}
      {!desktop && page === "exams" && examsExpanded && submenu("exams", true)}
      <View style={[styles.sidebarFooter, !desktop && styles.mobileFooter]}>
        {desktop && (
          <Text style={styles.sidebarQuote}>
            Her gün biraz.{"\n"}Her kelimede ileri.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={!!storageError || busy}
          onPress={backup}
          style={styles.textButton}
        >
          <Text style={styles.footerLink}>↗ Yedeği indir</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={restore}
          style={styles.textButton}
        >
          <Text style={styles.footerLink}>↙ Yedekten geri yükle</Text>
        </Pressable>
        {desktop && (
          <Text style={styles.storageHint}>
            Kayıtlar proje dosyasında tutulur.{"\n"}Ara sıra yedek almayı
            unutma.
          </Text>
        )}
      </View>
    </View>
  );
}
