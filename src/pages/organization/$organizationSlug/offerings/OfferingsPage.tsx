import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationOfferingCreate,
  organizationOfferingEdit,
} from '@/lib/routes/offerings-builders.ts';
import type { OfferRecord } from '@/shared/api/app/offerings-contracts.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/app/app-tones.ts';
import { DataTable, exportTableCsv } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { RoomTableEmpty } from '@/shared/components/RoomTableEmpty/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import {
  type AppAccess,
  canExportRows,
  useAppAccess,
} from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { FileIcon, PenLine, Tag, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useOfferingText } from './components/OfferingCells/index.ts';
import { OfferingDrawer } from './components/OfferingDrawer/index.ts';
import {
  type OfferingsDialogRoute,
  useOfferingsDialogRoute,
} from './hooks/useOfferingsDialogRoute/index.ts';
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

/** The row grid's minimum width with every column side by side (H:5469). */
const MIN_ROW_WIDTH = 1340;

/** The permission code each Offerings action needs (research §7; the API's `x-permission`). */
const OFFERING_CODES = {
  create: 'offering:create',
  edit: 'offering:update',
  delete: 'offering:delete',
  export: 'offering:export',
} as const;

/** What the table shows with no rows (KICKOFF §6.11 States). */
function TableEmpty({
  loading,
  failed,
  filtered,
  searched,
  onClearFilters,
  onRetry,
  onNew,
}: {
  loading: boolean;
  /** The catalogue's read failed with nothing read before: the error in place, with Retry. */
  failed: boolean;
  filtered: boolean;
  searched: boolean;
  onClearFilters: () => void;
  onRetry: () => void;
  /** "New offering" under the empty catalogue — absent without `offering:create`. */
  onNew?: () => void;
}) {
  const { t } = useTranslation(OFFERINGS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  if (failed && !loading) {
    return (
      <RetryError
        message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
        onRetry={onRetry}
      />
    );
  }
  return (
    <RoomTableEmpty
      loading={loading}
      filtered={filtered}
      onClearFilters={onClearFilters}
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
      label={t(OFFERINGS_KEYS.manifest.title)}
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
      openBranchIds: branches.map((branch) => branch.id),
    }),
    [pricingBranchId, branches],
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
 * What the Offering drawer opens as for the URL's dialog: Edit with the
 * offering — its own read by public id, else the catalogue's copy while that
 * read is on its way — or New offering with the URL's prefill.
 */
function drawerModeOf(
  dialog: OfferingsDialogRoute,
  offerings: OfferingsCatalogue['offerings'],
) {
  if (dialog.kind === 'edit') {
    return {
      mode: 'edit' as const,
      offering:
        dialog.offering ??
        offerings.find((offering) => offering.id === dialog.offeringId),
    };
  }
  return {
    mode: 'create' as const,
    prefill: dialog.kind === 'create' ? dialog.prefill : undefined,
  };
}

/**
 * The row actions a member's codes allow (research §7): Edit with
 * `offering:update` (a row click still opens the drawer, view only, for
 * everyone), Delete with `offering:delete`.
 */
function offeringRowActions({
  access,
  labels,
  onEdit,
  onDelete,
}: {
  access: Pick<AppAccess, 'canCode'>;
  labels: { edit: string; delete: string };
  onEdit: () => void;
  onDelete: () => void;
}): DataTableRowAction[] {
  const actions: DataTableRowAction[] = [];
  if (access.canCode(OFFERING_CODES.edit)) {
    actions.push({ id: 'edit', label: labels.edit, icon: PenLine, onSelect: onEdit });
  }
  if (access.canCode(OFFERING_CODES.delete)) {
    actions.push({
      id: 'delete',
      label: labels.delete,
      icon: Trash,
      destructive: true,
      onSelect: onDelete,
    });
  }
  return actions;
}

/**
 * The Offerings tab (KICKOFF §6.11; `offerings.md`) on clinozy-be: the room's
 * toolbar over the shared table — every offering (`GET /app/offerings`, read
 * whole, newest first), priced in rupees for the header's branch, searched,
 * filtered (sections built from the rows) and sorted in place; folded columns
 * on a tablet, rows with Price as the key on a phone, selection and Export
 * from `md` (`offering:export`), row actions (Edit · Delete by their codes),
 * "All offerings loaded". Delete is the reason confirm (`DELETE …?reason=`,
 * 204) with Undo (`POST …/restore`). The search, filters and sort live in the
 * URL. Its dialog routes render nothing: this page reads the URL and opens the
 * Offering drawer — "New offering" (the toolbar, the phone's floating pill,
 * the empty catalogue) opens `create/`, a row click or its Edit opens
 * `$offeringId/edit/` by the offering's public id — and closing it comes back
 * to the list as it was (D28). A first read that fails shows the error in
 * place with Retry; a later one keeps the last copy and toasts Retry.
 */
export function OfferingsPage() {
  const { t } = useTranslation(OFFERINGS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const catalogue = useOfferingsCatalogue();
  // A failed read with rows on screen keeps them and toasts Retry; with none
  // read yet the table shows the error in place instead (`TableEmpty`).
  const hasLastCopy = catalogue.offerings.length > 0;
  useListLoadError(
    { isError: catalogue.isError && hasLastCopy, refetch: catalogue.refetch },
    OFFERINGS_TABLE_ID,
  );
  const { search, fields, filters, rows } = useOfferingRows(catalogue);
  const copy = useFilterCopy(catalogue.offers, catalogue);
  const { dialog, close } = useOfferingsDialogRoute();
  const [deleting, setDeleting] = useState<CatalogueDeleteTarget | null>(null);

  const canCreate = access.canCode(OFFERING_CODES.create);
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

  const rowActions = (offering: OfferingRow): DataTableRowAction[] =>
    offeringRowActions({
      access,
      labels: {
        edit: t(OFFERINGS_KEYS.rowActions.edit),
        delete: t(OFFERINGS_KEYS.rowActions.delete),
      },
      onEdit: () => openOffering(offering.id),
      onDelete: () =>
        setDeleting({
          kind: 'offering',
          id: offering.id,
          offeringNumber: offering.offeringNumber,
          record: offering.name,
        }),
    });

  const bulkActions: DataTableBulkAction<OfferingRow>[] = canExportRows(
    access,
    OFFERING_CODES.export,
  )
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
        onNew={canCreate ? openCreate : undefined}
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
            failed={catalogue.isError && !hasLastCopy}
            filtered={filters.count > 0}
            searched={Boolean(search.q)}
            onClearFilters={() => filters.apply({})}
            onRetry={catalogue.refetch}
            onNew={canCreate ? openCreate : undefined}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <CatalogueDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <OfferingDrawer
        {...drawerModeOf(dialog, catalogue.offerings)}
        open={dialog.kind !== 'none'}
        catalogue={catalogue}
        onClose={close}
      />
      <Outlet />
    </section>
  );
}
