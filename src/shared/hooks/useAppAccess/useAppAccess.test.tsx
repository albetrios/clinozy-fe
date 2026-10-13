import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRolePermissions: vi.fn(),
}));
import { getRolePermissions } from '@/shared/api/organization-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import {
  holdPreset,
  PRESET_CODES,
  previewPreset,
} from '@/tests/utils/app-preset-codes.ts';

import { canExportRows, useAppAccess } from './useAppAccess.ts';

let client: QueryClient;

function renderAccess() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAppAccess(), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
});
afterEach(() => {
  act(() => {
    useUIStore.getState().setPreviewRole(null);
    useOrganizationStore.getState().clearOrganization();
  });
});

describe('useAppAccess — the member’s own codes', () => {
  it('answers nothing until the codes are known — "not yet", never "not allowed"', () => {
    const { result } = renderAccess();
    expect(result.current.isResolved).toBe(false);
    expect(result.current.can('today', 'view')).toBe(false);
    expect(result.current.viewableSections).toEqual([]);
  });

  it('answers every section and every code from the codes held', () => {
    holdPreset('accountant');
    const { result } = renderAccess();
    expect(result.current.isResolved).toBe(true);
    expect(result.current.previewRole).toBeNull();
    expect(result.current.can('payments', 'view')).toBe(true);
    // Money back is payment:delete (D83): the Accountant gives it back.
    expect(result.current.can('payments', 'delete')).toBe(true);
    expect(result.current.can('stock', 'create')).toBe(false);
    expect(result.current.can('patients', 'view')).toBe(true);
    expect(result.current.can('appointments', 'view')).toBe(false);
    expect(result.current.canCode('payment:export')).toBe(true);
    expect(result.current.canCode('membership:read')).toBe(false);
    expect(result.current.viewableSections).toEqual(
      expect.arrayContaining(['today', 'payments', 'offerings']),
    );
    expect(result.current.viewableSections).not.toContain('users');
  });

  it('opens the Users room to Owner and Admin only (membership:read)', () => {
    for (const role of ['owner', 'admin'] as const) {
      holdPreset(role);
      expect(renderAccess().result.current.can('users', 'view')).toBe(true);
    }
    for (const role of ['doctor', 'front_desk', 'marketing'] as const) {
      holdPreset(role);
      expect(renderAccess().result.current.can('users', 'view')).toBe(false);
    }
  });
});

describe('useAppAccess — View-as answers from the previewed role’s codes', () => {
  it('narrows an Owner to the Accountant’s codes while the preview runs, and back after', async () => {
    holdPreset('owner');
    const { result } = renderAccess();
    expect(result.current.can('appointments', 'view')).toBe(true);

    act(() => previewPreset(client, 'accountant'));
    await waitFor(() => expect(result.current.previewRole).toBe('rol_accountant'));
    expect(result.current.isResolved).toBe(true);
    expect(result.current.can('appointments', 'view')).toBe(false);
    expect(result.current.can('payments', 'view')).toBe(true);
    expect(result.current.canCode('payment:export')).toBe(true);
    expect(result.current.canCode('role:read')).toBe(false);

    act(() => useUIStore.getState().setPreviewRole(null));
    await waitFor(() => expect(result.current.can('appointments', 'view')).toBe(true));
  });

  it('reads a previewed role’s codes from clinozy-be, and is unresolved until they answer', async () => {
    holdPreset('owner');
    let answer!: (codes: string[]) => void;
    vi.mocked(getRolePermissions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve as (codes: string[]) => void;
      }),
    );
    const { result } = renderAccess();
    act(() => useUIStore.getState().setPreviewRole('rol_counsellor'));
    await waitFor(() =>
      expect(getRolePermissions).toHaveBeenCalledWith('rol_counsellor'),
    );
    expect(result.current.isResolved).toBe(false);

    act(() => answer([...PRESET_CODES.counsellor]));
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.can('leads', 'create')).toBe(true);
    expect(result.current.can('users', 'view')).toBe(false);
  });

  it('previews nothing — never the member’s own access — when the role’s codes cannot be read', async () => {
    holdPreset('owner');
    vi.mocked(getRolePermissions).mockRejectedValue(new Error('403'));
    const { result } = renderAccess();
    act(() => useUIStore.getState().setPreviewRole('rol_gone'));
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.viewableSections).toEqual(['today']);
    expect(result.current.canCode('organization:read')).toBe(false);
  });
});

describe('canExportRows', () => {
  it('needs the room’s own export code, and nothing before the access resolves', () => {
    expect(
      canExportRows({ isResolved: false, canCode: () => true }, 'patient:export'),
    ).toBe(false);
    const holds = (code: string) => code === 'patient:export';
    expect(canExportRows({ isResolved: true, canCode: holds }, 'patient:export')).toBe(
      true,
    );
    expect(canExportRows({ isResolved: true, canCode: holds }, 'medicine:export')).toBe(
      false,
    );
  });
});
