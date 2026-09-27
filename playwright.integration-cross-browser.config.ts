import { defineConfig, devices } from '@playwright/test';

/**
 * Live FE ↔ BE integration across Chromium, Firefox, and WebKit.
 * Requires clinozy-be on :3000, DATABASE_URL for email-code flows, and the same
 * webServer as `playwright.config.ts` (dev locally, preview in CI).
 *
 *   DATABASE_URL=postgresql://… pnpm test:e2e:integration:cross-browser
 */
const E2E_PORT = 5180;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  testMatch: /(routes-integration|org-switching|workflows)\.e2e\.test\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  outputDir: './test-results/integration-cross-browser/artifacts',
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: 'test-results/integration-cross-browser/report', open: 'never' },
    ],
  ],
  use: {
    baseURL: E2E_BASE_URL,
    storageState: 'tests/e2e/storage/e2e-init.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.CI
    ? {
        command: `pnpm preview --port ${E2E_PORT} --strictPort`,
        url: E2E_BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: `pnpm dev --port ${E2E_PORT} --strictPort`,
        url: E2E_BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
