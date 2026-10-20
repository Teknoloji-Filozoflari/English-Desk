import React from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "./theme";
const options = [
  ["", "Otomatik bul"],
  ["noun", "İsim (noun)"],
  ["verb", "Fiil (verb)"],
  ["adjective", "Sıfat (adjective)"],
  ["adverb", "Zarf (adverb)"],
  ["pronoun", "Zamir (pronoun)"],
  ["preposition", "Edat (preposition)"],
  ["conjunction", "Bağlaç (conjunction)"],
  ["interjection", "Ünlem (interjection)"],
  ["determiner", "Belirleyici (determiner)"],
  ["phrasal verb", "Öbek fiil (phrasal verb)"],
  ["collocation", "Eşdizim (collocation)"],
  ["phrase", "İfade (phrase)"],
];
export function WordTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const choices = options.some(([key]) => key === value)
    ? options
    : [...options, [value, `Mevcut: ${value}`]];
  return (
    <View style={{ gap: 8, marginVertical: 12 }}>
      <Text style={{ color: theme.ink, fontWeight: "600" }}>Kelime türü</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {choices.map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: value === key }}
            onPress={() => onChange(key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: value === key ? theme.accent : theme.line,
              backgroundColor: value === key ? theme.accent : theme.surface,
            }}
          >
            <Text style={{ color: value === key ? theme.surface : theme.ink }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: theme.muted, fontSize: 13 }}>
        Kelimenin kullandığın anlamına uygun türü seç. Emin değilsen otomatik
        bulmayı seçebilirsin.
      </Text>
    </View>
  );
}
