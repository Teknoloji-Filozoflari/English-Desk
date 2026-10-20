import { theme, levelColors } from './theme';
﻿import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LEVELS } from './model';
import { pageSlice } from './pagination';
import { WORD_TYPES, isVerbType, wordTypeKey } from './word-types';
type Item = { id: string; title: string; search: string; level: string; read?: boolean; members?: Item[]; wordType?: string; verbRegularity?: string };
export type BrowserState = { query: string; level: string; sort: string; status: string; wordType: string; verbRegularity: string; page: number };
export const initialBrowserState: BrowserState = { query: '', level: 'all', sort: 'new', status: 'all', wordType: 'all', verbRegularity: 'all', page: 1 };
type Props = { items: Item[]; kind: 'words' | 'stories'; onOpen: (id: string) => void; wide: boolean; state?: BrowserState; onStateChange?: (state: BrowserState) => void; renderAction?: (id: string) => React.ReactNode };

function mixLevels(rows: Item[]): Item[] {
  const knownLevels = new Set<string>(LEVELS);
  const buckets = [...LEVELS.map(level => rows.filter(item => item.level === level)), rows.filter(item => !knownLevels.has(item.level))];
  const mixed: Item[] = [];
  for (let index = 0; mixed.length < rows.length; index++) {
    for (const bucket of buckets) if (index < bucket.length) mixed.push(bucket[index]);
  }
  return mixed;
}

export function CollectionBrowser({ items, kind, onOpen, state, onStateChange, renderAction }: Props) {
  const [localState, setLocalState] = useState<BrowserState>(initialBrowserState);
  const [gridWidth, setGridWidth] = useState(0);
  const [openFilter, setOpenFilter] = useState<'wordType' | 'verbRegularity' | null>(null);
  const browser = state ?? localState;
  const change = onStateChange ?? setLocalState;
  const { query, level, sort, status, wordType = 'all', verbRegularity = 'all', page } = browser;
  const gap = 12;
  const minimumTileWidth = kind === 'stories' ? 235 : 185;
  const maximumColumns = kind === 'stories' ? 4 : 5;
  const columns = gridWidth ? Math.max(1, Math.min(maximumColumns, Math.floor((gridWidth + gap) / (minimumTileWidth + gap)))) : 1;
  const tileWidth = gridWidth ? (gridWidth - gap * (columns - 1)) / columns : '100%';
  const counts = useMemo(() => { const result: Record<string, number> = { all: items.length, pending: 0 }; for (const item of items) { const key = item.level || 'pending'; result[key] = (result[key] ?? 0) + 1; } return result; }, [items]);
  const typeCounts = useMemo(() => { const result: Record<string, number> = { all: items.length }; for (const item of items) { const key = wordTypeKey(item.wordType ?? ''); result[key] = (result[key] ?? 0) + 1; if (key === 'phrasal verb') result.verb = (result.verb ?? 0) + 1; } return result; }, [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    const rows = items.filter(group => (group.members ?? [group]).some(item => (level === 'all' || (level === 'pending' ? !item.level : item.level === level)) && (status === 'all' || (status === 'read' ? item.read : !item.read)) && (kind !== 'words' || (wordType === 'all' || wordTypeKey(item.wordType ?? '') === wordType || (wordType === 'verb' && wordTypeKey(item.wordType ?? '') === 'phrasal verb')) && (verbRegularity === 'all' || (wordTypeKey(item.wordType ?? '') === 'verb' || wordTypeKey(item.wordType ?? '') === 'phrasal verb') && (item.verbRegularity || 'pending') === verbRegularity)) && (!needle || item.search.toLocaleLowerCase('tr').includes(needle))));
    if (sort === 'new') {
      const newest = rows.reverse();
      return kind === 'stories' && level === 'all' ? mixLevels(newest) : newest;
    }
    return rows.sort((a,b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) * (sort === 'az' ? 1 : -1));
  }, [items, kind, level, status, wordType, verbRegularity, query, sort]);
  const result = pageSlice(filtered, page);
  const typeLabel = wordType === 'all' ? 'Tüm türler' : WORD_TYPES.find(([key]) => key === wordType)?.[1] ?? (wordType === 'pending' ? 'Tür bekliyor' : 'Diğer');
  const regularityLabel = verbRegularity === 'regular' ? 'Düzenli' : verbRegularity === 'irregular' ? 'Düzensiz' : verbRegularity === 'pending' ? 'Belirlenmemiş' : 'Tüm fiiller';
  function selectFilter(field: 'wordType' | 'verbRegularity', value: string) {
    change({ ...browser, [field]: value, ...(field === 'wordType' ? { verbRegularity: 'all' } : {}), page: 1 });
    setOpenFilter(null);
  }
  function dropdown(field: 'wordType' | 'verbRegularity', label: string, options: readonly (readonly [string, string, number])[]) {
    const open = openFilter === field;
    return <View style={s.dropdownWrap}><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${field === 'wordType' ? typeLabel : regularityLabel}`} accessibilityState={{ expanded: open }} onPress={() => setOpenFilter(open ? null : field)} style={[s.dropdownToggle, open && s.dropdownOpen]}><Text style={s.dropdownLabel}>{label}</Text><Text style={s.dropdownValue}>{field === 'wordType' ? typeLabel : regularityLabel} {open ? '▴' : '▾'}</Text></Pressable>{open && <ScrollView style={s.dropdownMenu} nestedScrollEnabled>{options.map(([value, name, count]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: (field === 'wordType' ? wordType : verbRegularity) === value }} onPress={() => selectFilter(field, value)} style={[s.dropdownOption, (field === 'wordType' ? wordType : verbRegularity) === value && s.dropdownSelected]}><Text style={s.dropdownOptionText}>{name}</Text><Text style={s.meta}>{count}</Text></Pressable>)}</ScrollView>}</View>;
  }
  function chip(value: string, label: string, selected: string, field: 'level' | 'sort' | 'status' | 'wordType' | 'verbRegularity') { return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => change({ ...browser, [field]: value, ...(field === 'wordType' ? { verbRegularity: 'all' } : {}), page: 1 })} style={[s.chip, selected === value && s.active, selected !== value && levelColors[value] && { backgroundColor: levelColors[value].background }]}><Text style={[s.chipText, selected === value && s.activeText]}>{label}</Text></Pressable>; }
  function tile(item: Item) { const palette = levelColors[item.level]; return <View key={item.id} style={[s.tile, kind === 'stories' ? s.storyTile : s.wordTile, { width: tileWidth, borderTopColor: palette?.ink ?? theme.line }]}><Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => onOpen(item.id)} style={({ pressed }) => [{ gap: 8, minHeight: 44 }, pressed && s.pressedTile]}><View style={s.tileMeta}><Text style={[s.badge, { backgroundColor: palette?.background ?? theme.background, color: palette?.ink ?? theme.muted }]}>{item.level || 'Seviye bekliyor'}</Text>{kind === 'stories' && item.read && <Text style={s.readBadge}>✓ Okundu</Text>}</View><Text style={[s.title, kind === 'words' && s.wordTitle]}>{item.title}</Text></Pressable>{renderAction?.(item.id)}</View>; }
  function grid(rows: Item[]) { return <View style={s.grid} onLayout={event => { const width = Math.round(event.nativeEvent.layout.width); setGridWidth(current => current === width ? current : width); }}>{rows.map(tile)}</View>; }
  return <View style={{ gap: 20 }}>
    <View style={s.panel}><TextInput accessibilityLabel={kind === 'words' ? 'Kelimelerde ara' : 'Hikâyelerde ara'} placeholder={kind === 'words' ? 'Kelime veya Türkçe anlam ara…' : 'Başlık veya hikâye içinde ara…'} value={query} onChangeText={value => change({ ...browser, query: value, page: 1 })} style={s.search} />
      <View style={s.row}>{['all', ...LEVELS, 'pending'].map(value => chip(value, `${value === 'all' ? 'Tümü' : value === 'pending' ? 'Seviye bekliyor' : value} · ${counts[value] ?? 0}`, level, 'level'))}</View>
      {kind === 'words' && <View style={s.row}>{dropdown('wordType', 'Kelime türü', [['all', 'Tüm türler', items.length], ...WORD_TYPES.map(([key, name]) => [key, name, typeCounts[key] ?? 0] as const), ['pending', 'Tür bekliyor', typeCounts.pending ?? 0], ['other', 'Diğer', typeCounts.other ?? 0]])}{(wordType === 'verb' || wordType === 'phrasal verb') && dropdown('verbRegularity', 'Fiil türü', [['all', 'Tüm fiiller', items.filter(item => { const key = wordTypeKey(item.wordType ?? ''); return wordType === 'verb' ? key === 'verb' || key === 'phrasal verb' : key === 'phrasal verb'; }).length], ['regular', 'Düzenli', items.filter(item => item.verbRegularity === 'regular' && (wordType === 'verb' ? isVerbType(item.wordType ?? '') : wordTypeKey(item.wordType ?? '') === 'phrasal verb')).length], ['irregular', 'Düzensiz', items.filter(item => item.verbRegularity === 'irregular' && (wordType === 'verb' ? isVerbType(item.wordType ?? '') : wordTypeKey(item.wordType ?? '') === 'phrasal verb')).length], ['pending', 'Belirlenmemiş', items.filter(item => !item.verbRegularity && (wordType === 'verb' ? isVerbType(item.wordType ?? '') : wordTypeKey(item.wordType ?? '') === 'phrasal verb')).length]])}</View>}
      <View style={[s.row, { justifyContent: 'space-between' }]}><View style={s.row}>{chip('new',kind === 'stories' && level === 'all' ? 'Seviyeler karışık' : 'Son eklenen',sort,'sort')}{chip('az','A–Z',sort,'sort')}{chip('za','Z–A',sort,'sort')}</View>{kind === 'stories' && <View style={s.row}>{chip('all','Tüm hikâyeler',status,'status')}{chip('unread','Okunmadı',status,'status')}{chip('read','Okundu',status,'status')}</View>}</View>
    </View>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text accessibilityLiveRegion="polite" style={s.meta}>{result.total} sonuç · {result.start}–{result.end} gösteriliyor</Text><Pressable accessibilityRole="button" onPress={() => change(initialBrowserState)} style={s.chip}><Text style={s.chipText}>Filtreleri temizle</Text></Pressable></View>
    {result.total === 0 ? <View style={s.panel}><Text style={s.empty}>Kayıt bulunamadı</Text><Text style={s.meta}>Aramanı veya filtrelerini değiştirebilirsin.</Text></View> : kind === 'stories' && level === 'all' ? grid(result.rows) : [...LEVELS, ''].map(group => { const rows = result.rows.filter(item => item.level === group); return rows.length ? <View key={group} style={{ gap: 12 }}><Text accessibilityRole="header" style={[s.group, { color: levelColors[group]?.ink ?? theme.muted }]}>{group || 'Seviye bekliyor'}</Text>{grid(rows)}</View> : null; })}
    {result.pages > 1 && <View style={[s.row, { justifyContent: 'center', paddingVertical: 16 }]}><Pressable accessibilityRole="button" disabled={result.page === 1} onPress={() => change({ ...browser, page: result.page - 1 })} style={[s.chip, result.page === 1 && s.disabled]}><Text style={s.chipText}>← Önceki</Text></Pressable><Text style={s.meta}>Sayfa {result.page} / {result.pages}</Text><Pressable accessibilityRole="button" disabled={result.page === result.pages} onPress={() => change({ ...browser, page: result.page + 1 })} style={[s.chip, result.page === result.pages && s.disabled]}><Text style={s.chipText}>Sonraki →</Text></Pressable></View>}
  </View>;
}
const s = StyleSheet.create({ panel: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E2DED6', borderRadius: 18, padding: 18, gap: 12 }, search: { minHeight: 52, backgroundColor: '#F5F2EC', borderRadius: 12, padding: 14, fontSize: 16, color: '#252B35' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', maxWidth: '100%' }, chip: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 24, justifyContent: 'center' }, chipText: { fontSize: 14, color: '#686D74' }, active: { backgroundColor: theme.accent }, activeText: { color: '#fff', fontWeight: '600' }, meta: { fontSize: 14, color: '#686D74', lineHeight: 22 }, group: { fontSize: 18, fontWeight: '600', color: '#252B35', marginTop: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }, tile: { borderWidth: 1, borderTopWidth: 3, borderColor: '#E2DED6', borderRadius: 12, backgroundColor: '#FFFEFA', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, gap: 8 }, storyTile: { minHeight: 88 }, wordTile: { minHeight: 72 }, pressedTile: { backgroundColor: '#F7E5DB' }, tileMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, title: { fontSize: 17, lineHeight: 23, color: '#252B35', fontWeight: '600' }, wordTitle: { fontSize: 18, lineHeight: 24 }, badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, fontSize: 11, fontWeight: '700' }, readBadge: { color: '#A84427', fontSize: 11, fontWeight: '600' }, empty: { fontSize: 21, color: '#252B35' }, dropdownWrap: { minWidth: 190, flexGrow: 1, maxWidth: 280 }, dropdownToggle: { minHeight: 52, borderWidth: 1, borderColor: '#E2DED6', borderRadius: 12, backgroundColor: '#F5F2EC', paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' }, dropdownOpen: { borderColor: theme.accent }, dropdownLabel: { color: '#686D74', fontSize: 12, fontWeight: '600' }, dropdownValue: { color: '#252B35', fontSize: 15, fontWeight: '600' }, dropdownMenu: { borderWidth: 1, borderColor: '#E2DED6', borderRadius: 12, backgroundColor: '#FFFEFA', marginTop: 6, padding: 4, maxHeight: 320, overflow: 'scroll' }, dropdownOption: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }, dropdownSelected: { backgroundColor: '#F7E5DB' }, dropdownOptionText: { color: '#252B35', fontSize: 14 }, disabled: { opacity: .35 } });
