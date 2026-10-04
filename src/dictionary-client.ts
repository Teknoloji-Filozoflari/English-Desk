import { Platform } from 'react-native';
import type { WordLookup } from './word-enrichment';

export async function fetchWord(word: string, type: string, example: string, signal: AbortSignal): Promise<WordLookup> {
  if (Platform.OS !== 'web') throw new Error('Otomatik sözlük şu an yerel web sürümünde çalışıyor. Bilgisayarındaki başlatıcıyla aç.');
  const response = await fetch('/api/words/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word, type, example }), signal });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sözlük için uygulamayı yerel başlatıcıyla aç.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Sözlüğe ulaşılamadı.');
  return result;
}
