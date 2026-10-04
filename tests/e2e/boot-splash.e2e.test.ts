import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { SPLASH_FRAMES_MS, SPLASH_REDUCED_FRAMES_MS } from '@/lib/app-splash.ts';
import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import {
  createTeamOrgViaApi,
  registerNewUserAndGoToDashboard,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, clickTestId, expectLoginFormReady } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * The cold load is ONE continuous screen: splash → content.
 *
 * Deliberately not a stopwatch — wall-clock numbers flake, and the dev server
 * these specs run against says nothing about production speed. It pins the two
 * things that made the first load FEEL slow, as invariants a browser can prove
 * at any speed:
 *
 * 1. **The splash fades exactly once.** A fade that starts and is then yanked
 *    back to full opacity (a loader mounting a beat late) is the "blink".
 * 2. **The page is never blank.** Whenever the splash is fading or gone, real
 *    content — or a loader that owns the viewport — is already mounted. Before
 *    the router's boot pending policy, a cold visit to anything but `/` faded the
 *    splash out over an empty page while a guard awaited `/auth/refresh`.
 *
 * (What the numbers were: `routeTree.tsx` → BOOT_PENDING_POLICY, and
 * `lib/app-splash.ts` → SETTLED_EXIT_DELAY_MS.)
 */
interface BootTrace {
  fadeStarts: number;
  fadeCancels: number;
  blankFrames: number;
}

/**
 * Observes the boot from the first byte. Content = anything that owns the
 * screen once the splash lets go of it.
 */
const TRACE_BOOT = `
(() => {
  const trace = { fadeStarts: 0, fadeCancels: 0, blankFrames: 0 };
  window.__bootTrace = trace;
  const CONTENT = [
    '[data-testid="login-form"]', '[data-testid="auth-form"]', 'form',
    '[data-testid="dashboard-page"]', '[data-testid="app-layout"]',
    '[data-testid="full-page-spinner"]', '[data-testid="onboarding-page"]',
    '[data-testid="not-found-page"]', 'main',
  ].join(',');
  let fading = false;
  const check = () => {
    const splash = document.getElementById('app-splash');
    const exiting = !!splash && splash.classList.contains('app-splash-exiting');
    if (exiting && !fading) trace.fadeStarts += 1;
    if (splash && !exiting && fading) trace.fadeCancels += 1;
    fading = exiting;
    if ((exiting || !splash) && document.body && !document.querySelector(CONTENT)) {
      trace.blankFrames += 1;
    }
  };
  new MutationObserver(check).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
})();
`;

async function bootTrace(page: Page): Promise<BootTrace> {
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });
  return page.evaluate(
    () => (window as unknown as { __bootTrace: BootTrace }).__bootTrace,
  );
}

/**
 * Make the auth bootstrap take as long as it does on a real network.
 *
 * On localhost `/auth/refresh` answers in a few milliseconds, faster than the
 * splash can even begin to leave — so a boot that WOULD go blank while a guard
 * awaits the network never gets the chance to, and the test passes against the
 * bug. Holding the response open is what makes the invariant bite.
 */
async function slowAuthBootstrap(page: Page, delayMs = 1500): Promise<void> {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

function expectOneContinuousScreen(trace: BootTrace) {
  expect(trace.fadeStarts, 'the splash fades out once').toBe(1);
  expect(trace.fadeCancels, 'a fade is never yanked back (the blink)').toBe(0);
  expect(trace.blankFrames, 'the page is never blank behind the splash').toBe(0);
}

test.describe('Cold load — one continuous screen', () => {
  test('a guest opening / lands on the login form', async ({ page }) => {
    await page.addInitScript(TRACE_BOOT);
    await slowAuthBootstrap(page);
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expectLoginFormReady(page);
    expectOneContinuousScreen(await bootTrace(page));
  });

  test('a guest opening a deep link is sent to login without a blank page', async ({
    page,
  }) => {
    // Not one of the four routes that used to opt into an immediate pending
    // state — a bookmarked dashboard is just as cold an entry as `/`.
    await page.addInitScript(TRACE_BOOT);
    await slowAuthBootstrap(page);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expectLoginFormReady(page);
    expectOneContinuousScreen(await bootTrace(page));
  });

  test('a signed-in user reloading the dashboard sees splash → dashboard, nothing between', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
    await registerNewUserAndGoToDashboard(page);

    await page.addInitScript(TRACE_BOOT);
    await slowAuthBootstrap(page);
    await page.reload();

    await expect(byTestId(page, 'dashboard-page')).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/login/);
    expectOneContinuousScreen(await bootTrace(page));
  });

  test('a signed-in user opening / is taken to their dashboard the same way', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
    await registerNewUserAndGoToDashboard(page);

    await page.addInitScript(TRACE_BOOT);
    await page.goto('/');

    await expect(byTestId(page, 'dashboard-page')).toBeVisible({ timeout: 30_000 });
    expectOneContinuousScreen(await bootTrace(page));
  });
});

// ── The splash itself (KICKOFF §6.1): frames, the React slot, offline, motion ──

/** What the browser actually played, observed from the first byte. */
interface SplashFrames {
  /** The frames' own start (the CSS animations' `startTime`), on `performance.now()`. */
  framesAt: number | null;
  /** When the exit began (`.app-splash-exiting`). */
  exitAt: number | null;
  /** The wordmark's opacity two frames after first paint. */
  wordmarkOpacityAtStart: string | null;
  /** The greeting line, if the slot rendered one. */
  greeting: string | null;
  /** The slot rendered its block / progress (bar + ticker), and when the block landed. */
  block: boolean;
  blockAt: number | null;
  progress: boolean;
  /** The bar's and the ticker's computed transforms, sampled as the block lands. */
  barTransform: string | null;
  tickerTransform: string | null;
}

const TRACE_FRAMES = `
(() => {
  const trace = {
    framesAt: null, exitAt: null, wordmarkOpacityAtStart: null, greeting: null,
    block: false, blockAt: null, progress: false, barTransform: null, tickerTransform: null,
  };
  window.__splashFrames = trace;
  const byId = (root, id) => root.querySelector('[data-testid="' + id + '"]');
  const framesStart = (splash) => {
    if (typeof splash.getAnimations !== 'function') return null;
    const starts = splash.getAnimations({ subtree: true })
      .map((animation) => animation.startTime)
      .filter((time) => typeof time === 'number');
    return starts.length ? Math.min(...starts) : null;
  };
  // Read the bar and the ticker as the block lands: on the normal beat they
  // have not started yet; under reduced motion they are drawn at their end.
  const sampleBlock = (splash) => {
    const bar = byId(splash, 'app-splash-bar');
    const ticker = byId(splash, 'app-splash-ticker');
    if (bar) trace.barTransform = getComputedStyle(bar).transform;
    if (ticker) trace.tickerTransform = getComputedStyle(ticker).transform;
  };
  const check = () => {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    trace.framesAt = framesStart(splash) ?? trace.framesAt;
    if (trace.exitAt === null && splash.classList.contains('app-splash-exiting')) {
      trace.exitAt = performance.now();
    }
    const greeting = byId(splash, 'app-splash-greeting');
    if (greeting) trace.greeting = greeting.textContent;
    if (!trace.block && byId(splash, 'app-splash-block')) {
      trace.block = true;
      trace.blockAt = performance.now();
      sampleBlock(splash);
    }
    if (byId(splash, 'app-splash-progress')) trace.progress = true;
  };
  new MutationObserver(check).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const splash = document.getElementById('app-splash');
      const wordmark = splash && byId(splash, 'app-splash-wordmark');
      if (wordmark) trace.wordmarkOpacityAtStart = getComputedStyle(wordmark).opacity;
      if (splash) trace.framesAt = framesStart(splash) ?? trace.framesAt;
    }));
  });
})();
`;

/** Wait for the splash to leave, then read what it played. */
async function splashFrames(page: Page): Promise<SplashFrames> {
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });
  return page.evaluate(
    () => (window as unknown as { __splashFrames: SplashFrames }).__splashFrames,
  );
}

/** How long the splash had been on screen when its exit began. */
function exitAfterMs(trace: SplashFrames): number {
  expect(trace.framesAt, 'the frames started').not.toBeNull();
  expect(trace.exitAt, 'the splash exited').not.toBeNull();
  return (trace.exitAt ?? 0) - (trace.framesAt ?? 0);
}

/**
 * Serve the app from what an earlier online visit loaded, the way the service
 * worker's precache does on a real device: GETs answered once are replayed
 * while offline; anything else — the API above all — fails as it would with no
 * network. The dev server has no service worker of its own, and without one an
 * offline reload is the browser's error page (out of scope, KICKOFF §6.1).
 */
async function serveShellWhileOffline(
  page: Page,
  context: BrowserContext,
): Promise<(offline: boolean) => Promise<void>> {
  const shell = new Map<
    string,
    { status: number; headers: Record<string, string>; body: Buffer }
  >();
  let offline = false;
  await page.route('**/*', async (route) => {
    const request = route.request();
    // The dev server's HMR client pings for the server and reloads the page the
    // moment it answers. Keep it out, so the only reload here is Retry's.
    if (request.headers().accept === 'text/x-vite-ping') {
      await route.abort('internetdisconnected');
      return;
    }
    if (offline) {
      const cached = shell.get(request.url());
      if (cached) await route.fulfill(cached);
      else await route.abort('internetdisconnected');
      return;
    }
    const response = await route.fetch();
    // The backend (`/api/…`) is never part of the shell; source modules under
    // `/src/…/api/` are.
    if (
      request.method() === 'GET' &&
      !new URL(request.url()).pathname.startsWith('/api/')
    ) {
      // The body is stored decoded: its encoding and length no longer apply.
      const headers = Object.fromEntries(
        Object.entries(response.headers()).filter(
          ([name]) => name !== 'content-encoding' && name !== 'content-length',
        ),
      );
      shell.set(request.url(), {
        status: response.status(),
        headers,
        body: await response.body(),
      });
    }
    await route.fulfill({ response });
  });
  return async (value) => {
    offline = value;
    await context.setOffline(value);
  };
}

/**
 * A signed-in member — with a refresh cookie, so a cold load restores the
 * session — of a team organization they own (role home: Today). The org is made
 * through the API: the clinic shell has no organization switcher.
 */
async function signInToNewTeamOrganization(page: Page): Promise<string> {
  await registerNewUserAndGoToDashboard(page);
  const { slug } = await createTeamOrgViaApi(page);
  return slug;
}

test.describe('Splash — frames, slot, offline hold, reduced motion', () => {
  test('a guest boot plays frames 1–4 and leaves no earlier than the wordmark lands', async ({
    page,
  }) => {
    await page.addInitScript(TRACE_FRAMES);
    await page.goto('/login');

    await expect(
      page.getByRole('status', { name: `Loading ${PRODUCT_NAME}` }),
    ).toBeVisible();
    await expectLoginFormReady(page);
    const trace = await splashFrames(page);

    expect(trace.wordmarkOpacityAtStart, 'the wordmark waits for its beat').toBe('0');
    expect(trace.block, 'a guest boot shows frames 1–4 only').toBe(false);
    expect(exitAfterMs(trace)).toBeGreaterThanOrEqual(SPLASH_FRAMES_MS - 5);
  });

  test('reduced motion lands every frame at once and may leave from 500ms', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(TRACE_FRAMES);
    await page.goto('/login');

    await expectLoginFormReady(page);
    const trace = await splashFrames(page);

    expect(trace.wordmarkOpacityAtStart, 'the wordmark is there at once').toBe('1');
    expect(exitAfterMs(trace)).toBeGreaterThanOrEqual(SPLASH_REDUCED_FRAMES_MS - 5);
  });

  test('a member’s first load of the org layout greets them and lands on the role home', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
    const slug = await signInToNewTeamOrganization(page);

    // A bare org URL, cold: the splash plays the greeting block, then the
    // cross-fade lands on the owner's role home — Today, never Leads (D25).
    await page.addInitScript(TRACE_FRAMES);
    await page.goto(`/organization/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/today$`), {
      timeout: 30_000,
    });
    await expect(byTestId(page, 'today-page')).toBeVisible({ timeout: 30_000 });

    const trace = await splashFrames(page);
    expect(trace.greeting).toMatch(/^Good (morning|afternoon|evening), \S/);
    expect(trace.progress, 'online: the bar and ticker, not the notice').toBe(true);
    expect(trace.blockAt, 'the block is on the splash before it leaves').toBeLessThan(
      trace.exitAt ?? 0,
    );
    expect(exitAfterMs(trace)).toBeGreaterThanOrEqual(SPLASH_FRAMES_MS - 5);

    // Reduced motion: the same block, already at its end state — a full bar,
    // the ticker on "All set" (−36px) — even though the exit may start at 500ms.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/organization/${slug}`);
    await expect(byTestId(page, 'today-page')).toBeVisible({ timeout: 30_000 });
    const reduced = await splashFrames(page);
    expect(reduced.greeting).toMatch(/^Good (morning|afternoon|evening), \S/);
    expect(reduced.blockAt).toBeLessThan(reduced.exitAt ?? 0);
    expect(reduced.barTransform, 'the bar is full: never scaled').toBe('none');
    expect(reduced.tickerTransform, 'the ticker sits on "All set"').toBe(
      'matrix(1, 0, 0, 1, 0, -36)',
    );
  });

  test('offline at mount, the splash holds with the notice — only Retry leaves', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const setOffline = await serveShellWhileOffline(page, context);

    // Online first, as a device that has run the app before: an org deep link
    // loads the splash slot (the guard then sends the guest to sign in), and the
    // start URL is the shell the service worker serves offline.
    await page.goto('/organization/e2e-offline/today');
    await expectLoginFormReady(page);
    await page.goto('/');
    await expectLoginFormReady(page);
    await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });

    // Offline, the app opened from its start URL — as an installed PWA does.
    await setOffline(true);
    await page.goto('/');

    const notice = page
      .getByRole('alert')
      .filter({ hasText: `Can’t reach ${PRODUCT_NAME}` });
    await expect(byTestId(page, 'app-splash-offline')).toBeVisible({ timeout: 30_000 });
    await expect(notice).toContainText(
      `Can’t reach ${PRODUCT_NAME} · check the internet connection`,
    );
    await expect(notice.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(byTestId(page, 'app-splash-progress')).toHaveCount(0);

    // No exit runs, and the 8s hand-off to React's own loader is suspended:
    // wait out that ceiling and prove nothing happened.
    await page.waitForTimeout(9000);
    await expect(page.locator('#app-splash')).toBeVisible();
    await expect(page.locator('#app-splash')).not.toHaveClass(/app-splash-exiting/);

    // Retry loads the app again where it was opened — the guard moved the URL
    // to /login under the splash — so, still offline, it is held again.
    await Promise.all([page.waitForEvent('load'), clickTestId(page, 'app-splash-retry')]);
    await expect(byTestId(page, 'app-splash-offline')).toBeVisible({ timeout: 30_000 });

    // Back online, Retry boots the app.
    await setOffline(false);
    await clickTestId(page, 'app-splash-retry');
    await expectLoginFormReady(page);
    await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });
  });
});
