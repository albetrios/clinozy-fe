import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRolePermissions: vi.fn(),
}));
import { queryClient } from '@/core/http/queryClient.ts';
import type { Role, Section } from '@/shared/api/app/app-schema.ts';
import { getRolePermissions } from '@/shared/api/organization-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { holdPreset, PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';

import { appHomeRoute, appHomeSection, movedBranchesLocation } from './app-home.ts';

const disabled = vi.hoisted(() => ({ modules: new Set<string>() }));
vi.mock('@/core/security/gates/require-module.ts', () => ({
  isModuleEnabled: (key: string) => !disabled.modules.has(key),
}));

const everyRoomOpen = () => true;
const holding =
  (...codes: readonly string[]) =>
  (code: string) =>
    codes.includes(code);

describe('appHomeSection (D25, re-derived on codes)', () => {
  it.each<[Role, Section]>([
    ['owner', 'today'],
    ['admin', 'today'],
    ['doctor', 'today'],
    ['therapist', 'today'],
    ['front_desk', 'today'],
    ['counsellor', 'today'],
    // Reads appointments since D83, books none, sells medicines: still the pharmacy.
    ['pharmacist', 'medical'],
    ['accountant', 'payments'],
    ['marketing', 'leads'],
  ])('a %s’s codes land on %s', (role, home) => {
    expect(appHomeSection(holding(...PRESET_CODES[role]), everyRoomOpen)).toBe(home);
  });

  it('lands an edited or custom role by what it holds', () => {
    expect(appHomeSection(holding('payment:read', 'lead:read'), everyRoomOpen)).toBe(
      'payments',
    );
    expect(appHomeSection(holding('appointment:read'), everyRoomOpen)).toBe('today');
  });

  it('skips a home whose room is shut, then falls back to the first open room in nav order', () => {
    const isOpen = (section: Section) => section !== 'medical' && section !== 'today';
    expect(appHomeSection(holding('medicine:create', 'payment:read'), isOpen)).toBe(
      'payments',
    );
    expect(appHomeSection(holding('medicine:create'), isOpen)).toBe('leads');
  });

  it('is null when no room is open', () => {
    expect(appHomeSection(holding(...PRESET_CODES.doctor), () => false)).toBeNull();
  });
});

describe('appHomeRoute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    disabled.modules = new Set();
    useOrganizationStore.getState().setOrganization('org_test', 'acme');
    useUIStore.getState().setPreviewRole(null);
  });

  it('sends a member home by their own codes', async () => {
    holdPreset('accountant');
    expect(await appHomeRoute('acme')).toEqual({
      to: '/organization/$organizationSlug/payments',
      params: { organizationSlug: 'acme' },
    });
  });

  it('opens only rooms the member’s codes view', async () => {
    disabled.modules = new Set(['app-today']);
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'appointment:read']);
    expect((await appHomeRoute('acme'))?.to).toBe(
      '/organization/$organizationSlug/appointments',
    );
  });

  it('follows a View-as preview by the previewed role’s codes', async () => {
    holdPreset('owner');
    vi.mocked(getRolePermissions).mockResolvedValue([...PRESET_CODES.marketing]);
    useUIStore.getState().setPreviewRole('rol_marketing');
    expect((await appHomeRoute('acme'))?.to).toBe(
      '/organization/$organizationSlug/leads',
    );
    expect(getRolePermissions).toHaveBeenCalledWith('rol_marketing');
  });

  it('is null when the deployment enables no clinic room', async () => {
    disabled.modules = new Set([
      'app-today',
      'app-leads',
      'app-appointments',
      'app-patients',
      'app-medical',
      'app-stock',
      'app-payments',
      'app-tasks',
      'app-offerings',
      'app-users',
      'app-branches',
    ]);
    holdPreset('owner');
    expect(await appHomeRoute('acme')).toBeNull();
  });
});

describe('movedBranchesLocation (change-branches-in-navbar)', () => {
  const at = (rest: string) => movedBranchesLocation({ organizationSlug: 'acme', rest });
  const slug = { organizationSlug: 'acme' };

  it('sends an old Users › Branches path to the same place in the Branches room', () => {
    expect(at('')).toEqual({
      to: '/organization/$organizationSlug/branches',
      params: slug,
    });
    expect(at('create')).toEqual({
      to: '/organization/$organizationSlug/branches/create',
      params: slug,
    });
    expect(at('create/')).toEqual(at('create'));
    expect(at('brn_1/edit')).toEqual({
      to: '/organization/$organizationSlug/branches/$branchId/edit',
      params: { ...slug, branchId: 'brn_1' },
    });
    expect(at('brn_1')).toEqual(at(''));
  });
});
