/**
 * Local persistence.
 *
 * AsyncStorage keeps this runnable in Expo Go. The brief calls for MMKV, which
 * is faster and synchronous but needs a development build; swapping it in later
 * only means reimplementing these three functions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Losing a settings write is not worth interrupting a hand for.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const KEYS = {
  settings: 'bahay.settings.v1',
  stats: 'bahay.stats.v1',
  savedGame: 'bahay.saved-game.v1',
  ruleset: 'bahay.ruleset.v1',
} as const;
