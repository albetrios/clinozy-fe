import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  member,
  PLATFORM_ROLES,
  platformRole,
  SELF,
} from '@/tests/utils/team-doubles.ts';

import { USERS_ADMIN_CODES } from '../../../__tests__/integration/users-test-router.tsx';
import { useNewRole } from './useNewRole.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/notify.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  createRole: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const CREATED = platformRole('created', 'New role 2', false);

function setUp(codes: OrganizationPermission[] = USERS_ADMIN_CODES) {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(codes);
  useAuthStore
    .getState()
    .setUser({ id: SELF.userId, email: SELF.email, role: 'user', name: 'Riya Shah' });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onCreated = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNewRole(onCreated), { wrapper });
  return { hook, onCreated };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  api.listMembers.mockResolvedValue({
    rows: [member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId })],
    next: null,
    hasMore: false,
  });
  // A custom role already called "New role": the next one is "New role 2".
  api.listRoles.mockResolvedValue({
    rows: [...Object.values(PLATFORM_ROLES), platformRole('first', 'New role', false)],
    next: null,
    hasMore: false,
  });
  api.createRole.mockResolvedValue(CREATED);
});
afterEach(() => {
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
});

describe('useNewRole (H:5187)', () => {
  it('creates the next "New role" in one call — no access, the next tone — and selects it', async () => {
    const { hook, onCreated } = setUp();
    await waitFor(() => expect(api.listRoles).toHaveBeenCalled());
    // Wait for the access and the roles to answer before pressing.
    await waitFor(async () => {
      await act(() => hook.result.current());
      expect(api.createRole).toHaveBeenCalled();
    });
    // Two custom roles already (Senior desk, New role): the third tone.
    expect(api.createRole).toHaveBeenCalledWith({
      input: {
        name: 'New role 2',
        description: 'Custom role',
        permissions: ['organization:read'],
        tone: 'mint',
      },
      idempotencyKey: expect.any(String),
    });
    expect(onCreated).toHaveBeenCalledWith(CREATED.id);
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Role added · name it and pick what it can do',
    );
  });

  it('says why without role:create and creates nothing', async () => {
    const { hook, onCreated } = setUp(
      USERS_ADMIN_CODES.filter((code) => code !== 'role:create'),
    );
    await waitFor(async () => {
      await act(() => hook.result.current());
      expect(notifyMock.info).toHaveBeenCalledWith('You can’t add roles · ask an admin');
    });
    expect(api.createRole).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('selects nothing when clinozy-be refuses the role', async () => {
    api.createRole.mockRejectedValue(new Error('offline'));
    const { hook, onCreated } = setUp();
    await waitFor(async () => {
      await act(() => hook.result.current());
      expect(api.createRole).toHaveBeenCalled();
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(notifyMock.success).not.toHaveBeenCalled();
  });
});
