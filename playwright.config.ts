import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 5180;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  testMatch: /\.e2e\.test\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Parallel local runs share one clinozy-be on loopback; default to 1 worker (override with PLAYWRIGHT_WORKERS).
  workers: process.env.CI ? 1 : Number(process.env.PLAYWRIGHT_WORKERS ?? 1),
  timeout: 60_000,
  outputDir: './test-results/artifacts',
  reporter: [['html', { outputFolder: 'test-results/report', open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    storageState: 'tests/e2e/storage/e2e-init.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api-contract',
      testMatch: /-api\.e2e\.test\.ts$/,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /-api\.e2e\.test\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: `pnpm preview --port ${E2E_PORT} --strictPort`,
        url: E2E_BASE_URL,
        reuseExistingServer: false,
      }
    : {
        command: `pnpm dev --port ${E2E_PORT} --strictPort`,
        url: E2E_BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
