import { useEffect, useRef, useState, type RefObject } from "react";
import { fetchWord } from "../../dictionary-client";
import type { Notebook, Word } from "../../model";
import {
  mergeLookup,
  normalizeWord,
  relatedWords,
} from "../../word-enrichment";
import { errorMessage, type Persist } from "../types";
export function useWordEnrichment(
  dataRef: RefObject<Notebook>,
  persist: Persist,
  storageError: string,
  setNotice: (message: string) => void,
) {
  const [wordStatus, setWordStatus] = useState<string | null>(null);
  const [wordMessages, setWordMessages] = useState<string[]>([]);
  const wordController = useRef<AbortController | null>(null);
  useEffect(() => () => wordController.current?.abort(), []);
  async function enrichCards(seedIds: string[]) {
    if (wordController.current || storageError) return;
    const controller = new AbortController();
    wordController.current = controller;
    setWordMessages([]);
    setWordStatus("Sözlük hazırlanıyor…");
    const queue = [...seedIds];
    const seen = new Set<string>();
    const messages = new Set<string>();
    let completed = 0;
    try {
      for (let cursor = 0; cursor < queue.length; cursor++) {
        if (controller.signal.aborted) break;
        const item = dataRef.current.words.find((w) => w.id === queue[cursor]);
        if (!item || seen.has(normalizeWord(item.word))) continue;
        seen.add(normalizeWord(item.word));
        setWordStatus(
          item.word + " · " + (cursor + 1) + "/" + queue.length + " kart",
        );
        try {
          const result = await fetchWord(
            item.word,
            item.type,
            item.example,
            controller.signal,
          );
          if (controller.signal.aborted) break;
          const saved = await persist((current) => {
            const existing = current.words.find((w) => w.id === item.id);
            if (
              !existing ||
              normalizeWord(existing.word) !== normalizeWord(item.word)
            )
              return current;
            const merged = mergeLookup(existing, result);
            const next = {
              ...current,
              words: current.words.map((w) => (w.id === item.id ? merged : w)),
            };
            return next;
          });
          if (!saved) {
            messages.add("Dosyaya kayıt başarısız oldu; işlem durduruldu.");
            break;
          }
          result.warnings.forEach((message) =>
            messages.add(item.word + ": " + message),
          );
          completed++;
        } catch (error) {
          if (!controller.signal.aborted)
            messages.add(item.word + ": " + errorMessage(error));
        }
        const parent = dataRef.current.words.find((w) => w.id === item.id);
        if (parent) {
          const names = new Set(relatedWords(parent));
          for (const related of dataRef.current.words)
            if (
              names.has(normalizeWord(related.word)) &&
              !seen.has(normalizeWord(related.word)) &&
              !queue.includes(related.id)
            )
              queue.push(related.id);
        }
      }
    } finally {
      setWordMessages([...messages]);
      setWordStatus(null);
      wordController.current = null;
      setNotice(
        (controller.signal.aborted ? "İşlem durduruldu. " : "") +
          completed +
          " kart işlendi. Kaydedilen bilgiler korundu.",
      );
    }
  }
  async function refreshTurkishMeaning(item: Word) {
    if (wordController.current || storageError) return;
    const controller = new AbortController();
    wordController.current = controller;
    setWordStatus(`${item.word} · Türkçe karşılık aranıyor…`);
    try {
      const result = await fetchWord(
        item.word,
        item.type,
        item.example,
        controller.signal,
      );
      if (!result.meaning || !result.sources.includes("English Wiktionary")) {
        setNotice(
          "Doğrulanmış Türkçe sözlük karşılığı bulunamadı; mevcut anlam korundu.",
        );
        return;
      }
      const ok = await persist((current) => ({
        ...current,
        words: current.words.map((word) =>
          word.id === item.id
            ? {
                ...word,
                meaning: result.meaning,
                sources: [
                  ...new Set(
                    [word.sources, result.sources]
                      .filter(Boolean)
                      .flatMap((source) => source!.split("\n")),
                  ),
                ].join("\n"),
              }
            : word,
        ),
      }));
      if (ok) setNotice(`${item.word}: Türkçe karşılık yenilendi.`);
    } catch (error) {
      if (!controller.signal.aborted) setNotice(errorMessage(error));
    } finally {
      setWordStatus(null);
      wordController.current = null;
    }
  }
  return {
    wordStatus,
    wordMessages,
    setWordMessages,
    wordController,
    enrichCards,
    refreshTurkishMeaning,
  };
}
