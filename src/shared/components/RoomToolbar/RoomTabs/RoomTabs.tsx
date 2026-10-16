import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { markSamePageNavigation } from '@/lib/animations/same-page-navigation.ts';
import { fitTabs, measureTextWidth } from '@/lib/fit-tabs.ts';
import { cn } from '@/lib/utils.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import {
  ROOM_TOOLBAR_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { SelectionGlide } from '@/shared/components/SelectionGlide/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { WeightStableLabel } from '@/shared/components/WeightStableLabel/index.ts';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { type AppIcon, ChevronDown } from '@/shared/icons/index.ts';

/**
 * The segmented track (H:1086, H:228–231): 36px — 28px segments in 3px of
 * `muted` inside a 1px border of the same colour — scrolling sideways with no
 * scrollbar when it is narrower than its tabs. As wide as its tabs; a phone
 * toolbar row may stretch it (`data-room-tabs-track`). Positioned and
 * isolated for its {@link SelectionGlide} thumb.
 */
const TRACK =
  'bg-muted border-muted relative isolate flex h-9 max-w-full min-w-0 flex-none items-center gap-0.5 overflow-x-auto rounded-lg border p-0.75 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

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

/**
 * The track's thumb (change-motion-polish D7): the selected segment's card —
 * its fill, ring, shadow and radius — as one surface that glides to the
 * segment picked. The segment's own selected classes stay: with no layout
 * nothing covers them.
 */
const TRACK_THUMB = 'bg-card shadow-(--elevation-control) ring-1 ring-border rounded-md';

/** The 78px a "More" segment keeps, the track's 8px of padding and border, 2px gaps (H:4006). */
const TRACK_FIT = { reserve: 78, gap: 2, padding: 8 } as const;

/**
 * A tab's width as the prototype budgets it (H:4001): 24px of padding, 20px
 * for an icon and its gap, and the label at 500 12.5px.
 */
function tabWidth(label: string, hasIcon: boolean, fontFamily: string): number {
  return 24 + (hasIcon ? 20 : 0) + measureTextWidth(label, `500 12.5px ${fontFamily}`);
}

/**
 * A tab's label row: the icon, the label (none for an icon-only tab; it
 * truncates where the tabs share the row), and trailing content (a count chip).
 */
function SegmentLabel({
  icon: Icon,
  label,
  badge,
  iconClassName,
  stableWeight = false,
}: {
  icon?: AppIcon;
  label?: string;
  badge?: ReactNode;
  iconClassName?: string;
  /** The look draws the selected tab bolder: keep every label at its bold width. */
  stableWeight?: boolean;
}) {
  let text: ReactNode = null;
  if (label !== undefined) {
    text = stableWeight ? (
      <WeightStableLabel label={label} />
    ) : (
      <span className="min-w-0 truncate">{label}</span>
    );
  }
  return (
    <>
      {Icon ? (
        <Icon aria-hidden="true" className={cn('size-3.5 flex-none', iconClassName)} />
      ) : null}
      {text}
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
  /**
   * The current tab's id, when the URL alone can't say — a drawer route that
   * renders another tab's page behind it (Users' member drawer over Roles).
   */
  current?: string;
}

/**
 * A room's tabs (KICKOFF §3.5 List toolbar; H:1086, H:4000–4010): links to the
 * room's literal child routes on the segmented track, the current one marked
 * `aria-current="page"` — its create / edit children keep it current, and a
 * tab nested under another's URL wins over it (the bare `/offerings` tab
 * beside `/offerings/offers`). With `overflow="fold"` the tabs that do not
 * fit fold from the inline end into a 28px "More ⌄" (a 200px list; a bottom
 * sheet on a phone); the current tab always stays, and on a phone it stays
 * alone. Otherwise the track scrolls sideways without a scrollbar. Fills the
 * space {@link RoomToolbar} gives it.
 */
export function RoomTabs({
  label,
  tabs,
  overflow = 'scroll',
  testIdPrefix,
  current,
}: RoomTabsProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const ids = roomToolbarTestIds(testIdPrefix);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const [measureRef, width] = useElementWidth<HTMLElement>();

  const phone = useViewportTier() === 'phone';
  // The deepest tab the URL is under: a room whose first tab is its bare URL
  // (`/offerings` beside `/offerings/offers`) matches both on the second.
  const deepestIndex = tabs.reduce((found, tab, index) => {
    if (matchRoute({ to: tab.to, params: tab.params, fuzzy: true }) === false) {
      return found;
    }
    const best = tabs[found];
    return best && best.to.length >= tab.to.length ? found : index;
  }, -1);
  // A drawer route may render another tab's page behind it: the page says which.
  const currentIndex =
    current === undefined ? deepestIndex : tabs.findIndex((tab) => tab.id === current);
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
  // A phone row keeps the current tab alone beside "More" (`medical.md:17`,
  // `payments.md:17`): the rest of the row belongs to the tab-row buttons.
  const available = phone ? 0 : width;
  const fit = fitTabs(widths, folding ? available : null, currentIndex, TRACK_FIT);
  const visible = folding ? fit.visible.flatMap((index) => tabs[index] ?? []) : tabs;
  const folded = folding ? fit.folded.flatMap((index) => tabs[index] ?? []) : [];
  // A track that scrolls keeps the current tab in view — a phone's fourth
  // Clinic stock tab would open half off the row (H:93).
  const currentTabRef = useRef<HTMLAnchorElement | null>(null);
  const currentTabId = tabs[currentIndex]?.id;
  useEffect(() => {
    if (folding || currentTabId === undefined) return;
    currentTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [folding, currentTabId]);

  return (
    <nav
      ref={measureRef}
      aria-label={label}
      data-testid={ids.tabs}
      className="flex w-full min-w-0"
    >
      <div data-room-tabs-track="" className={cn(TRACK, 'w-max')}>
        {/* The room's tabs are routes: each page draws this track again, so the thumb
            carries on from where it stood (feat-payment-celebration D13). */}
        <SelectionGlide
          selected='[data-slot="room-tab"][aria-current="page"]'
          className={TRACK_THUMB}
          continuity={`room-tabs:${testIdPrefix}`}
        />
        {visible.map((tab) => {
          const isCurrent = tab === tabs[currentIndex];
          return (
            <Link
              key={tab.id}
              ref={isCurrent ? currentTabRef : undefined}
              to={tab.to}
              params={tab.params}
              // The Link's own fuzzy match would mark the bare `/offerings` tab
              // current on `/offerings/offers` too: `isCurrent` decides instead.
              activeOptions={{ exact: true }}
              aria-current={isCurrent ? 'page' : undefined}
              // Another tab of this room is no new page: the header stays still.
              onClick={isCurrent ? undefined : markSamePageNavigation}
              data-testid={ids.tab(tab.id)}
              data-slot="room-tab"
              className={cn(
                SEGMENT,
                isCurrent ? SEGMENT_STATE.selected : SEGMENT_STATE.idle,
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
              if (!tab) return;
              markSamePageNavigation();
              void navigate({ to: tab.to, params: tab.params });
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

/** One in-page view: a search param of the room's list (D4), a pane or a mode — not a route. */
export interface RoomViewTab {
  /** The view's value — the React key and the test id (`<prefix>-tab-<id>`). */
  id: string;
  label: string;
  icon?: AppIcon;
  /** Trailing content inside the tab, such as a count chip. */
  badge?: ReactNode;
  /** Only the icon shows: the label names the tab and is its tooltip. */
  iconOnly?: boolean;
  /** The tab's tooltip on hover — a disabled tab's reason. */
  hint?: string;
  /** Not pickable: the arrows pass it by, and its hint says why. */
  disabled?: boolean;
  /** Its colours while selected — a section's tone, a channel's solid fill. */
  selectedClassName?: string;
  /** Its colours while not selected. */
  idleClassName?: string;
}

/** How a {@link RoomViewTabs} row looks. */
type RoomViewTabsLook = 'track' | 'card' | 'plain';

/** Each look's row, segment and default states (the tabs' own colours win). */
const VIEW_LOOKS: Readonly<
  Record<
    RoomViewTabsLook,
    {
      list: string;
      segment: string;
      selected: string;
      idle: string;
      icon?: string;
      /** Selected is bolder than idle: labels keep their bold width (D6). */
      stableWeight?: boolean;
    }
  >
> = {
  track: {
    list: TRACK,
    segment: SEGMENT,
    selected: SEGMENT_STATE.selected,
    idle: SEGMENT_STATE.idle,
  },
  // The chat composer's "Send via" (H:5770): 32px segments on the card.
  card: {
    list: 'bg-card flex min-w-0 items-center gap-0.75 rounded-lg border p-0.75 shadow-(--elevation-control)',
    segment:
      'text-detail flex h-8 items-center gap-1.5 rounded-md px-2.5 whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
    selected:
      'bg-primary text-primary-foreground font-semibold shadow-(--elevation-control)',
    idle: 'text-muted-foreground-strong hover:bg-muted font-medium',
    stableWeight: true,
  },
  // The patient file bar (H:710): no track, 32px tabs; an idle tab's icon is muted.
  plain: {
    list: 'flex max-w-full min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    segment:
      'text-body relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 whitespace-nowrap transition-[background-color,color,box-shadow] duration-160',
    selected: 'bg-muted text-foreground font-semibold',
    idle: 'text-foreground-soft hover:bg-muted font-medium',
    icon: 'text-muted-foreground group-data-[state=active]/view-tab:text-current',
    stableWeight: true,
  },
};

/**
 * A tab row's test ids: the room convention from a prefix (`<prefix>-tabs`,
 * `<prefix>-tab-<id>`), or the ids a surface's specs already name.
 */
type RoomViewTabsTestIds =
  | { testIdPrefix: string; testIds?: never }
  | { testIds: { list: string; tab: (id: string) => string }; testIdPrefix?: never };

/** Props for {@link RoomViewTabs}. */
export type RoomViewTabsProps = RoomViewTabsTestIds & {
  /** The tablist's accessible name ("Lead views"). */
  label: string;
  tabs: readonly RoomViewTab[];
  /** The current view's id. */
  value: string;
  onValueChange: (id: string) => void;
  /** The id of the list the views filter (each tab's `aria-controls`). */
  controls?: string;
  /**
   * `track` (default): the room tabs' segmented track; `card`: 32px segments on
   * a card with a hairline (the chat composer's "Send via"); `plain`: no track,
   * 32px tabs in their own colours (the patient file bar).
   */
  look?: RoomViewTabsLook;
  /** The tabs share the row's width (the composer, the lead drawer's phone switch). */
  fill?: boolean;
  /**
   * `manual` (default): the arrows move, Enter or Space opens — so arrowing
   * past a view never refetches its list; `automatic`: the arrows open the tab
   * they reach (a pane, a mode, a file section).
   */
  activation?: 'manual' | 'automatic';
  className?: string;
};

/** One tab: the Radix trigger in its look and colours, with its tooltip when it has one. */
function ViewTab({
  tab,
  selected,
  look,
  fill,
  controls,
  testId,
}: {
  tab: RoomViewTab;
  selected: boolean;
  look: RoomViewTabsLook;
  fill: boolean;
  controls?: string;
  testId: string;
}) {
  const styles = VIEW_LOOKS[look];
  const width = fill ? 'min-w-0 flex-1 basis-0 justify-center' : 'flex-none';
  const trigger = (
    <TabsPrimitive.Trigger
      value={tab.id}
      disabled={tab.disabled}
      aria-controls={controls}
      aria-label={tab.iconOnly ? tab.label : undefined}
      data-testid={testId}
      data-slot="room-tab"
      className={cn(
        'group/view-tab',
        styles.segment,
        width,
        selected ? styles.selected : styles.idle,
        selected ? tab.selectedClassName : tab.idleClassName,
        'disabled:cursor-not-allowed disabled:opacity-45',
      )}
    >
      <SegmentLabel
        icon={tab.icon}
        label={tab.iconOnly ? undefined : tab.label}
        badge={tab.badge}
        iconClassName={styles.icon}
        stableWeight={styles.stableWeight}
      />
    </TabsPrimitive.Trigger>
  );
  const hint = tab.hint ?? (tab.iconOnly ? tab.label : undefined);
  if (!hint) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button takes no pointer: its tooltip hangs on a wrapper. */}
        {tab.disabled ? <span className={cn('flex', width)}>{trigger}</span> : trigger}
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A room's in-page views (KICKOFF §3.5: in-page view tabs are tabs — the Radix
 * `Tabs` shadcn's `tabs` wraps): "All · In clinic today · …", "Mine ·
 * Unreplied · All" on the room tabs' segmented track — and the app's other
 * tab rows on the same unit: the chat composer's "Send via" (`card`, each
 * channel's solid fill — D93), the patient file bar's sections (`plain`, each
 * in its tone) and a drawer's phone panes (`fill`). Roving focus: one tab
 * stop, the arrows move (mirrored right-to-left), Home / End jump, a disabled
 * tab is passed by; Enter or Space opens (`automatic`: the arrows open).
 * Scrolls sideways when narrower than its tabs.
 */
export function RoomViewTabs({
  label,
  tabs,
  value,
  onValueChange,
  controls,
  testIdPrefix,
  testIds,
  look = 'track',
  fill = false,
  activation = 'manual',
  className,
}: RoomViewTabsProps) {
  const { direction } = useLocaleFormat();
  const roomIds = roomToolbarTestIds(testIdPrefix ?? '');
  const ids = testIds ?? { list: roomIds.tabs, tab: roomIds.tab };
  const styles = VIEW_LOOKS[look];
  // The track's thumb glides between its segments (D7) — unless a tab paints
  // its own selected colour, which one thumb cannot be (D8).
  const glides = look === 'track' && tabs.every((tab) => !tab.selectedClassName);
  // Radix tabs underneath, styled as the look's segments: the shadcn trigger's
  // own active, dark and underline rules would each need overriding.
  const list = (
    <TabsPrimitive.List
      aria-label={label}
      data-testid={ids.list}
      data-room-tabs-track={look === 'track' ? '' : undefined}
      className={cn(styles.list, fill ? 'w-full' : 'w-max')}
    >
      {glides ? (
        <SelectionGlide
          selected='[data-slot="room-tab"][data-state="active"]'
          className={TRACK_THUMB}
        />
      ) : null}
      {tabs.map((tab) => (
        <ViewTab
          key={tab.id}
          tab={tab}
          selected={tab.id === value}
          look={look}
          fill={fill}
          controls={controls}
          testId={ids.tab(tab.id)}
        />
      ))}
    </TabsPrimitive.List>
  );
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      activationMode={activation}
      dir={direction}
      className={cn('flex w-full min-w-0', className)}
    >
      {tabs.some((tab) => tab.hint ?? tab.iconOnly) ? (
        <TooltipProvider>{list}</TooltipProvider>
      ) : (
        list
      )}
    </TabsPrimitive.Root>
  );
}
