import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { wordLevel, type Notebook } from "../../model";
import { chooseWordTable, downloadWordTable } from "../../word-transfer-file";
import {
  applyWordImport,
  exportWordTable,
  parseWordTable,
  planWordImport,
  suggestMapping,
  tableColumns,
  transferSignature,
  TRANSFER_FIELDS,
  type ColumnMapping,
  type ParsedTable,
  type Separator,
  type TransferField,
  type TransferOptions,
  type TransferPlan,
} from "../../word-transfer";
import { Button } from "./ui";
import { styles } from "../styles";
import { makeId, type Persist } from "../types";
type Props = {
  data: Notebook;
  persist: Persist;
  disabled: boolean;
  onClose: () => void;
};
export function WordTransferModal({ data, persist, disabled, onClose }: Props) {
  const [source, setSource] = useState<{ name: string; text: string } | null>(
      null,
    ),
    [table, setTable] = useState<ParsedTable | null>(null),
    [separator, setSeparator] = useState<Separator | "auto">("auto");
  const [header, setHeader] = useState(false),
    [mapping, setMapping] = useState<ColumnMapping>({
      word: null,
      meaning: null,
      example: null,
      tags: null,
      level: null,
      type: null,
      translation: null,
    });
  const [tags, setTags] = useState<TransferOptions["tags"]>("auto"),
    [duplicates, setDuplicates] =
      useState<TransferOptions["duplicates"]>("skip"),
    [plan, setPlan] = useState<TransferPlan | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false),
    [columnField, setColumnField] = useState<TransferField | null>(null),
    [page, setPage] = useState(0);
  const [exportFormat, setExportFormat] = useState<"csv" | "tsv" | "anki">(
      "csv",
    ),
    [exportPreview, setExportPreview] = useState<ReturnType<
      typeof exportWordTable
    > | null>(null);
  const [exportSignature, setExportSignature] = useState("");
  const lock = useRef(false),
    closed = useRef(false);
  const busy = working || disabled;
  function close() {
    if (lock.current) return;
    closed.current = true;
    onClose();
  }
  function configure(text: string, value: Separator | "auto") {
    setPlan(null);
    setError("");
    setNotice("");
    setColumnField(null);
    setPage(0);
    setSeparator(value);
    try {
      const parsed = parseWordTable(text, value);
      setTable(parsed);
      setHeader(parsed.headerSuggested);
      setMapping(suggestMapping(parsed, parsed.headerSuggested));
      setTags(parsed.anki ? "anki" : "auto");
    } catch (e) {
      setTable(null);
      setError(e instanceof Error ? e.message : "Dosya çözümlenemedi.");
    }
  }
  async function choose() {
    if (busy || lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    setSource(null);
    setTable(null);
    setPlan(null);
    try {
      const loaded = await chooseWordTable();
      if (loaded && !closed.current) {
        setSource(loaded);
        configure(loaded.text, "auto");
      }
    } catch (e) {
      if (!closed.current)
        setError(e instanceof Error ? e.message : "Dosya okunamadı.");
    } finally {
      lock.current = false;
      if (!closed.current) setWorking(false);
    }
  }
  function preview() {
    if (!table) return;
    setError("");
    setNotice("");
    try {
      setPlan(
        planWordImport(data, table, { mapping, header, duplicates, tags }),
      );
      setPage(0);
    } catch (e) {
      setPlan(null);
      setError(e instanceof Error ? e.message : "Önizleme oluşturulamadı.");
    }
  }
  async function apply() {
    if (busy || lock.current || !plan) return;
    lock.current = true;
    setWorking(true);
    setError("");
    let failure = "";
    try {
      const ok = await persist((current) => {
        try {
          return applyWordImport(current, plan, makeId);
        } catch (e) {
          failure = e instanceof Error ? e.message : "Aktarım uygulanamadı.";
          throw e;
        }
      });
      if (ok) {
        setNotice(
          `${plan.added} yeni kart eklendi, ${plan.matched} satır mevcut karta tamamlandı, ${plan.skipped + plan.invalid} satır alınmadı.`,
        );
        setSource(null);
        setTable(null);
        setPlan(null);
      } else
        setError(
          failure ||
            "Aktarım kaydedilemedi. Mevcut kartlar korundu; yeniden deneyebilirsin.",
        );
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  function prepareExport(format: typeof exportFormat) {
    setExportFormat(format);
    setExportPreview(null);
    setError("");
    setNotice("");
    try {
      setExportPreview(exportWordTable(data, format));
      setExportSignature(transferSignature(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dışa aktarma hazırlanamadı.");
    }
  }
  async function download() {
    if (busy || lock.current || !exportPreview) return;
    lock.current = true;
    setWorking(true);
    setError("");
    if (exportSignature !== transferSignature(data)) {
      setError("Koleksiyon değişti. Dışa aktarma dosyasını yeniden hazırla.");
      lock.current = false;
      setWorking(false);
      return;
    }
    try {
      await downloadWordTable(data, exportFormat);
      setNotice("Kelime metni dosyası kaydedilmeye hazır.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya kaydedilemedi.");
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  const columns = table ? tableColumns(table, header) : [];
  const rows = plan?.rows.slice(page * 25, (page + 1) * 25) ?? [];
  const stale = !!plan && plan.signature !== transferSignature(data);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.h2}>Kelime aktarımı · CSV / TSV</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kelime aktarımını kapat"
              disabled={working}
              onPress={close}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.modalBody, { gap: 16 }]}
          >
            <Text style={styles.hint}>
              Bu metin aktarımı tam yedek değildir. JSON/ZIP yedekleri; hikâye
              bağlamları, ek anlamlar, sesler ve çalışma geçmişini korumak için
              kullanılmaya devam eder.
            </Text>
            <Text style={styles.hint}>
              Anki uyumu metin alanları ve etiketlerle sınırlıdır. Yerel .apkg
              paketleri, deste/not şablonları, medya, cloze şablonları ve Anki
              tekrar takvimi desteklenmez. HTML çalıştırılmaz, düz metin kalır.
            </Text>
            <Button
              secondary
              disabled={busy}
              onPress={() => {
                void choose();
              }}
            >
              {source ? "Başka kelime dosyası seç" : "CSV / TSV dosyası seç"}
            </Button>
            {!!notice && (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>
                {notice}
              </Text>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {error}
              </Text>
            )}
            {source && (
              <View style={{ gap: 12 }}>
                <Text style={styles.label}>
                  {source.name} · En fazla 5 MB / 10.000 kelime satırı
                </Text>
                <Text style={styles.label}>Dosya ayıracı</Text>
                <View style={styles.actions}>
                  {(
                    [
                      ["auto", "Otomatik ayıraç"],
                      [",", "Virgül (CSV)"],
                      ["\t", "Sekme (TSV)"],
                      [";", "Noktalı virgül"],
                    ] as const
                  ).map(([value, title]) => (
                    <Button
                      key={value}
                      small
                      secondary={separator !== value}
                      disabled={busy}
                      onPress={() => configure(source.text, value)}
                    >
                      {title}
                    </Button>
                  ))}
                </View>
              </View>
            )}
            {table && (
              <View style={{ gap: 14 }}>
                <Text style={styles.label}>
                  Ham içerik önizlemesi · İlk 5 satır
                </Text>
                <ScrollView horizontal>
                  <View style={{ gap: 8 }}>
                    {table.rows.slice(0, 5).map((row, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                        {row.map((cell, j) => (
                          <View key={j} style={[styles.quote, { width: 175 }]}>
                            <Text style={styles.meta}>
                              {i + 1}. satır · {j + 1}. sütun
                            </Text>
                            <Text selectable style={styles.hint}>
                              {cell
                                ? cell.length > 500
                                  ? cell.slice(0, 500) + "…"
                                  : cell
                                : "∅ (boş)"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {table.warnings.map((warning, i) => (
                  <Text key={i} style={styles.hint}>
                    {warning}
                  </Text>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="İlk satır sütun başlığı"
                  aria-checked={header}
                  accessibilityState={{ checked: header, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    const next = !header;
                    setHeader(next);
                    setMapping(suggestMapping(table, next));
                    setPlan(null);
                    setColumnField(null);
                  }}
                >
                  <Text style={styles.label}>
                    {header ? "☑" : "☐"} İlk satır sütun başlığı
                  </Text>
                </Pressable>
                <Text style={styles.h2}>Sütun eşleştirmesi</Text>
                {TRANSFER_FIELDS.map(([field, title]) => (
                  <View key={field} style={{ gap: 6 }}>
                    <Button
                      small
                      secondary
                      disabled={busy}
                      onPress={() =>
                        setColumnField(columnField === field ? null : field)
                      }
                    >{`${title} sütunu: ${mapping[field] === null ? "Alma" : `${mapping[field]! + 1} · ${columns[mapping[field]!] || "(başlık boş)"}`}`}</Button>
                    {columnField === field && (
                      <View style={{ gap: 6 }}>
                        {[null, ...columns.map((_, i) => i)].map((index) => (
                          <Pressable
                            key={index ?? "none"}
                            accessibilityRole="radio"
                            aria-checked={mapping[field] === index}
                            accessibilityLabel={`${title} eşleştir: ${index === null ? "Alma" : `Sütun ${index + 1}`}`}
                            accessibilityState={{
                              checked: mapping[field] === index,
                            }}
                            disabled={busy}
                            onPress={() => {
                              setMapping({ ...mapping, [field]: index });
                              setPlan(null);
                              setColumnField(null);
                            }}
                            style={styles.quote}
                          >
                            <Text style={styles.hint}>
                              {index === null
                                ? "Bu alanı alma"
                                : `${index + 1} · ${columns[index] || "(başlık boş)"}`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                <Text style={styles.hint}>
                  Kelime sütunu zorunludur. Eşlenmeyen veya eksik hücreler boş
                  kalır. Seviye yalnız A1–C2 kabul eder. Aynı kelimenin farklı
                  türleri varsa tür sütununu da eşleştir.
                </Text>
                <Text style={styles.label}>Etiket biçimi</Text>
                <View style={styles.actions}>
                  <Button
                    small
                    secondary={tags !== "auto"}
                    disabled={busy}
                    onPress={() => {
                      setTags("auto");
                      setPlan(null);
                    }}
                  >
                    Virgül/noktalı virgül veya JSON etiketleri
                  </Button>
                  <Button
                    small
                    secondary={tags !== "anki"}
                    disabled={busy}
                    onPress={() => {
                      setTags("anki");
                      setPlan(null);
                    }}
                  >
                    Anki etiketleri · Boşlukla ayrılmış
                  </Button>
                </View>
                <Text style={styles.label}>Mevcut kart eşleşirse</Text>
                <View style={styles.actions}>
                  <Button
                    small
                    secondary={duplicates !== "skip"}
                    disabled={busy}
                    onPress={() => {
                      setDuplicates("skip");
                      setPlan(null);
                    }}
                  >
                    Eşleşen kartı atla
                  </Button>
                  <Button
                    small
                    secondary={duplicates !== "fill"}
                    disabled={busy}
                    onPress={() => {
                      setDuplicates("fill");
                      setPlan(null);
                    }}
                  >
                    Yalnız boş alanları ve etiketleri tamamla
                  </Button>
                </View>
                <Text style={styles.hint}>
                  Dolu alanlar, ek anlamlar, kaynak ilişkileri ve tekrar geçmişi
                  korunur. Dosya içindeki aynı kelime/türün ilk geçerli satırı
                  esas alınır. Geçersiz satırlar alınmaz; nedenlerini aşağıda
                  görebilirsin.
                </Text>
                <Button secondary disabled={busy} onPress={preview}>
                  Aktarım önizlemesini oluştur
                </Button>
              </View>
            )}
            {plan && (
              <View style={{ gap: 12 }}>
                <Text style={styles.h2}>İçe aktarma özeti</Text>
                <Text
                  accessibilityLabel="Aktarım kayıt özeti"
                  style={styles.label}
                >
                  {plan.added} eklenecek · {plan.matched} tamamlanacak ·{" "}
                  {plan.skipped} atlanacak · {plan.invalid} geçersiz
                </Text>
                <Text style={styles.hint}>
                  {plan.duplicates} satırda aynı kelime/tür eşleşmesi veya
                  belirsiz eşleşme bulundu. Sayılar satır bazındadır.
                </Text>
                {rows.map((row) => (
                  <View key={row.row} style={[styles.quote, { gap: 6 }]}>
                    <Text style={styles.label}>
                      {row.row}. satır · {row.word || "(kelime boş)"} ·{" "}
                      {
                        {
                          add: "Eklenecek",
                          match: "Tamamlanacak",
                          skip: "Atlanacak",
                          invalid: "Geçersiz",
                        }[row.status]
                      }
                    </Text>
                    <Text style={styles.hint}>{row.reason}</Text>
                    {row.record && (
                      <>
                        <Text selectable style={styles.hint}>
                          Anlam: {row.record.meaning || "∅"} · Tür:{" "}
                          {row.record.type || "∅"} · Seviye:{" "}
                          {wordLevel(row.record, data.stories) || "∅"}
                        </Text>
                        <Text selectable style={styles.hint}>
                          Örnek: {row.record.example || "∅"}
                        </Text>
                        <Text selectable style={styles.hint}>
                          Çeviri: {row.record.translation || "∅"} · Etiketler:{" "}
                          {(row.record.tags ?? []).join(", ") || "∅"}
                        </Text>
                      </>
                    )}
                    {row.changes && (
                      <Text style={styles.hint}>
                        Tamamlanacak alanlar: {row.changes.join(", ")}
                      </Text>
                    )}
                  </View>
                ))}
                <View style={styles.actions}>
                  <Button
                    small
                    secondary
                    disabled={busy || page === 0}
                    onPress={() => setPage(page - 1)}
                  >
                    Önceki aktarım satırları
                  </Button>
                  <Text style={styles.meta}>
                    {page + 1} / {Math.max(1, Math.ceil(plan.rows.length / 25))}
                  </Text>
                  <Button
                    small
                    secondary
                    disabled={busy || (page + 1) * 25 >= plan.rows.length}
                    onPress={() => setPage(page + 1)}
                  >
                    Sonraki aktarım satırları
                  </Button>
                </View>
                {stale && (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    Koleksiyon değişti. Aktarım önizlemesini yeniden oluştur ve
                    kontrol et.
                  </Text>
                )}
                <Text style={styles.hint}>
                  Aşağıdaki onay yalnız bu özetteki yeni kayıtları ve seçtiğin
                  boş alan tamamlamalarını uygular. Mevcut kayıtlar topluca
                  silinmez.
                </Text>
                <Button
                  disabled={busy || stale || (!plan.added && !plan.matched)}
                  onPress={() => {
                    void apply();
                  }}
                >
                  Önizlemeyi onayla ve içe aktar
                </Button>
              </View>
            )}
            <Text style={styles.h2}>Kelimeleri metin olarak dışa aktar</Text>
            <Text style={styles.hint}>
              Koleksiyondaki tüm {data.words.length} kartın ana kelimesi,
              anlamı, örneği, etiketi, seviyesi, türü ve örnek çevirisi
              aktarılır. Ek anlamlar ve kaynak bağlamları için JSON/ZIP yedeği
              kullan. Standart CSV/TSV etiketleri boşlukları koruyan JSON
              listesidir. Anki TSV sürümünde etiket boşlukları alt çizgi olur.
            </Text>
            <View style={styles.actions}>
              {(["csv", "tsv", "anki"] as const).map((format) => (
                <Button
                  key={format}
                  small
                  secondary
                  disabled={busy}
                  onPress={() => prepareExport(format)}
                >
                  {format === "anki"
                    ? "Anki TSV hazırla"
                    : `${format.toUpperCase()} hazırla`}
                </Button>
              ))}
            </View>
            {exportPreview && (
              <View style={{ gap: 10 }}>
                <Text style={styles.label}>
                  Dışa aktarma önizlemesi ·{" "}
                  {exportFormat === "anki"
                    ? "Anki TSV"
                    : exportFormat.toUpperCase()}
                </Text>
                <Text selectable style={styles.hint}>
                  {exportPreview.text.slice(0, 1500)}
                </Text>
                {exportPreview.warnings.map((message, i) => (
                  <Text key={i} style={styles.hint}>
                    {message}
                  </Text>
                ))}
                <Button
                  secondary
                  disabled={busy}
                  onPress={() => {
                    void download();
                  }}
                >
                  Hazırlanan kelime dosyasını kaydet
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
