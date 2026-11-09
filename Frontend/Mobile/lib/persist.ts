import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small JSON persistence helper.
 *
 * Native uses SecureStore (report payloads can contain a description and an
 * address, so they should not sit in plain AsyncStorage). Web has no
 * SecureStore implementation, so it falls back to localStorage; failures
 * degrade to in-memory state rather than breaking the flow.
 */

function webStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? webStorage()?.getItem(key) ?? null
        : await SecureStore.getItemAsync(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === 'web') {
      webStorage()?.setItem(key, raw);
      return;
    }
    await SecureStore.setItemAsync(key, raw);
  } catch {
    // Best-effort: the in-memory state remains usable.
  }
}

export async function deleteJson(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      webStorage()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to delete.
  }
}
