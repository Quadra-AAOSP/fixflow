import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const web = process.env.VUE_WEB_URL ?? 'http://localhost:5173';
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080';
const browser = process.env.PLAYWRIGHT_BROWSER === 'firefox' ? 'firefox' : 'chromium';
const headless = process.env.PLAYWRIGHT_HEADLESS === 'true';
if (new URL(web).hostname !== new URL(backend).hostname) {
  throw new Error('Use the same hostname for VUE_WEB_URL and BACKEND_URL.');
}
export default defineConfig({
  testDir: './rewrite',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-rewrite' }]],
  outputDir: 'test-results-rewrite',
  use: {
    baseURL: web, browserName: browser, channel: browser === 'chromium' ? 'msedge' : undefined,
    headless, viewport: null, screenshot: 'only-on-failure', video: 'off', trace: 'off',
    launchOptions: {
      slowMo: Number(process.env.SLOW_MO_MS ?? 500),
      args: browser === 'chromium' && !headless ? ['--start-maximized'] : [],
    },
  },
  webServer: process.env.START_VUE === 'false' || process.argv.includes('--list') ? undefined : {
    command: `npm run dev -- --host ${new URL(web).hostname} --port ${new URL(web).port || 5173} --strictPort`,
    cwd: resolve(__dirname, '../../Frontend/Web'),
    url: web,
    env: { API_PROXY_TARGET: backend },
    reuseExistingServer: true,
    timeout: 90_000,
  },
});

