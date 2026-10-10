import { defineConfig, devices } from '@playwright/test';

import committedState from './tests/e2e/storage/e2e-init.json' with { type: 'json' };

const E2E_PORT = 5180;

/**
 * `E2E_BASE_URL` runs the suite against a server that is already up — e.g. the dev
 * server on :5173, when clinozy-be's `ALLOWED_ORIGINS` only accepts that origin and
 * :5180 would get 403s — and skips this config's own `webServer`. Unset, the suite
 * boots its own on :5180 as before.
 */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;
const E2E_BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${E2E_PORT}`;

/**
 * The shared storage state (cookie consent pre-answered) is keyed by origin, so it is
 * re-pointed at the origin under test — otherwise the consent card sits over every spec.
 * The answer is stamped with the run's start: one older than six months counts as not
 * answered (D161), so a committed date would bring the card back over every spec one day.
 */
const storageState = {
  ...committedState,
  origins: committedState.origins.map((entry) => ({
    ...entry,
    origin: new URL(E2E_BASE_URL).origin,
    localStorage: entry.localStorage.map((item) => ({
      ...item,
      value: item.value.replace('STAMPED_AT_RUN_START', new Date().toISOString()),
    })),
  })),
};

/** The server the suite boots for itself: the production preview in CI, the dev server locally. */
function ownWebServer() {
  if (process.env.CI) {
    return {
      command: `pnpm preview --port ${E2E_PORT} --strictPort`,
      url: E2E_BASE_URL,
      reuseExistingServer: false,
    };
  }
  return {
    command: `pnpm dev --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  };
}

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
    storageState,
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
  webServer: EXTERNAL_BASE_URL ? undefined : ownWebServer(),
});
