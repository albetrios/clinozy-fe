import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type OrganizationPermission,
  organizationPermissionSchema,
} from '@/core/types/permissions.ts';
import {
  resetClinicAccessFixture,
  saveRoleMatrixChange,
} from '@/shared/api/clinic/access-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { useClinicAccess } from './useClinicAccess.ts';

/** clinozy-be's org owner holds every code; Member and Viewer are its seeded read roles. */
const OWNER_CODES = [...organizationPermissionSchema.options];
const MEMBER_CODES: OrganizationPermission[] = [
  'organization:read',
  'membership:read',
  'role:read',
];
const VIEWER_CODES: OrganizationPermission[] = ['organization:read', 'membership:read'];
/** A custom role's clinozy-be id (Appendix F). */
const CUSTOM_ROLE = 'rol_customaaaaaaaaaaaaaaa';

function renderAccess() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useClinicAccess(), { wrapper });
}

/** Sign in as `email` with `codes` in the active organisation. */
function signIn(email: string | null, codes: OrganizationPermission[]) {
  useAuthStore.setState({
    user: email ? ({ id: 'usr_me', email, role: 'user' } as AuthUser) : null,
  });
  useOrganizationStore.getState().setPermissions(codes);
}

beforeEach(() => {
  resetClinicFixtures();
  resetClinicAccessFixture();
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
});
afterEach(() => {
  useAuthStore.setState({ user: null });
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
    signIn('owner@elsewhere.com', OWNER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['owner']);
    expect(result.current.viewableSections).toHaveLength(10);
    expect(result.current.canAbility('perms')).toBe(true);
  });

  it('shows a member with no clinic role Today only', async () => {
    signIn(null, ['organization:read']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.viewableSections).toEqual(['today']);
  });

  it('narrows to the View-as role, and widens again on exit', async () => {
    signIn('owner@elsewhere.com', OWNER_CODES);
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

  it('narrows to a custom role’s own matrix rows (L-31e)', async () => {
    await saveRoleMatrixChange({ kind: 'addCustom', key: CUSTOM_ROLE, tone: 'lime' });
    await saveRoleMatrixChange({
      kind: 'section',
      key: CUSTOM_ROLE,
      section: 'leads',
      grants: { view: true, create: true, edit: false, delete: false },
    });
    signIn('owner@elsewhere.com', OWNER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    act(() => useUIStore.getState().setPreviewRole(CUSTOM_ROLE));
    await waitFor(() =>
      expect(result.current.viewableSections).toEqual(['today', 'leads']),
    );
    expect(result.current.previewRole).toBe(CUSTOM_ROLE);
    // A custom role has no contract role: it counts in `can` alone.
    expect(result.current.roles).toEqual([]);
    expect(result.current.can('leads', 'create')).toBe(true);
    expect(result.current.can('leads', 'edit')).toBe(false);
    expect(result.current.can('users', 'view')).toBe(false);
    expect(result.current.canAbility('perms')).toBe(false);
  });
});

describe('useClinicAccess — the staff profile’s roles (L-31)', () => {
  it('takes the signed-in member’s clinic roles from their staff profile', async () => {
    signIn('farah@cresence.skin', VIEWER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['pharmacist']);
    expect(result.current.viewableSections).toEqual([
      'today',
      'patients',
      'medical',
      'stock',
      'tasks',
    ]);
    expect(result.current.canAbility('void')).toBe(true);
  });

  it('unions the profile’s roles, the main role first, Owner on top for the org owner', async () => {
    signIn('RIYA@cresence.skin', OWNER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['front_desk', 'admin', 'owner']);
    expect(result.current.can('medical', 'delete')).toBe(true);
  });

  it('falls back to the platform codes without a profile — least privilege', async () => {
    signIn('someone@elsewhere.com', ['organization:read', 'membership:manage']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['admin']);
  });

  it('previews the role, never the profile, while View-as runs', async () => {
    signIn('riya@cresence.skin', OWNER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    act(() => useUIStore.getState().setPreviewRole('accountant'));
    expect(result.current.roles).toEqual(['accountant']);
    expect(result.current.can('payments', 'edit')).toBe(true);
    expect(result.current.can('leads', 'view')).toBe(false);
  });
});

describe('useClinicAccess — Users gates on clinozy-be codes (D17)', () => {
  it('opens the Users room read-only to a Member, whatever their clinic role', async () => {
    signIn('reenal@cresence.skin', MEMBER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['doctor']);
    expect(result.current.can('users', 'view')).toBe(true);
    expect(result.current.can('users', 'create')).toBe(false);
    expect(result.current.can('users', 'delete')).toBe(false);
    expect(result.current.canAbility('perms')).toBe(false);
    expect(result.current.viewableSections).toContain('users');
  });

  it('keeps the Users room shut without role:read — a Viewer — even for a clinic Admin', async () => {
    signIn('daxil@cresence.skin', VIEWER_CODES);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.roles).toEqual(['admin']);
    expect(result.current.can('users', 'view')).toBe(false);
    expect(result.current.can('medical', 'delete')).toBe(true);
    expect(result.current.canAbility('perms')).toBe(false);
  });

  it('gives "Change roles & access" with role:manage', async () => {
    signIn('reenal@cresence.skin', [...MEMBER_CODES, 'role:manage']);
    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.canAbility('perms')).toBe(true);
    expect(result.current.canAbility('void')).toBe(false);
  });
});
