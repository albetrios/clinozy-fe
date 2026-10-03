import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { useClinicAccess } from './useClinicAccess.ts';

function renderAccess() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useClinicAccess(), { wrapper });
}

beforeEach(() => {
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
});

describe('useClinicAccess', () => {
  it('allows nothing until the permission set is known', async () => {
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.roles).toEqual([]));
    expect(result.current.isResolved).toBe(false);
    expect(result.current.can('today', 'view')).toBe(false);
    expect(result.current.viewableSections).toEqual([]);
  });

  it('gives the org owner every room and ability', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['owner']);
    expect(result.current.viewableSections).toHaveLength(10);
    expect(result.current.canAbility('perms')).toBe(true);
  });

  it('shows a member with no clinic role Today only', async () => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.viewableSections).toEqual(['today']);
  });

  it('narrows to the View-as role, and widens again on exit', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    act(() => useUIStore.getState().setPreviewRole('doctor'));
    expect(result.current.previewRole).toBe('doctor');
    expect(result.current.roles).toEqual(['doctor']);
    expect(result.current.viewableSections).toEqual([
      'today',
      'leads',
      'appointments',
      'patients',
      'tasks',
    ]);
    expect(result.current.can('users', 'view')).toBe(false);
    expect(result.current.can('leads', 'delete')).toBe(false);
    expect(result.current.canAbility('perms')).toBe(false);
    expect(result.current.canAbility('clinical')).toBe(true);

    act(() => useUIStore.getState().setPreviewRole(null));
    expect(result.current.roles).toEqual(['owner']);
    expect(result.current.can('users', 'view')).toBe(true);
  });
});
