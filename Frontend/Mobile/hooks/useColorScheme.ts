import { useColorScheme as useSystemColorScheme } from 'react-native';

import type { ColorSchemeName } from '@/constants/theme';

/** System appearance — NativeWind `dark:` utilities follow prefers-color-scheme / Appearance. */
export function useColorScheme(): ColorSchemeName {
  return useSystemColorScheme() === 'dark' ? 'dark' : 'light';
}
