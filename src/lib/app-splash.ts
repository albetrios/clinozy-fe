/**
 * HTML boot splash lives outside `#root` until React fades it out.
 *
 * `index.html` draws it and owns every frame (KICKOFF §6.1): CSS keyframes, so
 * the mark plays before any JS. This module owns when it LEAVES — never before
 * the wordmark lands, never while a loader holds it, never while the device was
 * offline at mount — and gives the React slot (`AppSplashSlot`) the splash's
 * clock and the node it renders the greeting block into. One load skips it: the
 * one right after a sign-out ({@link APP_SPLASH_SKIP}).
 */

const SPLASH_ID = 'app-splash';
const EXIT_CLASS = 'app-splash-exiting';
const SLOT_CLASS = 'app-splash-slot';
const DISMISS_EVENT = 'app-splash-dismissed';

/**
 * The load right after a sign-out skips the splash: the class `public/splash-init.js`
 * puts on `<html>` before the first paint, for index.html's CSS and for this module,
 * when it finds this sessionStorage key — which `forceLogout()` writes
 * (`skipSplashOnNextLoad` in `shared/auth/service.ts`). On that load the splash is hidden and `#root` shown, and
 * nothing paints until the login screen has rendered — so browsers keep the page
 * being left on screen until then. The splash node stays (hidden), so the loaders'
 * holds still keep React's own full-page loader away. Pinned across the files by
 * `app-splash.test.ts` and `service.test.ts`.
 */
export const APP_SPLASH_SKIP = 'app-splash-skip';

/**
 * The `#app-splash` opacity/visibility transition in index.html (500ms ease,
 * `splash.md:75`) plus slack — the layer is removed at exit + 520ms. Keep the two
 * in step: `transitionend` normally removes the node, this is the fallback for a
 * tab that never fires it.
 */
const EXIT_FALLBACK_MS = 520;

/**
 * The same fallback under reduced motion, where every splash transition is 1ms:
 * exit at 500ms, layer removed at 580ms (`splash.md:46`; H:4504's `+80`).
 */
const REDUCED_EXIT_FALLBACK_MS = 80;

/**
 * When the wordmark lands — frame 4 ends 2,050ms into the sequence (1,250ms delay
 * + 800ms, `index.html`). The exit never starts before it, however fast the boot
 * resolves (Q-S1): the splash leaves when boot resolves, not on the prototype's
 * fixed 3,700ms timer.
 */
export const SPLASH_FRAMES_MS = 2050;

/**
 * Reduced motion: every frame is at its end state at once, and the exit may start
 * from 500ms (`splash.md:46, 78`).
 */
export const SPLASH_REDUCED_FRAMES_MS = 500;

/**
 * When the greeting block rises — frame 5, 1,900ms into the sequence. The React
 * slot renders the block whenever the session is ready and shifts its animation
 * delays so it still rises on this beat (or at once, when the session is late).
 */
export const SPLASH_BLOCK_AT_MS = 1900;

/**
 * Grace period between the last hold releasing and the fade actually starting.
 *
 * A route handoff drops to zero holds for a moment — the outgoing screen's loader
 * unmounts a few frames before the incoming one mounts. Exiting on that gap makes
 * the splash dim and then snap back to full opacity when the next hold arrives,
 * which is the blink all over again. Measured gap on the OAuth callback → next
 * screen handoff is ~70ms, so this is comfortably wider while staying far below
 * the threshold where a human reads it as lag.
 */
const EXIT_GRACE_MS = 250;

/**
 * How long to wait once the router says the destination is on screen.
 *
 * {@link EXIT_GRACE_MS} is a guess about the FUTURE — "another loader may be
 * about to mount" — and it is only right while a navigation is still in flight.
 * Once the router has resolved there is no next loader coming, and those 250ms
 * were pure dead time: the login form (or the dashboard) sat fully rendered
 * behind an opaque overlay, on every single cold load. Two frames is enough for a
 * hold taken in the same commit (a layout effect) to land first.
 */
const SETTLED_EXIT_DELAY_MS = 32;

/**
 * Ceiling on how long holds may keep the splash up once dismissal was requested.
 * A bootstrap that never resolves must not trap the user behind an inert HTML
 * overlay — past this the splash leaves and React's own loader takes the screen,
 * because that one can surface an error and a Retry. Suspended while the splash
 * is held offline: there, the splash's own Retry is the way out.
 */
const MAX_HOLD_MS = 8000;

/**
 * The URL the app was opened at, read when this module first evaluates — before
 * the router runs a single guard.
 */
const BOOT_URL = globalThis.location?.href ?? '';

/** The overlay these module-level counters describe; identity change ⇒ reset. */
let tracked: HTMLElement | null = null;
let holdCount = 0;
/** Holds taken because the device was offline at mount — they suspend the deadline. */
let offlineHoldCount = 0;
let dismissRequested = false;
let holdDeadlineReached = false;
/** The router has resolved: what is mounted is the destination, not a way-point. */
let contentSettled = false;
let exitFinish: (() => void) | undefined;
let exitTimer: number | undefined;
let holdDeadline: number | undefined;
let releaseTimer: number | undefined;

/**
 * The live overlay, resetting hold/dismiss state whenever the node identity
 * changes (it is removed on exit, and remade between tests). Keeps the counters
 * from outliving the element they were counting for.
 */
function currentSplash(): HTMLElement | null {
  const splash = document.getElementById(SPLASH_ID);
  if (splash !== tracked) {
    tracked = splash;
    holdCount = 0;
    offlineHoldCount = 0;
    dismissRequested = false;
    holdDeadlineReached = false;
    contentSettled = false;
    exitFinish = undefined;
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    exitTimer = undefined;
    if (holdDeadline !== undefined) window.clearTimeout(holdDeadline);
    holdDeadline = undefined;
    if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
    releaseTimer = undefined;
  }
  return splash;
}

/** True while the pre-React `#app-splash` overlay is still in the document. */
export function isAppSplashActive(): boolean {
  return currentSplash() != null;
}

/** The node inside `#app-splash` the React slot renders the greeting block into. */
export function appSplashSlotHost(): HTMLElement | null {
  return currentSplash()?.querySelector<HTMLElement>(`.${SLOT_CLASS}`) ?? null;
}

/**
 * Name the splash for assistive technology. The HTML carries the English label
 * (`Loading {{PRODUCT_NAME}}`); the slot swaps in the translated one once i18n
 * is up (Q-S1).
 */
export function labelAppSplash(label: string): void {
  currentSplash()?.setAttribute('aria-label', label);
}

/** The OS asks for reduced motion — every frame then shows its end state at once. */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Milliseconds since the splash frames started — the clock every frame's delay
 * counts from. The frames are CSS animations that start with the first paint, so
 * their own start time is the truth. Without the Web Animations API (jsdom, old
 * engines) the document's time origin stands in: navigation start, never later
 * than the first paint.
 */
export function appSplashElapsedMs(): number {
  const now = performance.now();
  const splash = currentSplash();
  if (!(splash && typeof splash.getAnimations === 'function')) return now;
  let start = Number.POSITIVE_INFINITY;
  for (const animation of splash.getAnimations({ subtree: true })) {
    const at = animation.startTime;
    if (typeof at === 'number' && at < start) start = at;
  }
  return Number.isFinite(start) ? now - start : now;
}

/** This load skips the splash (`public/splash-init.js` read the key). */
function isAppSplashSkipped(): boolean {
  return document.documentElement.classList.contains(APP_SPLASH_SKIP);
}

/**
 * How long until the exit may start: the wordmark (or, reduced, 500ms) has to
 * land first — unless this load skips the splash, which then has no frames to wait for.
 */
function framesRemainingMs(): number {
  if (isAppSplashSkipped()) return 0;
  const floor = prefersReducedMotion() ? SPLASH_REDUCED_FRAMES_MS : SPLASH_FRAMES_MS;
  return Math.max(0, floor - appSplashElapsedMs());
}

/** Subscribe once when the boot splash finishes its exit transition (or is removed). */
export function onAppSplashDismissed(callback: () => void): () => void {
  if (!isAppSplashActive()) {
    callback();
    return () => undefined;
  }
  window.addEventListener(DISMISS_EVENT, callback, { once: true });
  return () => window.removeEventListener(DISMISS_EVENT, callback);
}

/** Start the fade-out and remove the node when it lands. */
function runExit(): void {
  const splash = currentSplash();
  if (!splash || exitFinish) return;

  splash.classList.add(EXIT_CLASS);

  const finish = () => {
    if (holdDeadline !== undefined) window.clearTimeout(holdDeadline);
    holdDeadline = undefined;
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    exitTimer = undefined;
    exitFinish = undefined;
    splash.removeEventListener('transitionend', finish);
    splash.remove();
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
  };

  exitFinish = finish;
  splash.addEventListener('transitionend', finish, { once: true });
  // A skipped splash fades nothing anyone can see, so it goes as fast as a reduced one.
  exitTimer = window.setTimeout(
    finish,
    prefersReducedMotion() || isAppSplashSkipped()
      ? REDUCED_EXIT_FALLBACK_MS
      : EXIT_FALLBACK_MS,
  );
}

/** Put a mid-flight fade back to full opacity — the app was not ready after all. */
function cancelExit(): void {
  const splash = currentSplash();
  if (!(splash && exitFinish)) return;

  splash.removeEventListener('transitionend', exitFinish);
  if (exitTimer !== undefined) window.clearTimeout(exitTimer);
  exitTimer = undefined;
  exitFinish = undefined;
  splash.classList.remove(EXIT_CLASS);
}

/** Nothing holds the splash and React asked it to go: exit, once the frames allow. */
function exitIfReleased(): void {
  if (!(holdCount === 0 && dismissRequested)) return;
  const remaining = framesRemainingMs();
  if (remaining <= 0) {
    runExit();
    return;
  }
  // Boot beat the wordmark: wait for it. A hold taken meanwhile clears this
  // timer, exactly as it clears the grace window below.
  releaseTimer = window.setTimeout(() => {
    releaseTimer = undefined;
    exitIfReleased();
  }, remaining);
}

/**
 * Re-check after {@link EXIT_GRACE_MS} instead of exiting the moment a hold drops
 * to zero. StrictMode remounts an effect as setup → cleanup → setup, and a route
 * swap unmounts one loader before the next mounts; both are a momentary zero that
 * must not start a fade the next hold then has to cancel.
 */
function scheduleExitCheck(): void {
  if (releaseTimer !== undefined) return;
  releaseTimer = window.setTimeout(
    () => {
      releaseTimer = undefined;
      exitIfReleased();
    },
    contentSettled ? SETTLED_EXIT_DELAY_MS : EXIT_GRACE_MS,
  );
}

/** Start the {@link MAX_HOLD_MS} ceiling — once, and never while held offline. */
function armHoldDeadline(): void {
  if (offlineHoldCount > 0) return;
  // Late route loaders may cancel a fade, but never extend the boot deadline.
  holdDeadline ??= window.setTimeout(() => {
    holdDeadline = undefined;
    holdDeadlineReached = true;
    holdCount = 0;
    runExit();
  }, MAX_HOLD_MS);
}

/**
 * The router finished resolving a navigation — the destination is mounted.
 *
 * From here a zero-hold moment is the real thing rather than a gap between two
 * loaders, so the splash may leave on the next frames instead of sitting out the
 * grace window. Any check already waiting on that window is brought forward.
 * Wired to the router's `onResolved` in `main.tsx` (this module cannot import it:
 * `lib` sits below `app`).
 */
export function markAppContentSettled(): void {
  if (!isAppSplashActive() || contentSettled) return;
  contentSettled = true;
  if (releaseTimer === undefined) return;
  window.clearTimeout(releaseTimer);
  releaseTimer = undefined;
  scheduleExitCheck();
}

/**
 * A navigation started — whatever is mounted is on its way out again, and the
 * next thing to mount may well be a loader. Back to the conservative grace
 * window (this is the OAuth callback → next screen handoff it was measured on).
 */
export function markAppContentPending(): void {
  if (!isAppSplashActive()) return;
  contentSettled = false;
}

/**
 * Keep the boot splash on screen while a full-page loader would otherwise
 * replace it, and release when that loader goes away.
 *
 * The splash and {@link FullPageSpinner} are the same visual, so handing off
 * between them mid-bootstrap reads as the loading screen blinking twice: the
 * HTML overlay fades to nothing at React's first paint, then an identical React
 * one pops back in at full opacity a frame later. Holding collapses that into a
 * single continuous screen that fades out once only, when real content is ready.
 *
 * Returns a release function; calling it more than once is a no-op. No-ops
 * entirely once the splash is gone — a loader shown later in the session is a
 * normal Suspense fallback and must never resurrect the boot overlay.
 */
export function holdAppSplash(): () => void {
  if (!isAppSplashActive() || holdDeadlineReached) return () => undefined;

  holdCount += 1;
  if (releaseTimer !== undefined) {
    window.clearTimeout(releaseTimer);
    releaseTimer = undefined;
  }
  cancelExit();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount = Math.max(0, holdCount - 1);
    if (holdCount === 0 && dismissRequested) scheduleExitCheck();
  };
}

/**
 * Hold the splash because the device was offline when the app mounted
 * (`navigator.onLine === false`, `splash.md:45`). Frames 1–5 play and the slot
 * shows the offline notice; no exit runs and the {@link MAX_HOLD_MS} hand-off is
 * suspended — only the notice's Retry (a reload) leaves.
 *
 * The release exists for the slot's unmount alone (so the splash is never held
 * with no Retry on it); it re-arms the ceiling. No-op once the splash is gone.
 */
export function holdAppSplashOffline(): () => void {
  if (!isAppSplashActive() || holdDeadlineReached) return () => undefined;

  offlineHoldCount += 1;
  if (holdDeadline !== undefined) {
    window.clearTimeout(holdDeadline);
    holdDeadline = undefined;
  }
  const release = holdAppSplash();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    offlineHoldCount = Math.max(0, offlineHoldCount - 1);
    if (dismissRequested) armHoldDeadline();
    release();
  };
}

/**
 * The offline splash's Retry (`splash.md:22`): load the app again, at the URL it
 * was opened at. While the splash held, the guards may have redirected underneath
 * it (`/` → `/login`), and offline the service worker serves the app shell for the
 * start URL — not for every path. A plain reload when nothing moved.
 */
export function reloadFromAppSplash(): void {
  const page = (href: string) => href.split('#')[0];
  if (!BOOT_URL || page(BOOT_URL) === page(window.location.href)) {
    window.location.reload();
    return;
  }
  window.location.replace(BOOT_URL);
}

/**
 * Fade out the HTML boot loader after React has painted underneath.
 * Idempotent — safe to call multiple times.
 *
 * With holds outstanding this only *records* the request: React has painted, but
 * what it painted is another loader, so the splash stays until the last
 * {@link holdAppSplash} releases (or {@link MAX_HOLD_MS} elapses). Either way it
 * never leaves before the wordmark has landed ({@link SPLASH_FRAMES_MS}).
 */
export function dismissAppSplash(): void {
  if (!isAppSplashActive()) return;

  dismissRequested = true;
  armHoldDeadline();

  if (holdCount > 0) return;

  // Never exit straight off first paint. React commits its shell a beat before
  // the route's loader mounts, so a splash that leaves on this tick fades part
  // way and is then yanked back when that loader takes its hold.
  scheduleExitCheck();
}

/** Wait for the next two animation frames (post-layout paint). */
export function afterPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}
