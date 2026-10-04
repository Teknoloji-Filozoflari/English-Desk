import { useEffect, useRef, useState, type RefObject } from "react";
import { Platform } from "react-native";
import type { Notebook } from "../../model";
import {
  applyBackup,
  chooseBackup,
  discardBackup,
  exportBackup,
  previewRestore,
} from "../../backup";
import {
  BACKUP_SECTIONS,
  type BackupImport,
  type BackupSection,
  type RestoreMode,
  type RestoreSummary,
} from "../../backup-core";
import { errorMessage } from "../types";

type Commit = (
  operation: (current: Notebook) => Promise<Notebook>,
  recovery?: boolean,
) => Promise<boolean>;
export function useBackup(
  dataRef: RefObject<Notebook>,
  commit: Commit,
  setNotice: (message: string) => void,
  onRestore: () => void,
) {
  const [dialog, setDialog] = useState<"export" | "restore" | "loading" | null>(
    null,
  );
  const [source, setSource] = useState<BackupImport | null>(null);
  const [sections, setSections] = useState<BackupSection[]>([
    ...BACKUP_SECTIONS,
  ]);
  const [includeAudio, setIncludeAudio] = useState(Platform.OS === "web");
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [working, setWorking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<{
    summary: RestoreSummary;
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const workingRef = useRef(false);
  function backup() {
    if (workingRef.current) return;
    setError("");
    setSections([...BACKUP_SECTIONS]);
    setIncludeAudio(Platform.OS === "web");
    setDialog("export");
  }
  async function restore() {
    if (workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    setDialog("loading");
    setError("");
    try {
      const loaded = await chooseBackup();
      if (!loaded) {
        setDialog(null);
        return;
      }
      setSource(loaded);
      setSections(loaded.sections);
      setMode("merge");
      setPlan(null);
      setDialog("restore");
    } catch (error) {
      setNotice("Yedek açılamadı: " + errorMessage(error));
      setDialog(null);
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  useEffect(() => {
    if (dialog !== "restore" || !source) return;
    setPlan(null);
    setError("");
    if (!sections.length) {
      setPlanning(false);
      return;
    }
    const controller = new AbortController();
    setPlanning(true);
    previewRestore(
      source,
      { sections, mode },
      dataRef.current,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setPlan(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanning(false);
      });
    return () => controller.abort();
  }, [dialog, source, sections, mode, dataRef]);
  function toggleSection(section: BackupSection) {
    setPlan(null);
    setSections((current) =>
      BACKUP_SECTIONS.filter((key) =>
        key === section ? !current.includes(key) : current.includes(key),
      ),
    );
  }
  function close() {
    if (!workingRef.current) {
      if (source) void discardBackup(source).catch(() => {});
      setDialog(null);
      setSource(null);
      setPlan(null);
      setError("");
    }
  }
  async function download() {
    if (workingRef.current || !sections.length) return;
    workingRef.current = true;
    setWorking(true);
    setError("");
    try {
      await exportBackup(dataRef.current, { sections, includeAudio });
      setDialog(null);
      setNotice(
        Platform.OS === "web"
          ? "ZIP yedeği indirilmeye hazır."
          : "JSON yedeğini paylaşım menüsünden kaydedebilirsin.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  async function load() {
    if (workingRef.current || !source || !sections.length || !plan || planning)
      return;
    workingRef.current = true;
    setWorking(true);
    setError("");
    let failure = "";
    try {
      const ok = await commit(async (current) => {
        try {
          return await applyBackup(source, { sections, mode }, current);
        } catch (error) {
          failure = errorMessage(error);
          throw error;
        }
      }, true);
      if (ok) {
        setDialog(null);
        setSource(null);
        setPlan(null);
        onRestore();
        setNotice(
          mode === "merge"
            ? "Seçili yedek bölümleri mevcut kayıtlara eklendi."
            : "Seçili bölümler yedekten değiştirildi.",
        );
      } else
        setError(failure || "Yedek kaydedilemedi; mevcut kayıtlar korundu.");
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  return {
    dialog,
    source,
    sections,
    setSections,
    includeAudio,
    setIncludeAudio,
    mode,
    setMode,
    working,
    planning,
    plan,
    error,
    backup,
    restore,
    toggleSection,
    close,
    download,
    load,
  };
}
export type BackupController = ReturnType<typeof useBackup>;
