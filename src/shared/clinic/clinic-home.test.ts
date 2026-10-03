import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { Section } from '@/shared/api/clinic/clinic-schema.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { clinicHomeRoute, clinicHomeSection } from './clinic-home.ts';

const disabled = vi.hoisted(() => ({ modules: new Set<string>() }));
vi.mock('@/core/security/gates/require-module.ts', () => ({
  isModuleEnabled: (key: string) => !disabled.modules.has(key),
}));

const everyRoomOpen = () => true;

describe('clinicHomeSection (D25)', () => {
  it.each<[ClinicRoleKey[], Section]>([
    [['pharmacist'], 'medical'],
    [['accountant'], 'payments'],
    [['marketing'], 'leads'],
    [['doctor'], 'today'],
    [['front_desk'], 'today'],
    [['owner'], 'today'],
    [[], 'today'],
    [['accountant', 'pharmacist'], 'payments'],
    [['rol_abcdefghijklmnopqrstu', 'pharmacist'], 'today'],
  ])('%j → %s', (roles, home) => {
    expect(clinicHomeSection(roles, everyRoomOpen)).toBe(home);
  });

  it('falls back to the first open room in nav order', () => {
    expect(
      clinicHomeSection(
        ['marketing'],
        (section) => section !== 'leads' && section !== 'today',
      ),
    ).toBe('appointments');
  });

  it('is null when no room is open', () => {
    expect(clinicHomeSection(['doctor'], () => false)).toBeNull();
  });
});

describe('clinicHomeRoute', () => {
  beforeEach(() => {
    disabled.modules = new Set();
    useUIStore.getState().setPreviewRole(null);
    useAuthStore.setState({ user: null });
  });

  it('sends a member home by their staff profile’s main role (L-31)', async () => {
    useAuthStore.setState({
      user: { id: 'usr_farah', email: 'farah@cresence.skin', role: 'user' } as AuthUser,
    });
    useOrganizationStore.getState().setPermissions(['organization:read']);
    expect((await clinicHomeRoute('acme'))?.to).toBe(
      '/organization/$organizationSlug/medical',
    );
  });

  it('sends the org owner to Today', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    expect(await clinicHomeRoute('acme')).toEqual({
      to: '/organization/$organizationSlug/today',
      params: { organizationSlug: 'acme' },
    });
  });

  it('follows a View-as preview', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    useUIStore.getState().setPreviewRole('accountant');
    expect((await clinicHomeRoute('acme'))?.to).toBe(
      '/organization/$organizationSlug/payments',
    );
  });

  it('is null when the deployment enables no clinic room', async () => {
    disabled.modules = new Set([
      'clinic-today',
      'clinic-leads',
      'clinic-appointments',
      'clinic-patients',
      'clinic-medical',
      'clinic-stock',
      'clinic-payments',
      'clinic-tasks',
      'clinic-offerings',
      'clinic-users',
    ]);
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    expect(await clinicHomeRoute('acme')).toBeNull();
  });
});
