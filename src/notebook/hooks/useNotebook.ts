import { useEffect, useRef, useState } from "react";
import type { Notebook } from "../../model";
import { loadNotebook, saveNotebook } from "../../storage";
import { errorMessage } from "../types";
const empty: Notebook = {
  version: 1,
  stories: [],
  words: [],
  grammar: [],
  storyNotes: [],
};
export function useNotebook(
  onNotice: (message: string) => void,
  onSaveError: (message: string) => void,
) {
  const [data, setData] = useState<Notebook>(empty);
  const dataRef = useRef<Notebook>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    let active = true;
    loadNotebook()
      .then((value) => {
        if (active) {
          dataRef.current = value;
          setData(value);
        }
      })
      .catch((error) => {
        if (active)
          setStorageError(
            `Kayıtlar okunamadı: ${errorMessage(error)} Mevcut verilerin üzerine yazılmadı. Yedekten geri yükleyebilirsin.`,
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function commit(
    operation: (current: Notebook) => Promise<Notebook>,
    recovery = false,
  ) {
    if (busyRef.current) return false;
    if (storageError && !recovery) {
      onNotice(
        "Kayıt sorunu giderilene kadar düzenleme kapalı. Önce yedeğini geri yükle.",
      );
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await operation(dataRef.current);
      dataRef.current = next;
      setData(next);
      setStorageError("");
      return true;
    } catch (error) {
      const message = `Kaydedilemedi: ${errorMessage(error)}`;
      onNotice(message);
      onSaveError(message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function persist(update: (current: Notebook) => Notebook, recovery = false) {
    return commit(async (current) => {
      const next = update(current);
      if (next === current) return current;
      await saveNotebook(next);
      return next;
    }, recovery);
  }
  return { data, dataRef, ready, storageError, busy, persist, commit };
}
