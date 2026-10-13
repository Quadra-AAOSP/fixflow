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
  /*
   * Base palette — mirrors `Frontend/Web/tailwind.config.js` and the
   * `.dashboard-app` block in `Frontend/Web/src/styles/dashboard.css`
   * (`--navy: #152742`, `--muted: #6e7e92`, `--line: #e9edf0`,
   * `background: #fcfdfc`). The navy ink + slate muted + hairline
   * `#e9edf0` border are what give the web its editorial feel.
   */
  surface: 'rgb(252, 253, 252)',
  card: 'rgb(255, 255, 255)',
  ink: 'rgb(21, 39, 66)',
  muted: 'rgb(107, 123, 143)',
  border: 'rgb(233, 237, 240)',
  line: 'rgb(233, 237, 240)',
  subtitle: 'rgb(107, 123, 143)',
  caption: 'rgb(125, 139, 147)',
  navy: 'rgb(21, 39, 66)',

  primary: 'rgb(226, 121, 121)',
  primaryForeground: 'rgb(48, 44, 41)',
  accent: 'rgb(121, 226, 205)',
  accentForeground: 'rgb(30, 59, 52)',
  lime: 'rgb(220, 226, 121)',
  limeForeground: 'rgb(58, 63, 20)',

  /*
   * Status-group tones — match `.coral`/`.mint`/`.citron` on the web.
   * Used for the status badge (open / in_progress / resolved groups),
   * the chart bars, the stat icons, and the activity avatars.
   */
  coralBg: 'rgb(250, 228, 229)',
  coralInk: 'rgb(187, 82, 96)',
  mintBg: 'rgb(210, 246, 238)',
  mintInk: 'rgb(0, 141, 128)',
  citronBg: 'rgb(237, 244, 178)',
  citronInk: 'rgb(104, 133, 34)',

  /*
   * Urgency — reporter-declared severity. Values copied from
   * `Frontend/Web/tailwind.config.js > colors.urgency`.
   */
  urgency: {
    low: 'rgb(113, 111, 104)',
    medium: 'rgb(14, 165, 233)',
    high: 'rgb(245, 158, 11)',
    critical: 'rgb(220, 38, 38)',
  },

  /*
   * Semantic status tones — mirrors `Frontend/Web/tailwind.config.js >
   * colors.status`. The keys stay stable so existing `bg-tone-*` and
   * `text-tone-*` classes keep working, just with the new values.
   */
  tone: {
    neutral: 'rgb(113, 111, 104)',
    info: 'rgb(37, 99, 235)',
    success: 'rgb(5, 150, 105)',
    warning: 'rgb(245, 158, 11)',
    danger: 'rgb(220, 38, 38)',
  },

  tabIconDefault: 'rgb(107, 123, 143)',
  tabIconSelected: 'rgb(0, 141, 128)',
} as const;

/**
 * Warm palette for the public auth chrome (login / register). Mirrors the auth
 * block in global.css and `Frontend/Web/src/styles/global.css`.
 *
 * Kept separate from `colors` because the auth pages use a warmer, editorial
 * treatment (cream panel, olive headline accent, coral brand mark) than the
 * in-app UI — and the web build hard-codes the same values.
 */
export const authColors = {
  bg: 'rgb(248, 247, 242)',
  ink: 'rgb(48, 44, 41)',
  panel: 'rgb(239, 238, 230)',
  olive: 'rgb(128, 127, 96)',
  body: 'rgb(115, 115, 103)',
  note: 'rgb(119, 119, 108)',
  sage: 'rgb(110, 149, 133)',
  sageDeep: 'rgb(141, 147, 98)',
  limeSoft: 'rgb(238, 240, 203)',
  input: 'rgb(253, 252, 249)',
  line: 'rgb(228, 227, 218)',
  foot: 'rgb(139, 136, 125)',
  coral: 'rgb(226, 121, 121)',
  coralDeep: 'rgb(193, 95, 95)',
  coralLink: 'rgb(147, 75, 75)',

  // Register flow — role picker + managed-access panel.
  cardBg: 'rgb(255, 253, 250)',
  cardLine: 'rgb(225, 228, 215)',
  roseSoft: 'rgb(250, 228, 229)',
  roseDeep: 'rgb(163, 85, 92)',
  mintSoft: 'rgb(210, 246, 238)',
  mintDeep: 'rgb(22, 123, 110)',
  managedBg: 'rgb(237, 242, 228)',
  managedIcon: 'rgb(106, 150, 122)',
  managedInk: 'rgb(114, 122, 103)',
  chipBg: 'rgb(234, 242, 215)',
  chipInk: 'rgb(101, 116, 75)',
  divider: 'rgb(230, 230, 218)',
  danger: 'rgb(160, 67, 77)',
  ghostInk: 'rgb(103, 94, 80)',
} as const;

/**
 * Dashboard palette — mirrors the welcome banner, stat cards, chart bars,
 * Report-an-Issue CTA, and floating create button on the web build
 * (`.dashboard-app` in `Frontend/Web/src/styles/dashboard.css`).
 *
 * Kept separate from `colors` / `authColors` because the dashboard uses a
 * coral/mint/citron wash that the rest of the app (and the auth pages) do
 * not. The web build hard-codes the same values per stat icon and chart bar.
 */
export const dashboardColors = {
  bannerBg: 'rgb(255, 249, 241)',
  bannerBorder: 'rgb(251, 239, 224)',
  bannerSubtitle: 'rgb(48, 75, 104)',
  bannerValues: 'rgb(86, 107, 128)',

  ctaBg: 'rgb(121, 226, 205)',
  ctaBorder: 'rgb(101, 216, 193)',
  ctaText: 'rgb(16, 75, 69)',
  ctaIconBg: 'rgb(243, 255, 252)',
  ctaIcon: 'rgb(0, 142, 130)',

  fabBg: 'rgb(121, 226, 205)',
  fabText: 'rgb(19, 85, 76)',
  fabShadow: 'rgb(42, 155, 125)',

  teal: 'rgb(0, 143, 133)',
  tealSoft: 'rgb(211, 246, 239)',

  statCoralSoft: 'rgb(250, 228, 229)',
  statCoralDeep: 'rgb(187, 82, 96)',
  statMintSoft: 'rgb(210, 246, 238)',
  statMintDeep: 'rgb(0, 141, 128)',
  statCitronSoft: 'rgb(237, 244, 178)',
  statCitronDeep: 'rgb(104, 133, 34)',

  cardLine: 'rgb(233, 237, 240)',
  cardBg: 'rgb(255, 255, 255)',
  subtitle: 'rgb(107, 123, 143)',
  caption: 'rgb(125, 139, 147)',
  pillBg: 'rgb(211, 246, 239)',
  empty: 'rgb(120, 138, 152)',
  errorBg: 'rgb(251, 232, 231)',
  errorText: 'rgb(148, 62, 70)',
} as const;

/** Families loaded in `app/_layout.tsx` for the web-parity auth typography. */
export const fontFamilies = {
  head: 'Manrope_600SemiBold',
  headBold: 'Manrope_700Bold',
  headExtraBold: 'Manrope_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

/**
 * Single accessor for non-className colors. Kept as a function so a future
 * dark theme can be returned from here without changing call sites.
 */
export function themeColors() {
  return colors;
}
