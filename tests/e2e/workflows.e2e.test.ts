import { type APIRequestContext, expect, test } from '@playwright/test';

import {
  AUTH_EMAIL_CODE_LOGIN_PATH,
  AUTH_EMAIL_CODE_SEND_PATH,
} from '@/tests/utils/auth-api-paths.ts';
import {
  completeOnboardingWizard,
  loginViaEmailCodeUI,
  navigateInApp,
  registerNewUserAndGoToToday,
  selectOrganizationInSwitcher,
} from '@/tests/utils/e2e-auth.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import { e2eTeamOrgProfile } from '@/tests/utils/e2e-faker.ts';
import { byTestId, gotoApp, navigateAuthenticated } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  e2eAuthHeaders,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { bearerHeaders, createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

/**
 * End-to-end workflows spanning UI + API against live clinozy-be.
 */
const API = '/api/v1';
const HOST = 'http://localhost:3000';

let api: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  test.skip(!(await verifyDatabaseConnection()), 'Postgres mail_outbox required');
  api = await playwright.request.newContext({ baseURL: HOST });
});

test.afterAll(async () => {
  await api?.dispose();
});

test.describe('Auth workflow (API)', () => {
  test('send-code → mail_outbox → login → me/context → logout revokes token', async () => {
    const email = uniqueE2eEmail('workflow');
    const send = await api.post(AUTH_EMAIL_CODE_SEND_PATH, {
      data: { email },
      headers: e2eAuthHeaders(),
    });
    expect(send.status()).toBe(200);

    const { accessToken } = await createSessionViaEmailCode(api, email);
    const ctx = await api.get(`${API}/auth/me/context`, {
      headers: bearerHeaders(accessToken),
    });
    expect(ctx.status()).toBe(200);
    // A personal workspace where the deployment has them; none until a clinic in team-only.
    const activeOrg = (await ctx.json()).data.active_organization;
    const { flags } = await probeLiveDeployment(api, accessToken);
    if (flags.personalOrganizations) {
      expect(activeOrg.type).toBe('PERSONAL');
      expect(activeOrg.status).toBe('ACTIVE');
    } else {
      expect(activeOrg).toBeNull();
    }

    const logout = await api.post(`${API}/auth/logout`, {
      headers: bearerHeaders(accessToken),
    });
    expect(logout.status()).toBe(200);
    expect(
      (
        await api.get(`${API}/auth/me/context`, { headers: bearerHeaders(accessToken) })
      ).status(),
    ).toBe(401);
  });

  test('bad verification code returns 401 without minting a session', async () => {
    const email = uniqueE2eEmail('bad-code');
    await api.post(AUTH_EMAIL_CODE_SEND_PATH, {
      data: { email },
      headers: e2eAuthHeaders(),
    });
    const login = await api.post(AUTH_EMAIL_CODE_LOGIN_PATH, {
      data: { email, code: 'BAD000' },
      headers: e2eAuthHeaders(),
    });
    expect(login.status()).toBe(401);
    expect((await login.json()).error).toBeTruthy();
  });
});

test.describe('Tenancy workflow (API)', () => {
  test('create team → switch token → me/context reflects team org', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const { org, teamToken } = await createTeamOrganization(api, accessToken);
    expect(org?.slug).toBeTruthy();

    const ctx = await api.get(`${API}/auth/me/context`, {
      headers: bearerHeaders(teamToken),
    });
    expect(ctx.status()).toBe(200);
    expect((await ctx.json()).data.active_organization.id).toBe(org?.id);

    const bySlug = await api.get(`${API}/tenancy/organizations/by-slug/${org?.slug}`, {
      headers: bearerHeaders(teamToken),
    });
    expect(bySlug.status()).toBe(200);
  });

  test('a session outside any clinic cannot create memberships (422 personal · 403 none)', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const { flags } = await probeLiveDeployment(api, accessToken);
    const res = await api.post(`${API}/tenancy/organization/memberships`, {
      headers: bearerHeaders(accessToken, true),
      data: { email: uniqueE2eEmail('invite'), role_ids: ['rol_zzzzzzzzzzzzzzzzzzzzz'] },
    });
    expect(res.status()).toBe(flags.personalOrganizations ? 422 : 403);
  });
});

test.describe('Invitations workflow (API)', () => {
  test('accept invite without auth returns 401 (not 500)', async () => {
    const res = await api.post(
      `${API}/tenancy/membership-invitations/inv_expired/accept`,
      {
        data: {},
      },
    );
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBeTruthy();
  });

  test('authenticated accept of an unknown invitation fails cleanly (4xx, not 500)', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const res = await api.post(
      `${API}/tenancy/membership-invitations/inv_${'z'.repeat(21)}/accept`,
      {
        headers: bearerHeaders(accessToken),
        data: {},
      },
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect((await res.json()).error).toBeTruthy();
  });

  test('authenticated accept of a malformed invitation id fails cleanly (4xx, not 500)', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const res = await api.post(
      `${API}/tenancy/membership-invitations/not-a-valid-id/accept`,
      {
        headers: bearerHeaders(accessToken),
        data: {},
      },
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Auth workflow (UI)', () => {
  test('API session hydrate lands on Today with the app shell', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('app-layout')).toBeVisible();
  });

  test('email-code UI login completes onboarding when needed', async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaEmailCodeUI(page);
    if (page.url().includes('/onboarding')) {
      await completeOnboardingWizard(page);
    }
    // Team-only: the new clinic's Today. Personal workspaces on: the picker (D44).
    await expect(
      page.getByTestId('today-page').or(page.getByTestId('organization-page')),
    ).toBeVisible({ timeout: 15000 });
  });

  test('session persists across in-app navigation on Today', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const todayUrl = new URL(page.url()).pathname;
    await page.evaluate(() => {
      window.location.hash = '#settings/account/profile';
    });
    await expect(page.getByTestId('settings-modal')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await navigateInApp(page, '/');
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    // `/` resolves back into the same clinic, on the same role home.
    expect(new URL(page.url()).pathname).toBe(todayUrl);
  });
});

test.describe('Org switch workflow (UI)', () => {
  // Through the UI end to end: a second clinic made in the picker's create dialog (the API
  // helpers make every other spec's clinics), then Switch clinic back into the first. A
  // personal workspace is not a destination any more (D44): personal workspaces are off.
  test('create a second clinic from the picker, then switch back to the first', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    const first = /^\/organization\/([^/]+)\//.exec(new URL(page.url()).pathname)?.[1];
    expect(first, 'landed outside a clinic').toBeTruthy();

    await navigateAuthenticated(page, '/organization');
    await expect(page.getByTestId('organization-page')).toBeVisible({ timeout: 10000 });
    await byTestId(page, 'organization-picker-create').click();
    const { name, slug } = e2eTeamOrgProfile({ label: 'wf' });
    await page.getByTestId('create-organization-dialog-name').fill(name);
    await page.getByTestId('create-organization-dialog-slug').fill(slug);
    await page.getByTestId('create-organization-dialog-submit').click();
    // The new clinic's home lands its owner on Today.
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });

    await selectOrganizationInSwitcher(page, first ?? '');
    await expect(page).toHaveURL(new RegExp(`/organization/${first}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Public route smoke (UI)', () => {
  test('login → MFA shell → unauthorized are reachable without auth', async ({
    page,
  }) => {
    await gotoApp(page, '/login');
    await expect(page.getByTestId('login-page')).toBeVisible();
    await gotoApp(page, '/mfa');
    await expect(page.getByTestId('mfa-page')).toBeVisible();
    await gotoApp(page, '/unauthorized');
    await expect(page.getByTestId('unauthorized-page')).toBeVisible();
  });
});
