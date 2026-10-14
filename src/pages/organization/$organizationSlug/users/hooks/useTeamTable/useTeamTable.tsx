import {
  type ColumnDef,
  functionalUpdate,
  type OnChangeFn,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
  type DataTableFoldValue,
} from '@/shared/components/DataTable/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
} from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';

import {
  TeamBranchesCell,
  TeamIdCell,
  type TeamPill,
  TeamRolesCell,
  TeamStatusCell,
  TeamTextCell,
  TeamUserCell,
} from '../../components/TeamCells/index.ts';
import type { RoleDirectory } from '../../shared/hooks/useRoleDirectory/index.ts';
import { TEAM_TABLE_ID, USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import type { TeamSort } from '../../users.search.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as TeamMember;

/** A pill cell's meta-line value: its labels, the dot in the first pill's ink (H:4115). */
function pillsFold(pills: readonly TeamPill[]): DataTableFoldValue | null {
  const [first] = pills;
  if (!first) return null;
  return {
    value: pills.map((pill) => pill.label).join(', '),
    dotClassName: TONE_CLASSES[first.tone].fill,
  };
}

/** What the columns read beyond the row. */
interface TeamColumnsInput {
  roles: RoleDirectory;
  /** The open branches, by id; with one open the Branches column is left out (`users.md:95`). */
  branches: readonly BranchOption[];
  multiBranch: boolean;
}

/**
 * The Team's columns (KICKOFF §6.12 Team table; `users.md:30–40`; H:5155–5162):
 * ID · User · Email · Roles · Branches · Working hours · Commission · Status ·
 * Updated — their tracks, which sort, which the recommended set hides (Email,
 * Working hours, Commission, Updated — "4 of 8 shown"), and what each folds to.
 * Roles is the phone row's key column. With one open branch there is no
 * Branches column at all (§7.3). The column ids are the URL's sort keys.
 */
function useTeamColumns({
  roles,
  branches,
  multiBranch,
}: TeamColumnsInput): ColumnDef<DataTableFeatures, TeamMember>[] {
  const { t } = useTranslation(USERS_NS);
  const format = useHoursFormat();
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));

  const rolePills = (member: TeamMember) => roles.pills(member.roleIds);
  const branchPills = (member: TeamMember): TeamPill[] =>
    member.branchIds.flatMap((id) => {
      const branch = branchById.get(id);
      return branch ? [{ id: branch.id, label: branch.name, tone: branch.tone }] : [];
    });
  const statusFold = (member: TeamMember): DataTableFoldValue => {
    if (member.status === 'invited') {
      return {
        value: t(USERS_KEYS.status.invited),
        dotClassName: TONE_CLASSES.butter.fill,
      };
    }
    const active = member.status === 'active';
    return {
      value: active ? t(USERS_KEYS.status.active) : t(USERS_KEYS.status.inactive),
      dotClassName: active ? TONE_CLASSES.sage.fill : 'bg-disabled',
      quiet: active,
    };
  };
  const hours = (member: TeamMember) =>
    format.hours(member.workingDays, member.startsAt, member.endsAt);
  // Up to two decimals as clinozy-be keeps them (12.5%); none is no commission.
  const commission = (member: TeamMember) =>
    member.commissionPercent
      ? t(USERS_KEYS.table.commission, { value: member.commissionPercent })
      : null;
  const updated = (member: TeamMember) => format.updated(member.updatedAt);

  const columns: ColumnDef<DataTableFeatures, TeamMember>[] = [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(USERS_KEYS.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <TeamIdCell label={displayId.user(row.original.seq)} />,
      meta: {
        track: '56px',
        kind: 'id',
        foldValue: (original) => displayId.user(rowOf(original).seq),
      },
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: t(USERS_KEYS.columns.user),
      cell: ({ row }) => <TeamUserCell member={row.original} />,
      meta: { track: 'minmax(200px,1.4fr)', kind: 'person' },
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: t(USERS_KEYS.columns.email),
      cell: ({ row }) => <TeamTextCell value={row.original.email} />,
      meta: { track: 'minmax(170px,1.1fr)', defaultHidden: true },
    },
    {
      id: 'role',
      accessorFn: (member) => member.roleIds.join(','),
      header: t(USERS_KEYS.columns.roles),
      cell: ({ row }) => <TeamRolesCell roles={rolePills(row.original)} />,
      meta: {
        track: 'minmax(150px,1fr)',
        kind: 'badges',
        // The phone row's key column (`users.md:39`): it never folds first.
        priority: 1,
        foldValue: (original) => pillsFold(rolePills(rowOf(original))),
      },
    },
    ...(multiBranch
      ? [
          {
            id: 'branches',
            accessorFn: (member: TeamMember) => member.branchIds.join(','),
            header: t(USERS_KEYS.columns.branches),
            enableSorting: false,
            cell: ({ row }: { row: { original: TeamMember } }) => (
              <TeamBranchesCell branches={branchPills(row.original)} />
            ),
            meta: {
              track: 'minmax(130px,.9fr)',
              kind: 'badges' as const,
              foldValue: (original: unknown) => pillsFold(branchPills(rowOf(original))),
            },
          } satisfies ColumnDef<DataTableFeatures, TeamMember>,
        ]
      : []),
    {
      id: 'hours',
      accessorFn: (member) => hours(member),
      header: t(USERS_KEYS.columns.hours),
      enableSorting: false,
      cell: ({ row }) => <TeamTextCell value={hours(row.original)} />,
      meta: {
        track: 'minmax(170px,1fr)',
        defaultHidden: true,
        foldValue: (original) => hours(rowOf(original)),
      },
    },
    {
      id: 'commission',
      accessorFn: (member) => member.commissionPercent,
      header: t(USERS_KEYS.columns.commission),
      cell: ({ row }) => <TeamTextCell value={commission(row.original)} align="end" />,
      meta: {
        track: '96px',
        align: 'end',
        defaultHidden: true,
        foldValue: (original) => commission(rowOf(original)) ?? '—',
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: t(USERS_KEYS.columns.status),
      cell: ({ row }) => <TeamStatusCell member={row.original} />,
      meta: {
        track: '100px',
        kind: 'badges',
        foldValue: (original) => statusFold(rowOf(original)),
      },
    },
    {
      id: 'updatedAt',
      accessorFn: (member) => member.updatedAt,
      header: t(USERS_KEYS.columns.updated),
      cell: ({ row }) => <TeamTextCell value={updated(row.original)} ink="muted" />,
      meta: {
        track: '150px',
        defaultHidden: true,
        foldValue: (original) => updated(rowOf(original)),
      },
    },
  ];
  return columns;
}

/** What {@link useTeamTable} needs from the page. */
export interface TeamTableInput extends TeamColumnsInput {
  /** The rows on screen — searched, filtered and sorted in place. */
  rows: readonly TeamMember[];
  /** The URL's column sort. */
  sort: TeamSort | undefined;
  /** Write a new sort to the URL (`undefined` clears it). */
  onSortChange: (sort: string | undefined) => void;
}

/**
 * The Team table instance (KICKOFF §6.12): the page sorts in place — the
 * header cycles ascending → descending → off and writes the URL's `sort`
 * (`manualSorting`); the Columns choice is a device pref (`useHiddenColumns`,
 * the recommended set hides four); the rows are keyed by membership id.
 */
export function useTeamTable({ rows, sort, onSortChange, ...input }: TeamTableInput) {
  const columns = useTeamColumns(input);
  const visibility = useHiddenColumns(TEAM_TABLE_ID, columns);
  const sorting = useMemo<SortingState>(() => sortingFromSearch(sort), [sort]);
  const onSortingChange: OnChangeFn<SortingState> = (updater) =>
    onSortChange(sortingToSearch(functionalUpdate(updater, sorting)));

  return useTable({
    features: dataTableFeatures,
    data: rows as TeamMember[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (member) => member.membershipId,
    state: { sorting, columnVisibility: visibility.columnVisibility },
    onSortingChange,
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
