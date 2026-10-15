import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { PLATFORM_ROLES } from '@/tests/utils/team-doubles.ts';

import { useRoleDirectory } from './useRoleDirectory.ts';

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listRoles: vi.fn() }));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(PRESET_CODES.owner);
  useAuthStore
    .getState()
    .setUser({ id: 'usr_riya', email: 'riya@cresence.skin', role: 'user', name: 'Riya' });
  api.listMembers.mockResolvedValue({ rows: [], next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
});
afterEach(() => {
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
});

describe('useRoleDirectory', () => {
  it('lists every role but Owner in creation order, each named and toned by its id', async () => {
    const { result } = renderHook(() => useRoleDirectory(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const { owner, ...listed } = PLATFORM_ROLES;
    expect(result.current.roles.map((role) => role.id)).toEqual(
      Object.values(listed).map((role) => role.id),
    );
    expect(result.current.options[0]).toEqual({
      id: PLATFORM_ROLES.admin.id,
      label: 'Admin',
      tone: 'plum',
    });
    expect(result.current.label(PLATFORM_ROLES.front_desk.id)).toBe('Front desk');
    expect(result.current.label(PLATFORM_ROLES.senior.id)).toBe('Senior desk');
    expect(result.current.tone(PLATFORM_ROLES.senior.id)).toBe('lime');
    expect(result.current.preset(PLATFORM_ROLES.doctor.id)).toBe('doctor');
    expect(result.current.preset(PLATFORM_ROLES.senior.id)).toBeNull();
    // Owner is no pill to give, yet still named on the owner's own row.
    expect(result.current.label(owner.id)).toBe('Owner');
  });

  it('finds the clinic’s role for a preset — a Quick fill’s, the default Front desk', async () => {
    const { result } = renderHook(() => useRoleDirectory(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.presetRoleId('front_desk')).toBe(PLATFORM_ROLES.front_desk.id);
    expect(
      result.current.pills([PLATFORM_ROLES.doctor.id, PLATFORM_ROLES.senior.id]),
    ).toEqual([
      { id: PLATFORM_ROLES.doctor.id, label: 'Doctor', tone: 'sky' },
      { id: PLATFORM_ROLES.senior.id, label: 'Senior desk', tone: 'lime' },
    ]);
  });

  it('has no preset role a clinic no longer keeps', async () => {
    api.listRoles.mockResolvedValue({
      rows: [PLATFORM_ROLES.admin],
      next: null,
      hasMore: false,
    });
    const { result } = renderHook(() => useRoleDirectory(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.presetRoleId('front_desk')).toBeNull();
  });
});
