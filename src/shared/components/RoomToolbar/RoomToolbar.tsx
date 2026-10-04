import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { DataTableSavedViews } from '@/shared/components/DataTableSavedViews/index.ts';

import { roomToolbarTestIds } from './room-toolbar.constants.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  RoomFilters,
  useRoomFilters,
} from './RoomFilters/index.ts';
import { RoomPrimary, type RoomPrimaryProps } from './RoomPrimary/index.ts';
import { RoomSearch } from './RoomSearch/index.ts';

/** The phone rows (H:83–93; `_patterns.md:96`). */
type RoomToolbarLayout = 'default' | 'leads';

/** Where each slot sits on a phone, per layout — row by row, through `order`. */
const PHONE_PLACEMENT = {
  // Row 1: search (grows, min 180px) + Filters 40px; row 2: the tabs' track across
  // the row (H:142); then saved views.
  default: {
    search: 'max-md:order-1 max-md:flex-[1_1_180px]',
    filters: 'max-md:order-2',
    tabs: 'max-md:order-3 max-md:basis-full max-md:[&_[data-room-tabs-track]]:w-full',
  },
  // Row 1: the search alone; row 2: the tabs at their width + a 36px Filters at
  // the inline end (H:83–88).
  leads: {
    search: 'max-md:order-1 max-md:basis-full',
    filters: 'max-md:order-3',
    tabs: 'max-md:order-2 max-md:min-w-0 max-md:flex-1',
  },
} as const satisfies Record<RoomToolbarLayout, Record<string, string>>;

const NO_FILTERS: RoomFilterFields = {};

/** The toolbar's Filters: the room's filter fields and the copy of its options filters. */
export interface RoomToolbarFilters {
  /** The room's filters — the same object its `validateSearch` parses with. */
  fields: RoomFilterFields;
  /** Copy for the options filters, by field key. */
  copy: Readonly<Record<string, RoomFilterCopy>>;
  /** "Save as view" and the saved-views track (default on). */
  savedViews?: boolean;
}

/** Props for {@link RoomToolbar}. */
export interface RoomToolbarProps {
  /** The room's name: the h1. */
  title: string;
  /**
   * The room's table: prefixes the test ids, and keys its saved views and
   * Columns choice on this device.
   */
  tableId: string;
  /** The tab strip — `RoomTabs` (child routes) or `RoomViewTabs` (in-page views). */
  tabs?: ReactNode;
  /**
   * A period control right after the tabs (Appointments' "Today" + "‹ <period>
   * ›", H:1994): the tabs then keep their width and the free space follows
   * the period; on a phone it takes its own row under the tabs (H:54).
   */
  period?: ReactNode;
  /** The list search, writing the URL's `q`. */
  search?: { placeholder: string; label: string };
  /** The Filters popover and the saved views. */
  filters?: RoomToolbarFilters;
  /**
   * A room's own Filters in the Filters place, instead of `filters` — the
   * Appointments popover with its calendar (H:1999). It takes the Filters'
   * phone placement.
   */
  filtersSlot?: ReactNode;
  /** The Columns chooser — `DataTableColumnChooser` (hidden on a phone). */
  columns?: ReactNode;
  /** Room-specific buttons before the primary ("Day close"). */
  actions?: ReactNode;
  /** The primary create action(s): in the toolbar from `md`, the floating "New" below. */
  primary?: Omit<RoomPrimaryProps, 'testIdPrefix'>;
  /**
   * The phone rows: `default` — search + Filters, then the tabs; `leads` —
   * the search alone, then the tabs + a 36px Filters (its h1 keeps 20px on a
   * tablet, `leads.md:17`).
   */
  layout?: RoomToolbarLayout;
  className?: string;
}

/**
 * The tabs, a period control right after them, then the free space: with a
 * period the tabs keep their width (a tablet's at least 120px, H:142) and the
 * space follows the period (H:1994); without one the tabs take it.
 */
function ToolbarViews({
  tabs,
  period,
  tabsClassName,
}: {
  tabs: ReactNode;
  period: ReactNode;
  tabsClassName: string;
}) {
  return (
    <>
      {tabs ? (
        <div
          data-slot="room-toolbar-tabs"
          className={cn(
            'flex min-w-0',
            period
              ? 'md:max-w-max md:min-w-30 md:flex-[1_1_7.5rem] xl:min-w-0 xl:flex-initial'
              : 'md:min-w-30 md:flex-1 md:basis-0 xl:min-w-0',
            tabsClassName,
          )}
        >
          {tabs}
        </div>
      ) : null}
      {period ? (
        <div
          data-slot="room-toolbar-period"
          className="flex flex-none items-center gap-1.5 max-md:order-4"
        >
          {period}
        </div>
      ) : null}
      {!tabs || period ? (
        <span aria-hidden="true" className="flex-1 max-md:hidden" />
      ) : null}
    </>
  );
}

/** The shared Filters popover, when the room has filters and no Filters of its own. */
function ToolbarFilters({
  filters,
  tableId,
  savedViews,
  layout,
  className,
}: {
  filters: RoomToolbarFilters | undefined;
  tableId: string;
  savedViews: boolean;
  layout: RoomToolbarLayout;
  className: string;
}) {
  if (!filters) return null;
  return (
    <RoomFilters
      fields={filters.fields}
      copy={filters.copy}
      savedViewsTableId={savedViews ? tableId : undefined}
      testIdPrefix={tableId}
      phoneRow={layout === 'leads' ? 'tabs' : 'search'}
      className={className}
    />
  );
}

/**
 * A room list's toolbar (KICKOFF §3.5 List toolbar; H:1085–1090,
 * `_patterns.md:92–104`). From `md` one wrapping row, gap 10px 8px: h1 ·
 * tabs · (space) · search · saved views · Filters · Columns · actions ·
 * primary — the tabs take the free space, scrolling or folding into "More"
 * when it runs out (at least 120px on a tablet). On a phone the h1 is for
 * screen readers only (the header chip names the room), the rows follow
 * `layout`, Columns hides and the primary floats. Padding follows the room
 * metrics (`--room-toolbar-pad`: 16px 20px · 12px · 8px 12px).
 */
export function RoomToolbar({
  title,
  tableId,
  tabs,
  period,
  search,
  filters,
  filtersSlot,
  columns,
  actions,
  primary,
  layout = 'default',
  className,
}: RoomToolbarProps) {
  const ids = roomToolbarTestIds(tableId);
  const placement = PHONE_PLACEMENT[layout];
  const { applied, apply } = useRoomFilters(filters?.fields ?? NO_FILTERS);
  const savedViews = filters !== undefined && filters.savedViews !== false;

  return (
    <div
      data-slot="room-toolbar"
      data-layout={layout}
      data-testid={ids.toolbar}
      className={cn(
        'flex flex-none flex-wrap items-center gap-x-2 gap-y-2.5 p-(--room-toolbar-pad)',
        className,
      )}
    >
      <h1
        className={cn(
          'text-foreground flex-none border-e font-semibold tracking-[-0.015em] whitespace-nowrap max-md:sr-only',
          // Leads: 20px at every width, 6px before the divider + 2px after (H:1681).
          layout === 'leads' ? 'me-0.5 pe-1.5 text-xl' : 'pe-2.5 text-lg xl:text-xl',
          // After the size: a later font size would drop an earlier line height.
          'leading-[1.2]',
        )}
      >
        {title}
      </h1>
      <ToolbarViews tabs={tabs} period={period} tabsClassName={placement.tabs} />
      {search ? (
        <RoomSearch
          placeholder={search.placeholder}
          label={search.label}
          testIdPrefix={tableId}
          className={placement.search}
        />
      ) : null}
      {savedViews ? (
        <DataTableSavedViews
          tableId={tableId}
          activeFilters={applied}
          onApply={(view) => apply(view.filters)}
          className="max-md:order-4"
        />
      ) : null}
      {filtersSlot ? (
        <div
          data-slot="room-toolbar-filters"
          className={cn('flex flex-none', placement.filters)}
        >
          {filtersSlot}
        </div>
      ) : (
        <ToolbarFilters
          filters={filters}
          tableId={tableId}
          savedViews={savedViews}
          layout={layout}
          className={placement.filters}
        />
      )}
      {columns}
      {actions ? (
        <div className="flex flex-none items-center gap-2 max-md:order-5">{actions}</div>
      ) : null}
      {primary ? <RoomPrimary {...primary} testIdPrefix={tableId} /> : null}
    </div>
  );
}
