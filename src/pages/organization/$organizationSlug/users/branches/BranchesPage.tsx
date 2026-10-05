import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import {
  organizationUsersBranchCreate,
  organizationUsersBranchEdit,
} from '@/lib/routes/users-builders.ts';
import { createdFilterMatches } from '@/shared/api/clinic/clinic-filter-match.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { FileIcon, MapPin, PenLine, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { UsersToolbar } from '../shared/components/UsersToolbar/index.ts';
import { BRANCHES_TABLE_ID, USERS_KEYS, USERS_NS } from '../users.constants.ts';
import { validateBranchesSearch } from './branches.search.ts';
import {
  BranchDeleteConfirm,
  type BranchDeleteTarget,
} from './components/BranchDeleteConfirm/index.ts';
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

/** Who may do what on Branches: the matrix's Users row (Admin by default, H:3605–3606). */
function useBranchAccess() {
  const access = useClinicAccess();
  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('users', action);
  return {
    isResolved: access.isResolved,
    canCreate: can('create'),
    canEdit: can('edit'),
    canDelete: can('delete'),
    canExport: access.isResolved && access.canAbility('export'),
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
  const { t } = useTranslation(USERS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        label={t(USERS_KEYS.tabs.branches)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="lav" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="lav"
      icon={<MapPin />}
      title={t(USERS_KEYS.branches.empty)}
      description={t(USERS_KEYS.empty.description)}
    />
  );
}

/**
 * Users › Branches (KICKOFF §6.12; `users.md:79–95`): the room toolbar —
 * Filters (Created) and "New branch", a floating pill on a phone — over every
 * branch, open and closed, the main branch first: chip, address, contact,
 * opening hours, team, default people and status, folded on a tablet, rows on
 * a phone with the address block carrying the rest. Its dialog routes render
 * nothing: this page reads the URL and opens the branch drawer.
 */
export function BranchesPage() {
  const { t } = useTranslation(USERS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateBranchesSearch(useSearch({ strict: false }));
  const access = useBranchAccess();
  const list = useBranchRows();
  useListLoadError(list, BRANCHES_TABLE_ID);
  const filters = useRoomFilters(BRANCH_FILTER_FIELDS);
  const [deleting, setDeleting] = useState<BranchDeleteTarget | null>(null);
  const { dialog, close } = useBranchesDialogRoute(list, {
    canCreate: access.canCreate,
    accessResolved: access.isResolved,
  });
  const loading = list.isPending && list.rows.length === 0;
  const { created } = search;
  const rows = useMemo(() => {
    if (!created) return list.rows;
    const today = clinicToday();
    return list.rows.filter((row) =>
      createdFilterMatches(row.branch.createdAt, created, today),
    );
  }, [list.rows, created]);
  const table = useBranchesTable(loading ? [] : rows);

  const openEdit = (row: BranchRow) =>
    void navigate({
      ...organizationUsersBranchEdit(organizationSlug, row.branch.id),
      search: true,
    });

  const rowActions = (row: BranchRow): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [
      {
        id: 'edit',
        label: t(USERS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => openEdit(row),
      },
    ];
    // Never on the main branch (`users.md:88`).
    if (access.canDelete && !row.branch.isMain) {
      actions.push({
        id: 'delete',
        label: t(USERS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => setDeleting({ branch: row.branch }),
      });
    }
    return actions;
  };

  const bulkActions: DataTableBulkAction<BranchRow>[] = access.canExport
    ? [
        {
          id: 'export',
          label: t(USERS_KEYS.bulk.export),
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
                if (fold === undefined) return String(column.accessorFn?.(row, 0) ?? '');
                return typeof fold === 'string' ? fold : (fold?.value ?? '');
              }),
            );
            downloadCsv(EXPORT_FILE_NAME, toCsv(headers, records));
            notify.success(t(USERS_KEYS.bulk.exported, { count: selected.length }));
          },
        },
      ]
    : [];

  const drawerAccess = { resolved: access.isResolved, canDelete: access.canDelete };

  return (
    <section
      data-testid="users-branches-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <UsersToolbar
        tab="branches"
        filters={{ fields: BRANCH_FILTER_FIELDS, copy: {} }}
        primary={
          access.canCreate
            ? {
                id: 'new-branch',
                label: t(USERS_KEYS.primary.newBranch),
                onSelect: () =>
                  void navigate({
                    ...organizationUsersBranchCreate(organizationSlug),
                    search: true,
                  }),
              }
            : undefined
        }
      />
      <DataTable
        table={table}
        tableId={BRANCHES_TABLE_ID}
        label={t(USERS_KEYS.tabs.branches)}
        recordsLabel={t(USERS_KEYS.branches.records)}
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
      {/* The row's and the drawer's confirm both live here, so the removal's
          10s Undo outlives the drawer it was confirmed from (L-64). */}
      <BranchDeleteConfirm
        target={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          if (dialog.kind === 'edit') close();
        }}
      />
      <BranchDrawer
        mode="create"
        open={dialog.kind === 'create'}
        access={{ ...drawerAccess, canWrite: access.canCreate, canDelete: false }}
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
        access={{ ...drawerAccess, canWrite: access.canEdit }}
        rows={list.rows}
        members={list.members}
        ready={!list.isPending}
        onClose={close}
        onSaved={close}
        onDelete={setDeleting}
      />
      <Outlet />
    </section>
  );
}
