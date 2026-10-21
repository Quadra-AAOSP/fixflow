import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import en from './resources/en/common.json';
import zh from './resources/zh/common.json';

export type SupportedLocale = 'en' | 'zh';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'zh'];
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  zh: '中文',
};

const STORAGE_KEY = 'fixflow.locale';

/** Persist the chosen locale so it survives app restarts. */
async function persistLocale(locale: SupportedLocale) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, locale);
  } catch {
    // SecureStore unavailable on web — non-fatal.
  }
}

async function loadPersistedLocale(): Promise<SupportedLocale | null> {
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    if (value === 'en' || value === 'zh') return value;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Lightweight fallback: prefer persisted → prefer device → default English.
 * We don't pull expo-localization as a dep; Platform.OS gives us the signal
 * we need (web already runs under the browser locale, so we just read
 * SecureStore there).
 */
function deviceLocale(): SupportedLocale {
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { language?: string } }).navigator;
    const lang = (nav?.language ?? '').toLowerCase();
    return lang.startsWith('zh') ? 'zh' : 'en';
  }
  // Native: `Expo.Localization` would be more precise, but we avoid the extra dep.
  return 'en';
}

async function init() {
  const persisted = await loadPersistedLocale();
  const resolved: SupportedLocale = persisted ?? deviceLocale();

  await i18n.use(initReactI18next).init({
    lng: resolved,
    fallbackLng: 'en',
    resources: {
      en: { common: en },
      zh: { common: zh },
    },
    ns: ['common'],
    defaultNS: 'common',
    // The catalogs use single-brace placeholders (`{count}`, `{site}`), not
    // i18next's default double-brace. Tell i18next to match so the values
    // actually substitute instead of rendering literally.
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  });
}

init().catch(() => {
  // Shouldn't throw, but guard anyway.
});

/** Change language at runtime and persist it. */
export async function setLocale(locale: SupportedLocale) {
  await i18n.changeLanguage(locale);
  await persistLocale(locale);
}

export default i18n;
