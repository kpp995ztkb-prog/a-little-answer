import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: false,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
