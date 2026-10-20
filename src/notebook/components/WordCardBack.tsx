import { Text, View } from "react-native";
import type { Word } from "../../model";
import { styles } from "../styles";
import { wordContexts } from "../../word-context";
export function WordCardBack({
  word,
  showWord = true,
}: {
  word: Word;
  showWord?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {showWord && (
        <Text selectable style={styles.h2}>
          {word.word}
        </Text>
      )}
      <Text selectable style={styles.h2}>
        {word.meaning}
      </Text>
      {!!word.definition && (
        <Text selectable style={styles.hint}>
          {word.definition}
        </Text>
      )}
      {!!word.example && (
        <Text selectable style={styles.hint}>
          {word.example}
        </Text>
      )}
      {!!word.translation && (
        <Text selectable style={styles.hint}>
          {word.translation}
        </Text>
      )}
      {!!word.senses?.length && (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Diğer anlamlar</Text>
          {word.senses.map((sense, index) => (
            <View key={index} style={{ gap: 4 }}>
              <Text selectable style={styles.hint}>
                {sense.meaning}
                {sense.definition ? ` · ${sense.definition}` : ""}
              </Text>
              {!!sense.example && (
                <Text selectable style={styles.hint}>
                  {sense.example}
                </Text>
              )}
              {!!sense.translation && (
                <Text selectable style={styles.hint}>
                  {sense.translation}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      {!!word.synonyms && (
        <Text selectable style={styles.hint}>
          Eş anlamlılar: {word.synonyms}
        </Text>
      )}
      {!!word.antonyms && (
        <Text selectable style={styles.hint}>
          Zıt anlamlılar: {word.antonyms}
        </Text>
      )}
      {!!word.verbForms && (
        <Text style={styles.hint}>
          Fiil halleri: {word.verbForms.base} · {word.verbForms.past} ·{" "}
          {word.verbForms.participle}
        </Text>
      )}
      {!!word.type && (
        <Text style={styles.hint}>
          Tür: {word.type}
          {word.level ? ` · ${word.level}` : ""}
        </Text>
      )}
      {wordContexts(word).map((context) => (
        <View key={context.id} style={{ gap: 4 }}>
          <Text style={styles.label}>
            {context.kind === "personal"
              ? "Kendi örneğim"
              : `Kaynak cümle · ${context.storyTitle}`}
          </Text>
          <Text selectable style={styles.hint}>
            {context.sentence}
          </Text>
          {!!context.meaning && (
            <Text style={styles.hint}>{context.meaning}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
