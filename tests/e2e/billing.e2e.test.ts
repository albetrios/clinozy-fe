import { expect, type Page, type PlaywrightWorkerArgs, test } from '@playwright/test';

import { readAppStripeEnabled } from '@/tests/utils/e2e-app-config.ts';
import {
  establishSessionInPage,
  navigateInApp,
  registerNewUserOnPersonalWorkspace,
} from '@/tests/utils/e2e-auth.ts';
import { gotoApp, openSettingsHash } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { bearerHeaders, createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

/**
 * Billing & subscription UI flow (`#settings/account/billing`).
 *
 * The HTTP contract is covered by `billing-api.e2e.test.ts`; this spec drives the
 * actual panel: the Your plan card, the plan picker ("Compare plans") with its
 * billing-cycle toggle and feature table, the change confirm, invoices, payment
 * methods, cancellation, and the personal-org gate. Billing is
 * a team-org feature (`subscription:manage`, `teamOrganizationOnly`), so the
 * setup creates a team org via the API and hydrates the team-scoped session.
 */

const API = 'http://localhost:3000/api/v1';

/** The plan header's one button ("Adjust plan" / "Upgrade plan" / "View plans") opens the picker. */
async function openPlanPicker(page: Page) {
  await page.getByTestId('billing-adjust-plan').click();
  const picker = page.getByTestId('billing-plan-picker');
  await expect(picker).toBeVisible();
  return picker;
}

type TeamContext = {
  slug: string;
  subscribed: boolean;
  planCount: number;
  /** The app has a Stripe publishable key, so a subscription shows its invoices and cards. */
  stripe: boolean;
};

/** Why a subscription spec skips: no paid plan carries a Stripe sandbox price. */
const NO_PAID_SUBSCRIPTION =
  'no paid plan with a Stripe sandbox price — run `pnpm db:seed:stripe-catalog` in clinozy-be';

/** Why an invoices / payment-methods spec skips: the panel shows them only with Stripe. */
const NO_STRIPE_KEY =
  'the app has no Stripe publishable key (VITE_STRIPE_PUBLISHABLE_KEY), so a subscription shows no invoices or payment methods';

/**
 * Create a team org via the API, optionally subscribe it to the cheapest paid plan, then
 * hydrate the browser with the team-scoped token and land on its home (Today).
 * Returns `null` when the environment can't provision one (seat seed / Stripe).
 * `planCount` reflects the seeded plan catalog so plan-dependent specs can skip
 * gracefully when no plans exist in this environment.
 */
async function setUpTeamBilling(
  page: Page,
  playwright: PlaywrightWorkerArgs['playwright'],
  opts: { withSubscription: boolean },
): Promise<TeamContext | null> {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  try {
    const { accessToken } = await createSessionViaEmailCode(api);
    const { org, teamToken } = await createTeamOrganization(api, accessToken);
    if (!org) return null;

    // The plan catalog is public; read it up front so every spec knows whether
    // any plans are seeded (an empty catalog means the plan cards never render).
    const plansRes = await api.get(`${API}/billing/plans`);
    const plans = plansRes.ok()
      ? (
          (await plansRes.json()) as {
            data: Array<{ id: string; price_monthly: string }>;
          }
        ).data
      : [];

    let subscribed = false;
    if (opts.withSubscription) {
      // Free is the tier an organization with no subscription is on: clinozy-be refuses a
      // subscription to it (it has no provider price). The cheapest paid plan — priced in the
      // Stripe sandbox by clinozy-be's `pnpm db:seed:stripe-catalog` — is subscribed to, and
      // waits for its first payment.
      const paidPlan = plans
        .filter((p) => Number(p.price_monthly) > 0)
        .sort((a, b) => Number(a.price_monthly) - Number(b.price_monthly))[0];
      if (paidPlan) {
        const sub = await api.post(`${API}/billing/subscriptions`, {
          headers: bearerHeaders(teamToken, true),
          data: { plan_id: paidPlan.id, billing_cycle: 'monthly' },
        });
        subscribed = sub.ok();
      }
    }

    await gotoApp(page, '/login');
    await establishSessionInPage(page, teamToken);

    if (!org.slug) throw new Error('team org slug missing');
    await navigateInApp(page, `/organization/${org.slug}`);
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    return {
      slug: org.slug,
      subscribed,
      planCount: plans.length,
      stripe: await readAppStripeEnabled(page),
    };
  } finally {
    await api.dispose();
  }
}

test.describe('Billing & subscription', () => {
  test.beforeEach(async () => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (mail_outbox + billing seed)',
    );
  });

  test('a team manager sees the plan catalog and the billing-cycle toggle', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: false });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(ctx?.planCount === 0, 'no billing plans seeded in this environment');

    await openSettingsHash(page, 'account', 'billing');

    await expect(page.getByTestId('settings-account-billing')).toBeVisible({
      timeout: 15000,
    });
    // a11y guard: the panel is a labelled region inside the settings dialog,
    // with the "Billing" section heading exposed to assistive tech.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByTestId('settings-account-billing').getByText('Billing', { exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId('billing-summary')).toBeVisible();
    // On Free: one button that invites the upgrade, and no renewal notice to give.
    await expect(page.getByTestId('billing-adjust-plan')).toHaveText('Upgrade plan');
    await expect(page.getByTestId('billing-notice')).toHaveCount(0);
    const picker = await openPlanPicker(page);
    // a11y guard: the picker is a named dialog with every plan as an article.
    await expect(page.getByRole('dialog', { name: 'Plans' })).toBeVisible();
    await expect(picker.getByTestId('plan-options')).toBeVisible();
    await expect(picker.getByRole('article').first()).toBeVisible();
    // Manager-only controls are exposed.
    await expect(picker.getByTestId('billing-cycle-toggle')).toBeVisible();
  });

  test('the billing-cycle toggle switches plan pricing between monthly and yearly', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: false });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(ctx?.planCount === 0, 'no billing plans seeded in this environment');

    await openSettingsHash(page, 'account', 'billing');
    await expect(page.getByTestId('billing-adjust-plan')).toBeVisible({
      timeout: 15000,
    });
    const picker = await openPlanPicker(page);
    const options = picker.getByTestId('plan-options');

    // Every card reads per month; the cycle says how it is billed.
    await expect(page.getByTestId('billing-cycle-monthly')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(options.getByText('Billed monthly').first()).toBeVisible();

    await page.getByTestId('billing-cycle-yearly').click();
    await expect(options.getByText(/^Billed yearly · /).first()).toBeVisible();

    await page.getByTestId('billing-cycle-monthly').click();
    await expect(options.getByText('Billed monthly').first()).toBeVisible();
  });

  test('the plan picker compares features, and a move asks before it changes anything', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: false });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip((ctx?.planCount ?? 0) < 2, 'fewer than two billing plans seeded');

    await openSettingsHash(page, 'account', 'billing');
    await expect(page.getByTestId('billing-summary')).toBeVisible({ timeout: 15000 });
    const picker = await openPlanPicker(page);
    await expect(picker.getByTestId('plan-compare-table')).toBeVisible();
    await expect(
      picker.getByRole('table', { name: 'Every plan, side by side' }),
    ).toBeVisible();

    // A card press opens the confirm — from → to, the price and what you get.
    await picker
      .getByTestId(/^plan-pln_/)
      .first()
      .click();
    const confirm = page.getByTestId('plan-change-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm.getByTestId('plan-change-route')).toBeVisible();
    await expect(confirm.getByTestId('plan-change-summary')).toBeVisible();
    await expect(confirm.getByTestId('plan-change-when')).toBeVisible();

    // Keep closes it and leaves the picker where it was: nothing moved.
    await confirm.getByTestId('plan-change-confirm-keep').click();
    await expect(confirm).toHaveCount(0);
    await expect(picker).toBeVisible();
  });

  test('a subscription surfaces summary, invoices, payment methods, and cancellation', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: true });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(!ctx?.subscribed, NO_PAID_SUBSCRIPTION);
    test.skip(!ctx?.stripe, NO_STRIPE_KEY);

    await openSettingsHash(page, 'account', 'billing');

    await expect(page.getByTestId('billing-summary')).toBeVisible({ timeout: 15000 });
    // A subscribed org carries the status badge + the dedicated sections.
    await expect(page.getByTestId('billing-invoices-card')).toBeVisible();
    await expect(page.getByTestId('billing-payment-methods-card')).toBeVisible();
    await expect(page.getByTestId('billing-cancellation-card')).toBeVisible();
    // A subscription keeps its own cycle (change-plan takes the plan alone), so the
    // Monthly · Yearly switch is offered only before there is one.
    const picker = await openPlanPicker(page);
    await expect(picker.getByTestId('plan-options')).toBeVisible();
    await expect(page.getByTestId('billing-cycle-toggle')).toHaveCount(0);
  });

  test('a personal account cannot manage billing (team-gated)', async ({ page }) => {
    // A personal workspace reaches Settings over the organization picker (D44).
    await registerNewUserOnPersonalWorkspace(page);

    await openSettingsHash(page, 'account', 'billing');
    await expect(page.getByTestId('settings-account-billing')).toBeVisible({
      timeout: 15000,
    });

    // Plan-management controls are team-only — never exposed to a personal account.
    await expect(page.getByTestId('billing-adjust-plan')).toHaveText('View plans');
    await expect(page.getByTestId('billing-cancellation-card')).toHaveCount(0);
    // Comparing is reading: the picker opens, with prices and no moves.
    const picker = await openPlanPicker(page);
    await expect(picker.getByTestId('plan-options')).toBeVisible();
    await expect(picker.getByTestId(/^plan-pln_/)).toHaveCount(0);
    await expect(page.getByTestId('billing-cycle-toggle')).toHaveCount(0);
  });

  test('cancelling a subscription runs the confirm flow without error', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: true });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(!ctx?.subscribed, NO_PAID_SUBSCRIPTION);

    await openSettingsHash(page, 'account', 'billing');
    await expect(page.getByTestId('billing-cancellation-card')).toBeVisible({
      timeout: 15000,
    });

    const cancelButton = page.getByTestId('billing-cancel');
    test.skip(
      !(await cancelButton.isEnabled()),
      // The subscription waits for its first payment; only Stripe's webhook marks it paid, so
      // locally it needs `stripe listen --forward-to localhost:3000/api/v1/billing/webhook`.
      'subscription not cancellable yet: its first payment is unconfirmed (forward Stripe webhooks with `stripe listen`)',
    );

    await cancelButton.click();
    await expect(page.getByTestId('billing-cancel-dialog')).toBeVisible();
    // a11y guard: the destructive confirm is a labelled button.
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();

    // The dialog closes and the panel stays healthy (no error toast / crash).
    await expect(page.getByTestId('billing-cancel-dialog')).toHaveCount(0);
    await expect(page.getByTestId('billing-cancellation-card')).toBeVisible();
  });

  test('switching plans updates the subscription (upgrade)', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: true });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(!ctx?.subscribed, NO_PAID_SUBSCRIPTION);

    await openSettingsHash(page, 'account', 'billing');
    const summary = page.getByTestId('billing-summary');
    await expect(summary).toBeVisible({ timeout: 15000 });

    // A subscribed plan says when it renews, and "Adjust plan" opens the picker; an
    // "Upgrade to <plan>" there opens its confirm, whose button changes the subscription.
    // Depending on the Stripe config that lands as a trial, an active switch, or the in-app
    // payment step — all of which update the header away from the current plan.
    await expect(page.getByTestId('billing-notice')).toBeVisible();
    await expect(page.getByTestId('billing-adjust-plan')).toHaveText('Adjust plan');
    const beforeSummary = (await summary.innerText()).trim();
    const picker = await openPlanPicker(page);
    const upgrade = picker.getByRole('button', { name: /^Upgrade to / }).first();
    test.skip((await upgrade.count()) === 0, 'no dearer plan seeded to upgrade to');
    await upgrade.click();
    const confirm = page.getByTestId('plan-change-confirm');
    await expect(confirm).toBeVisible();
    await confirm.getByTestId('plan-change-confirm-accept').click();

    await expect(confirm).toHaveCount(0, { timeout: 20000 });
    await expect(summary).not.toHaveText(beforeSummary, { timeout: 20000 });
  });

  test('an invoice row links out to its hosted invoice when one exists', async ({
    page,
    playwright,
  }) => {
    const ctx = await setUpTeamBilling(page, playwright, { withSubscription: true });
    test.skip(ctx === null, 'team org could not be provisioned in this environment');
    test.skip(!ctx?.subscribed, NO_PAID_SUBSCRIPTION);
    test.skip(!ctx?.stripe, NO_STRIPE_KEY);

    await openSettingsHash(page, 'account', 'billing');
    await expect(page.getByTestId('billing-invoices-card')).toBeVisible({
      timeout: 15000,
    });

    // The card frames the list before Stripe's answer arrives: decide on the table itself, once
    // the invoices have loaded — not on the card, which is up while they are still loading.
    await expect(page.getByTestId('billing-invoices-table')).toBeVisible({
      timeout: 15000,
    });
    const viewLink = page.getByTestId('billing-invoice-view').first();
    test.skip(
      !(await viewLink.isVisible()),
      'no invoice generated for this subscription',
    );
    // Opens the hosted invoice safely in a new tab.
    await expect(viewLink).toHaveAttribute('href', /^https?:\/\/.+/);
    await expect(viewLink).toHaveAttribute('target', '_blank');
    await expect(viewLink).toHaveAttribute('rel', /noopener/);
  });
});
