import { expect, type Page, test } from '@playwright/test';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { withApiRetry } from '@/tests/utils/e2e-api-retry.ts';
import { installE2eCaptchaHeadersOnAuthApi } from '@/tests/utils/e2e-captcha.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import {
  e2eDisplayName,
  e2eOrganizationName,
  uniqueE2eEmail,
} from '@/tests/utils/e2e-faker.ts';
import {
  byTestId,
  clickTestId,
  expectLoginFormReady,
  fillEmailVerificationCode,
  fillTestId,
  gotoApp,
  openAccountMenu,
} from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  e2eAuthHeaders,
  echoedVerificationCode,
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
  /** Set by {@link asTheSessionsOnlyRefresher} while it holds the page's refresh lock. */
  var __playwrightReleaseRefreshLock: (() => void) | undefined;
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
 * Hands the page a session's access token through the dev-only
 * `__clinozyFeEstablishSession` hook (`src/main.tsx`): the app holds it in
 * memory, hydrates `me/context` with it and schedules its own refresh, as a
 * sign-in does.
 */
export async function establishSessionInPage(
  page: Page,
  accessToken: string,
): Promise<void> {
  await page.waitForFunction(() => globalThis.__clinozyFeEstablishSession != null, null, {
    timeout: 10_000,
  });
  await page.evaluate(async (token) => {
    const establish = globalThis.__clinozyFeEstablishSession;
    if (!establish)
      throw new Error('__clinozyFeEstablishSession is not exposed (dev-only)');
    await establish(token);
  }, accessToken);
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
  const send = await withApiRetry(() =>
    page.request.post('/api/v1/auth/email/send-code', {
      data: { email },
      headers: e2eAuthHeaders(),
    }),
  );
  expect(
    send.ok(),
    `send-code failed: ${send.status()} ${await send.text()}`,
  ).toBeTruthy();

  const code =
    (await echoedVerificationCode(send)) ??
    (await pollVerificationCodeFromMailOutbox(email));

  const login = await withApiRetry(() =>
    page.request.post('/api/v1/auth/email/login', {
      data: { email, code },
      headers: e2eAuthHeaders(),
    }),
  );
  expect(
    login.ok(),
    `email/login failed: ${login.status()} ${await login.text()}`,
  ).toBeTruthy();

  const body = (await login.json()) as { data: { access_token: string } };
  await establishSessionInPage(page, body.data.access_token);

  return { email };
}

/**
 * Where a signed-in session lands: the organization picker, or a clinic room. A
 * clinic's home (`/organization/<slug>`) is never a landing on its own — it
 * redirects on to the member's role home.
 */
const LANDED_URL = /\/organization(?:\/[^/?#]+\/[^/?#]+)?(?:[?#]|$)/;

/**
 * How a sign-up fills the wizard: `firstName` replaces the random full name a
 * test types by default — for a screen whose layout follows the name's length
 * (Today's greeting wraps its row).
 */
export interface OnboardingProfile {
  firstName?: string;
}

/**
 * Walks the onboarding wizard through to the workspace when the user still needs it.
 * Skips workspace/invite steps when they are hidden for the deployment mode. A team-only
 * deployment creates the clinic in the wizard and lands on its role home (Today for its
 * owner); where personal workspaces still exist the wizard creates none, and the user
 * lands on the organization picker (D44: a personal workspace has no clinic).
 */
export async function completeOnboardingWizard(
  page: Page,
  profile: OnboardingProfile = {},
): Promise<void> {
  await expect(page.getByTestId('onboarding-page')).toBeVisible({ timeout: 10000 });

  await clickTestId(page, 'onboarding-next');

  // Profile step splits into first/last name (onboarding-first-name /
  // onboarding-last-name); firstName is what gates the Continue button.
  await fillTestId(page, 'onboarding-first-name', profile.firstName ?? e2eDisplayName());
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
  await expect(page).toHaveURL(LANDED_URL, { timeout: 15000 });
}

/**
 * Signs in through the unified `/login` email-code UI and lands on onboarding, the
 * organization picker or a clinic room. Requires clinozy-be on :3000 (Vite proxies
 * `/api` in dev) and DATABASE_URL for code retrieval.
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

  await expect(page).toHaveURL(new RegExp(`/onboarding|${LANDED_URL.source}`), {
    timeout: 20000,
  });
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
 * Email-code sign-in, then onboarding when needed, ending inside a clinic on Today —
 * its owner's role home (D25). Uses API send-code/login (refresh cookie) then SPA
 * hydrate — reliable across browsers. For explicit `/login` UI coverage see
 * `loginViaEmailCodeUI` and auth.e2e tests.
 */
export async function registerNewUserAndGoToToday(
  page: Page,
  profile: OnboardingProfile = {},
): Promise<void> {
  await authenticateViaEmailCodeAndLand(page, profile);
}

/**
 * API email-code session, then client navigation to `/` (refresh cookie hydrates the SPA),
 * ending inside a clinic on Today. A new user walks the onboarding wizard first; it lands
 * them in the clinic it created (team-only), or — where personal workspaces still exist —
 * on the organization picker, since they own no clinic yet: one is created for them
 * through the API and opened.
 */
export async function authenticateViaEmailCodeAndLand(
  page: Page,
  profile: OnboardingProfile = {},
): Promise<{ email: string }> {
  const { email } = await authenticateViaEmailCode(page);
  // Client-side nav keeps the in-memory access token; a full reload would require the refresh cookie.
  await navigateInApp(page, '/');
  await expect(page).toHaveURL(new RegExp(`/onboarding|${LANDED_URL.source}`), {
    timeout: 15000,
  });
  if (page.url().includes('/onboarding')) {
    await completeOnboardingWizard(page, profile);
  }
  if (new URL(page.url()).pathname === '/organization') {
    await createTeamOrgAndOpenToday(page);
  }
  await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
  return { email };
}

/**
 * A new user who stays on their personal workspace, standing on the organization
 * picker: a personal workspace has no clinic (D44), so the picker — and Settings
 * over it — is all it reaches. Skips where personal workspaces are off: the
 * onboarding wizard makes a clinic there instead.
 */
export async function registerNewUserOnPersonalWorkspace(page: Page): Promise<void> {
  await authenticateViaEmailCode(page);
  await navigateInApp(page, '/');
  await expect(page).toHaveURL(new RegExp(`/onboarding|${LANDED_URL.source}`), {
    timeout: 15000,
  });
  if (page.url().includes('/onboarding')) {
    await completeOnboardingWizard(page);
  }
  test.skip(
    new URL(page.url()).pathname !== '/organization',
    'personal workspaces are off on this deployment (onboarding made a clinic)',
  );
  await expect(page.getByTestId('organization-page')).toBeVisible({ timeout: 15000 });
}

/**
 * The Web Lock the app's tabs take around every `/auth/refresh` —
 * `refreshAccessToken()` in `src/shared/auth/service.ts`, whose unit test pins
 * the name (CLAUDE.md, "One refresh path").
 */
const AUTH_REFRESH_LOCK = `${PRODUCT_NAMESPACE}-auth:refresh`;

/**
 * Runs `work` holding the page's own refresh lock, the way a second tab of the
 * app would.
 *
 * `page.request` shares the page's session, and clinozy-be keeps ONE live access
 * token per session: a refresh retires the token before it. So a refresh from
 * here retires the page's token, the page's next call answers 401, and the page
 * refreshes in turn — which retired THIS token whenever it landed between the
 * helper's refresh and its writes: "team organization not created (401)", about
 * one sign-up in ten. Holding the lock parks the page's recovery refresh until
 * `work` is done, so the two clients take turns instead of interleaving.
 */
async function asTheSessionsOnlyRefresher<T>(
  page: Page,
  work: () => Promise<T>,
): Promise<T> {
  await page.evaluate(
    (name) =>
      new Promise<void>((held) => {
        void navigator.locks.request(
          name,
          () =>
            new Promise<void>((release) => {
              globalThis.__playwrightReleaseRefreshLock = release;
              held();
            }),
        );
      }),
    AUTH_REFRESH_LOCK,
  );
  try {
    return await work();
  } finally {
    await page
      .evaluate(() => {
        globalThis.__playwrightReleaseRefreshLock?.();
        globalThis.__playwrightReleaseRefreshLock = undefined;
      })
      // A full navigation since the acquire unloaded the document, and its lock with it.
      .catch(() => undefined);
  }
}

/**
 * Creates a team organization the signed-in user owns, through the API — the
 * clinic shell has no create-organization switcher (personal workspaces are out
 * of scope, D44). A cookie-authenticated refresh mints the token, sent with the
 * app's own origin as the app sends it, while the helper holds the app's refresh
 * lock ({@link asTheSessionsOnlyRefresher}); the session stays in the workspace
 * it was in, and so does the page. Skips the test when the live clinozy-be has
 * team organizations turned off.
 */
export async function createTeamOrgViaApi(
  page: Page,
  opts?: { name?: string; slug?: string },
): Promise<{ slug: string; name: string }> {
  return asTheSessionsOnlyRefresher(page, async () => {
    const refresh = await withApiRetry(() =>
      page.request.post('/api/v1/auth/refresh', {
        headers: { origin: new URL(page.url()).origin },
      }),
    );
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
      { ...opts, switchInto: false },
    );
    expect(org?.slug, `team organization not created (${createStatus})`).toBeTruthy();

    // The refresh above retired the page's token. Hand the page the live one
    // while the lock is still held, so the page never refreshes to recover: a
    // second rotation on every create, against clinozy-be's cap of 30 refreshes
    // a minute per IP. Nothing switched, so the page keeps its workspace.
    await establishSessionInPage(page, data.access_token);
    return { slug: org?.slug ?? '', name: org?.name ?? '' };
  });
}

/**
 * {@link createTeamOrgViaApi}, then opens the new clinic in the app — its home,
 * which lands its owner on Today (D25). The navigation is client-side, so the
 * in-memory session carries over (a reload would need the refresh cookie).
 * Returns once Today is up in the new clinic: the guard's switch into it has
 * landed, and a menu opened now is not torn down mid-click.
 */
export async function createTeamOrgAndOpenToday(
  page: Page,
  opts?: { name?: string; slug?: string },
): Promise<{ slug: string; name: string }> {
  const { slug, name } = await createTeamOrgViaApi(page, opts);
  await navigateInApp(page, `/organization/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/organization/${slug}/today(?:[?#]|$)`), {
    timeout: 15000,
  });
  await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
  return { slug, name };
}

/**
 * Opens the organization switcher. The section-bar shell keeps it in the Account
 * menu, as its "Switch clinic" row — shown once the member belongs to two or more
 * workspaces; the preview shells keep it in the header.
 */
export async function openOrganizationSwitcher(page: Page): Promise<void> {
  if (!(await byTestId(page, 'organization-switcher-trigger').isVisible())) {
    await openAccountMenu(page);
  }
  // Busy (disabled) while me/context loads or a switch is in flight.
  await expect(byTestId(page, 'organization-switcher-trigger')).toBeEnabled({
    timeout: 15000,
  });
  await clickTestId(page, 'organization-switcher-trigger');
}

/** Selects a workspace in the switcher by slug (`personal` for the personal org). */
export async function selectOrganizationInSwitcher(
  page: Page,
  slug: string,
): Promise<void> {
  await openOrganizationSwitcher(page);
  await clickTestId(page, `organization-switcher-option-${slug}`);
}

export { createSessionViaEmailCode, expectLoginFormReady, uniqueE2eEmail };
