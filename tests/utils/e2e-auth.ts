import { expect, type Page, test } from '@playwright/test';

import { installE2eCaptchaHeadersOnAuthApi } from '@/tests/utils/e2e-captcha.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import {
  e2eDisplayName,
  e2eOrganizationName,
  uniqueE2eEmail,
} from '@/tests/utils/e2e-faker.ts';
import {
  clickTestId,
  expectLoginFormReady,
  fillEmailVerificationCode,
  fillTestId,
  gotoApp,
} from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  e2eAuthHeaders,
  pollVerificationCodeFromMailOutbox,
  requireDatabaseUrl,
} from '@/tests/utils/e2e-session.ts';
import { createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

type ClinozyFeRouter = {
  navigate: (opts: { to: string }) => Promise<void> | void;
};

type ClinozyFeEstablishSession = (accessToken: string) => Promise<void>;

declare global {
  var __clinozyFeRouter: ClinozyFeRouter | undefined;
  var __clinozyFeEstablishSession: ClinozyFeEstablishSession | undefined;
}

/**
 * Client-side navigation without a full reload — avoids racing `silentRefresh()`
 * against synchronous `requireAuth` on cold `page.goto`. Requires the dev-only
 * hook in `src/main.tsx`.
 */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const r = globalThis.__clinozyFeRouter;
    if (!r) throw new Error('__clinozyFeRouter is not exposed (dev-only)');
    await r.navigate({ to });
  }, path);
}

/**
 * Creates a session via clinozy-be email send-code + login (proxied through the Vite dev server).
 * Returns the email used. Requires clinozy-be on :3000 and DATABASE_URL for code retrieval.
 */
export async function authenticateViaEmailCode(page: Page): Promise<{ email: string }> {
  // Finish anonymous bootstrap before the login request sets a refresh cookie.
  await gotoApp(page, '/login');
  await expectLoginFormReady(page);
  const email = uniqueE2eEmail('e2e');
  const send = await page.request.post('/api/v1/auth/email/send-code', {
    data: { email },
    headers: e2eAuthHeaders(),
  });
  expect(
    send.ok(),
    `send-code failed: ${send.status()} ${await send.text()}`,
  ).toBeTruthy();

  const code = await pollVerificationCodeFromMailOutbox(email);

  const login = await page.request.post('/api/v1/auth/email/login', {
    data: { email, code },
    headers: e2eAuthHeaders(),
  });
  expect(
    login.ok(),
    `email/login failed: ${login.status()} ${await login.text()}`,
  ).toBeTruthy();

  const body = (await login.json()) as { data: { access_token: string } };
  await page.waitForFunction(() => globalThis.__clinozyFeEstablishSession != null, null, {
    timeout: 10_000,
  });
  await page.evaluate(async (token) => {
    const establish = globalThis.__clinozyFeEstablishSession;
    if (!establish)
      throw new Error('__clinozyFeEstablishSession is not exposed (dev-only)');
    await establish(token);
  }, body.data.access_token);

  return { email };
}

/**
 * Walks the onboarding wizard through to a dashboard when the user still needs it.
 * Skips workspace/invite steps when they are hidden for the deployment mode.
 */
export async function completeOnboardingWizard(page: Page): Promise<void> {
  await expect(page.getByTestId('onboarding-page')).toBeVisible({ timeout: 10000 });

  await clickTestId(page, 'onboarding-next');

  // Profile step splits into first/last name (onboarding-first-name /
  // onboarding-last-name); firstName is what gates the Continue button.
  await fillTestId(page, 'onboarding-first-name', e2eDisplayName());
  await clickTestId(page, 'onboarding-next');

  await clickTestId(page, 'onboarding-next');

  const orgName = page.getByTestId('onboarding-organization-name');
  if (await orgName.isVisible()) {
    await orgName.fill(e2eOrganizationName());
    await clickTestId(page, 'onboarding-next');
  }

  const inviteEmail = page.getByTestId('onboarding-invite-email');
  if (await inviteEmail.isVisible()) {
    await clickTestId(page, 'onboarding-next');
  }

  await clickTestId(page, 'onboarding-finish');
  await expect(page).toHaveURL(/\/organization\/[^/]+\/dashboard|\/dashboard/, {
    timeout: 15000,
  });
}

/**
 * Signs in through the unified `/login` email-code UI and lands on onboarding or a dashboard.
 * Requires clinozy-be on :3000 (Vite proxies `/api` in dev) and DATABASE_URL for code retrieval.
 */
export async function loginViaEmailCodeUI(
  page: Page,
  email = uniqueE2eEmail('e2e-ui'),
): Promise<{ email: string }> {
  requireDatabaseUrl();
  await gotoApp(page, '/login');
  await installE2eCaptchaHeadersOnAuthApi(page);
  await fillTestId(page, 'auth-email', email);
  await clickTestId(page, 'auth-email-submit');
  await expect(page.getByTestId('auth-email-verify-panel')).toBeVisible({
    timeout: 10000,
  });

  const code = await pollVerificationCodeFromMailOutbox(email);
  await watchForEmailStepReappearing(page);
  await fillEmailVerificationCode(page, code);

  await expect(page).toHaveURL(
    /\/onboarding|\/organization\/[^/]+\/dashboard|\/dashboard/,
    { timeout: 20000 },
  );
  await expectEmailStepNeverReappeared(page);

  return { email };
}

/**
 * Starts watching for the email step coming back, covering the window between
 * submitting a valid code and landing on the destination.
 *
 * A plain `expect(...).not.toBeVisible()` afterwards cannot catch this: the
 * regression was a remount that rewound the form to step one for exactly as
 * long as the destination took to load (LOGIN-7), so by the time the URL
 * assertion resolves the evidence is gone. An observer armed beforehand sees it
 * even if it lasts a single frame. The verdict is parked on `<html>`, which the
 * observer does not watch, so recording it cannot retrigger the observer.
 */
async function watchForEmailStepReappearing(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dataset.e2eAuthEmailStepReappeared = 'false';
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="auth-email"]')) {
        document.documentElement.dataset.e2eAuthEmailStepReappeared = 'true';
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

/** Asserts the sign-in screen only ever moved forward. Pairs with the watch above. */
async function expectEmailStepNeverReappeared(page: Page): Promise<void> {
  const reappeared = await page.evaluate(
    () => document.documentElement.dataset.e2eAuthEmailStepReappeared === 'true',
  );
  expect(
    reappeared,
    'the email step reappeared after a valid code — the sign-in screen went backwards (LOGIN-7)',
  ).toBe(false);
}

/**
 * Email-code UI sign-in, then onboarding when needed, ending on a dashboard shell.
 * Uses API send-code/login (refresh cookie) then SPA hydrate — reliable across browsers.
 * For explicit `/login` UI coverage see `loginViaEmailCodeUI` and auth.e2e tests.
 */
export async function registerNewUserAndGoToDashboard(page: Page): Promise<void> {
  await authenticateViaEmailCodeAndLand(page);
}

/**
 * API email-code session, then client navigation to `/` (refresh cookie hydrates the SPA).
 */
export async function authenticateViaEmailCodeAndLand(
  page: Page,
): Promise<{ email: string }> {
  const { email } = await authenticateViaEmailCode(page);
  // Client-side nav keeps the in-memory access token; a full reload would require the refresh cookie.
  await navigateInApp(page, '/');
  await expect(page).toHaveURL(
    /\/onboarding|\/organization\/[^/]+\/dashboard|\/dashboard/,
    { timeout: 15000 },
  );
  if (page.url().includes('/onboarding')) {
    await completeOnboardingWizard(page);
  }
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 });
  return { email };
}

/**
 * Creates a team organization the signed-in user owns, through the API — the
 * clinic shell has no create-organization switcher (personal workspaces are out
 * of scope, D44). A cookie-authenticated refresh mints the token, sent with the
 * app's own origin as the app sends it; the page stays where it is. Skips the
 * test when the live clinozy-be has team organizations turned off.
 */
export async function createTeamOrgViaApi(
  page: Page,
  opts?: { name?: string; slug?: string },
): Promise<{ slug: string }> {
  const refresh = await page.request.post('/api/v1/auth/refresh', {
    headers: { origin: new URL(page.url()).origin },
  });
  expect(refresh.ok(), `refresh failed: ${refresh.status()}`).toBeTruthy();
  const { data } = (await refresh.json()) as { data: { access_token: string } };

  const { flags } = await probeLiveDeployment(page.request, data.access_token);
  test.skip(
    !flags.teamOrganizations,
    'team organizations are off on this clinozy-be (TEAM_ORGANIZATION_ENABLED=false)',
  );

  const { createStatus, org } = await createTeamOrganization(
    page.request,
    data.access_token,
    opts,
  );
  expect(org?.slug, `team organization not created (${createStatus})`).toBeTruthy();
  return { slug: org?.slug ?? '' };
}

/**
 * {@link createTeamOrgViaApi}, then opens the new organization's dashboard in
 * the app — where creating one from the old switcher landed. The navigation is
 * client-side, so the in-memory session carries over (a reload would need the
 * refresh cookie).
 */
export async function createTeamOrgAndOpenDashboard(
  page: Page,
  opts?: { name?: string; slug?: string },
): Promise<{ slug: string }> {
  const { slug } = await createTeamOrgViaApi(page, opts);
  await navigateInApp(page, `/organization/${slug}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/organization/${slug}/dashboard`), {
    timeout: 15000,
  });
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 });
  return { slug };
}

/** Opens the org switcher and selects an option by slug (`personal` for personal org). */
export async function selectOrganizationInSwitcher(
  page: Page,
  slug: string,
): Promise<void> {
  await clickTestId(page, 'organization-switcher-trigger');
  await clickTestId(page, `organization-switcher-option-${slug}`);
}

export { createSessionViaEmailCode, expectLoginFormReady, uniqueE2eEmail };
