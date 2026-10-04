import React from 'react';
import { Platform, Text } from 'react-native';
import { tokenize, Token, Word, StoryNote } from './model';
export function ReadingText({ text, savedWords, savedNotes = [], selectedStart, onPick, fontSize = 22, lineHeight = 1.9 }: { text: string; savedWords: Word[]; savedNotes?: StoryNote[]; selectedStart?: number; onPick: (token: Token) => void; fontSize?: number; lineHeight?: number }) {
  const saved = new Map(savedWords.map(word => [word.word.toLocaleLowerCase('en'), word]));
  const noteRanges = savedNotes.flatMap(note => { const start = text.indexOf(note.selection); return start < 0 ? [] : [{ start, end: start + note.selection.length }]; });
  return <Text android_hyphenationFrequency="none" textBreakStrategy="simple" style={{ fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia', fontSize, lineHeight: fontSize * lineHeight, color: '#252B35', marginTop: 25 }}>{tokenize(text).map((token, index) => token.isWord ? <Text key={index} accessibilityRole="button" accessibilityLabel={saved.get(token.text.toLocaleLowerCase('en'))?.meaning ? `${token.text}: ${saved.get(token.text.toLocaleLowerCase('en'))?.meaning}` : `${token.text} kelimesini seç`} onPress={() => onPick(token)} style={{ backgroundColor: selectedStart === token.start ? '#F2DFAD' : saved.has(token.text.toLocaleLowerCase('en')) ? '#F7E5DB' : noteRanges.some(range => token.start < range.end && token.end > range.start) ? '#FFF0C9' : undefined }}>{token.text}</Text> : token.text)}</Text>;
}
