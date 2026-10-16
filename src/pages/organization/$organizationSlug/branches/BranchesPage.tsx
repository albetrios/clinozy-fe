import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import {
  organizationBranchCreate,
  organizationBranchEdit,
} from '@/lib/routes/branches-builders.ts';
import { createdFilterMatches } from '@/shared/api/app/app-filter-match.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterFields,
  RoomToolbar,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { Building, FileIcon, PenLine } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS, BRANCHES_TABLE_ID } from './branches.constants.ts';
import { validateBranchesSearch } from './branches.search.ts';
import { readBranchDrawerStep } from './components/BranchDrawer/branch-form.ts';
import { BranchDrawer } from './components/BranchDrawer/index.ts';
import { useBranchesDialogRoute } from './hooks/useBranchesDialogRoute/index.ts';
import { useBranchesTable } from './hooks/useBranchesTable/index.ts';
import { type BranchRow, useBranchRows } from './hooks/useBranchRows/index.ts';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'branches.csv';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 3;

/** The Filters' one section (`users.md:204`): Created. */
const BRANCH_FILTER_FIELDS: RoomFilterFields = {
  created: { kind: 'date', presets: 'created' },
};

/** An accessor's value as a CSV cell: a text, number or yes/no as written, else blank. */
function csvTextOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

/**
 * Who may do what on Branches — by the `branch:*` codes: create, edit (closing one included —
 * a branch is never deleted) and export what the tab already shows (clinozy-be has no export
 * code for branches). The same codes gate a branch's rooms, machines and holidays in the
 * drawer's "Places & days": add on `branch:create`, rename or switch off on `branch:update`,
 * remove on `branch:delete`.
 */
function useBranchAccess() {
  const access = useAppAccess();
  const holds = (
    code: 'branch:read' | 'branch:create' | 'branch:update' | 'branch:delete',
  ) => access.isResolved && access.canCode(code);
  return {
    isResolved: access.isResolved,
    canCreate: holds('branch:create'),
    canEdit: holds('branch:update'),
    canDelete: holds('branch:delete'),
    canExport: holds('branch:read'),
  };
}

/** What the table shows while the list loads or nothing matches. */
function BranchesEmpty({
  loading,
  filtered,
  onClearFilters,
}: {
  loading: boolean;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation(BRANCHES_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        label={t(BRANCHES_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="lav" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="lav"
      icon={<Building />}
      title={t(BRANCHES_KEYS.empty.title)}
      description={t(BRANCHES_KEYS.empty.description)}
    />
  );
}

/**
 * The Branches room (KICKOFF §6.12; `users.md:79–95`): the room toolbar — h1
 * "Branches", Filters (Created) and "New branch", a floating pill on a phone — over every
 * branch, open and closed, the main branch first: chip, address, contact,
 * opening hours, team, default people and status, folded on a tablet, rows on
 * a phone with the address block carrying the rest. Its dialog routes render
 * nothing: this page reads the URL and opens the branch drawer.
 */
export function BranchesPage() {
  const { t } = useTranslation(BRANCHES_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateBranchesSearch(useSearch({ strict: false }));
  // The step a link opens the edit drawer on, read here — the step list ships with the drawer.
  const startStep = readBranchDrawerStep(search.step);
  const access = useBranchAccess();
  const list = useBranchRows();
  useListLoadError(list, BRANCHES_TABLE_ID);
  const filters = useRoomFilters(BRANCH_FILTER_FIELDS);
  const { dialog, close } = useBranchesDialogRoute(list, {
    canCreate: access.canCreate,
    accessResolved: access.isResolved,
  });
  const loading = list.isPending && list.rows.length === 0;
  const { created } = search;
  const rows = useMemo(() => {
    if (!created) return list.rows;
    const today = appToday();
    return list.rows.filter((row) =>
      createdFilterMatches(row.branch.createdAt, created, today),
    );
  }, [list.rows, created]);
  const table = useBranchesTable(loading ? [] : rows);

  const openEdit = (row: BranchRow) =>
    void navigate({
      ...organizationBranchEdit(organizationSlug, row.branch.id),
      search: (current: Record<string, unknown>) => ({ ...current, step: undefined }),
    });

  // A branch is closed from its drawer (Status), never deleted: Edit is the row's one action.
  const rowActions = (row: BranchRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(BRANCHES_KEYS.rowActions.edit),
      icon: PenLine,
      onSelect: () => openEdit(row),
    },
  ];

  const bulkActions: DataTableBulkAction<BranchRow>[] = access.canExport
    ? [
        {
          id: 'export',
          label: t(BRANCHES_KEYS.bulk.export),
          icon: FileIcon,
          onSelect: (selected) => {
            const columns = table.getVisibleLeafColumns();
            const headers = columns.map((column) =>
              typeof column.columnDef.header === 'string'
                ? column.columnDef.header
                : column.id,
            );
            const records = selected.map((row) =>
              columns.map((column) => {
                const fold = column.columnDef.meta?.foldValue?.(row);
                if (fold === undefined) return csvTextOf(column.accessorFn?.(row, 0));
                return typeof fold === 'string' ? fold : (fold?.value ?? '');
              }),
            );
            downloadCsv(EXPORT_FILE_NAME, toCsv(headers, records));
            notify.success(t(BRANCHES_KEYS.bulk.exported, { count: selected.length }));
          },
        },
      ]
    : [];

  return (
    <section
      data-testid="branches-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <RoomToolbar
        title={t(BRANCHES_KEYS.manifest.title)}
        tableId={BRANCHES_TABLE_ID}
        filters={{ fields: BRANCH_FILTER_FIELDS, copy: {} }}
        primary={
          access.canCreate
            ? {
                action: {
                  id: 'new-branch',
                  label: t(BRANCHES_KEYS.primary.newBranch),
                  onSelect: () =>
                    void navigate({
                      ...organizationBranchCreate(organizationSlug),
                      search: true,
                    }),
                },
              }
            : undefined
        }
      />
      <DataTable
        table={table}
        tableId={BRANCHES_TABLE_ID}
        label={t(BRANCHES_KEYS.manifest.title)}
        recordsLabel={t(BRANCHES_KEYS.records)}
        fold
        phoneKeyFirst
        selectable
        minWidth={1260}
        onRowClick={(row) => openEdit(row.original)}
        getRowTone={(row) => row.original.branch.tone}
        rowActions={(row) => rowActions(row.original)}
        bulkActions={bulkActions}
        empty={
          <BranchesEmpty
            loading={loading}
            filtered={filters.count > 0}
            onClearFilters={() => filters.apply({})}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <BranchDrawer
        mode="create"
        open={dialog.kind === 'create'}
        access={{ resolved: access.isResolved, canWrite: access.canCreate }}
        rows={list.rows}
        members={list.members}
        ready={!list.isPending}
        onClose={close}
        onCreated={close}
      />
      <BranchDrawer
        mode="edit"
        open={dialog.kind === 'edit'}
        row={dialog.kind === 'edit' ? dialog.row : undefined}
        startStep={startStep}
        access={{
          resolved: access.isResolved,
          canWrite: access.canEdit,
          places: {
            canAdd: access.canCreate,
            canEdit: access.canEdit,
            canRemove: access.canDelete,
          },
        }}
        rows={list.rows}
        members={list.members}
        ready={!list.isPending}
        onClose={close}
        onSaved={close}
      />
      <Outlet />
    </section>
  );
}
