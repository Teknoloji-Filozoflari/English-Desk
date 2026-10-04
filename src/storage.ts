import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notebook, validateNotebook } from './model';
import { initialNotebook } from './sample';

const STORAGE_KEY = 'english-desk-native-v1';
export async function loadNotebook(): Promise<Notebook> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === null ? JSON.parse(JSON.stringify(initialNotebook)) : validateNotebook(JSON.parse(raw));
}
export async function saveNotebook(notebook: Notebook): Promise<void> {
  const checked = validateNotebook(notebook);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
}
