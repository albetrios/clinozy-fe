import { Link, Outlet } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { PageTransition } from '@/lib/animations/PageTransition.tsx';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { preloadCommandPalette } from '@/shared/components/CommandPalette/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { Compass, Search } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import {
  layoutMainClassName,
  resolveEffectiveLayoutWidth,
} from '@/shared/theme/layout-width.ts';

/** The nav entries a shell draws (`useAppNav`). */
export type NavItems = readonly AppNavEntry[];

/** "Skip to main content" — the shell's first focus stop. */
export function SkipLink() {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <a
      href="#main-content"
      className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:underline"
    >
      {t(LAYOUT_KEYS.a11y.skipToMain)}
    </a>
  );
}

/**
 * The section bar's ⌘K search (slot 6, `shell.md:23`; H:541): a 240px field
 * from `md`, a 36px icon button on a phone.
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { t } = useTranslation(LAYOUT_NS);
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const open = () => useUIStore.getState().setCommandPaletteOpen(true);
  const keys = LAYOUT_KEYS.app.sectionBar;
  return (
    <button
      type="button"
      onClick={open}
      onMouseEnter={preloadCommandPalette}
      onFocus={preloadCommandPalette}
      aria-label={t(keys.searchLabel)}
      title={t(isMac ? keys.searchTitleMac : keys.searchTitleWindows)}
      data-testid="search-trigger"
      className={cn(
        'bg-card text-muted-foreground hover:bg-muted flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg border transition-colors',
        'md:bg-canvas md:hover:border-border-strong md:text-body md:h-8 md:w-auto md:min-w-8 md:flex-[0_1_15rem] md:justify-start md:gap-2 md:overflow-hidden md:ps-2.25 md:pe-1.5',
        className,
      )}
    >
      <Search className="size-3.75 flex-none" aria-hidden />
      <span className="hidden min-w-0 flex-1 truncate text-start md:inline">
        {t(keys.searchPlaceholder)}
      </span>
      <kbd
        data-slot="kbd"
        className="bg-card text-muted-foreground text-tiny hidden h-5 flex-none items-center rounded-sm border px-1.5 font-mono md:flex"
      >
        {isMac
          ? t(LAYOUT_KEYS.app.searchShortcutMac)
          : t(LAYOUT_KEYS.app.searchShortcutWindows)}
      </kbd>
    </button>
  );
}

const tabSlotClassName =
  'flex min-w-0 flex-col items-center justify-center gap-0.75 rounded-lg [-webkit-tap-highlight-color:transparent]';
const tabPillClassName =
  'flex h-7 w-11.5 items-center justify-center rounded-full transition-colors duration-160';
const tabLabelClassName = 'max-w-full truncate px-0.5 text-tiny leading-[1.1]';

/** One tab-bar slot: a 46×28 icon pill over a 10.5px label, in the room's tone when current. */
function TabBarItem({
  entry,
  current,
  organizationSlug,
}: {
  entry: SectionBarEntry;
  current: boolean;
  organizationSlug: string;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const tone = TONE_CLASSES[entry.tone];
  return (
    <Link
      to={entry.to}
      params={{ organizationSlug }}
      activeOptions={{ exact: true }}
      aria-current={current ? 'page' : undefined}
      data-slot="nav-item"
      data-testid={`nav-${entry.id}`}
      className={cn(
        tabSlotClassName,
        current ? tone.ink : 'text-muted-foreground-strong',
      )}
    >
      <span
        data-slot="pill"
        className={cn(tabPillClassName, current ? tone.bg : 'text-muted-foreground')}
      >
        <entry.icon className="size-4" aria-hidden />
      </span>
      <span className={cn(tabLabelClassName, current ? 'font-semibold' : 'font-medium')}>
        {t(entry.labelKey, { ns: entry.labelNs })}
      </span>
    </Link>
  );
}

/** The section bar's phone tab bar: the first four pinned rooms and "More" (D30; H:4079–4082). */
function SectionTabBar({
  sections,
  organizationSlug,
}: {
  sections: MobileNavSections;
  organizationSlug: string;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const { nav, moreOpen, onMore } = sections;
  const slots = nav.pinned.slice(0, 4);
  const elsewhere =
    nav.current !== null && !slots.includes(nav.current) ? nav.current : null;
  const moreTone = elsewhere ? TONE_CLASSES[elsewhere.tone] : null;
  let morePill = 'text-muted-foreground';
  if (moreTone) morePill = moreTone.bg;
  else if (moreOpen) morePill = 'bg-muted';
  return (
    <>
      {slots.map((entry) => (
        <TabBarItem
          key={entry.id}
          entry={entry}
          current={entry === nav.current}
          organizationSlug={organizationSlug}
        />
      ))}
      <button
        type="button"
        onClick={onMore}
        aria-label={t(LAYOUT_KEYS.app.sectionBar.allSections)}
        aria-haspopup="dialog"
        aria-current={elsewhere ? 'page' : undefined}
        data-testid="nav-more-sections"
        className={cn(
          tabSlotClassName,
          'col-start-5',
          moreTone ? moreTone.ink : 'text-muted-foreground-strong',
        )}
      >
        <span data-slot="pill" className={cn(tabPillClassName, morePill)}>
          <Compass className="size-4.5" aria-hidden />
        </span>
        <span
          className={cn(tabLabelClassName, elsewhere ? 'font-semibold' : 'font-medium')}
        >
          {elsewhere
            ? t(elsewhere.labelKey, { ns: elsewhere.labelNs })
            : t(LAYOUT_KEYS.app.sectionBar.more)}
        </span>
      </button>
    </>
  );
}

/** What the section bar hands the tab bar: its nav model and the All sections sheet's state. */
export interface MobileNavSections {
  nav: SectionBarNav;
  moreOpen: boolean;
  onMore: () => void;
}

/**
 * The section bar's bottom tab bar on phones (the header nav hides below
 * `md`): 58px plus the safe area, `bg-card` with a top hairline — four pins +
 * "More" (D30).
 */
export function MobileNav({
  organizationSlug,
  sections,
}: {
  organizationSlug: string;
  sections: MobileNavSections;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <nav
      aria-label={t(LAYOUT_KEYS.app.sectionBar.nav)}
      // `mobile-nav` is what `index.css` looks for to lift floating corner
      // surfaces (consent card, feedback trigger, notice pills, the floating
      // "New") clear of this bar.
      data-slot="mobile-nav"
      className="bg-card fixed inset-x-0 bottom-0 z-40 grid h-[calc(3.625rem+env(safe-area-inset-bottom))] grid-cols-5 border-t px-1 pt-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      data-testid="mobile-bottom-bar"
    >
      <SectionTabBar sections={sections} organizationSlug={organizationSlug} />
    </nav>
  );
}

/**
 * Scroll offset carried across a remount of `<main>`.
 *
 * A Retry on the shell's error boundary rebuilds the shell, and with it this
 * `<main>` — the browser has nothing to restore and the user is thrown back to
 * the top of a page they were reading (SHELL-1). Module scope, not state: it
 * must outlive the component that is being replaced.
 *
 * Outliving the component also meant outliving the SESSION. Signing out and
 * signing back in as somebody else left the fresh session being chase-scrolled
 * to the previous user's offset for the whole restore window below, on a page
 * they had never scrolled. A logout now clears it — see
 * {@link bindScrollResetToSession}.
 */
let lastMainScrollTop = 0;

/** How long a restore keeps chasing content that is still rendering in. */
const SCROLL_RESTORE_WINDOW_MS = 1500;

let scrollResetBound = false;

/**
 * Drop the carried offset when the session ends.
 *
 * Every local logout path — the Account menu, a dead/expired session, the
 * cross-tab logout broadcast — funnels through the auth service's
 * `clearLocalAuthState()`, and its one effect observable from here is
 * `useAuthStore.clearAuth()`. Watching that one transition therefore covers all
 * of them without this shell having to know about any of them — a plain
 * subscription to the auth store's transition.
 *
 * Bound once from the first `AppMain` mount and deliberately never unbound. The
 * offset it guards cannot be non-zero unless `AppMain` has mounted, so binding
 * on mount misses nothing; keeping the subscription alive afterwards is what
 * makes it correct, because the logout it has to hear is usually the same event
 * that unmounts `AppMain` (a subscription owned by the effect would be torn
 * down in that same teardown), and a cross-tab logout can arrive while this tab
 * already sits on `/login` with no shell mounted at all.
 */
function bindScrollResetToSession(): void {
  if (scrollResetBound) return;
  scrollResetBound = true;
  useAuthStore.subscribe((state, prev) => {
    if (prev.isAuthenticated && !state.isAuthenticated) lastMainScrollTop = 0;
  });
}

/**
 * The scrolling content region (the routed page). `flush` drops the page
 * padding for screens that lay out their own gutters (the clinic rooms,
 * KICKOFF §3.2) and keeps only the phone tab bar's clearance. The email notice
 * is the shell's, drawn as a pill in its notice stack.
 */
export function AppMain({ flush = false }: { flush?: boolean } = {}) {
  const { t } = useTranslation(ERRORS_NS);
  const mainRef = useRef<HTMLElement>(null);
  const layoutWidth = resolveEffectiveLayoutWidth(platformConfig.layoutWidthForced);

  useEffect(() => {
    bindScrollResetToSession();
    const el = mainRef.current;
    if (!el) return;
    const target = lastMainScrollTop;
    let restoring = target > 0;
    let written: number | null = null;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const deadline = performance.now() + SCROLL_RESTORE_WINDOW_MS;

    const stop = () => {
      restoring = false;
      observer?.disconnect();
    };

    // One assignment is not enough: the routed island remounts with the shell,
    // so at this instant its content can still be short and `scrollTop` clamps
    // back to 0. Re-apply while the content grows into the offset.
    const apply = () => {
      if (!restoring) return;
      // Someone moved it who is not us — the user wins, stop restoring.
      if (written !== null && el.scrollTop !== written) return stop();
      el.scrollTop = target;
      written = el.scrollTop;
      if (written >= target || performance.now() > deadline) stop();
    };

    // Save continuously rather than on unmount: during a remount React can
    // mount the replacement before the outgoing instance's cleanup runs, and a
    // value written then arrives one commit too late to be read.
    const onScroll = () => {
      if (restoring || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        lastMainScrollTop = el.scrollTop;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    apply();
    if (restoring && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(apply);
      observer.observe(el);
      if (el.firstElementChild) observer.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <main
      id="main-content"
      ref={mainRef}
      // `app-main`: index.css extends the bottom padding by the consent card's
      // height on phones. `sm:pb-20` is not redundant — `sm:p-6` resets every
      // side, and the tab bar this padding clears stays until `md`.
      data-slot="app-main"
      className={
        flush
          ? 'flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom))]'
          : '3xl:p-8 flex-1 overflow-y-auto p-4 pb-20 sm:p-6 sm:pb-20 md:pb-6'
      }
      data-testid="main-content"
      data-layout-width={layoutWidth}
      data-flush={flush || undefined}
    >
      <div
        className={cn(
          layoutMainClassName(layoutWidth),
          flush && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <SectionErrorBoundary
          title={t(ERRORS_KEYS.widget.pageContent)}
          testId="page-content-error"
        >
          <PageTransition className={flush ? 'flex min-h-0 flex-1 flex-col' : undefined}>
            <Outlet />
          </PageTransition>
        </SectionErrorBoundary>
      </div>
    </main>
  );
}
