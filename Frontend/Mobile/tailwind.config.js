/** @type {import('tailwindcss').Config} */

/**
 * Colors resolve from the CSS custom properties declared in global.css.
 * Wrapping each token in `rgb(var(--x) / <alpha-value>)` keeps opacity
 * utilities (`bg-primary/15`) working, and lets a future dark theme be
 * swapped in by overriding the variables alone — no className churn.
 *
 * Token names are semantic, never screen-specific. global.css holds the
 * authoritative values; constants/theme.ts mirrors them for the cases where a
 * className cannot be used.
 *
 * Dark mode is intentionally NOT configured (light-first decision) and no
 * `dark:` variant exists anywhere in the app.
 */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        foreground: token('foreground'),
        'muted-foreground': token('muted-foreground'),
        border: token('border'),

        primary: token('primary'),
        'primary-foreground': token('primary-foreground'),
        accent: token('accent'),
        'accent-foreground': token('accent-foreground'),
        lime: token('lime'),
        'lime-foreground': token('lime-foreground'),

        urgency: {
          low: token('urgency-low'),
          medium: token('urgency-medium'),
          high: token('urgency-high'),
          critical: token('urgency-critical'),
        },

        neutral: token('neutral'),
        info: token('info'),
        success: token('success'),
        warning: token('warning'),
        error: token('error'),
      },
    },
  },
  plugins: [],
};
