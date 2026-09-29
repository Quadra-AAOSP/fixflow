/** @type {import('tailwindcss').Config} */

/**
 * Colors resolve from the CSS custom properties declared in global.css.
 * Wrapping each token in `rgb(var(--x) / <alpha-value>)` keeps opacity
 * utilities (`bg-primary/15`) working, and lets a future dark theme be
 * swapped in by overriding the variables alone — no className churn.
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
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: token('surface'),
        card: token('card'),
        ink: token('ink'),
        muted: token('muted'),
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

        tone: {
          neutral: token('tone-neutral'),
          info: token('tone-info'),
          success: token('tone-success'),
          warning: token('tone-warning'),
          danger: token('tone-danger'),
        },
      },
    },
  },
  plugins: [],
};
