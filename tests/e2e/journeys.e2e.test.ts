import { expect, test } from '@playwright/test';

import {
  completeOnboardingWizard,
  createTeamOrgAndOpenToday,
  createTeamOrgViaApi,
  establishSessionInPage,
  loginViaEmailCodeUI,
  navigateInApp,
  registerNewUserAndGoToToday,
} from '@/tests/utils/e2e-auth.ts';
import { e2eOrganizationSlug } from '@/tests/utils/e2e-faker.ts';
import {
  clickTestId,
  expectAppHeaderReady,
  expectLoginFormReady,
  gotoApp,
  navigateAuthenticated,
  openSettingsHash,
} from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  pollInvitationTokenFromMailOutbox,
  requireDatabaseUrl,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { createTeamInvitation } from '@/tests/utils/e2e-tenancy.ts';

test.describe('Product journeys', () => {
  test.beforeEach(async () => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
  });

  test('onboarding wizard completes and lands in the workspace', async ({ page }) => {
    requireDatabaseUrl();
    await loginViaEmailCodeUI(page, uniqueE2eEmail('onboard-ui'));
    if (page.url().includes('/onboarding')) {
      await completeOnboardingWizard(page);
    }
    // Team-only: the clinic the wizard made, on its owner's role home (Today).
    // Personal workspaces on: the organization picker — no clinic yet (D44).
    await expect(
      page.getByTestId('today-page').or(page.getByTestId('organization-page')),
    ).toBeVisible({ timeout: 15000 });
  });

  test('accept invite happy path joins team org', async ({ page, playwright }) => {
    const inviteeEmail = uniqueE2eEmail('invitee');
    const ownerApi = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    const inviteeApi = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    try {
      const ownerToken = (await createSessionViaEmailCode(ownerApi)).accessToken;
      const invitation = await createTeamInvitation(ownerApi, ownerToken, inviteeEmail);
      const { invitationId, orgSlug } = invitation;
      const invitationToken =
        invitation.invitationToken ??
        (await pollInvitationTokenFromMailOutbox(inviteeEmail));

      const inviteeSession = await createSessionViaEmailCode(inviteeApi, inviteeEmail);

      await gotoApp(page, '/login');
      await establishSessionInPage(page, inviteeSession.accessToken);

      await navigateInApp(
        page,
        `/accept-invite/${invitationId}?token=${encodeURIComponent(invitationToken)}`,
      );
      await expect(page.getByTestId('accept-invite-success')).toBeVisible({
        timeout: 15000,
      });
      // The clinic's home, which sends the member on to their role home.
      await expect(page).toHaveURL(
        new RegExp(`/organization/${orgSlug}(?:/[^/?#]+)?(?:[?#]|$)`),
        { timeout: 20000 },
      );
      await expect(page.getByTestId('app-layout')).toBeVisible();
    } finally {
      await ownerApi.dispose();
      await inviteeApi.dispose();
    }
  });

  test('accept invite without auth goes through sign-in and keeps the invite', async ({
    page,
  }) => {
    // `/accept-invite/$invitationId` is auth-required (INV-4, `requireAuth` in the
    // route's `beforeLoad`): the recipient of an invite email is usually NOT signed
    // in, and that is the common path — so a guest goes to sign-in FIRST, with the
    // invite page carried as the post-login redirect. The single-use token never
    // rides in that URL: it waits in the tab's sessionStorage (E-5). The page's
    // error card is for a signed-in user; a guest never sees it.
    await gotoApp(page, '/accept-invite/inv_expired?token=tok_e2e_guest');

    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10000 });
    const redirect = new URL(page.url()).searchParams.get('redirect') ?? '';
    expect(redirect).toContain('/accept-invite/inv_expired');
    expect(page.url()).not.toContain('tok_e2e_guest');
    expect(
      await page.evaluate(() => sessionStorage.getItem('clinozy:accept-invite-token')),
    ).toContain('tok_e2e_guest');
    await expectLoginFormReady(page);
  });

  /**
   * A member of a SUSPENDED organization is held on its blocked page. clinozy-be
   * suspends an organization itself (a lapsed plan, an admin) — nothing a local run
   * can trigger — so the three answers that carry the status (the workspace list the
   * org guard resolves the slug from, the switch into it, and me/context) say what
   * they would then say. An active organization's `…/suspended` sends the member
   * back instead (`org-lifecycle.e2e.test.ts`).
   */
  test('suspended page renders for a member of a suspended team organization', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    // The answers say "suspended" from the moment the organization exists. The org
    // guard reads the workspace list cache-first, and the app may read it as soon as
    // the organization is created — so the routes go in first, then the create.
    const slug = e2eOrganizationSlug();
    type OrgWire = { slug?: string | null; status?: string };
    const suspend = (org: OrgWire | null | undefined) => {
      if (org?.slug === slug) org.status = 'SUSPENDED';
    };
    await page.route('**/api/v1/users/me/organizations*', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { data?: OrgWire[] };
      body.data?.forEach(suspend);
      await route.fulfill({ response, json: body });
    });
    for (const path of ['auth/me/context', 'auth/switch-to-organization']) {
      await page.route(`**/api/v1/${path}`, async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as {
          data?: { active_organization?: OrgWire | null };
        };
        suspend(body.data?.active_organization);
        await route.fulfill({ response, json: body });
      });
    }
    await createTeamOrgViaApi(page, { slug });

    // The clinic's home runs the status guard before it picks a room.
    await navigateAuthenticated(page, `/organization/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/suspended`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('suspended-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('suspended-switch-organization')).toBeVisible();
  });

  test('logout clears session and blocks protected routes', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    await expectAppHeaderReady(page);
    await page.getByTestId('user-menu-trigger').click();
    await clickTestId(page, 'logout-button');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expectLoginFormReady(page);
    await navigateInApp(page, '/organization');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('settings account and organization section smoke matrix', async ({ page }) => {
    await registerNewUserAndGoToToday(page);

    const accountSections: Array<{ section: string; panel: string }> = [
      { section: 'profile', panel: 'settings-section-profile' },
      { section: 'security', panel: 'settings-section-security' },
      { section: 'notifications', panel: 'settings-section-notifications' },
    ];

    for (const { section, panel } of accountSections) {
      await openSettingsHash(page, 'account', section);
      await expect(page.getByTestId(panel)).toBeVisible({ timeout: 10000 });
    }

    // Leave settings before entering the new organization. Not with Escape:
    // closing is `history.back()`, and each deep link above PUSHED an entry, so
    // one Escape only steps back to the previous section. (In-app section
    // switches `replace`, which is why a real user needs just one.) Drop the
    // hash instead.
    const withoutHash = new URL(page.url());
    withoutHash.hash = '';
    await page.goto(withoutHash.toString());
    await expect(page.getByTestId('settings-modal')).toHaveCount(0);
    await expectAppHeaderReady(page);

    await createTeamOrgAndOpenToday(page);

    // Regression: deep-linking to an organization section the instant the org
    // exists used to land on Account · Profile. Entering an org clears the store's
    // permissions a beat before the real set arrives; the modal read that empty,
    // UNRESOLVED list as an answer and rewrote the URL — 19 ms after the deep
    // link, for good. me/context was correct the whole time. Nothing had ever run
    // this half of the spec (it was skipping by accident), which is how it shipped.
    await openSettingsHash(page, 'organization', 'general');
    await expect(page.getByTestId('settings-section-org-general')).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId('settings-nav-organization-members').click();
    await expect(page).toHaveURL(/#settings\/organization\/members$/);
    await expect(page.getByTestId('settings-organization-members')).toBeVisible({
      timeout: 10000,
    });
  });

  test('account settings nav tour switches sections via nav clicks and syncs the URL', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    await openSettingsHash(page, 'account', 'profile');
    await expect(page.getByTestId('settings-section-profile')).toBeVisible({
      timeout: 10000,
    });

    // Drive the modal via its nav items (not the hash) — each click swaps the
    // panel and syncs the URL hash.
    await page.getByTestId('settings-nav-account-security').click();
    await expect(page).toHaveURL(/#settings\/account\/security$/);
    await expect(page.getByTestId('settings-section-security')).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId('settings-nav-account-sessions').click();
    await expect(page).toHaveURL(/#settings\/account\/sessions$/);
    await expect(page.getByTestId('settings-account-sessions')).toBeVisible({
      timeout: 10000,
    });
  });

  test('the active settings nav item is marked with aria-current=page', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    await openSettingsHash(page, 'account', 'security');

    await expect(page.getByTestId('settings-nav-account-security')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByTestId('settings-nav-account-profile')).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
