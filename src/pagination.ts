export function pageSlice<T>(rows: T[], requested: number, size = 24) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, requested), pages);
  return { page, pages, total: rows.length, start: rows.length ? (page - 1) * size + 1 : 0, end: Math.min(page * size, rows.length), rows: rows.slice((page - 1) * size, page * size) };
}
