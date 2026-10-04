import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { checkFile, StoryDraft, textFileDraft } from './story-import-core';

export async function chooseStoryFile(): Promise<{ name: string; uri: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/markdown', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const extension = checkFile(asset.name, asset.size ?? new File(asset.uri).size);
  if (extension === 'pdf') throw new Error('PDF içe aktarmayı şu an bilgisayardaki web sürümünden kullanabilirsin. Mobilde TXT veya Markdown dosyası seç.');
  return { name: asset.name, uri: asset.uri };
}
export async function readStoryFile(source: { name: string; uri: string }, onProgress: (text: string) => void, signal: AbortSignal): Promise<StoryDraft> {
  onProgress('Metin okunuyor…');
  const text = await new File(source.uri).text();
  if (signal.aborted) throw new Error('İçe aktarma iptal edildi.');
  return textFileDraft(source.name, text);
}
