import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { PageTransition } from '@/lib/animations/PageTransition.tsx';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { iconOnSidebarSurface } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import { logout } from '@/shared/auth/service.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { preloadCommandPalette } from '@/shared/components/CommandPalette/index.ts';
import { EmailVerificationBanner } from '@/shared/components/EmailVerificationBanner/index.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { Compass, LogOut, Search, Settings } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import {
  layoutMainClassName,
  resolveEffectiveLayoutWidth,
} from '@/shared/theme/layout-width.ts';

/** The nav entries a shell draws (`useAppNav`). */
export type NavItems = readonly AppNavEntry[];

/**
 * One nav entry's link: the route's own path, with the org slug as its only
 * param (a personal-mode route has none). Active on the route and anything
 * under it, so a record page keeps its room lit. Styling is passed in so each
 * shell can draw the nav its own way.
 */
function AppNavLink({
  entry,
  organizationSlug,
  activeClassName,
  inactiveClassName,
  children,
}: {
  entry: AppNavEntry;
  organizationSlug: string;
  activeClassName: string;
  inactiveClassName: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={entry.to}
      params={{ organizationSlug }}
      activeOptions={{ exact: false }}
      activeProps={{ className: activeClassName }}
      inactiveProps={{ className: inactiveClassName }}
      data-slot="nav-item"
      data-testid={`nav-${entry.id}`}
    >
      {children}
    </Link>
  );
}

// ── Shared pieces (used by every shell) ──────────────────────────────────────

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

/** ⌘K search — wide button by default, icon-only when `iconOnly`. */
export function SearchTrigger({
  iconOnly = false,
  emphasis = false,
  sectionBar = false,
  className,
}: {
  iconOnly?: boolean;
  /** Center-weighted search for the Focus shell. */
  emphasis?: boolean;
  /**
   * The section bar's slot 6 (`shell.md:23`; H:541): a 240px field from `md`,
   * a 36px icon button on a phone.
   */
  sectionBar?: boolean;
  className?: string;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const open = () => useUIStore.getState().setCommandPaletteOpen(true);
  if (sectionBar) {
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
  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={open}
        onMouseEnter={preloadCommandPalette}
        onFocus={preloadCommandPalette}
        aria-label={t(LAYOUT_KEYS.app.search)}
        data-testid="search-trigger"
        className={className}
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      variant={emphasis ? 'secondary' : 'outline'}
      className={cn(
        'text-muted-foreground justify-start gap-2',
        emphasis ? 'flex h-9 w-full' : 'hidden h-8 w-48 sm:flex lg:w-64',
        className,
      )}
      onClick={open}
      onMouseEnter={preloadCommandPalette}
      onFocus={preloadCommandPalette}
      data-testid="search-trigger"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="text-sm">{t(LAYOUT_KEYS.app.searchPlaceholder)}</span>
      <kbd
        data-slot="kbd"
        className="bg-background text-foreground/70 ms-auto hidden rounded-sm border px-1.5 text-[10px] font-medium sm:inline"
      >
        {isMac
          ? t(LAYOUT_KEYS.app.searchShortcutMac)
          : t(LAYOUT_KEYS.app.searchShortcutWindows)}
      </kbd>
    </Button>
  );
}

/** Avatar + dropdown (settings, logout). */
export function UserMenu({
  align = 'end',
  side,
}: {
  align?: 'end' | 'start';
  /** Preferred popover side — use `right` when the trigger sits in a narrow left rail. */
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const initials = user?.name
    ? personInitials(user.name)
    : (user?.email?.slice(0, 2).toUpperCase() ?? '??');

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // forceLogout handles the redirect
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-9 rounded-full p-0"
          aria-label={t(LAYOUT_KEYS.app.userMenu)}
          data-testid="user-menu-trigger"
        >
          <PersonAvatar initials={initials} tone="stone" size="cell" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user?.name ?? t(LAYOUT_KEYS.app.userFallback)}
            </p>
            <p className="text-muted-foreground text-xs">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            void navigate({ to: '.', hash: settingsHash('account', 'profile') })
          }
          data-testid="user-menu-settings"
        >
          <Settings className="me-2 h-4 w-4" />
          {t(LAYOUT_KEYS.app.settings)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
          data-testid="logout-button"
        >
          <LogOut className="me-2 h-4 w-4" />
          {t(LAYOUT_KEYS.app.logOut)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const sidebarNavBase =
  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors';

// eslint-disable-next-line react-refresh/only-export-components -- static class map colocated with the layout shell
export const NAV_STYLES = {
  sidebar: {
    active: `${sidebarNavBase} bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:top-1/2 before:start-0 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary [&_svg]:text-sidebar-accent-foreground`,
    inactive: `${sidebarNavBase} text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground [&_svg]:${iconOnSidebarSurface}`,
  },
  top: {
    active:
      'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-foreground after:absolute after:inset-x-3 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-primary',
    inactive:
      'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground',
  },
  rail: {
    active:
      'flex size-10 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground',
    inactive: `flex size-10 items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground [&_svg]:${iconOnSidebarSurface}`,
  },
} as const;

export function NavList({
  navItems,
  organizationSlug,
  variant,
}: {
  navItems: NavItems;
  organizationSlug: string;
  variant: keyof typeof NAV_STYLES;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const style = NAV_STYLES[variant];

  const links = navItems.map((item) => {
    const label = t(item.labelKey, { ns: item.labelNs });
    const link = (
      <AppNavLink
        key={item.id}
        entry={item}
        organizationSlug={organizationSlug}
        activeClassName={style.active}
        inactiveClassName={style.inactive}
      >
        <item.icon className={variant === 'rail' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
        {variant === 'rail' ? <span className="sr-only">{label}</span> : label}
      </AppNavLink>
    );

    if (variant !== 'rail') return link;

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  });

  if (variant === 'rail') {
    return <TooltipProvider delayDuration={300}>{links}</TooltipProvider>;
  }

  return <>{links}</>;
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
 * Bottom tab bar on phones (shells that hide their nav below `md`): 58px plus
 * the safe area, `bg-card` with a top hairline. Given `sections` it is the
 * section bar's tab bar (four pins + "More", D30); otherwise it lists the
 * shell's nav entries.
 */
export function MobileNav({
  navItems,
  organizationSlug,
  sections,
}: {
  navItems: NavItems;
  organizationSlug: string;
  sections?: MobileNavSections;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <nav
      aria-label={t(
        sections ? LAYOUT_KEYS.app.sectionBar.nav : LAYOUT_KEYS.a11y.mobileNavigation,
      )}
      // `mobile-nav` is what `index.css` looks for to lift floating corner
      // surfaces (consent card, feedback trigger, notice pills, the floating
      // "New") clear of this bar.
      data-slot="mobile-nav"
      className={cn(
        'bg-card fixed inset-x-0 bottom-0 z-40 h-[calc(3.625rem+env(safe-area-inset-bottom))] border-t px-1 pt-1 pb-[env(safe-area-inset-bottom)] md:hidden',
        sections ? 'grid grid-cols-5' : 'flex',
      )}
      data-testid="mobile-bottom-bar"
    >
      {sections ? (
        <SectionTabBar sections={sections} organizationSlug={organizationSlug} />
      ) : (
        navItems.map((item) => (
          <AppNavLink
            key={item.id}
            entry={item}
            organizationSlug={organizationSlug}
            activeClassName="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-foreground bg-muted/50"
            inactiveClassName="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <item.icon className="h-5 w-5" aria-hidden />
            <span>{t(item.labelKey, { ns: item.labelNs })}</span>
          </AppNavLink>
        ))
      )}
    </nav>
  );
}

/**
 * Scroll offset carried across a shell swap.
 *
 * Each variant owns its own `<main>`, so changing shells unmounts this one and
 * mounts a different node — the browser has nothing to restore and the user is
 * thrown back to the top of a page they were reading (SHELL-1). Module scope,
 * not state: it must outlive the component that is being replaced.
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
 * Every local logout path — the user menu, a dead/expired session, the
 * cross-tab logout broadcast — funnels through the auth service's
 * `clearLocalAuthState()`, and its one effect observable from here is
 * `useAuthStore.clearAuth()`. Watching that one transition therefore covers all
 * of them without this shell having to know about any of them, and follows the
 * store-subscription pattern already used for auth transitions in
 * `shared/icons/icon-registry.ts`.
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
 * The scrolling content region (email banner + routed page). `flush` drops the
 * page padding for screens that lay out their own gutters (the clinic rooms,
 * KICKOFF §3.2) and keeps only the phone tab bar's clearance; `banner: 'none'`
 * leaves the email notice to the shell (the section bar draws it as a pill).
 */
export function AppMain({
  flush = false,
  banner = 'strip',
}: {
  flush?: boolean;
  banner?: 'strip' | 'none';
} = {}) {
  const { t } = useTranslation(ERRORS_NS);
  const mainRef = useRef<HTMLElement>(null);
  const layoutPreference = useThemeStore((s) => s.layoutWidth);
  const layoutWidth = resolveEffectiveLayoutWidth(
    platformConfig.layoutWidthForced,
    layoutPreference,
  );

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

    // Save continuously rather than on unmount: during a shell swap React can
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
    <>
      {banner === 'strip' ? (
        <SectionErrorBoundary
          title={t(ERRORS_KEYS.widget.emailBanner)}
          testId="email-banner-error"
          variant="inline"
        >
          <EmailVerificationBanner />
        </SectionErrorBoundary>
      ) : null}
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
            <PageTransition
              className={flush ? 'flex min-h-0 flex-1 flex-col' : undefined}
            >
              <Outlet />
            </PageTransition>
          </SectionErrorBoundary>
        </div>
      </main>
    </>
  );
}
