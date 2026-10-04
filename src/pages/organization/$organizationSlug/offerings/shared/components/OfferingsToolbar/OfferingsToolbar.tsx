'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve it
// stale answers (see `DataTable.tsx`).

import { useParams } from '@tanstack/react-router';
import type { ReactTable, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  type RoomLinkTab,
  RoomTabs,
  RoomToolbar,
  type RoomToolbarFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { Sparkles, Tag } from '@/shared/icons/index.ts';

import {
  NEW_BUTTON_ACTION_ID,
  OFFERINGS_TABS_TEST_PREFIX,
  OFFERINGS_TOOLBAR_KEYS,
  OFFERINGS_TOOLBAR_NS,
} from './offerings-toolbar.constants.ts';

/** The room's two tabs: its literal child routes (D24). */
export type OfferingsTab = 'offerings' | 'offers';

/** Props of {@link OfferingsToolbar}. */
export interface OfferingsToolbarProps<TRow extends RowData> {
  /** The tab on screen: its search placeholder and its New button. */
  tab: OfferingsTab;
  /** The tab's table id — its saved views, Columns choice and test ids. */
  tableId: string;
  /** The tab's table — the Columns chooser drives its column visibility. */
  table: ReactTable<DataTableFeatures, TRow>;
  /** The tab's Filters: the sections its rows hold, and their copy. */
  filters: RoomToolbarFilters;
  /** "New offering" / "New offer" — absent without the right access (the button hides). */
  onNew?: () => void;
}

/** The two tabs as links (`Tag` / `Sparkles`, 14px; H:5522). */
function useTabs(organizationSlug: string): RoomLinkTab[] {
  const { t } = useTranslation(OFFERINGS_TOOLBAR_NS);
  const params = { organizationSlug };
  return [
    {
      id: 'offerings',
      label: t(OFFERINGS_TOOLBAR_KEYS.tabOfferings),
      icon: Tag,
      to: '/organization/$organizationSlug/offerings',
      params,
    },
    {
      id: 'offers',
      label: t(OFFERINGS_TOOLBAR_KEYS.tabOffers),
      icon: Sparkles,
      to: '/organization/$organizationSlug/offerings/offers',
      params,
    },
  ];
}

/**
 * The Offerings room's toolbar (KICKOFF §6.11 Toolbar; `offerings.md:17`) on
 * the shared room toolbar, the same on both tabs: h1 "Offerings" · the tabs
 * "Offerings" / "Offers" — links to the room's child routes, not state ·
 * search ("Search name or search term" / "Search offers or codes") · saved
 * views · Filters · Columns · "New offering" / "New offer", a floating pill on
 * a phone.
 */
export function OfferingsToolbar<TRow extends RowData>({
  tab,
  tableId,
  table,
  filters,
  onNew,
}: OfferingsToolbarProps<TRow>) {
  const { t } = useTranslation(OFFERINGS_TOOLBAR_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const tabs = useTabs(organizationSlug);
  const offers = tab === 'offers';

  return (
    <RoomToolbar
      title={t(OFFERINGS_TOOLBAR_KEYS.title)}
      tableId={tableId}
      tabs={
        <RoomTabs
          label={t(OFFERINGS_TOOLBAR_KEYS.tabsLabel)}
          tabs={tabs}
          testIdPrefix={OFFERINGS_TABS_TEST_PREFIX}
        />
      }
      search={{
        placeholder: t(
          offers
            ? OFFERINGS_TOOLBAR_KEYS.searchOffers
            : OFFERINGS_TOOLBAR_KEYS.searchOfferings,
        ),
        label: t(OFFERINGS_TOOLBAR_KEYS.searchLabel),
      }}
      filters={filters}
      columns={<DataTableColumnChooser table={table} tableId={tableId} />}
      primary={
        onNew
          ? {
              action: {
                id: NEW_BUTTON_ACTION_ID,
                label: t(
                  offers
                    ? OFFERINGS_TOOLBAR_KEYS.newOffer
                    : OFFERINGS_TOOLBAR_KEYS.newOffering,
                ),
                onSelect: onNew,
              },
            }
          : undefined
      }
    />
  );
}
