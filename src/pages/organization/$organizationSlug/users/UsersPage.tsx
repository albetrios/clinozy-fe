import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import { organizationUserCreate, organizationUserEdit } from '@/lib/routes/index.ts';
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  compareTeamMembers,
  teamMemberMatchesFilters,
  teamMemberMatchesSearch,
} from '@/shared/api/clinic/users-api.ts';
import type { TeamMember, TeamSortKey } from '@/shared/api/clinic/users-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useTeam } from '@/shared/hooks/useTeam/index.ts';
import { FileIcon, PenLine, Shield, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  UserDeleteConfirm,
  type UserDeleteTarget,
} from './components/UserDeleteConfirm/index.ts';
import { UserDrawer } from './components/UserDrawer/index.ts';
import { useTeamTable } from './hooks/useTeamTable/index.ts';
import { useUsersDialogRoute } from './hooks/useUsersDialogRoute/index.ts';
import { RolesAccess } from './shared/components/RolesAccess/index.ts';
import { UsersToolbar } from './shared/components/UsersToolbar/index.ts';
import {
  type RoleDirectory,
  useRoleDirectory,
} from './shared/hooks/useRoleDirectory/index.ts';
import { TEAM_TABLE_ID, USERS_KEYS, USERS_NS } from './users.constants.ts';
import {
  TEAM_STATUS_VALUES,
  type TeamSortColumn,
  type UsersSearch,
  validateUserEditSearch,
  validateUsersSearch,
} from './users.search.ts';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'users.csv';

/** How many placeholder rows stand in for the Team while it loads. */
const SKELETON_ROWS = 8;

/** The Team's sort columns as the in-place comparator names them. */
const SORT_KEY: Readonly<Record<TeamSortColumn, TeamSortKey>> = {
  seq: 'seq',
  name: 'name',
  email: 'email',
  role: 'role',
  commission: 'commission',
  status: 'status',
  updatedAt: 'updatedAt',
};

/**
 * The Team's Filters (`users.md:204`): Roles — one pick, "All" by default —
 * Branches (only with two or more open), Status, Created. Built from the
 * roles and branches the clinic has, so a pick always names one.
 */
function teamFilterFields(
  roles: RoleDirectory,
  branches: readonly Branch[],
  multiBranch: boolean,
): RoomFilterFields {
  return {
    role: { kind: 'options', values: roles.roles.map((role) => role.key), single: true },
    ...(multiBranch
      ? { branch: { kind: 'options', values: branches.map((branch) => branch.id) } }
      : {}),
    status: { kind: 'options', values: TEAM_STATUS_VALUES },
    created: { kind: 'date', presets: 'created' },
  };
}

/** The copy of the Team's options filters, each value in its tone. */
function useTeamFilterCopy(
  roles: RoleDirectory,
  branches: readonly Branch[],
): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(USERS_NS);
  return {
    role: {
      label: t(USERS_KEYS.filters.roles),
      anyLabel: t(USERS_KEYS.filters.all),
      options: Object.fromEntries(
        roles.options.map((role) => [role.id, { label: role.label, tone: role.tone }]),
      ),
    },
    branch: {
      label: t(USERS_KEYS.filters.branches),
      options: Object.fromEntries(
        branches.map((branch) => [branch.id, { label: branch.name, tone: branch.tone }]),
      ),
    },
    status: {
      label: t(USERS_KEYS.filters.status),
      options: {
        active: { label: t(USERS_KEYS.status.active), tone: 'sage' },
        inactive: { label: t(USERS_KEYS.status.inactive), tone: 'stone' },
      },
    },
  };
}

/** The Team as the URL asks for it: searched, filtered, then sorted in place. */
function useTeamRows(
  members: readonly TeamMember[],
  search: UsersSearch,
  roles: RoleDirectory,
): TeamMember[] {
  return useMemo(() => {
    const today = clinicToday();
    const filtered = members.filter(
      (member) =>
        teamMemberMatchesSearch(member, search.q ?? '') &&
        teamMemberMatchesFilters(
          member,
          {
            role: search.role as ClinicRoleKey | undefined,
            branch: search.branch,
            status: search.status,
            created: search.created,
          },
          today,
        ),
    );
    if (!search.sort) return filtered;
    const [column, order] = search.sort.split(':') as [TeamSortColumn, 'asc' | 'desc'];
    return [...filtered].sort(compareTeamMembers(SORT_KEY[column], order, roles.label));
  }, [members, search, roles.label]);
}

/**
 * What the table shows while the Team is loading or nothing matches — the
 * in-place skeleton, the filtered empty state, or "No user matches" (the
 * Team itself can't be empty: you are on it; KICKOFF §6.12 States).
 */
function TeamEmpty({
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
        avatar
        label={t(USERS_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="lav" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="lav"
      icon={<Shield />}
      title={t(USERS_KEYS.empty.title)}
      description={t(USERS_KEYS.empty.description)}
    />
  );
}

/** Who may do what on the Team (D17, D47): clinozy-be's codes, or the previewed role's matrix. */
function useTeamAccess() {
  const access = useClinicAccess();
  const canManageMembers = useCan({ permission: 'membership:manage' });
  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('users', action);
  return {
    isResolved: access.isResolved,
    // clinozy-be's invite needs `membership:manage` as well as `invitation:manage` (D47).
    canInvite: can('create') && (access.previewRole !== null || canManageMembers),
    canEdit: can('edit'),
    canDelete: can('delete'),
    canResend: can('create'),
    canExport: access.isResolved && access.canAbility('export'),
  };
}

/**
 * Users › Team (KICKOFF §6.12; `users.md`): the room toolbar — the tabs,
 * search "Name, email, mobile or #ID", Filters (Roles · Branches · Status ·
 * Created), Columns and "New user" (a floating pill on a phone) — over the
 * shared table: clinozy-be's members joined with their staff profiles (D17),
 * searched, filtered and sorted in place, folded on a tablet, rows with the
 * Roles pills as the key column on a phone. Its dialog routes render nothing:
 * this page reads the URL and opens the user drawer — New user (an
 * invitation) or the member's; a member opened from a role page
 * (`?from=roles`) keeps Roles & access behind the drawer instead (H:5188).
 */
export function UsersPage() {
  const { t } = useTranslation(USERS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const rawSearch = useSearch({ strict: false });
  const search = validateUsersSearch(rawSearch);
  const { from } = validateUserEditSearch(rawSearch);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useTeamAccess();
  const team = useTeam();
  useListLoadError(team, TEAM_TABLE_ID);
  const { openBranches, isMultiBranch } = useBranches();
  const roles = useRoleDirectory();
  const filterFields = teamFilterFields(roles, openBranches, isMultiBranch);
  const filters = useRoomFilters(filterFields);
  const filterCopy = useTeamFilterCopy(roles, openBranches);
  const rows = useTeamRows(team.members, search, roles);
  const [deleting, setDeleting] = useState<UserDeleteTarget | null>(null);
  const { dialog, close } = useUsersDialogRoute(team, {
    canInvite: access.canInvite,
    accessResolved: access.isResolved,
    from,
    role: search.role,
  });
  const loading = team.isPending && team.members.length === 0;

  const openEdit = (member: TeamMember) =>
    void navigate({
      ...organizationUserEdit(organizationSlug, member.membershipId),
      search: true,
    });
  const openCreate = () =>
    void navigate({ ...organizationUserCreate(organizationSlug), search: true });

  const table = useTeamTable({
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
    roles,
    branches: openBranches,
    multiBranch: isMultiBranch,
  });

  const rowActions = (member: TeamMember): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [
      {
        id: 'edit',
        label: t(USERS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => openEdit(member),
      },
    ];
    // No Delete on your own row or the owner's (`OrganizationMembersPanel`, §7.3).
    if (access.canDelete && !member.isSelf && !member.isOwner) {
      actions.push({
        id: 'delete',
        label: t(USERS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => setDeleting({ member }),
      });
    }
    return actions;
  };

  const bulkActions: DataTableBulkAction<TeamMember>[] = access.canExport
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
            const records = selected.map((member) =>
              columns.map((column) => {
                if (column.id === 'name') {
                  return member.phone
                    ? `${member.name} · ${formatClinicPhone(member.phone)}`
                    : member.name;
                }
                if (column.id === 'email') return member.email;
                const fold = column.columnDef.meta?.foldValue?.(member);
                return typeof fold === 'string' ? fold : (fold?.value ?? '');
              }),
            );
            downloadCsv(EXPORT_FILE_NAME, toCsv(headers, records));
            notify.success(t(USERS_KEYS.bulk.exported, { count: selected.length }));
          },
        },
      ]
    : [];

  return (
    <section data-testid="users-page" className="flex min-h-0 flex-1 flex-col">
      {from === 'roles' ? (
        <RolesAccess selected={search.role} />
      ) : (
        <>
          <UsersToolbar
            tab="team"
            search
            filters={{ fields: filterFields, copy: filterCopy }}
            columns={<DataTableColumnChooser table={table} tableId={TEAM_TABLE_ID} />}
            primary={
              access.canInvite
                ? {
                    id: 'new-user',
                    label: t(USERS_KEYS.primary.newUser),
                    onSelect: openCreate,
                  }
                : undefined
            }
          />
          <DataTable
            table={table}
            tableId={TEAM_TABLE_ID}
            label={t(USERS_KEYS.tabs.team)}
            recordsLabel={t(USERS_KEYS.table.records)}
            fold
            selectable
            minWidth={isMultiBranch ? 1340 : 1210}
            onRowClick={(row) => openEdit(row.original)}
            getRowTone={(row) => row.original.tone}
            rowActions={(row) => rowActions(row.original)}
            bulkActions={bulkActions}
            empty={
              <TeamEmpty
                loading={loading}
                filtered={filters.count > 0}
                onClearFilters={() => filters.apply({})}
              />
            }
            className="m-(--room-card-margin) flex-1"
          />
        </>
      )}
      <UserDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <UserDrawer
        mode="create"
        open={dialog.kind === 'create'}
        access={{
          resolved: access.isResolved,
          canWrite: access.canInvite,
          canDelete: false,
          canResend: false,
        }}
        onClose={close}
        // The list stays; the new member shows at the top as "Invited" (D28).
        onCreated={close}
      />
      <UserDrawer
        mode="edit"
        open={dialog.kind === 'edit'}
        member={dialog.kind === 'edit' ? dialog.member : undefined}
        access={{
          resolved: access.isResolved,
          canWrite: access.canEdit,
          canDelete:
            access.canDelete &&
            dialog.kind === 'edit' &&
            !dialog.member?.isSelf &&
            !dialog.member?.isOwner,
          canResend: access.canResend,
        }}
        onClose={close}
        onSaved={close}
        onDeleted={close}
      />
      <Outlet />
    </section>
  );
}
