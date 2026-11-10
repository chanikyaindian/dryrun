import { defineConfig } from '@playwright/test';

const preview = process.env.DRYRUN_PREVIEW === '1';
export default defineConfig({
  testDir: './tests',
  timeout: 70000,
  expect: { timeout: 10000 },
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run ' + (preview ? 'preview' : 'dev') + ' -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
