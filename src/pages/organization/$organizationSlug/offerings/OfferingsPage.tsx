import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationOfferingCreate,
  organizationOfferingEdit,
} from '@/lib/routes/offerings-builders.ts';
import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/clinic/clinic-tones.ts';
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
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { FileIcon, PenLine, Tag, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useOfferingText } from './components/OfferingCells/index.ts';
import { OfferingDrawer } from './components/OfferingDrawer/index.ts';
import { useOfferingsDialogRoute } from './hooks/useOfferingsDialogRoute/index.ts';
import { useOfferingsTable } from './hooks/useOfferingsTable/index.ts';
import {
  OFFERINGS_KEYS,
  OFFERINGS_NS,
  OFFERINGS_TABLE_ID,
} from './offerings.constants.ts';
import {
  filterOfferingRows,
  offeringFilterFields,
  type OfferingRow,
  offeringRows,
  searchOfferingRows,
  sortOfferingRows,
} from './offerings.rows.ts';
import {
  OFFERING_CATEGORY_FILTER,
  OFFERING_STATUS_FILTER,
  validateOfferingsSearch,
} from './offerings.search.ts';
import { useBranchFilterCopy } from './shared/components/CatalogueCells/index.ts';
import {
  CatalogueDeleteConfirm,
  type CatalogueDeleteTarget,
} from './shared/components/CatalogueDeleteConfirm/index.ts';
import { OfferingsToolbar } from './shared/components/OfferingsToolbar/index.ts';
import {
  type OfferingsCatalogue,
  useOfferingsCatalogue,
} from './shared/hooks/useOfferingsCatalogue/index.ts';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'offerings.csv';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 8;

/** The row grid's minimum width with every column side by side (H:5469). */
const MIN_ROW_WIDTH = 1340;

/** What the table shows while it loads, or when it has no rows (KICKOFF §6.11 States). */
function TableEmpty({
  loading,
  filtered,
  searched,
  onClearFilters,
  onNew,
}: {
  loading: boolean;
  filtered: boolean;
  searched: boolean;
  onClearFilters: () => void;
  /** "New offering" under the empty catalogue — absent without Create. */
  onNew?: () => void;
}) {
  const { t } = useTranslation(OFFERINGS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        label={t(OFFERINGS_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="sky" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="sky"
      icon={<Tag />}
      title={t(searched ? OFFERINGS_KEYS.empty.noMatchTitle : OFFERINGS_KEYS.empty.title)}
      description={t(
        searched
          ? OFFERINGS_KEYS.empty.noMatchDescription
          : OFFERINGS_KEYS.empty.description,
      )}
      action={
        !searched && onNew ? (
          <EmptyStateAction onClick={onNew}>
            {t(OFFERINGS_KEYS.empty.newOffering)}
          </EmptyStateAction>
        ) : undefined
      }
    />
  );
}

/** The Filters sections' copy: Category · Offer · Branches · Status, each value in its pill's tone. */
function useFilterCopy(
  offers: readonly OfferRecord[],
  catalogue: Pick<OfferingsCatalogue, 'branches'>,
): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(OFFERINGS_NS);
  const text = useOfferingText();
  const branchCopy = useBranchFilterCopy();
  return {
    category: {
      label: t(OFFERINGS_KEYS.columns.category),
      options: Object.fromEntries(
        OFFERING_CATEGORY_FILTER.map((category) => [
          category,
          { label: text.category(category), tone: OFFERING_CATEGORY_TONES[category] },
        ]),
      ),
    },
    offer: {
      label: t(OFFERINGS_KEYS.columns.offer),
      options: Object.fromEntries(
        offers.map((offer) => [offer.id, { label: offer.name, tone: offer.tone }]),
      ),
    },
    branch: branchCopy(t(OFFERINGS_KEYS.columns.branches), catalogue.branches),
    status: {
      label: t(OFFERINGS_KEYS.columns.status),
      options: Object.fromEntries(
        OFFERING_STATUS_FILTER.map((status) => [
          status,
          status === 'active'
            ? { label: text.status(true), tone: 'sage' as const }
            : { label: text.status(false) },
        ]),
      ),
    },
  };
}

/**
 * The rows on screen and the Filters they offer: the catalogue priced for the
 * header's branch, searched, its sections built from what the search left,
 * filtered by the URL's picks and sorted by the URL's sort.
 */
function useOfferingRows(catalogue: OfferingsCatalogue) {
  const search = validateOfferingsSearch(useSearch({ strict: false }));
  const { offerings, offers, branches, pricingBranchId, today } = catalogue;
  const context = useMemo(
    () => ({
      branchId: pricingBranchId,
      today,
      openBranchIds: branches.map((branch) => branch.id),
    }),
    [pricingBranchId, today, branches],
  );
  const searched = useMemo(
    () => searchOfferingRows(offeringRows(offerings, offers, context), search.q),
    [offerings, offers, context, search.q],
  );
  const fields: RoomFilterFields = useMemo(
    () => offeringFilterFields(searched, offers, context),
    [searched, offers, context],
  );
  const filters = useRoomFilters(fields);
  const rows = sortOfferingRows(
    filterOfferingRows(searched, filters.applied, search.created, today),
    search.sort,
  );
  return { search, fields, filters, rows };
}

/**
 * The Offerings tab (KICKOFF §6.11; `offerings.md`): the room's toolbar over
 * the shared table — every offering, priced for the header's branch, searched,
 * filtered (sections built from the rows) and sorted in place; folded columns
 * on a tablet, rows with Price as the key on a phone, selection and Export
 * from `md`, row actions (Edit · Delete), "All offerings loaded". The search,
 * filters and sort live in the URL. Its dialog routes render nothing: this
 * page reads the URL and opens the Offering drawer — "New offering" (the
 * toolbar, the phone's floating pill, the empty catalogue) opens `create/`, a
 * row click or its Edit opens `$offeringId/edit/` — and closing it comes back
 * to the list as it was (D28).
 */
export function OfferingsPage() {
  const { t } = useTranslation(OFFERINGS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const catalogue = useOfferingsCatalogue();
  useListLoadError(catalogue, OFFERINGS_TABLE_ID);
  const { search, fields, filters, rows } = useOfferingRows(catalogue);
  const copy = useFilterCopy(catalogue.offers, catalogue);
  const { dialog, close } = useOfferingsDialogRoute();
  const [deleting, setDeleting] = useState<CatalogueDeleteTarget | null>(null);

  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('offerings', action);
  const loading = catalogue.isPending && catalogue.offerings.length === 0;

  // The drawers open over the list with its search, filters and sort kept.
  const openCreate = () =>
    void navigate({ ...organizationOfferingCreate(organizationSlug), search: true });
  const openOffering = (offeringId: string) =>
    void navigate({
      ...organizationOfferingEdit(organizationSlug, offeringId),
      search: true,
    });

  const table = useOfferingsTable({
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
    catalogue,
  });

  const rowActions = (offering: OfferingRow): DataTableRowAction[] => [
    ...(can('edit')
      ? [
          {
            id: 'edit',
            label: t(OFFERINGS_KEYS.rowActions.edit),
            icon: PenLine,
            onSelect: () => openOffering(offering.id),
          },
        ]
      : []),
    ...(can('delete')
      ? [
          {
            id: 'delete',
            label: t(OFFERINGS_KEYS.rowActions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({
                kind: 'offering',
                id: offering.id,
                seq: offering.seq,
                record: offering.name,
              }),
          },
        ]
      : []),
  ];

  const bulkActions: DataTableBulkAction<OfferingRow>[] =
    access.isResolved && access.canAbility('export')
      ? [
          {
            id: 'export',
            label: t(OFFERINGS_KEYS.bulk.export),
            icon: FileIcon,
            onSelect: (selected) => {
              exportTableCsv({ table, rows: selected, fileName: EXPORT_FILE_NAME });
              notify.success(t(OFFERINGS_KEYS.bulk.exported, { count: selected.length }));
            },
          },
        ]
      : [];

  return (
    <section
      data-testid="offerings-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <OfferingsToolbar
        tab="offerings"
        tableId={OFFERINGS_TABLE_ID}
        table={table}
        filters={{ fields, copy }}
        onNew={can('create') ? openCreate : undefined}
      />
      <DataTable
        table={table}
        tableId={OFFERINGS_TABLE_ID}
        label={t(OFFERINGS_KEYS.manifest.title)}
        recordsLabel={t(OFFERINGS_KEYS.table.records)}
        fold
        selectable
        minWidth={MIN_ROW_WIDTH}
        getRowTone={(row) => row.original.tone}
        onRowClick={(row) => openOffering(row.original.id)}
        rowActions={(row) => rowActions(row.original)}
        bulkActions={bulkActions}
        empty={
          <TableEmpty
            loading={loading}
            filtered={filters.count > 0}
            searched={Boolean(search.q)}
            onClearFilters={() => filters.apply({})}
            onNew={can('create') ? openCreate : undefined}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <CatalogueDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <OfferingDrawer
        {...(dialog.kind === 'edit'
          ? {
              mode: 'edit' as const,
              // The catalogue already holds it; a deep link waits for its own read.
              offering:
                dialog.offering ??
                catalogue.offerings.find((offering) => offering.id === dialog.offeringId),
            }
          : {
              mode: 'create' as const,
              prefill: dialog.kind === 'create' ? dialog.prefill : undefined,
            })}
        open={dialog.kind !== 'none'}
        catalogue={catalogue}
        onClose={close}
      />
      <Outlet />
    </section>
  );
}
