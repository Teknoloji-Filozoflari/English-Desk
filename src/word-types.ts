export const WORD_TYPES = [
  ["noun", "İsim"],
  ["verb", "Fiil"],
  ["phrasal verb", "Öbek fiil"],
  ["adjective", "Sıfat"],
  ["adverb", "Zarf"],
  ["pronoun", "Zamir"],
  ["phrase", "Kelime kalıbı"],
  ["preposition", "Edat"],
  ["conjunction", "Bağlaç"],
  ["collocation", "Eşdizim (collocation)"],
  ["interjection", "Ünlem"],
  ["determiner", "Belirleyici"],
] as const;

const aliases: Record<string, string> = {
  isim: "noun",
  fiil: "verb",
  "öbek fiil": "phrasal verb",
  sıfat: "adjective",
  zarf: "adverb",
  zamir: "pronoun",
  edat: "preposition",
  bağlaç: "conjunction",
  ünlem: "interjection",
  belirleyici: "determiner",
};

export function wordTypeKey(value: string): string {
  const key = value.trim().toLocaleLowerCase("tr");
  if (!key) return "pending";
  const translated = aliases[key] ?? key;
  return WORD_TYPES.some(([type]) => type === translated)
    ? translated
    : "other";
}

export function isVerbType(value: string): boolean {
  const key = wordTypeKey(value);
  return key === "verb" || key === "phrasal verb";
}
