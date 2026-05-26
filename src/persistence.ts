import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './store';

const STORAGE_KEY = '@ktidebt_state';

export async function loadState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    const raw = JSON.stringify(state);
    await AsyncStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // silently fail
  }
}
