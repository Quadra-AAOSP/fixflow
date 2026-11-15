import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const startWebServer = process.env.PLAYWRIGHT_WEB_SERVER === 'true';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-US',
  },
  projects: [
    { name: 'edge', use: { channel: 'msedge', headless: false, viewport: null, launchOptions: { args: ['--start-maximized'], slowMo: Number(process.env.SLOW_MO_MS ?? 500) } } },
  ],
  // Optional: start Vite when PLAYWRIGHT_WEB_SERVER=true.
  // Backend (API on :8080, proxied by Vite) must already be running with SEED_DEMO_DATA=true.
  ...(startWebServer
    ? {
        webServer: {
          command: 'npm run dev --prefix ../../Frontend/Web',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
