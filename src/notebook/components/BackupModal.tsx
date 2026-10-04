import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BACKUP_SECTIONS,
  backupCounts,
  sectionLabels,
  type BackupSection,
} from "../../backup-core";
import type { Notebook } from "../../model";
import type { BackupController } from "../hooks/useBackup";
import { styles, colors } from "../styles";
import { Button } from "./ui";

type Props = {
  controller: BackupController;
  data: Notebook;
  disabled: boolean;
};
export function BackupModal({ controller: c, data, disabled }: Props) {
  const restoring = c.dialog === "restore";
  const counts = restoring && c.source ? c.source.counts : backupCounts(data);
  function checkbox(section: BackupSection) {
    const checked = c.sections.includes(section),
      available = !restoring || c.source?.sections.includes(section);
    return (
      <Pressable
        key={section}
        accessibilityRole="checkbox"
        accessibilityLabel={sectionLabels[section]}
        aria-checked={checked}
        accessibilityState={{ checked, disabled: !available || c.working }}
        disabled={!available || c.working}
        onPress={() => c.toggleSection(section)}
        style={[
          s.section,
          checked && s.selected,
          !available && { opacity: 0.4 },
        ]}
      >
        <Text style={[s.check, checked && { color: colors.blue }]}>
          {checked ? "☑" : "☐"}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{sectionLabels[section]}</Text>
          <Text style={styles.hint}>
            {available ? `${counts[section]} kayıt` : "Bu yedekte bulunmuyor"}
            {section === "stories" && available
              ? ` · ${counts.notes} hikâye notu`
              : ""}
            {section === "exams" && available
              ? ` · ${counts.attempts} oturum`
              : ""}
          </Text>
        </View>
      </Pressable>
    );
  }
  return (
    <Modal
      visible={c.dialog !== null}
      transparent
      animationType="fade"
      onRequestClose={c.close}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.h2}>
              {c.dialog === "loading"
                ? "Yedek okunuyor"
                : restoring
                  ? "Yedeği geri yükle"
                  : "Yedeği indir"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yedek penceresini kapat"
              disabled={c.working}
              onPress={c.close}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {c.dialog === "loading" ? (
            <View style={s.loading}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.hint}>
                Dosya bu bilgisayarda inceleniyor. Büyük ses arşivleri biraz
                sürebilir.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.modalBody,
                  { paddingTop: 20, gap: 14 },
                ]}
              >
                <Text style={styles.muted}>
                  {restoring
                    ? "Yedekteki bölümleri ve nasıl yükleneceklerini seç. Kaydetmeden önce hiçbir kayıt değişmez."
                    : "Tam defterini veya seçtiğin bölümleri yedekle."}
                </Text>
                {!restoring && (
                  <View style={s.row}>
                    <Button
                      secondary
                      onPress={() => c.setSections([...BACKUP_SECTIONS])}
                      disabled={c.working}
                    >
                      Tam yedek
                    </Button>
                    <Button
                      secondary
                      onPress={() => c.setSections([])}
                      disabled={c.working}
                    >
                      Bölüm seç
                    </Button>
                  </View>
                )}
                <View style={{ gap: 9 }}>{BACKUP_SECTIONS.map(checkbox)}</View>
                {!restoring && c.sections.includes("stories") && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Sesleri de ekle"
                    aria-checked={c.includeAudio}
                    accessibilityState={{ checked: c.includeAudio }}
                    disabled={c.working || Platform.OS !== "web"}
                    onPress={() => c.setIncludeAudio(!c.includeAudio)}
                    style={s.section}
                  >
                    <Text style={s.check}>{c.includeAudio ? "☑" : "☐"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Sesleri de ekle</Text>
                      <Text style={styles.hint}>
                        {counts.audio} ses bağlantısı ·{" "}
                        {Platform.OS === "web"
                          ? "MP3 dosyaları ZIP içine alınır."
                          : "Sesli ZIP yedeği bilgisayardaki yerel web sürümünde hazırlanır."}
                      </Text>
                    </View>
                  </Pressable>
                )}
                {!restoring && (
                  <Text style={styles.hint}>
                    Hikâye notları ve ses zamanlamaları hikâyelerle; sınav
                    oturumları ve sonuçları sınavlarla birlikte yedeklenir.{" "}
                    {Platform.OS === "web"
                      ? "ZIP dosyası indirilecek."
                      : "JSON dosyası paylaşılacak."}
                  </Text>
                )}
                {restoring && (
                  <>
                    <Text style={styles.label}>Geri yükleme yöntemi</Text>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel="Mevcutlara ekle"
                      aria-checked={c.mode === "merge"}
                      accessibilityState={{ checked: c.mode === "merge" }}
                      disabled={c.working}
                      onPress={() => {
                        c.setMode("merge");
                      }}
                      style={[s.section, c.mode === "merge" && s.selected]}
                    >
                      <Text style={s.check}>
                        {c.mode === "merge" ? "◉" : "○"}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Mevcutlara ekle · önerilen</Text>
                        <Text style={styles.hint}>
                          Mevcut kayıtlar korunur. Tekrarlanan kayıtlar yeniden
                          eklenmez.
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel="Seçili bölümleri değiştir"
                      aria-checked={c.mode === "replace"}
                      accessibilityState={{ checked: c.mode === "replace" }}
                      disabled={c.working}
                      onPress={() => {
                        c.setMode("replace");
                      }}
                      style={[s.section, c.mode === "replace" && s.selected]}
                    >
                      <Text style={s.check}>
                        {c.mode === "replace" ? "◉" : "○"}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Seçili bölümleri değiştir</Text>
                        <Text style={styles.hint}>
                          Seçtiğin bölümlerdeki mevcut içerik kaldırılır ve
                          yedekteki içerik yüklenir. Diğer bölümler korunur.
                        </Text>
                      </View>
                    </Pressable>
                    {c.planning && (
                      <View style={s.row}>
                        <ActivityIndicator color={colors.blue} />
                        <Text style={styles.hint}>
                          Yükleme planı hazırlanıyor…
                        </Text>
                      </View>
                    )}
                    {c.plan && (
                      <View style={s.preview}>
                        <Text style={s.label}>İşlem özeti</Text>
                        {c.sections.map((section) => (
                          <Text key={section} style={styles.hint}>
                            {sectionLabels[section]}:{" "}
                            {c.plan!.summary.added[section]} kayıt yüklenecek
                            {c.plan!.summary.skipped[section]
                              ? ` · ${c.plan!.summary.skipped[section]} kayıt zaten var`
                              : ""}
                            {c.mode === "replace"
                              ? ` · ${c.plan!.summary.removed[section]} mevcut kayıt değiştirilecek`
                              : ""}
                          </Text>
                        ))}
                        {c.sections.includes("stories") && (
                          <Text style={styles.hint}>
                            {c.plan.summary.notes} hikâye notu yüklenecek ·
                            yedekte {counts.audio} ses dosyası
                          </Text>
                        )}
                        {c.sections.includes("exams") && (
                          <Text style={styles.hint}>
                            {c.plan.summary.attempts} sınav oturumu yüklenecek
                          </Text>
                        )}
                        {[
                          ...(c.source?.warnings ?? []),
                          ...c.plan.warnings,
                        ].map((warning, index) => (
                          <Text key={index} style={s.warning}>
                            {warning}
                          </Text>
                        ))}
                      </View>
                    )}
                    {c.mode === "replace" && (
                      <Text style={s.warning}>
                        Bu işlem seçili bölümlerin mevcut içeriğini değiştirir.
                        Yerel web sürümünde işlem öncesindeki defter otomatik
                        yedeklenir.
                      </Text>
                    )}
                  </>
                )}
                {!c.sections.length && (
                  <Text style={styles.hint}>
                    Devam etmek için en az bir bölüm seç.
                  </Text>
                )}
                {!!c.error && (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {c.error}
                  </Text>
                )}
                {c.working && (
                  <View style={s.row}>
                    <ActivityIndicator color={colors.blue} />
                    <Text accessibilityLiveRegion="polite" style={styles.hint}>
                      {restoring
                        ? "Yedek kaydediliyor…"
                        : "ZIP yedeği hazırlanıyor…"}
                    </Text>
                  </View>
                )}
              </ScrollView>
              <View style={styles.modalFooter}>
                <Button secondary disabled={c.working} onPress={c.close}>
                  Vazgeç
                </Button>
                <Button
                  danger={restoring && c.mode === "replace"}
                  disabled={
                    disabled ||
                    c.working ||
                    !c.sections.length ||
                    (restoring && (!c.plan || c.planning))
                  }
                  onPress={() => {
                    void (restoring ? c.load() : c.download());
                  }}
                >
                  {c.working
                    ? "İşleniyor…"
                    : restoring
                      ? "Yedeği yükle"
                      : "Yedeği oluştur ve indir"}
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.blue, backgroundColor: colors.pale },
  check: { fontSize: 23, color: colors.muted },
  label: { fontSize: 16, fontWeight: "600", color: colors.ink },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  preview: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.background,
    gap: 8,
  },
  warning: { fontSize: 14, lineHeight: 22, color: "#8B4027" },
  loading: { padding: 30, gap: 16 },
});
