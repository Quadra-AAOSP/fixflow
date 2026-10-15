/**
 * FixFlow design tokens for the few places a className cannot be used:
 * lucide icon `color` props, `placeholderTextColor`, the navigation theme,
 * and the status bar. These mirror the CSS custom properties in global.css —
 * keep the two files in sync.
 *
 * Light + dark. Every exported palette below is a *getter object*: reading a
 * property resolves to the light or dark value for the active `ThemeMode`
 * (see `stores/theme.tsx`). Components read these during render, so when the
 * mode flips the provider re-renders the tree and every value re-resolves —
 * no call site needs to know about the theme.
 *
 * The class-based tokens (`bg-surface`, `text-auth-ink`, …) switch through the
 * CSS variables declared in global.css; their dark values live in the
 * `.dark:root` block there (`darkMode: 'class'`). The provider activates them
 * via nativewind's `setColorScheme` on native and the `dark` class on <html>
 * on web, so every CSS-variable utility switches too.
 */

export type ThemeMode = 'light' | 'dark';

let activeMode: ThemeMode = 'light';

/** Set by the theme provider before the tree renders. */
export function setActiveThemeMode(mode: ThemeMode): void {
  activeMode = mode;
}

export function getActiveThemeMode(): ThemeMode {
  return activeMode;
}

/**
 * Wrap a light palette so each property becomes a getter that returns the dark
 * override when the dark theme is active (falling back to light for any key the
 * dark set leaves alone — e.g. brand accents, which are scheme-independent).
 */
function modePalette<L extends object>(light: L, dark: Partial<L> = {}): L {
  const out = {} as L;
  (Object.keys(light) as (keyof L)[]).forEach((key) => {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => {
        const themed = dark[key];
        return activeMode === 'dark' && themed !== undefined ? themed : light[key];
      },
    });
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/*  App palette (light)                                                       */
/* -------------------------------------------------------------------------- */

const colorsLight = {
  /*
   * Base scaffolding — mirrors `Frontend/Web/tailwind.config.js` and the
   * `.dashboard-app` block (`--navy: #152742`, `--muted: #6e7e92`,
   * `--line: #e9edf0`, `background: #fcfdfc`).
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

  coralBg: 'rgb(250, 228, 229)',
  coralInk: 'rgb(187, 82, 96)',
  mintBg: 'rgb(210, 246, 238)',
  mintInk: 'rgb(0, 141, 128)',
  citronBg: 'rgb(237, 244, 178)',
  citronInk: 'rgb(104, 133, 34)',

  urgency: {
    low: 'rgb(113, 111, 104)',
    medium: 'rgb(14, 165, 233)',
    high: 'rgb(245, 158, 11)',
    critical: 'rgb(220, 38, 38)',
  },
  tone: {
    neutral: 'rgb(113, 111, 104)',
    info: 'rgb(37, 99, 235)',
    success: 'rgb(5, 150, 105)',
    warning: 'rgb(245, 158, 11)',
    danger: 'rgb(220, 38, 38)',
  },

  tabIconDefault: 'rgb(107, 123, 143)',
  tabIconSelected: 'rgb(0, 141, 128)',
};

const colorsDark: Partial<typeof colorsLight> = {
  surface: 'rgb(17, 19, 23)',
  card: 'rgb(24, 27, 32)',
  ink: 'rgb(231, 235, 240)',
  muted: 'rgb(150, 161, 175)',
  border: 'rgb(43, 47, 54)',
  line: 'rgb(43, 47, 54)',
  subtitle: 'rgb(150, 161, 175)',
  caption: 'rgb(133, 144, 158)',
  navy: 'rgb(231, 235, 240)',
  tabIconDefault: 'rgb(150, 161, 175)',
  coralBg: 'rgb(60, 35, 38)',
  coralInk: 'rgb(240, 172, 176)',
  mintBg: 'rgb(23, 50, 46)',
  mintInk: 'rgb(122, 222, 206)',
  citronBg: 'rgb(52, 58, 30)',
  citronInk: 'rgb(200, 215, 120)',
};

/* -------------------------------------------------------------------------- */
/*  Auth palette (light) — mirrors the auth block in global.css               */
/* -------------------------------------------------------------------------- */

const authLight = {
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
};

const authDark: Partial<typeof authLight> = {
  bg: 'rgb(24, 22, 20)',
  ink: 'rgb(235, 231, 225)',
  panel: 'rgb(33, 31, 28)',
  olive: 'rgb(184, 182, 142)',
  body: 'rgb(168, 166, 154)',
  note: 'rgb(152, 150, 140)',
  sage: 'rgb(132, 172, 154)',
  sageDeep: 'rgb(178, 184, 132)',
  limeSoft: 'rgb(54, 60, 40)',
  input: 'rgb(30, 28, 25)',
  line: 'rgb(58, 55, 50)',
  foot: 'rgb(136, 133, 123)',
  coralLink: 'rgb(232, 150, 150)',
  cardBg: 'rgb(30, 28, 25)',
  cardLine: 'rgb(58, 55, 50)',
  roseSoft: 'rgb(60, 35, 38)',
  roseDeep: 'rgb(236, 162, 166)',
  mintSoft: 'rgb(23, 50, 46)',
  mintDeep: 'rgb(122, 222, 206)',
  managedBg: 'rgb(32, 38, 30)',
  managedIcon: 'rgb(142, 188, 160)',
  managedInk: 'rgb(168, 174, 152)',
  chipBg: 'rgb(42, 50, 32)',
  chipInk: 'rgb(192, 205, 142)',
  divider: 'rgb(50, 48, 44)',
  danger: 'rgb(236, 152, 158)',
  ghostInk: 'rgb(182, 172, 154)',
};

/* -------------------------------------------------------------------------- */
/*  Dashboard palette (light) — welcome banner / stat cards / FAB             */
/* -------------------------------------------------------------------------- */

const dashboardLight = {
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
};

const dashboardDark: Partial<typeof dashboardLight> = {
  bannerBg: 'rgb(38, 33, 27)',
  bannerBorder: 'rgb(52, 44, 33)',
  bannerSubtitle: 'rgb(202, 212, 226)',
  bannerValues: 'rgb(170, 184, 200)',
  teal: 'rgb(96, 214, 198)',
  tealSoft: 'rgb(23, 50, 46)',
  statCoralSoft: 'rgb(60, 35, 38)',
  statCoralDeep: 'rgb(240, 172, 176)',
  statMintSoft: 'rgb(23, 50, 46)',
  statMintDeep: 'rgb(122, 222, 206)',
  statCitronSoft: 'rgb(52, 58, 30)',
  statCitronDeep: 'rgb(200, 215, 120)',
  cardLine: 'rgb(44, 48, 55)',
  cardBg: 'rgb(24, 27, 32)',
  subtitle: 'rgb(150, 161, 175)',
  caption: 'rgb(133, 144, 158)',
  pillBg: 'rgb(23, 50, 46)',
  empty: 'rgb(140, 152, 166)',
  errorBg: 'rgb(60, 30, 33)',
  errorText: 'rgb(236, 162, 166)',
};

/* -------------------------------------------------------------------------- */
/*  Shop palette (light) — the public /shop page                              */
/* -------------------------------------------------------------------------- */

const shopLight = {
  shell: 'rgb(255, 254, 250)',
  ink: 'rgb(35, 61, 54)',
  mint: 'rgb(121, 226, 205)',
  coral: 'rgb(226, 121, 121)',
  citron: 'rgb(220, 226, 121)',
  wordmarkSub: 'rgb(122, 134, 121)',
  shellLine: 'rgb(232, 236, 227)',
  hero: 'rgb(245, 238, 229)',
  heroBody: 'rgb(93, 106, 97)',
  pillLine: 'rgb(216, 215, 199)',
  pillDot: 'rgb(69, 151, 133)',
  serifAccent: 'rgb(142, 71, 71)',
  secondaryLine: 'rgb(204, 214, 206)',
  footText: 'rgb(99, 113, 104)',
  star: 'rgb(171, 81, 81)',
  imageNoteBg: 'rgba(255, 249, 238, 0.92)',
  valuesText: 'rgb(95, 107, 99)',
  valuesLine: 'rgb(228, 232, 223)',
  searchLine: 'rgb(224, 230, 221)',
  tabLine: 'rgb(223, 230, 220)',
  stateBg: 'rgb(250, 251, 246)',
  stateLine: 'rgb(217, 225, 211)',
  stateIconBg: 'rgb(214, 244, 234)',
  stateText: 'rgb(104, 117, 104)',
  cardLine: 'rgb(232, 235, 227)',
  imageBg: 'rgb(243, 242, 236)',
  productBody: 'rgb(112, 128, 113)',
  productFoot: 'rgb(109, 125, 110)',
  editorialBg: 'rgb(240, 241, 214)',
  editorialText: 'rgb(96, 110, 91)',
  editorialLink: 'rgb(82, 102, 80)',
  dialogLine: 'rgb(231, 235, 228)',
  qtyLine: 'rgb(220, 228, 216)',
  basketBadge: 'rgb(220, 226, 121)',
};

const shopDark: Partial<typeof shopLight> = {
  shell: 'rgb(20, 22, 20)',
  ink: 'rgb(226, 233, 227)',
  wordmarkSub: 'rgb(142, 152, 142)',
  shellLine: 'rgb(48, 52, 48)',
  hero: 'rgb(42, 38, 33)',
  heroBody: 'rgb(182, 190, 180)',
  pillLine: 'rgb(60, 60, 52)',
  pillDot: 'rgb(110, 190, 172)',
  serifAccent: 'rgb(226, 150, 150)',
  secondaryLine: 'rgb(60, 68, 62)',
  footText: 'rgb(150, 162, 152)',
  star: 'rgb(226, 150, 150)',
  valuesText: 'rgb(150, 162, 152)',
  valuesLine: 'rgb(50, 54, 48)',
  searchLine: 'rgb(52, 58, 52)',
  tabLine: 'rgb(52, 58, 52)',
  stateBg: 'rgb(28, 31, 27)',
  stateLine: 'rgb(50, 56, 48)',
  stateIconBg: 'rgb(30, 52, 48)',
  stateText: 'rgb(150, 162, 152)',
  cardLine: 'rgb(46, 50, 44)',
  imageBg: 'rgb(40, 40, 36)',
  productBody: 'rgb(160, 172, 162)',
  productFoot: 'rgb(150, 162, 152)',
  editorialBg: 'rgb(44, 46, 30)',
  editorialText: 'rgb(160, 172, 152)',
  editorialLink: 'rgb(150, 172, 150)',
  dialogLine: 'rgb(46, 50, 44)',
  qtyLine: 'rgb(48, 54, 44)',
};

/* -------------------------------------------------------------------------- */
/*  Exports — mode-aware                                                     */
/* -------------------------------------------------------------------------- */

export const colors = modePalette(colorsLight, colorsDark);
export const authColors = modePalette(authLight, authDark);
export const dashboardColors = modePalette(dashboardLight, dashboardDark);
export const shopColors = modePalette(shopLight, shopDark);

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
 * Single accessor for non-className colors. Returns the mode-aware palette,
 * so a cached call during render is always correct for the active mode.
 */
export function themeColors() {
  return colors;
}

