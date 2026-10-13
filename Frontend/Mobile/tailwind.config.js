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
        line: token('line'),
        subtitle: token('subtitle'),
        caption: token('caption'),
        navy: token('navy'),

        primary: token('primary'),
        'primary-foreground': token('primary-foreground'),
        accent: token('accent'),
        'accent-foreground': token('accent-foreground'),
        lime: token('lime'),
        'lime-foreground': token('lime-foreground'),

        /* Status-group tones — see `.coral`/`.mint`/`.citron` in
           `Frontend/Web/src/styles/dashboard.css`. `DEFAULT`/`deep`/`link`
           are the auth-chrome coral (see the auth block in global.css);
           they are merged into this single object because a duplicate
           `coral` key below would silently drop `bg`/`ink`. */
        coral: {
          DEFAULT: token('coral'),
          bg: token('coral-bg'),
          ink: token('coral-ink'),
          deep: token('coral-deep'),
          link: token('coral-link'),
        },
        mint: {
          bg: token('mint-bg'),
          ink: token('mint-ink'),
        },
        citron: {
          bg: token('citron-bg'),
          ink: token('citron-ink'),
        },

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

        auth: {
          bg: token('auth-bg'),
          ink: token('auth-ink'),
          panel: token('auth-panel'),
          olive: token('auth-olive'),
          body: token('auth-body'),
          note: token('auth-note'),
          sage: token('auth-sage'),
          'sage-deep': token('auth-sage-deep'),
          'lime-soft': token('auth-lime-soft'),
          input: token('auth-input'),
          line: token('auth-line'),
          foot: token('auth-foot'),

          /* Register flow — role picker + managed-access panel. */
          'card-bg': token('auth-card-bg'),
          'card-line': token('auth-card-line'),
          'rose-soft': token('auth-rose-soft'),
          'rose-deep': token('auth-rose-deep'),
          'mint-soft': token('auth-mint-soft'),
          'mint-deep': token('auth-mint-deep'),
          'managed-bg': token('auth-managed-bg'),
          'managed-icon': token('auth-managed-icon'),
          'managed-ink': token('auth-managed-ink'),
          'chip-bg': token('auth-chip-bg'),
          'chip-ink': token('auth-chip-ink'),
          divider: token('auth-divider'),
          danger: token('auth-danger'),
          'ghost-ink': token('auth-ghost-ink'),
        },

        /* Dashboard — see global.css > @layer base > :root. */
        dashboard: {
          'banner-bg': token('dashboard-banner-bg'),
          'banner-border': token('dashboard-banner-border'),
          'banner-subtitle': token('dashboard-banner-subtitle'),
          'banner-values': token('dashboard-banner-values'),
          'cta-bg': token('dashboard-cta-bg'),
          'cta-border': token('dashboard-cta-border'),
          'cta-text': token('dashboard-cta-text'),
          'cta-icon-bg': token('dashboard-cta-icon-bg'),
          'cta-icon': token('dashboard-cta-icon'),
          'fab-bg': token('dashboard-fab-bg'),
          'fab-text': token('dashboard-fab-text'),
          teal: token('dashboard-teal'),
          'teal-soft': token('dashboard-teal-soft'),
          'stat-coral-soft': token('dashboard-stat-coral-soft'),
          'stat-coral-deep': token('dashboard-stat-coral-deep'),
          'stat-mint-soft': token('dashboard-stat-mint-soft'),
          'stat-mint-deep': token('dashboard-stat-mint-deep'),
          'stat-citron-soft': token('dashboard-stat-citron-soft'),
          'stat-citron-deep': token('dashboard-stat-citron-deep'),
          'card-line': token('dashboard-card-line'),
          'card-bg': token('dashboard-card-bg'),
          subtitle: token('dashboard-subtitle'),
          caption: token('dashboard-caption'),
          'pill-bg': token('dashboard-pill-bg'),
          empty: token('dashboard-empty'),
          'error-bg': token('dashboard-error-bg'),
          'error-text': token('dashboard-error-text'),
        },
      },
    },
  },
  plugins: [],
};
