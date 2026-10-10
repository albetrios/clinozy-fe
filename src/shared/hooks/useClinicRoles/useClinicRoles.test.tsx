import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import {
  type DirectoryRole,
  fetchRoleDirectory,
} from '@/shared/api/clinic/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import type { MyRole } from '@/shared/tenancy/me-context.ts';

import { useClinicRoles, useRoleLabel, useRolesInForce } from './useClinicRoles.ts';

vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchRoleDirectory: vi.fn(),
}));

const me = vi.hoisted(() => ({ myRoles: undefined as MyRole[] | undefined }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: me.myRoles ? { myRoles: me.myRoles } : undefined }),
}));

const DOCTOR: DirectoryRole = {
  id: 'rol_doctor0000000000000000',
  name: 'Doctor',
  tone: 'sky',
  isSystem: true,
  isLocked: false,
  preset: 'doctor',
};
const FLOOR: DirectoryRole = {
  id: 'rol_floor00000000000000000',
  name: 'Floor manager',
  tone: 'lime',
  isSystem: false,
  isLocked: false,
  preset: null,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  vi.mocked(fetchRoleDirectory).mockReset().mockResolvedValue([DOCTOR, FLOOR]);
  me.myRoles = undefined;
});
afterEach(() => {
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useRoleLabel', () => {
  it('names a preset in the clinic’s own words and the clinic’s own role by its name', () => {
    const { result } = renderHook(() => useRoleLabel());
    expect(result.current({ name: 'Front desk', preset: 'front_desk' })).toBe(
      'Front desk',
    );
    expect(result.current({ name: 'Floor manager', preset: null })).toBe('Floor manager');
  });
});

describe('useClinicRoles', () => {
  it('reads the role directory once and names and tones each role by its id', async () => {
    const { result } = renderHook(() => useClinicRoles(), { wrapper });
    await waitFor(() => expect(result.current.roles).toEqual([DOCTOR, FLOOR]));
    expect(result.current.labelOf(DOCTOR.id)).toBe('Doctor');
    expect(result.current.labelOf(FLOOR.id)).toBe('Floor manager');
    expect(result.current.toneOf(FLOOR.id)).toBe('lime');
    // A role the directory does not know: no name, the id's own hashed tone.
    expect(result.current.labelOf('rol_gone00000000000000000')).toBe('');
    expect(result.current.toneOf('rol_gone00000000000000000')).toEqual(
      expect.any(String),
    );
    expect(fetchRoleDirectory).toHaveBeenCalledOnce();
  });

  it('reads nothing while not enabled', () => {
    const { result } = renderHook(() => useClinicRoles(false), { wrapper });
    expect(result.current.roles).toEqual([]);
    expect(fetchRoleDirectory).not.toHaveBeenCalled();
  });
});

describe('useRolesInForce', () => {
  it('is the member’s own roles off me/context, the main role first — no directory read', () => {
    me.myRoles = [
      { id: DOCTOR.id, name: 'Doctor', tone: 'sky', isSystem: true },
      { id: FLOOR.id, name: 'Floor manager', tone: 'lime', isSystem: false },
    ];
    const { result } = renderHook(() => useRolesInForce(), { wrapper });
    expect(result.current.map((role) => [role.id, role.preset])).toEqual([
      [DOCTOR.id, 'doctor'],
      [FLOOR.id, null],
    ]);
    expect(fetchRoleDirectory).not.toHaveBeenCalled();
  });

  it('is the previewed role alone during View-as, from the directory', async () => {
    me.myRoles = [
      { id: 'rol_owner00000000000000000', name: 'Owner', tone: 'slate', isSystem: true },
    ];
    const { result } = renderHook(() => useRolesInForce(), { wrapper });
    act(() => useUIStore.setState({ previewRole: FLOOR.id }));
    await waitFor(() => expect(result.current).toEqual([FLOOR]));
  });

  it('is empty until the roles are known', () => {
    const { result } = renderHook(() => useRolesInForce(), { wrapper });
    expect(result.current).toEqual([]);
  });
});
