import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { fitTabs, measureTextWidth } from '@/lib/fit-tabs.ts';
import { cn } from '@/lib/utils.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import {
  ROOM_TOOLBAR_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
import { type AppIcon, ChevronDown } from '@/shared/icons/index.ts';

/**
 * The segmented track (H:1086, H:228–231): 36px — 28px segments in 3px of
 * `muted` inside a 1px border of the same colour — scrolling sideways with no
 * scrollbar when it is narrower than its tabs. As wide as its tabs; a phone
 * toolbar row may stretch it (`data-room-tabs-track`).
 */
const TRACK =
  'bg-muted border-muted flex h-9 max-w-full min-w-0 flex-none items-center gap-0.5 overflow-x-auto rounded-lg border p-0.75 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** One 28px segment: 12.5px/500, `px-3`, an optional 14px icon 6px before the label. */
const SEGMENT =
  'text-detail flex h-7 flex-none items-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-out';

/**
 * Selected: the card colour with the 1px shadow ring; unselected: the 7.03:1
 * text-on-muted value, lifting to `background/55` on hover and `/85` pressed
 * (H:230–231, KICKOFF §3.1).
 */
const SEGMENT_STATE = {
  selected: 'bg-card text-foreground shadow-(--elevation-control) ring-1 ring-border',
  idle: 'text-muted-foreground-strong hover:bg-background/55 hover:text-foreground active:bg-background/85',
} as const;

/** The 78px a "More" segment keeps, the track's 8px of padding and border, 2px gaps (H:4006). */
const TRACK_FIT = { reserve: 78, gap: 2, padding: 8 } as const;

/**
 * A tab's width as the prototype budgets it (H:4001): 24px of padding, 20px
 * for an icon and its gap, and the label at 500 12.5px.
 */
function tabWidth(label: string, hasIcon: boolean, fontFamily: string): number {
  return 24 + (hasIcon ? 20 : 0) + measureTextWidth(label, `500 12.5px ${fontFamily}`);
}

/** A tab's label row: the icon, the label, and trailing content (a count chip). */
function SegmentLabel({
  icon: Icon,
  label,
  badge,
}: {
  icon?: AppIcon;
  label: string;
  badge?: ReactNode;
}) {
  return (
    <>
      {Icon ? <Icon aria-hidden="true" className="size-3.5 flex-none" /> : null}
      {label}
      {badge}
    </>
  );
}

/** One room tab: a link to one of the room's literal child routes (D24). */
export interface RoomLinkTab {
  /** Stable id — the React key and the test id (`<prefix>-tab-<id>`). */
  id: string;
  label: string;
  icon?: AppIcon;
  /** Trailing content inside the tab, such as a count chip. */
  badge?: ReactNode;
  /** The child route, e.g. `/organization/$organizationSlug/medical/sales`. */
  to: string;
  params?: Readonly<Record<string, string>>;
  /** Its group's header in the "More" list ("Buying", "Money"; H:4007). */
  group?: string;
}

/** Props for {@link RoomTabs}. */
export interface RoomTabsProps {
  /** The row's accessible name ("Medical sections"). */
  label: string;
  tabs: readonly RoomLinkTab[];
  /**
   * A row wider than its space scrolls sideways (`scroll`, the default) or
   * folds from the inline end into "More" (`fold`, Medical and Payments).
   */
  overflow?: 'scroll' | 'fold';
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
}

/**
 * A room's tabs (KICKOFF §3.5 List toolbar; H:1086, H:4000–4010): links to the
 * room's literal child routes on the segmented track, the current one marked
 * `aria-current="page"` — its create / edit children keep it current, and a
 * tab nested under another's URL wins over it (the bare `/offerings` tab
 * beside `/offerings/offers`). With
 * `overflow="fold"` the tabs that do not fit fold from the inline end into a
 * 28px "More ⌄" (a 200px list); the current tab always stays. Otherwise the
 * track scrolls sideways without a scrollbar. Fills the space
 * {@link RoomToolbar} gives it.
 */
export function RoomTabs({
  label,
  tabs,
  overflow = 'scroll',
  testIdPrefix,
}: RoomTabsProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const ids = roomToolbarTestIds(testIdPrefix);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const [measureRef, width] = useElementWidth<HTMLElement>();

  // The deepest tab the URL is under: a room whose first tab is its bare URL
  // (`/offerings` beside `/offerings/offers`) matches both on the second.
  const currentIndex = tabs.reduce((current, tab, index) => {
    if (matchRoute({ to: tab.to, params: tab.params, fuzzy: true }) === false) {
      return current;
    }
    const best = tabs[current];
    return best && best.to.length >= tab.to.length ? current : index;
  }, -1);
  const folding = overflow === 'fold' && width > 0;
  // Keyed on the labels' text: a re-render with the same tabs measures nothing.
  const labelsKey = tabs.map((tab) => `${tab.icon ? '+' : '-'}${tab.label}`).join('\n');
  const widths = useMemo(() => {
    if (!folding || labelsKey === '') return [];
    const fontFamily = getComputedStyle(document.body).fontFamily;
    return labelsKey
      .split('\n')
      .map((entry) => tabWidth(entry.slice(1), entry.startsWith('+'), fontFamily));
  }, [folding, labelsKey]);
  const fit = fitTabs(widths, folding ? width : null, currentIndex, TRACK_FIT);
  const visible = folding ? fit.visible.flatMap((index) => tabs[index] ?? []) : tabs;
  const folded = folding ? fit.folded.flatMap((index) => tabs[index] ?? []) : [];

  return (
    <nav
      ref={measureRef}
      aria-label={label}
      data-testid={ids.tabs}
      className="flex w-full min-w-0"
    >
      <div data-room-tabs-track="" className={cn(TRACK, 'w-max')}>
        {visible.map((tab) => {
          const current = tab === tabs[currentIndex];
          return (
            <Link
              key={tab.id}
              to={tab.to}
              params={tab.params}
              // The Link's own fuzzy match would mark the bare `/offerings` tab
              // current on `/offerings/offers` too: `current` decides instead.
              activeOptions={{ exact: true }}
              aria-current={current ? 'page' : undefined}
              data-testid={ids.tab(tab.id)}
              data-slot="room-tab"
              className={cn(
                SEGMENT,
                current ? SEGMENT_STATE.selected : SEGMENT_STATE.idle,
              )}
            >
              <SegmentLabel icon={tab.icon} label={tab.label} badge={tab.badge} />
            </Link>
          );
        })}
        {folded.length > 0 ? (
          <Picker
            menu
            label={t(ROOM_TOOLBAR_KEYS.moreSections)}
            value={null}
            options={folded.map((tab) => ({
              key: tab.id,
              label: tab.label,
              group: tab.group,
              leading: tab.icon ? { kind: 'icon', icon: tab.icon } : { kind: 'none' },
            }))}
            onChange={(id) => {
              const tab = folded.find((entry) => entry.id === id);
              if (tab) void navigate({ to: tab.to, params: tab.params });
            }}
            minWidth={200}
            testId={ids.tabsMore}
            className="flex-none"
            renderTrigger={({ open }) => (
              <button
                type="button"
                aria-label={t(ROOM_TOOLBAR_KEYS.moreSections)}
                title={t(ROOM_TOOLBAR_KEYS.moreSections)}
                data-testid={ids.tabsMore}
                data-slot="room-tab"
                className={cn(
                  SEGMENT,
                  SEGMENT_STATE.idle,
                  'gap-1 ps-2.5 pe-1.5',
                  open && 'text-foreground',
                )}
              >
                {t(ROOM_TOOLBAR_KEYS.more)}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'text-muted-foreground size-3.5 flex-none transition-transform duration-150',
                    open && 'rotate-180',
                  )}
                />
              </button>
            )}
          />
        ) : null}
      </div>
    </nav>
  );
}

/** One in-page view: a search param of the room's list (D4), not a route. */
export interface RoomViewTab {
  /** The view's value — the React key and the test id (`<prefix>-tab-<id>`). */
  id: string;
  label: string;
  icon?: AppIcon;
  /** Trailing content inside the tab, such as a count chip. */
  badge?: ReactNode;
}

/** Props for {@link RoomViewTabs}. */
export interface RoomViewTabsProps {
  /** The tablist's accessible name ("Lead views"). */
  label: string;
  tabs: readonly RoomViewTab[];
  /** The current view's id. */
  value: string;
  onValueChange: (id: string) => void;
  /** The id of the list the views filter (each tab's `aria-controls`). */
  controls?: string;
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
}

/**
 * A room's in-page views on the same segmented track (KICKOFF §3.5: in-page
 * view tabs are tabs — the Radix `Tabs` shadcn's `tabs` wraps) — "All · In
 * clinic today · …", "Mine · Unreplied · All". Arrow keys move between views;
 * Enter or Space opens one, so arrowing past a view never refetches the list.
 * Scrolls sideways when narrower than its tabs.
 */
export function RoomViewTabs({
  label,
  tabs,
  value,
  onValueChange,
  controls,
  testIdPrefix,
}: RoomViewTabsProps) {
  const ids = roomToolbarTestIds(testIdPrefix);
  // Radix tabs underneath, styled as the room tabs' segments: the shadcn
  // trigger's own active, dark and underline rules would each need overriding.
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      activationMode="manual"
      className="flex w-full min-w-0"
    >
      <TabsPrimitive.List
        aria-label={label}
        data-testid={ids.tabs}
        data-room-tabs-track=""
        className={cn(TRACK, 'w-max')}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            aria-controls={controls}
            data-testid={ids.tab(tab.id)}
            data-slot="room-tab"
            className={cn(
              SEGMENT,
              tab.id === value ? SEGMENT_STATE.selected : SEGMENT_STATE.idle,
            )}
          >
            <SegmentLabel icon={tab.icon} label={tab.label} badge={tab.badge} />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
