export type Topic = { id: string; title: string };
export const DEFAULT_EXAM_TOPICS: Topic[] = [
  { id: "osym", title: "ÖSYM" },
  { id: "ielts", title: "IELTS" },
  { id: "other", title: "Diğer testler" },
];
export function validateTopics(value: unknown): Topic[] {
  if (!Array.isArray(value) || value.length > 200)
    throw Error("Alt başlık listesi geçersiz.");
  const ids = new Set<string>(),
    titles = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(row.id) ||
      typeof row.title !== "string" ||
      !row.title.trim() ||
      row.title.length > 100
    )
      throw Error("Alt başlık adı veya kimliği geçersiz.");
    const title = row.title.trim(),
      key = title.toLocaleLowerCase("tr");
    if (ids.has(row.id) || titles.has(key))
      throw Error("Bu alt başlık zaten var.");
    ids.add(row.id);
    titles.add(key);
    return { id: row.id, title };
  });
}
export function mergeTopics(current: Topic[], incoming: Topic[]) {
  const rows = current.map((row) => ({ ...row })),
    ids = new Map<string, string>();
  for (const topic of incoming) {
    const same = rows.find(
      (row) =>
        row.title.toLocaleLowerCase("tr") ===
        topic.title.toLocaleLowerCase("tr"),
    );
    if (same) {
      ids.set(topic.id, same.id);
      continue;
    }
    let id = topic.id;
    for (let n = 1; rows.some((row) => row.id === id); n++)
      id = `topic-${n}-${topic.id}`.slice(0, 100);
    rows.push({ ...topic, id });
    ids.set(topic.id, id);
  }
  return { rows: validateTopics(rows), ids };
}
