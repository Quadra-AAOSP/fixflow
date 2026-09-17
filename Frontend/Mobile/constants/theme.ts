/**
 * FixFlow design tokens for non-className use (icons, headers, StatusBar).
 * Mirror of colors in tailwind.config.js — keep in sync.
 */

export const colors = {
  light: {
    primary: '#0F766E',
    primaryForeground: '#F0FDFA',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#0F766E',
  },
  dark: {
    primary: '#2DD4BF',
    primaryForeground: '#042F2E',
    surface: '#0F172A',
    card: '#1E293B',
    ink: '#F8FAFC',
    muted: '#94A3B8',
    border: '#334155',
    tabIconDefault: '#64748B',
    tabIconSelected: '#2DD4BF',
  },
  urgency: {
    low: '#64748B',
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
