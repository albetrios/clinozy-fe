import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  PLATFORM_ROLES,
  USERS_ADMIN_CODES,
} from '../../../__tests__/integration/users-test-router.tsx';
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
  resetClinicFixtures();
  resetClinicAccessFixture();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(USERS_ADMIN_CODES);
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
  it('lists the catalog’s presets, then the custom roles, each named and toned', async () => {
    const { result } = renderHook(() => useRoleDirectory(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.options.map((role) => role.id)).toEqual([
      'admin',
      'doctor',
      'therapist',
      'front_desk',
      'counsellor',
      'pharmacist',
      'accountant',
      'marketing',
      PLATFORM_ROLES.senior.id,
    ]);
    expect(result.current.label('front_desk')).toBe('Front desk');
    expect(result.current.tone('front_desk')).toBe('mint');
    expect(result.current.label(PLATFORM_ROLES.senior.id)).toBe('Senior desk');
  });

  it('names Owner — the org owner’s row — though Owner is not listed', async () => {
    const { result } = renderHook(() => useRoleDirectory(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.pills(['owner', 'doctor'])).toEqual([
      { id: 'owner', label: 'Owner', tone: 'slate' },
      { id: 'doctor', label: 'Doctor', tone: 'sky' },
    ]);
  });
});
