import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveThemeMode, type ThemeMode } from '@/constants/theme';

const STORAGE_KEY = 'fixflow:theme-mode';

type ThemeModeValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

function readStoredMode(): ThemeMode | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function systemMode(): ThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Owns the active light/dark mode and applies it everywhere:
 *
 *  - `setActiveThemeMode` updates the module accessor in `constants/theme.ts`
 *    so every inline-style palette getter (icon colors, navigation theme, the
 *    status bar) resolves to the new mode on the next render.
 *  - nativewind's `setColorScheme` switches the class-based tokens: on native
 *    it drives the runtime so the `.dark:root` variables in global.css take
 *    effect, and on web it adds/removes the `dark` class on <html> for the same
 *    result.
 *
 * Explicit choices persist on native and web. With no saved choice the
 * provider starts with the current system appearance.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useNativewindColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(
    () => readStoredMode() ?? systemMode(),
  );
  const [restored, setRestored] = useState(Platform.OS === 'web');
  const userChanged = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (active && !userChanged.current && (value === 'light' || value === 'dark')) setModeState(value);
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, []);

  // Resolve the module-level accessor *during* render so the very first paint
  // already uses the stored/system palette.
  setActiveThemeMode(mode);

  useEffect(() => {
    setActiveThemeMode(mode);
    setColorScheme(mode);

    if (!userChanged.current) return;
    if (Platform.OS !== 'web' && restored) {
      void AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Storage can be unavailable (private mode) — the session default holds.
      }
    }
    // `setColorScheme`'s identity is not stable between renders; its behaviour
    // is, so re-running on `mode` alone is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, restored]);

  const value = useMemo<ThemeModeValue>(
    () => ({
      mode,
      setMode: (next) => { userChanged.current = true; setModeState(next); },
      toggle: () => { userChanged.current = true; setModeState((current) => (current === 'dark' ? 'light' : 'dark')); },
    }),
    [mode],
  );

  if (!restored) return null;
  return (
    <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used inside a ThemeModeProvider');
  }
  return context;
}
