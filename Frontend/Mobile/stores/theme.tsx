import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

import { setActiveThemeMode, type ThemeMode } from '@/constants/theme';

const STORAGE_KEY = 'fixflow:theme-mode';

type ThemeModeValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/**
 * Web keeps the choice in localStorage. Native has no bundled storage module
 * (no async-storage dependency), so the choice lives in memory for the session
 * and starts from the system scheme on launch.
 */
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
 * Owns the active light/dark mode. Writes it into `constants/theme.ts`
 * (`setActiveThemeMode`) so every palette getter resolves correctly, and
 * re-renders the whole tree on change. The root layout applies the matching
 * CSS-variable set — see `darkCssVars` in `constants/theme.ts`.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => readStoredMode() ?? systemMode(),
  );

  // Resolve the module-level accessor *during* render so the very first paint
  // already uses the stored/system palette.
  setActiveThemeMode(mode);

  useEffect(() => {
    setActiveThemeMode(mode);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Storage can be unavailable (private mode) — the session default holds.
      }
    }
  }, [mode]);

  const value = useMemo<ThemeModeValue>(
    () => ({
      mode,
      setMode: setModeState,
      toggle: () => setModeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

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
