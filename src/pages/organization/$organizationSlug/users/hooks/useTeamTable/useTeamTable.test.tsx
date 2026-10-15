import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Branch } from '@/shared/api/app/app-schema.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { RoleDirectory } from '@/shared/hooks/useRoleDirectory/index.ts';

import { useTeamTable } from './useTeamTable.tsx';

const ADAJAN = { id: 'b1', name: 'Adajan', tone: 'sage' } as Branch;
const VESU = { id: 'b2', name: 'Vesu', tone: 'sky' } as Branch;

const roles: RoleDirectory = {
  roles: [],
  options: [],
  label: (key) => ({ doctor: 'Doctor', admin: 'Admin' })[key] ?? key,
  tone: () => 'sky',
  pills: (keys) => keys.map((key) => ({ id: key, label: key, tone: 'sky' as const })),
  isPending: false,
};

function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: 'mbr_reenal',
    userId: 'usr_reenal',
    email: 'reenal@cresence.skin',
    status: 'active',
    invitation: null,
    platformRoleId: 'rol_member',
    platformRoleName: 'Member',
    joinedAt: '2026-09-01T10:00:00.000Z',
    isOwner: false,
    isSelf: false,
    name: 'Dr. Reenal Chaniyara',
    initials: 'RC',
    tone: 'lav',
    roleKeys: ['doctor'],
    seq: 11,
    phone: null,
    branchIds: ['b1', 'b2'],
    presence: 'away',
    lastActiveAt: null,
    profile: null,
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

function table(multiBranch: boolean, sort?: `${'seq' | 'name'}:${'asc' | 'desc'}`) {
  const onSortChange = vi.fn();
  const { result } = renderHook(
    () =>
      useTeamTable({
        rows: [teamMember()],
        sort,
        onSortChange,
        roles,
        branches: [ADAJAN, VESU],
        multiBranch,
      }),
    { wrapper },
  );
  return { table: result.current, onSortChange };
}

describe('useTeamTable (users.md:30–40)', () => {
  it('lays out the nine columns, the recommended set hiding four', () => {
    const { table: team } = table(true);
    expect(team.getAllLeafColumns().map((column) => column.id)).toEqual([
      'seq',
      'name',
      'email',
      'role',
      'branches',
      'hours',
      'commission',
      'status',
      'updatedAt',
    ]);
    expect(team.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'seq',
      'name',
      'role',
      'branches',
      'status',
    ]);
  });

  it('has no Branches column with one open branch (users.md:95)', () => {
    const { table: team } = table(false);
    expect(team.getAllLeafColumns().map((column) => column.id)).not.toContain('branches');
  });

  it('makes Roles the phone row’s key column and folds the branches as their names', () => {
    const { table: team } = table(true);
    const role = team.getColumn('role');
    expect(role?.columnDef.meta?.priority).toBe(1);
    const branches = team.getColumn('branches');
    expect(branches?.columnDef.meta?.foldValue?.(teamMember())).toMatchObject({
      value: 'Adajan, Vesu',
    });
  });

  it('folds an active status quietly — the phone line drops "Active"', () => {
    const { table: team } = table(true);
    const status = team.getColumn('status');
    expect(status?.columnDef.meta?.foldValue?.(teamMember())).toMatchObject({
      value: 'Active',
      quiet: true,
    });
    expect(
      status?.columnDef.meta?.foldValue?.(teamMember({ status: 'suspended' })),
    ).toMatchObject({ value: 'Inactive' });
  });

  it('reads the URL’s sort and writes a new one back', () => {
    const { table: team, onSortChange } = table(true, 'name:desc');
    expect(team.getColumn('name')?.getIsSorted()).toBe('desc');
    team.getColumn('seq')?.toggleSorting(false);
    expect(onSortChange).toHaveBeenCalledWith('seq:asc');
  });
});
