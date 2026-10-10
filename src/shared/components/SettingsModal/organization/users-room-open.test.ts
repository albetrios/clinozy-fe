import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type * as RequireModule from '@/core/security/gates/require-module.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { useUsersRoomOpen } from './users-room-open.ts';

const disabled = vi.hoisted(() => ({ modules: new Set<string>() }));
vi.mock('@/core/security/gates/require-module.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof RequireModule>()),
  isModuleEnabled: (key: string) => !disabled.modules.has(key),
}));

function hold(codes: OrganizationPermission[]) {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(codes);
}

beforeEach(() => {
  disabled.modules.clear();
});
afterEach(() => {
  // Still mounted here: the store write re-renders whatever reads it.
  act(() => useOrganizationStore.getState().clearOrganization());
});

describe('useUsersRoomOpen (D17)', () => {
  it('is open with the module on and the code that opens its Team (membership:read)', () => {
    hold(['membership:read']);
    expect(renderHook(() => useUsersRoomOpen()).result.current).toBe(true);
  });

  it('is shut without membership:read — the Settings panels stay', () => {
    hold(['role:read', 'organization:read']);
    expect(renderHook(() => useUsersRoomOpen()).result.current).toBe(false);
  });

  it('is shut where the deployment turns the room off (production until its API lands, D8)', () => {
    disabled.modules.add('clinic-users');
    hold(['membership:read', 'role:read']);
    expect(renderHook(() => useUsersRoomOpen()).result.current).toBe(false);
  });
});
