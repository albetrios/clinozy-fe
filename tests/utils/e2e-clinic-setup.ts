import type { Page } from '@playwright/test';

/** The pages whose setup reads already answer deferred — the route is added once per page. */
const pagesExploringFirst = new WeakSet<Page>();

/** The pages that meet the clinic setup as a new owner does (the clinic-setup spec). */
const pagesOpeningSetup = new WeakSet<Page>();

/**
 * A new clinic opens its setup drawer by itself over the first room (feat-clinic-setup KICKOFF
 * §6.1). A journey about another screen starts as an owner who chose "Explore first": the setup
 * read answers deferred, so the drawer never covers the room. `gotoApp` and
 * `establishSessionInPage` add it to every page; a spec about the setup opts out with
 * {@link letClinicSetupOpen}. Nothing is written — only this page's reads of the setup change.
 */
export async function exploreClinicSetupFirst(page: Page): Promise<void> {
  if (pagesExploringFirst.has(page)) return;
  pagesExploringFirst.add(page);
  await page.route('**/api/v1/app/onboarding-setup', async (route) => {
    if (pagesOpeningSetup.has(page) || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    try {
      const response = await route.fetch();
      const body = (await response.json()) as { data?: { deferred_at?: string | null } };
      if (body.data && !body.data.deferred_at)
        body.data.deferred_at = new Date().toISOString();
      await route.fulfill({ response, json: body });
    } catch {
      // The app dropped the read (a navigation, a newer read) or the page closed: let it go.
      await route.fallback().catch(() => undefined);
    }
  });
}

/** This page meets the clinic setup as it is: the drawer opens by itself on a new clinic. */
export function letClinicSetupOpen(page: Page): void {
  pagesOpeningSetup.add(page);
}
