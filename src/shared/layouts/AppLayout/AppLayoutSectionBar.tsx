import { useNavigate } from '@tanstack/react-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { NotificationCenter } from '@/shared/components/NotificationCenter/index.ts';
import { BrandLogo } from '@/shared/components/ProductMark/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  AppMain,
  MobileNav,
  type NavItems,
  SearchTrigger,
} from '@/shared/layouts/AppLayout/AppLayout.shared.tsx';
import { AccountMenu } from '@/shared/layouts/AppLayout/components/AccountMenu/index.ts';
import {
  AllSectionsPopover,
  AllSectionsSheet,
} from '@/shared/layouts/AppLayout/components/AllSections/index.ts';
import { BranchPicker } from '@/shared/layouts/AppLayout/components/BranchPicker/index.ts';
import { NoticeStack } from '@/shared/layouts/AppLayout/components/NoticeStack/index.ts';
import { availableTabSpace } from '@/shared/layouts/AppLayout/components/PinnedTabs/fit-pinned-tabs.ts';
import { PinnedTabs } from '@/shared/layouts/AppLayout/components/PinnedTabs/index.ts';
import { SectionChip } from '@/shared/layouts/AppLayout/components/SectionChip/index.ts';
import { useSectionBarNav } from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { useSectionShortcuts } from '@/shared/layouts/AppLayout/section-bar-shortcuts.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

/**
 * Measure the space the pinned tabs may use (H:4083–4086): on every resize of
 * the header and of its right-hand items, after the first frame, after 300ms
 * and once the fonts are ready. Unmeasured (or laid out at zero width) means
 * null — nothing folds.
 */
function useTabSpace(refs: {
  header: RefObject<HTMLElement | null>;
  mark: RefObject<HTMLElement | null>;
  allSections: RefObject<HTMLElement | null>;
  search: RefObject<HTMLElement | null>;
  rightItems: RefObject<HTMLElement | null>;
}) {
  const [available, setAvailable] = useState<number | null>(null);
  const [fontFamily, setFontFamily] = useState('system-ui');

  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable objects; `measure` reads their elements at call time
  useEffect(() => {
    const header = refs.header.current;
    if (!header) return;
    const measure = () => {
      if (!header.isConnected || header.clientWidth === 0) return;
      const style = getComputedStyle(header);
      const next = availableTabSpace({
        innerWidth:
          header.clientWidth -
          Number.parseFloat(style.paddingInlineStart || style.paddingLeft) -
          Number.parseFloat(style.paddingInlineEnd || style.paddingRight),
        markWidth: refs.mark.current?.offsetWidth ?? 0,
        allSectionsWidth: refs.allSections.current?.offsetWidth ?? 0,
        rightItemWidths: [refs.rightItems.current?.offsetWidth ?? 0],
        hasSearch: refs.search.current !== null,
      });
      setFontFamily(style.fontFamily);
      setAvailable((previous) =>
        previous === null || Math.abs(next - previous) > 3 ? next : previous,
      );
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(header);
    if (refs.rightItems.current) observer?.observe(refs.rightItems.current);
    const frame = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 300);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer?.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    // The refs are stable objects; their elements are read inside `measure`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { available, fontFamily };
}

/**
 * The clinic launch's shell — the app's one shell (KICKOFF §3.2; `shell.md`): one
 * header bar and no sidebar on any viewport. Mark · (phone) section chip ·
 * All sections · pinned tabs with a measured "More" · search · divider ·
 * branch picker · avatar and Account menu; on a phone the tab bar and the All
 * sections sheet; the email notice and View-as pill along the bottom.
 */
export function SectionBarShell({
  navItems,
  organizationSlug,
}: {
  navItems: NavItems;
  organizationSlug: string;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const nav = useSectionBarNav(navItems);
  const [allSectionsOpen, setAllSectionsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const tier = useViewportTier();
  const navigate = useNavigate();
  // G and 1–9 / 0 (shell.md:46): All sections is the popover from `md`, the sheet below.
  useSectionShortcuts({
    roomCount: nav.entries.length,
    onToggle: () =>
      tier === 'phone'
        ? setSheetOpen((open) => !open)
        : setAllSectionsOpen((open) => !open),
    onOpen: (index) => {
      const entry = nav.entries[index];
      if (!entry) return;
      setAllSectionsOpen(false);
      setSheetOpen(false);
      void navigate({ to: entry.to, params: { organizationSlug } });
    },
  });
  const headerRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const allSectionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLSpanElement>(null);
  const rightItemsRef = useRef<HTMLDivElement>(null);
  const { available, fontFamily } = useTabSpace({
    header: headerRef,
    mark: markRef,
    allSections: allSectionsRef,
    search: searchRef,
    rightItems: rightItemsRef,
  });

  return (
    <div
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
      data-shell="section-bar"
    >
      <header
        ref={headerRef}
        data-slot="app-header"
        data-testid="header"
        className="bg-card relative z-30 flex min-h-[calc(3.25rem+1px)] flex-none items-center gap-2 border-b px-(--room-header-pad-x) md:min-h-[calc(3.75rem+1px)] md:gap-2.5"
      >
        <span ref={markRef} className="flex flex-none">
          <BrandLogo wordmark="md" />
        </span>
        <SectionChip entry={nav.current} />
        <nav
          aria-label={t(LAYOUT_KEYS.app.sectionBar.nav)}
          // Positioned and isolated for the pinned tabs' lens (PinnedTabs).
          className="relative isolate ms-1 hidden flex-none items-center gap-0.5 md:flex"
        >
          <AllSectionsPopover
            nav={nav}
            organizationSlug={organizationSlug}
            open={allSectionsOpen}
            onOpenChange={setAllSectionsOpen}
            wrapperRef={allSectionsRef}
          />
          <PinnedTabs
            nav={nav}
            organizationSlug={organizationSlug}
            available={available}
            fontFamily={fontFamily}
          />
        </nav>
        {/* Phone: the controls keep their size (the section chip gives way); from md the search shrinks. */}
        <div
          data-slot="header-controls"
          className="flex flex-[1_0_auto] items-center justify-end gap-1.5 md:min-w-0 md:flex-1"
        >
          <span ref={searchRef} className="contents">
            <SearchTrigger />
          </span>
          <div ref={rightItemsRef} className="flex flex-none items-center gap-1.5">
            <span aria-hidden className="bg-border mx-1 h-5 w-px flex-none" />
            <SectionErrorBoundary
              title={tErrors(ERRORS_KEYS.widget.organizationSwitcher)}
              testId="branch-picker-error"
              variant="control"
            >
              <BranchPicker />
            </SectionErrorBoundary>
            <NotificationCenter
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
            >
              <span className="flex">
                <AccountMenu onOpenNotifications={() => setNotificationsOpen(true)} />
              </span>
            </NotificationCenter>
          </div>
        </div>
      </header>
      <AppMain flush={nav.current !== null} />
      <NoticeStack />
      <MobileNav
        organizationSlug={organizationSlug}
        sections={{
          nav,
          moreOpen: sheetOpen,
          onMore: () => setSheetOpen(true),
        }}
      />
      <AllSectionsSheet
        nav={nav}
        organizationSlug={organizationSlug}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
