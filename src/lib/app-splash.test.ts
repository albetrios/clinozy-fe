import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import {
  appSplashElapsedMs,
  appSplashSlotHost,
  dismissAppSplash,
  holdAppSplash,
  holdAppSplashOffline,
  isAppSplashActive,
  labelAppSplash,
  markAppContentPending,
  markAppContentSettled,
  onAppSplashDismissed,
  reloadFromAppSplash,
  SPLASH_BLOCK_AT_MS,
  SPLASH_FRAMES_MS,
  SPLASH_REDUCED_FRAMES_MS,
} from './app-splash.ts';

const isFading = () =>
  document.getElementById('app-splash')?.classList.contains('app-splash-exiting') ??
  false;
const isGone = () => document.getElementById('app-splash') === null;

/**
 * Fake timers with the splash's frames already played — the wordmark has
 * landed, so only the hold/grace mechanics below decide the exit. (Under fake
 * timers `performance.now()` starts at 0, the splash's time origin in jsdom.)
 */
function fakeClockPastTheWordmark() {
  vi.useFakeTimers();
  vi.advanceTimersByTime(SPLASH_FRAMES_MS);
}

/** `prefers-reduced-motion: reduce`, as the OS would report it. */
function preferReducedMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );
}

describe('app-splash', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const splash = document.createElement('div');
    splash.id = 'app-splash';
    const slot = document.createElement('div');
    slot.className = 'app-splash-slot';
    splash.append(slot);
    document.body.append(splash, document.createElement('div'));
    document.body.lastElementChild!.id = 'root';
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('isAppSplashActive reflects the boot overlay', () => {
    expect(isAppSplashActive()).toBe(true);
    document.getElementById('app-splash')?.remove();
    expect(isAppSplashActive()).toBe(false);
  });

  it('dismissAppSplash adds exit class and removes the node', () => {
    fakeClockPastTheWordmark();
    dismissAppSplash();
    // The fade waits out the grace window first, so a loader mounting a beat
    // after first paint gets its chance to hold instead of being blinked at.
    vi.advanceTimersByTime(250);
    expect(isFading()).toBe(true);
    vi.advanceTimersByTime(520);
    expect(isGone()).toBe(true);
  });

  it('onAppSplashDismissed fires immediately when splash is already gone', () => {
    document.getElementById('app-splash')?.remove();
    const spy = vi.fn();
    onAppSplashDismissed(spy);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('onAppSplashDismissed fires after dismissAppSplash', () => {
    fakeClockPastTheWordmark();
    const spy = vi.fn();
    onAppSplashDismissed(spy);
    dismissAppSplash();
    vi.advanceTimersByTime(250);
    vi.advanceTimersByTime(520);
    expect(spy).toHaveBeenCalledOnce();
  });

  describe('the slot it hands React', () => {
    it('finds the node the greeting block renders into', () => {
      expect(appSplashSlotHost()).toBe(document.querySelector('.app-splash-slot'));
    });

    it('has no slot once the splash is gone', () => {
      document.getElementById('app-splash')?.remove();
      expect(appSplashSlotHost()).toBeNull();
    });

    describe('Retry', () => {
      const realLocation = window.location;
      const bootUrl = realLocation.href;
      let reload: ReturnType<typeof vi.fn>;
      let replace: ReturnType<typeof vi.fn>;

      function locationAt(href: string) {
        reload = vi.fn();
        replace = vi.fn();
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: { ...realLocation, href, reload, replace },
        });
      }

      afterEach(() => {
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: realLocation,
        });
      });

      it('reloads the page when nothing moved under the splash', () => {
        locationAt(`${bootUrl}#settings/account/profile`);
        reloadFromAppSplash();
        expect(reload).toHaveBeenCalledOnce();
        expect(replace).not.toHaveBeenCalled();
      });

      it('goes back to the URL the app was opened at when a guard redirected', () => {
        // Offline at `/`, the guard sent the guest to `/login` under the splash —
        // and offline the service worker only serves the shell at the start URL.
        locationAt(new URL('/login?redirect=%2F', bootUrl).href);
        reloadFromAppSplash();
        expect(replace).toHaveBeenCalledWith(bootUrl);
        expect(reload).not.toHaveBeenCalled();
      });
    });

    it('swaps in the translated label for assistive technology', () => {
      labelAppSplash(`Chargement de ${PRODUCT_NAME}`);
      expect(document.getElementById('app-splash')).toHaveAttribute(
        'aria-label',
        `Chargement de ${PRODUCT_NAME}`,
      );
    });
  });

  // ── Frames 1–4 always play: the exit waits for the wordmark (Q-S1) ──

  describe('exit on boot, never before the wordmark lands', () => {
    it(`a boot that resolves at once still leaves at ${SPLASH_FRAMES_MS}ms, not before`, () => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(120); // React's first paint
      dismissAppSplash();
      markAppContentSettled();

      vi.advanceTimersByTime(SPLASH_FRAMES_MS - 121);
      expect(isFading()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isFading()).toBe(true);
    });

    it('a slow boot leaves when it resolves — the floor adds nothing after it', () => {
      vi.useFakeTimers();
      const release = holdAppSplash(); // the boot's pending loader
      vi.advanceTimersByTime(120);
      dismissAppSplash();

      vi.advanceTimersByTime(3000);
      expect(isFading()).toBe(false);
      markAppContentSettled();
      release();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);
    });

    it('a loader that mounts while it waits for the wordmark keeps the splash up', () => {
      vi.useFakeTimers();
      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(1000);

      const release = holdAppSplash();
      vi.advanceTimersByTime(SPLASH_FRAMES_MS);
      expect(isFading()).toBe(false);

      release();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);
    });

    it('is counted from the frames’ own start when the browser reports it', () => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(400);
      // The CSS animations started with the first paint, 300ms after navigation.
      const splash = document.getElementById('app-splash')!;
      splash.getAnimations = () => [
        { startTime: 300 } as Animation,
        { startTime: null } as Animation,
      ];
      expect(appSplashElapsedMs()).toBe(100);

      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(SPLASH_FRAMES_MS - 101);
      expect(isFading()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isFading()).toBe(true);
    });

    it('falls back to the time origin without the Web Animations API', () => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(700);
      expect(appSplashElapsedMs()).toBe(700);
    });

    it('cross-fades over 500ms and removes the layer at exit + 520ms', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);

      vi.advanceTimersByTime(519);
      expect(isGone()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isGone()).toBe(true);
    });

    it('the transition ending removes it at once', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(32);

      document.getElementById('app-splash')!.dispatchEvent(new Event('transitionend'));
      expect(isGone()).toBe(true);
    });
  });

  describe('reduced motion', () => {
    it(`may leave from ${SPLASH_REDUCED_FRAMES_MS}ms and removes the layer by 580ms`, () => {
      preferReducedMotion();
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      dismissAppSplash();
      markAppContentSettled();

      vi.advanceTimersByTime(SPLASH_REDUCED_FRAMES_MS - 101);
      expect(isFading()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isFading()).toBe(true);

      vi.advanceTimersByTime(79);
      expect(isGone()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isGone()).toBe(true);
    });
  });

  // ── Offline at mount: frames 1–5, the notice, and only Retry leaves ──

  describe('offline hold', () => {
    it('never exits on its own — not even past the 8s ceiling', () => {
      vi.useFakeTimers();
      holdAppSplashOffline();
      dismissAppSplash();
      markAppContentSettled();

      vi.advanceTimersByTime(60_000);
      expect(isFading()).toBe(false);
      expect(isGone()).toBe(false);
    });

    it('suspends a ceiling that was already running', () => {
      vi.useFakeTimers();
      dismissAppSplash();
      holdAppSplash(); // a pending loader
      vi.advanceTimersByTime(1000);

      holdAppSplashOffline();
      vi.advanceTimersByTime(60_000);
      expect(isGone()).toBe(false);
    });

    it('puts a fade in flight back', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);

      holdAppSplashOffline();
      vi.advanceTimersByTime(1000);
      expect(isFading()).toBe(false);
      expect(isGone()).toBe(false);
    });

    it('lets go — and re-arms the ceiling — only if the slot unmounts', () => {
      fakeClockPastTheWordmark();
      const release = holdAppSplashOffline();
      dismissAppSplash();
      vi.advanceTimersByTime(10_000);
      expect(isGone()).toBe(false);

      // The slot holding the Retry went away: never leave a splash with no way out.
      const stuck = holdAppSplash();
      release();
      vi.advanceTimersByTime(8000);
      expect(isFading()).toBe(true);
      stuck();
    });

    it('is a no-op once the splash is gone', () => {
      document.getElementById('app-splash')?.remove();
      const release = holdAppSplashOffline();
      expect(() => release()).not.toThrow();
      expect(isGone()).toBe(true);
    });
  });

  describe('holds', () => {
    it.each([70, 300])(
      'still times out when a hold arrives %ims after dismissal',
      (delay) => {
        fakeClockPastTheWordmark();
        dismissAppSplash();
        vi.advanceTimersByTime(delay);
        holdAppSplash();

        vi.advanceTimersByTime(8000 + 520 - delay);

        expect(isGone()).toBe(true);
      },
    );

    it('cannot cancel the forced exit with another hold after the deadline', () => {
      fakeClockPastTheWordmark();
      holdAppSplash();
      dismissAppSplash();
      vi.advanceTimersByTime(8000);
      holdAppSplash();
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(true);
    });

    // The boot splash and FullPageSpinner are the same visual. Before holds, the
    // splash eased out at React's first paint and the React loader popped back in
    // a frame later — one bootstrap that read as the screen blinking twice.
    it('keeps the splash up while a hold is outstanding', () => {
      fakeClockPastTheWordmark();
      holdAppSplash();

      dismissAppSplash();
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(false);
      expect(isFading()).toBe(false);
    });

    it('exits once the last hold releases', () => {
      fakeClockPastTheWordmark();
      const releaseA = holdAppSplash();
      const releaseB = holdAppSplash();
      dismissAppSplash();

      releaseA();
      vi.advanceTimersByTime(520);
      expect(isGone()).toBe(false);

      releaseB();
      vi.advanceTimersByTime(250); // release re-checks after the grace window
      vi.advanceTimersByTime(520);
      expect(isGone()).toBe(true);
    });

    it('releasing twice does not double-count', () => {
      fakeClockPastTheWordmark();
      const release = holdAppSplash();
      holdAppSplash();
      dismissAppSplash();

      release();
      release();
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(false);
    });

    it('a hold taken mid-exit puts the fade back', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      vi.advanceTimersByTime(250);
      expect(isFading()).toBe(true);

      holdAppSplash();
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(false);
      expect(isFading()).toBe(false);
    });

    // The OAuth callback handoff drops to zero holds for ~70ms between the
    // outgoing loader unmounting and the next one mounting. Exiting on that gap
    // dimmed the splash and snapped it back to full opacity — the blink again.
    it('does not even start fading when the next hold lands inside the grace window', () => {
      fakeClockPastTheWordmark();
      const release = holdAppSplash();
      dismissAppSplash();

      release();
      vi.advanceTimersByTime(70); // route handoff gap
      holdAppSplash();
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(false);
      expect(isFading()).toBe(false);
    });

    it('gives up after MAX_HOLD_MS so a stuck bootstrap cannot trap the user', () => {
      fakeClockPastTheWordmark();
      holdAppSplash();
      dismissAppSplash();

      vi.advanceTimersByTime(8000);
      vi.advanceTimersByTime(520);

      expect(isGone()).toBe(true);
    });

    it('never resurrects a splash that is already gone', () => {
      fakeClockPastTheWordmark();
      document.getElementById('app-splash')?.remove();

      const release = holdAppSplash();
      release();

      expect(isGone()).toBe(true);
    });

    it('does not hold a splash that no loader asked for', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      vi.advanceTimersByTime(250);
      vi.advanceTimersByTime(520);
      expect(isGone()).toBe(true);
    });
  });

  // ── The router has settled: the grace window is no longer a guess worth making ──

  describe('settled content (markAppContentSettled)', () => {
    it('leaves within frames once the router has settled, not after the grace window', () => {
      // Regression: the login form (or the dashboard) sat fully rendered behind
      // an opaque overlay for a fixed 250ms on every cold load — a wait for a
      // "next loader" that, once the router has resolved, is never coming.
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();

      vi.advanceTimersByTime(31);
      expect(isFading()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(isFading()).toBe(true);
    });

    it('brings an exit check that is already waiting on the grace window forward', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      vi.advanceTimersByTime(100); // 150ms of grace still to run
      markAppContentSettled();

      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);
    });

    it('still waits for a hold — settled is not the same as ready', () => {
      // The org shell mounts a loader while its lazy layout arrives. The router
      // is resolved by then; the screen is not.
      fakeClockPastTheWordmark();
      const release = holdAppSplash();
      dismissAppSplash();
      markAppContentSettled();

      vi.advanceTimersByTime(2000);
      expect(isFading()).toBe(false);

      release();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);
    });

    it('lets a hold taken in the same commit land first', () => {
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();
      // A layout effect in the commit the router just resolved.
      const release = holdAppSplash();

      vi.advanceTimersByTime(500);
      expect(isFading()).toBe(false);
      release();
    });

    it('goes back to the grace window once another navigation starts', () => {
      // The OAuth callback → next screen handoff: the outgoing loader unmounts a
      // few frames before the incoming one mounts. Exiting on that gap is the
      // blink the grace window exists to prevent.
      fakeClockPastTheWordmark();
      const releaseOutgoing = holdAppSplash();
      dismissAppSplash();
      markAppContentSettled();
      markAppContentPending();

      releaseOutgoing();
      vi.advanceTimersByTime(70);
      expect(isFading()).toBe(false);
      const releaseIncoming = holdAppSplash();

      vi.advanceTimersByTime(1000);
      expect(isFading()).toBe(false);
      releaseIncoming();
    });

    it('does nothing before a dismissal was requested', () => {
      // React has not painted yet: settling must not start a fade on its own.
      fakeClockPastTheWordmark();
      markAppContentSettled();

      vi.advanceTimersByTime(1000);
      expect(isFading()).toBe(false);

      // …but the dismissal that follows takes the short path straight away.
      dismissAppSplash();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);
    });

    it('is a no-op once the splash is gone', () => {
      document.getElementById('app-splash')?.remove();

      expect(() => {
        markAppContentSettled();
        markAppContentPending();
      }).not.toThrow();
      expect(isGone()).toBe(true);
    });

    it('does not leak "settled" into a fresh overlay', () => {
      fakeClockPastTheWordmark();
      markAppContentSettled();
      // The node is removed on exit and remade between tests/boots.
      document.getElementById('app-splash')?.remove();
      const next = document.createElement('div');
      next.id = 'app-splash';
      document.body.prepend(next);

      dismissAppSplash();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(false);
      vi.advanceTimersByTime(218);
      expect(isFading()).toBe(true);
    });
  });

  // ── index.html owns the frames and the fade; this module owns when they end ──

  describe('index.html drift', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const html = readFileSync(join(root, 'index.html'), 'utf8');

    it('sets the wordmark left to right, so an RTL boot does not reverse its parts', () => {
      const tag =
        /<span[^>]*data-testid="app-splash-wordmark"[^>]*>/.exec(html)?.[0] ?? '';
      expect(tag).toContain('dir="ltr"');
    });

    /** The `animation` shorthand of one rule in the splash's stylesheet. */
    function animationOf(selector: string): string {
      const start = html.indexOf(`${selector} {`);
      expect(start, `${selector} is styled in index.html`).toBeGreaterThan(-1);
      const body = html.slice(start, html.indexOf('}', start));
      const at = body.indexOf('animation:');
      if (at === -1) return '';
      return body
        .slice(at + 'animation:'.length, body.indexOf(';', at))
        .replaceAll(/\s+/g, ' ')
        .trim();
    }

    // KICKOFF §6.1 → Frames (`splash.md:65–76`; H:517–520).
    it.each([
      [
        '.app-splash-mark',
        'app-splash-mark 700ms cubic-bezier(0.2, 0.9, 0.25, 1.05) 50ms both',
      ],
      [
        '.app-splash-halo',
        'app-splash-halo 1400ms cubic-bezier(0.2, 0.8, 0.2, 1) 550ms both',
      ],
      [
        '.app-splash-c',
        'app-splash-c 700ms cubic-bezier(0.65, 0, 0.35, 1) 550ms forwards',
      ],
      [
        '.app-splash-dot',
        'app-splash-dot 500ms cubic-bezier(0.34, 1.4, 0.64, 1) 1150ms forwards',
      ],
      [
        '.app-splash-word',
        'app-splash-word 800ms cubic-bezier(0.16, 1, 0.3, 1) 1250ms both',
      ],
      [
        '.app-splash-block',
        'app-splash-up 500ms ease var(--app-splash-block-delay, 1900ms) both',
      ],
      [
        '.app-splash-bar',
        'app-splash-bar 1500ms cubic-bezier(0.4, 0, 0.2, 1) calc(var(--app-splash-block-delay, 1900ms) + 150ms) both',
      ],
      [
        '.app-splash-reel',
        'app-splash-tick 1500ms cubic-bezier(0.65, 0, 0.35, 1) calc(var(--app-splash-block-delay, 1900ms) + 150ms) both',
      ],
    ])('plays %s on the design’s beat', (selector, animation) => {
      expect(animationOf(selector)).toBe(animation);
    });

    it('lands the wordmark exactly where the exit floor waits for it', () => {
      const [, duration, delay] =
        /^app-splash-word (\d+)ms cubic-bezier\([^)]*\) (\d+)ms both$/.exec(
          animationOf('.app-splash-word'),
        ) ?? [];
      expect(Number(duration) + Number(delay)).toBe(SPLASH_FRAMES_MS);
    });

    it('rises the greeting block on the beat the slot counts from', () => {
      expect(animationOf('.app-splash-block')).toContain(
        `var(--app-splash-block-delay, ${SPLASH_BLOCK_AT_MS}ms)`,
      );
    });

    it('steps the ticker 0 → −18px → −36px', () => {
      const start = html.indexOf('@keyframes app-splash-tick');
      const body = html.slice(start, html.indexOf('@media', start));
      expect(body.replaceAll(/\s+/g, ' ')).toContain(
        '0%, 30% { transform: translateY(0); } 40%, 66% { transform: translateY(-18px); } 76%, 100% { transform: translateY(-36px); }',
      );
    });

    it('cross-fades: the splash out over 500ms, the app in over 450ms', () => {
      expect(html).toMatch(
        /#app-splash \{[^}]*?opacity 500ms ease,\s*visibility 500ms ease/s,
      );
      expect(html).toMatch(/#root \{\s*transition: opacity 450ms ease;/);
      expect(html).toMatch(
        /#app-splash:not\(\.app-splash-exiting\) ~ #root \{\s*opacity: 0;/,
      );
    });

    it('enters the app from a first frame above 0, so Chrome records its LCP', () => {
      // Chrome records no Largest Contentful Paint for a paint at opacity 0, and a
      // composited fade from exactly 0 never paints the page again — every boot
      // ended without an LCP and Lighthouse's performance score was empty. A
      // negative delay starts the entering fade one frame in; only the entering
      // rule carries it, so a fade taken back still runs from where it is.
      const delay =
        /#app-splash\.app-splash-exiting ~ #root \{\s*transition-delay: (-?\d+)ms;/.exec(
          html,
        )?.[1];
      expect(Number(delay)).toBeLessThan(0);
      expect(Number(delay)).toBeGreaterThan(-50);
      expect(html).not.toMatch(
        /#app-splash:not\(\.app-splash-exiting\) ~ #root \{[^}]*transition-delay/,
      );
    });

    it('draws the mark from a first frame above 0, so Chrome records the first paint', () => {
      // The same compositor rule as the app's fade, for First Contentful Paint: a
      // mark fading in from exactly 0 is never painted as content, so FCP waited
      // for the "C" to start drawing (or for the app). Its first frame stays
      // invisible — the frames' beat is pinned above — but it is no longer 0.
      const start = html.indexOf('@keyframes app-splash-mark');
      const from = /from \{\s*opacity: ([\d.]+);/.exec(html.slice(start))?.[1];
      expect(Number(from)).toBeGreaterThan(0);
      expect(Number(from)).toBeLessThanOrEqual(0.05);
    });

    it('never cuts that fade short, and never outlives it by much', () => {
      // `transitionend` normally removes the node. The timer is the fallback for
      // a tab that never fires it — too short and it hard-cuts the fade, too long
      // and an inert overlay sits on the page.
      const fadeMs = Number(/#app-splash \{[^}]*?opacity (\d+)ms/s.exec(html)?.[1]);
      fakeClockPastTheWordmark();
      dismissAppSplash();
      markAppContentSettled();
      vi.advanceTimersByTime(32);
      expect(isFading()).toBe(true);

      vi.advanceTimersByTime(fadeMs);
      expect(isGone()).toBe(false);
      vi.advanceTimersByTime(100);
      expect(isGone()).toBe(true);
    });

    it('lands every frame at once under reduced motion, delays included', () => {
      const start = html.indexOf('@media (prefers-reduced-motion: reduce)');
      const body = html
        .slice(start, html.indexOf('</style>', start))
        .replaceAll(/\s+/g, ' ');
      expect(body).toContain('#app-splash *');
      expect(body).toContain('animation-delay: 0s !important');
      expect(body).toContain('animation-duration: 1ms !important');
      expect(body).toContain('transition-duration: 1ms !important');
      // The block, a full bar and "All set" are drawn, not animated, at once.
      expect(body).toContain(
        '.app-splash-block, .app-splash-bar, .app-splash-reel { animation: none !important; }',
      );
      expect(body).toContain('.app-splash-reel { transform: translateY(-36px); }');
    });

    it('carries no copy — every string comes from the slot, translated (Q-S1)', () => {
      const start = html.indexOf('<div id="app-splash"');
      const markup = html.slice(start, html.indexOf('<div id="root">', start));
      const text = new DOMParser()
        .parseFromString(markup, 'text/html')
        .body.textContent?.replaceAll('{{PRODUCT_WORDMARK}}', '')
        .trim();
      expect(text).toBe('');
      expect(markup).toContain('aria-label="Loading {{PRODUCT_NAME}}"');
      expect(markup).toContain('class="app-splash-slot"');
    });
  });
});
