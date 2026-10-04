import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Story } from './model';
import { chapterNumber, successChapters } from './story-series';
import { theme } from './theme';
export function StorySeriesPanel({ stories, currentId, onOpen, compact = false }: { stories: Story[]; currentId?: string; onOpen: (story: Story) => void; compact?: boolean }) {
  const chapters = successChapters(stories);
  const index = chapters.findIndex(s => s.id === currentId);
  if (!chapters.length || (currentId && index < 0)) return null;
  const read = chapters.filter(s => s.read).length;
  const nextUnread = chapters.find(s => !s.read);
  const button = (label: string, story?: Story) => <Pressable accessibilityRole="button" disabled={!story} onPress={() => story && onOpen(story)} style={{ padding: 12, minHeight: 44, borderRadius: 8, backgroundColor: theme.accentSoft, opacity: story ? 1 : .4 }}><Text style={{ color: theme.ink }}>{label}</Text></Pressable>;
  return <View style={{ padding: 18, gap: 12, marginVertical: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 12 }}>
    <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 20, fontWeight: '700' }}>Effortless Success</Text>
    <Text style={{ color: theme.muted }}>{currentId ? 'Bölüm ' + chapterNumber(chapters[index]) + ' · ' : ''}{read}/{chapters.length} bölüm okundu</Text>
    {!currentId && button(nextUnread ? 'İlk okunmamış bölümü aç' : 'Seriyi yeniden oku', nextUnread ?? chapters[0])}
    {!compact && <View style={{ gap: 8 }}>{chapters.map(story => <Pressable key={story.id} accessibilityRole="button" accessibilityState={{ selected: story.id === currentId }} onPress={() => onOpen(story)} style={{ padding: 14, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: story.id === currentId ? theme.accent : theme.line, backgroundColor: story.id === currentId ? theme.accentSoft : theme.surface }}><Text style={{ color: theme.ink, fontWeight: '600' }}>Bölüm {chapterNumber(story)}{story.id === currentId ? ' · Şu an burada' : ''}{story.read ? ' · ✓ Okundu' : ''}</Text></Pressable>)}</View>}
    {currentId && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>{button('← Önceki bölüm', chapters[index - 1])}{button('Sonraki bölüm →', chapters[index + 1])}</View>}
  </View>;
}
