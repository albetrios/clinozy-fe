import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationOfferCreate,
  organizationOfferEdit,
} from '@/lib/routes/offerings-builders.ts';
import { OFFER_STATE_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTable, exportTableCsv } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useSetOfferPaused } from '@/shared/hooks/useOffers/index.ts';
import { FileIcon, Pause, PenLine, Play, Sparkles, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useBranchFilterCopy } from '../shared/components/CatalogueCells/index.ts';
import {
  CatalogueDeleteConfirm,
  type CatalogueDeleteTarget,
} from '../shared/components/CatalogueDeleteConfirm/index.ts';
import { OfferingsToolbar } from '../shared/components/OfferingsToolbar/index.ts';
import {
  type OfferingsCatalogue,
  useOfferingsCatalogue,
} from '../shared/hooks/useOfferingsCatalogue/index.ts';
import { useOfferLabels } from '../shared/hooks/useOfferLabels/index.ts';
import { OfferDrawer } from './components/OfferDrawer/index.ts';
import { useOffersDialogRoute } from './hooks/useOffersDialogRoute/index.ts';
import { useOffersTable } from './hooks/useOffersTable/index.ts';
import { OFFERS_KEYS, OFFERS_NS, OFFERS_TABLE_ID } from './offers.constants.ts';
import {
  filterOfferRows,
  offerFilterFields,
  type OfferRow,
  offerRows,
} from './offers.rows.ts';
import { OFFER_STATE_FILTER, validateOffersSearch } from './offers.search.ts';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'offers.csv';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 4;

/** The row grid's minimum width with every column side by side (H:5484). */
const MIN_ROW_WIDTH = 1300;

/** What the table shows while it loads, or when it has no rows (KICKOFF §6.11 States). */
function TableEmpty({
  loading,
  filtered,
  onClearFilters,
  onNew,
}: {
  loading: boolean;
  filtered: boolean;
  onClearFilters: () => void;
  /** "New offer" under the empty list — absent without the right access. */
  onNew?: () => void;
}) {
  const { t } = useTranslation(OFFERS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        label={t(OFFERS_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="sky" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="sky"
      icon={<Sparkles />}
      title={t(OFFERS_KEYS.empty.title)}
      description={t(OFFERS_KEYS.empty.description)}
      action={
        onNew ? (
          <EmptyStateAction onClick={onNew}>
            {t(OFFERS_KEYS.empty.newOffer)}
          </EmptyStateAction>
        ) : undefined
      }
    />
  );
}

/** The Filters sections' copy: Branches · Status, each state in its pill's tone. */
function useFilterCopy(
  catalogue: Pick<OfferingsCatalogue, 'branches'>,
): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(OFFERS_NS);
  const labels = useOfferLabels();
  const branchCopy = useBranchFilterCopy();
  return {
    branch: branchCopy(t(OFFERS_KEYS.columns.branches), catalogue.branches),
    status: {
      label: t(OFFERS_KEYS.columns.status),
      options: Object.fromEntries(
        OFFER_STATE_FILTER.map((state) => [
          state,
          { label: labels.state(state), tone: OFFER_STATE_TONES[state] },
        ]),
      ),
    },
  };
}

/**
 * The rows on screen and the Filters they offer: every offer searched, in the
 * tab's order, its sections built from what the search left, filtered by the
 * URL's picks.
 */
function useOfferRows(catalogue: OfferingsCatalogue) {
  const search = validateOffersSearch(useSearch({ strict: false }));
  const { offers, offerings, branches, today } = catalogue;
  const context = useMemo(
    () => ({ today, openBranchIds: branches.map((branch) => branch.id) }),
    [today, branches],
  );
  const searched = useMemo(
    () => offerRows(offers, offerings, search.q, context),
    [offers, offerings, search.q, context],
  );
  const fields: RoomFilterFields = useMemo(
    () => offerFilterFields(searched, context),
    [searched, context],
  );
  const filters = useRoomFilters(fields);
  const rows = filterOfferRows(searched, filters.applied, search.created, today);
  return { fields, filters, rows };
}

/** An offering's name by id — none for one no longer in the catalogue. */
function useOfferingNames(
  catalogue: OfferingsCatalogue,
): (offeringId: string) => string | undefined {
  const names = useMemo(
    () => new Map(catalogue.offerings.map((offering) => [offering.id, offering.name])),
    [catalogue.offerings],
  );
  return (offeringId) => names.get(offeringId);
}

/**
 * The Offers tab (KICKOFF §6.11; `offerings.md:41–55`): the room's toolbar over
 * the shared table — every offer, searched by name, code or an offering's
 * name, filtered (sections built from the rows) and kept in the tab's fixed
 * order: Running → Scheduled → Paused → Ended, newest first in each. Folded
 * columns on a tablet, rows with Type as the key on a phone, selection and
 * Export from `md`, row actions (Edit · Pause / Resume · Delete), "All offers
 * loaded". Its dialog routes render nothing: this page reads the URL and
 * opens the Offer drawer — "New offer" (the toolbar, the phone's floating
 * pill, the empty list) opens `create/`, a row click or its Edit opens
 * `$offerId/edit/` — and closing it comes back to the list as it was (D28).
 */
export function OffersPage() {
  const { t } = useTranslation(OFFERS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const access = useClinicAccess();
  const catalogue = useOfferingsCatalogue();
  useListLoadError(catalogue, OFFERS_TABLE_ID);
  const { fields, filters, rows } = useOfferRows(catalogue);
  const copy = useFilterCopy(catalogue);
  const nameOf = useOfferingNames(catalogue);
  const { dialog, close } = useOffersDialogRoute();
  const setPaused = useSetOfferPaused();
  const [deleting, setDeleting] = useState<CatalogueDeleteTarget | null>(null);

  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('offerings', action);
  // Offers are prices: writing one needs the `prices` ability too (Q-U8).
  const canPrice = access.isResolved && access.canAbility('prices');
  const loading = catalogue.isPending && catalogue.offers.length === 0;

  const table = useOffersTable({ rows: loading ? [] : rows, catalogue, nameOf });

  // The drawers open over the list with its search and filters kept.
  const openCreate = () =>
    void navigate({ ...organizationOfferCreate(organizationSlug), search: true });
  const openOffer = (offerId: string) =>
    void navigate({ ...organizationOfferEdit(organizationSlug, offerId), search: true });
  const onNew = can('create') && canPrice ? openCreate : undefined;

  const rowActions = (offer: OfferRow): DataTableRowAction[] => [
    ...(can('edit')
      ? [
          {
            id: 'edit',
            label: t(OFFERS_KEYS.rowActions.edit),
            icon: PenLine,
            onSelect: () => openOffer(offer.id),
          },
        ]
      : []),
    // Pause / Resume — never on an ended offer (H:4566, H:5483).
    ...(can('edit') && canPrice && offer.state !== 'ended'
      ? [
          offer.paused
            ? {
                id: 'resume',
                label: t(OFFERS_KEYS.rowActions.resume),
                icon: Play,
                onSelect: () => setPaused.mutate({ id: offer.id, paused: false }),
              }
            : {
                id: 'pause',
                label: t(OFFERS_KEYS.rowActions.pause),
                icon: Pause,
                onSelect: () => setPaused.mutate({ id: offer.id, paused: true }),
              },
        ]
      : []),
    ...(can('delete')
      ? [
          {
            id: 'delete',
            label: t(OFFERS_KEYS.rowActions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({
                kind: 'offer' as const,
                id: offer.id,
                name: offer.name,
                record: offer.name,
              }),
          },
        ]
      : []),
  ];

  const bulkActions: DataTableBulkAction<OfferRow>[] =
    access.isResolved && access.canAbility('export')
      ? [
          {
            id: 'export',
            label: t(OFFERS_KEYS.bulk.export),
            icon: FileIcon,
            onSelect: (selected) => {
              exportTableCsv({
                table,
                rows: selected,
                fileName: EXPORT_FILE_NAME,
                cell: (columnId, offer) =>
                  columnId === 'offer'
                    ? [offer.name, offer.code].filter(Boolean).join(' · ')
                    : undefined,
              });
              notify.success(t(OFFERS_KEYS.bulk.exported, { count: selected.length }));
            },
          },
        ]
      : [];

  return (
    <section data-testid="offers-page" className="bg-canvas flex min-h-0 flex-1 flex-col">
      <OfferingsToolbar
        tab="offers"
        tableId={OFFERS_TABLE_ID}
        table={table}
        filters={{ fields, copy }}
        onNew={onNew}
      />
      <DataTable
        table={table}
        tableId={OFFERS_TABLE_ID}
        label={t(OFFERS_KEYS.manifest.title)}
        recordsLabel={t(OFFERS_KEYS.table.records)}
        fold
        selectable
        minWidth={MIN_ROW_WIDTH}
        getRowTone={(row) => row.original.tone}
        onRowClick={(row) => openOffer(row.original.id)}
        rowActions={(row) => rowActions(row.original)}
        bulkActions={bulkActions}
        empty={
          <TableEmpty
            loading={loading}
            filtered={filters.count > 0}
            onClearFilters={() => filters.apply({})}
            onNew={onNew}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <CatalogueDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <OfferDrawer
        {...(dialog.kind === 'edit'
          ? {
              mode: 'edit' as const,
              // The list already holds it; a deep link waits for its own read.
              offer:
                dialog.offer ??
                catalogue.offers.find((offer) => offer.id === dialog.offerId),
            }
          : { mode: 'create' as const })}
        open={dialog.kind !== 'none'}
        catalogue={catalogue}
        onClose={close}
      />
      <Outlet />
    </section>
  );
}
