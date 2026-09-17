/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E',
          foreground: '#F0FDFA',
          dark: '#2DD4BF',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          dark: '#0F172A',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B',
        },
        ink: {
          DEFAULT: '#0F172A',
          dark: '#F8FAFC',
        },
        muted: {
          DEFAULT: '#64748B',
          dark: '#94A3B8',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#334155',
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
      },
    },
  },
  plugins: [],
};
