/**
 * FixFlow design tokens for non-className use (icons, chrome).
 * Mirror of colors in tailwind.config.js — keep in sync.
 */

export const colors = {
  light: {
    primary: '#E27979',
    primaryForeground: '#302C29',
    surface: '#F8F7F2',
    card: '#FFFFFF',
    ink: '#302C29',
    muted: '#716F68',
    border: '#E5E4DC',
    navIconDefault: '#94A3B8',
    navIconSelected: '#E27979',
  },
  dark: {
    primary: '#2DD4BF',
    primaryForeground: '#042F2E',
    surface: '#302C29',
    card: '#1E293B',
    ink: '#F8F7F2',
    muted: '#94A3B8',
    border: '#334155',
    navIconDefault: '#716F68',
    navIconSelected: '#2DD4BF',
  },
  urgency: {
    low: '#716F68',
    medium: '#0EA5E9',
    high: '#F59E0B',
    critical: '#DC2626',
  },
  status: {
    progress: '#2563EB',
    pending: '#F59E0B',
    resolved: '#059669',
  },
} as const;

export type ColorSchemeName = 'light' | 'dark';

export function themeColors(scheme: ColorSchemeName | null | undefined) {
  return colors[scheme === 'dark' ? 'dark' : 'light'];
}
