import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { previewPreset } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { usePaymentAccess } from './usePaymentAccess.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The gates for a member holding `codes` — or View-as `role`. */
function renderAccess(codes: readonly OrganizationPermission[], role?: Role) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  if (role) previewPreset(client, role);
  return renderHook(() => usePaymentAccess(), { wrapper });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('usePaymentAccess', () => {
  it('answers each gate from the member’s own payment:* code', async () => {
    const { result } = renderAccess([
      'organization:read',
      'payment:read',
      'payment:create',
      'payment:export',
    ]);
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toEqual({
      resolved: true,
      canRead: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
      canGiveBack: false,
      canExport: true,
    });
  });

  it('gives money back only with payment:create and payment:delete — the Front desk takes, never refunds (D83)', async () => {
    const frontDesk = renderAccess(['payment:read', 'payment:create', 'payment:update']);
    await waitFor(() => expect(frontDesk.result.current.resolved).toBe(true));
    expect(frontDesk.result.current).toMatchObject({
      canCreate: true,
      canGiveBack: false,
    });
    const accountant = renderAccess([
      'payment:read',
      'payment:create',
      'payment:update',
      'payment:delete',
    ]);
    await waitFor(() => expect(accountant.result.current.resolved).toBe(true));
    expect(accountant.result.current.canGiveBack).toBe(true);
  });

  it('reverses and deletes with payment:delete — the Accountant’s now (#158)', async () => {
    const { result } = renderAccess(['payment:read', 'payment:update', 'payment:delete']);
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({
      canEdit: true,
      canDelete: true,
      canCreate: false,
      canExport: false,
    });
  });

  it('follows the previewed role’s own codes under View-as, not the viewer’s', async () => {
    const { result } = renderAccess(['organization:read'], 'admin');
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({
      canRead: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    });
    const doctor = renderAccess(['organization:read'], 'doctor');
    await waitFor(() => expect(doctor.result.current.resolved).toBe(true));
    expect(doctor.result.current.canCreate).toBe(false);
  });
});
