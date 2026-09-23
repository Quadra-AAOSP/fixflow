/**
 * FixFlow design tokens for the few places a className cannot be used:
 * lucide icon `color` props, `placeholderTextColor`, the navigation theme,
 * and the status bar.
 *
 * These mirror the CSS custom properties in global.css — keep them in sync.
 *
 * Dark mode is not implemented (light-first). When it is, add a `dark`
 * palette here and return it from `themeColors()` based on the active scheme,
 * plus a variable-override block in global.css. No component, screen, or
 * `dark:` variant needs to change.
 */

export const colors = {
  surface: 'rgb(251, 247, 248)',
  card: 'rgb(255, 255, 255)',
  ink: 'rgb(42, 30, 35)',
  muted: 'rgb(122, 106, 112)',
  border: 'rgb(239, 230, 233)',

  primary: 'rgb(226, 121, 150)',
  primaryForeground: 'rgb(59, 36, 44)',
  accent: 'rgb(121, 226, 205)',
  accentForeground: 'rgb(30, 59, 52)',
  lime: 'rgb(220, 226, 121)',
  limeForeground: 'rgb(58, 63, 20)',

  urgency: {
    low: 'rgb(85, 99, 111)',
    medium: 'rgb(37, 99, 235)',
    high: 'rgb(180, 83, 9)',
    critical: 'rgb(190, 18, 60)',
  },

  tone: {
    neutral: 'rgb(85, 99, 111)',
    info: 'rgb(37, 99, 235)',
    success: 'rgb(18, 121, 92)',
    warning: 'rgb(180, 83, 9)',
    danger: 'rgb(190, 18, 60)',
  },

  tabIconDefault: 'rgb(122, 106, 112)',
  tabIconSelected: 'rgb(226, 121, 150)',
} as const;

/**
 * Single accessor for non-className colors. Kept as a function so a future
 * dark theme can be returned from here without changing call sites.
 */
export function themeColors() {
  return colors;
}
