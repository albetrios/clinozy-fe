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
 * The shared storage state pre-answers the cookie card (Reject all, in the consent cookie) so it
 * never sits over another spec's button. A cookie is keyed by host, so it is re-pointed at the host
 * under test. It is a session cookie: nothing ages it during a run.
 */
const storageState = {
  ...committedState,
  cookies: committedState.cookies.map((cookie) => ({
    ...cookie,
    domain: new URL(E2E_BASE_URL).hostname,
    sameSite: cookie.sameSite as 'Lax',
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
