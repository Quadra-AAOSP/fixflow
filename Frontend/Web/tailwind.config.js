/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E27979',
          foreground: '#302C29',
          dark: '#2DD4BF',
        },
        surface: {
          DEFAULT: '#F8F7F2',
          dark: '#302C29',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B',
        },
        ink: {
          DEFAULT: '#302C29',
          dark: '#F8F7F2',
        },
        muted: {
          DEFAULT: '#716F68',
          dark: '#94A3B8',
        },
        border: {
          DEFAULT: '#E5E4DC',
          dark: '#334155',
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
      },
    },
  },
  plugins: [],
};
