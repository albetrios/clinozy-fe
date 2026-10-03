import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AccessApiModule from '@/shared/api/clinic/access-api.ts';
import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import { FULL_GRANTS, NO_GRANTS } from '@/shared/api/clinic/access-contracts.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { useClinicRole, useClinicRoles, useUpdateRoleMatrix } from './useClinicRoles.ts';

const { listMembers, listRoles, getRolePermissions } = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  getRolePermissions: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', () => ({
  listMembers,
  listRoles,
  getRolePermissions,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/** Holds a matrix save until a test lets it land, so the optimistic flip can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('@/shared/api/clinic/access-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof AccessApiModule>();
  return {
    ...actual,
    saveRoleMatrixChange: async (
      ...args: Parameters<typeof actual.saveRoleMatrixChange>
    ) => {
      await gate.hold;
      return actual.saveRoleMatrixChange(...args);
    },
  };
});

const ORG = 'org_aaaaaaaaaaaaaaaaaaaaa';

function role(key: string, name: string, isSystem: boolean): RoleSummary {
  return {
    id: `rol_${key.padEnd(21, 'a')}`,
    name,
    description: '',
    permissions: [],
    memberCount: 1,
    isSystem,
  };
}
const ADMIN = role('admin', 'Admin', true);
const DOCTOR = role('doctor', 'Doctor', false);
const SENIOR = role('senior', 'Senior desk', false);

function member(key: string, email: string, platform: RoleSummary): Member {
  return {
    id: `mbr_${key}`,
    userId: `usr_${key}`,
    name: email,
    email,
    role: 'member',
    roleId: platform.id,
    roleName: platform.name,
    status: 'active',
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
  };
}

const page = <T,>(rows: T[]) => ({ rows, next: null, hasMore: false });

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  gate.hold = null;
  resetClinicFixtures();
  resetClinicAccessFixture();
  vi.mocked(notify.error).mockClear();
  listMembers
    .mockReset()
    .mockResolvedValue(
      page([
        member('riya', 'riya@cresence.skin', ADMIN),
        member('reenal', 'reenal@cresence.skin', DOCTOR),
        member('senior', 'senior@clinic.com', SENIOR),
      ]),
    );
  listRoles.mockReset().mockResolvedValue(page([ADMIN, DOCTOR, SENIOR]));
  getRolePermissions
    .mockReset()
    .mockResolvedValue(['organization:read', 'membership:read', 'role:read']);
  useAuthStore.setState({
    user: { id: 'usr_reenal', email: 'reenal@cresence.skin', role: 'user' } as AuthUser,
  });
  useOrganizationStore.setState({ organizationId: ORG });
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'membership:read', 'role:read', 'role:manage']);
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
  resetClinicAccessFixture();
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useClinicRoles', () => {
  it('lists the presets, then the custom roles, each with the members holding it', async () => {
    const { result } = renderHook(() => useClinicRoles(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.roles.map((view) => view.key)).toEqual([
      'admin',
      'doctor',
      'therapist',
      'front_desk',
      'counsellor',
      'pharmacist',
      'accountant',
      'marketing',
      SENIOR.id,
    ]);
    const holders = (key: string) =>
      result.current.roles.find((view) => view.key === key)?.memberIds;
    expect(holders('admin')).toEqual(['mbr_riya']);
    expect(holders('doctor')).toEqual(['mbr_reenal']);
    expect(holders(SENIOR.id)).toEqual(['mbr_senior']);
  });

  it('reports a roles failure in place and reads again on Retry', async () => {
    listRoles.mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => useClinicRoles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.roles.at(-1)?.key).toBe(SENIOR.id);
  });
});

describe('useClinicRole', () => {
  it('reads a platform-backed role’s Users row from its clinozy-be codes', async () => {
    const { result } = renderHook(() => useClinicRole('doctor'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(getRolePermissions).toHaveBeenCalledWith(DOCTOR.id);
    expect(result.current.role?.grants.users).toEqual({ ...NO_GRANTS, view: true });
    expect(result.current.role?.abilities).not.toContain('perms');
  });

  it('reads no codes for a role clinozy-be doesn’t back', async () => {
    const { result } = renderHook(() => useClinicRole('therapist'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.role?.platformRole).toBeNull();
    expect(getRolePermissions).not.toHaveBeenCalled();
  });

  it('is null for a key no role has', async () => {
    const { result } = renderHook(() => useClinicRole('rol_goneaaaaaaaaaaaaaaaaa'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.role).toBeNull();
  });
});

describe('useUpdateRoleMatrix (Q-U6: instant)', () => {
  it('flips the box at once, and every resolver follows once it lands', async () => {
    let release = () => {};
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });
    const { result } = renderHook(
      () => ({
        doctor: useClinicRole('doctor'),
        access: useClinicAccess(),
        update: useUpdateRoleMatrix(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.access.isResolved).toBe(true));
    expect(result.current.access.can('medical', 'view')).toBe(false);

    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = result.current.update.mutateAsync({
        kind: 'section',
        key: 'doctor',
        section: 'medical',
        grants: FULL_GRANTS,
      });
    });
    await waitFor(() =>
      expect(result.current.doctor.role?.grants.medical).toEqual(FULL_GRANTS),
    );
    expect(result.current.access.can('medical', 'delete')).toBe(true);
    release();
    await act(() => saving);
    await waitFor(() =>
      expect(result.current.access.can('medical', 'delete')).toBe(true),
    );
  });

  it('rolls a refused change back with the save-error toast', async () => {
    const { result } = renderHook(
      () => ({ admin: useClinicRole('admin'), update: useUpdateRoleMatrix() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.admin.isPending).toBe(false));
    await act(async () => {
      await result.current.update
        .mutateAsync({
          kind: 'section',
          key: 'admin',
          section: 'leads',
          grants: NO_GRANTS,
        })
        .catch(() => undefined);
    });
    expect(result.current.admin.role?.grants.leads).toEqual(FULL_GRANTS);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it('adds a custom role’s rows in its tone', async () => {
    const { result } = renderHook(
      () => ({ roles: useClinicRoles(), update: useUpdateRoleMatrix() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.roles.isPending).toBe(false));
    await act(() =>
      result.current.update.mutateAsync({
        kind: 'addCustom',
        key: SENIOR.id,
        tone: 'lime',
      }),
    );
    await waitFor(() => expect(result.current.roles.roles.at(-1)?.tone).toBe('lime'));
  });
});
