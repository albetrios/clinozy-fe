import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

// Leads and Appointments are on the API; every other room still reads fixtures.
import type { OrganizationPermission } from '@/core/types/permissions.ts';
import {
  resetClinicAccessFixture,
  resolveAccessFromCodes,
} from '@/shared/api/clinic/access-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { canExportRows, useClinicAccess } from './useClinicAccess.ts';

function renderAccess() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useClinicAccess(), { wrapper });
}

function signIn(codes: OrganizationPermission[]) {
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'front@clinic.test', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setPermissions(codes);
}

beforeEach(() => {
  resetClinicFixtures();
  resetClinicAccessFixture();
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
});

describe('resolveAccessFromCodes', () => {
  it('maps each section action to its resource code', () => {
    const access = resolveAccessFromCodes(['lead:read', 'lead:update', 'payment:create']);

    expect(access.can('leads', 'view')).toBe(true);
    expect(access.can('leads', 'edit')).toBe(true);
    expect(access.can('leads', 'create')).toBe(false);
    expect(access.can('leads', 'delete')).toBe(false);
    expect(access.can('payments', 'create')).toBe(true);
    expect(access.can('payments', 'view')).toBe(false);
    expect(access.can('patients', 'view')).toBe(false);
  });

  it('reads offerings with organization:read and writes them with the offering codes', () => {
    const access = resolveAccessFromCodes(['organization:read', 'offering:update']);

    expect(access.can('offerings', 'view')).toBe(true);
    expect(access.can('offerings', 'edit')).toBe(true);
    expect(access.can('offerings', 'create')).toBe(false);
  });

  it('always shows Today and lists the viewable sections in nav order', () => {
    const access = resolveAccessFromCodes(['task:read', 'lead:read', 'stock_item:read']);

    expect(access.can('today', 'view')).toBe(true);
    expect(access.can('today', 'edit')).toBe(false);
    expect(access.viewableSections).toEqual(['today', 'leads', 'stock', 'tasks']);
  });

  it('answers no ability — a room on the API asks for its exact code', () => {
    expect(resolveAccessFromCodes(['payment:delete']).canAbility('void')).toBe(false);
  });
});

describe('useClinicAccess — a room on the API answers from the member’s codes', () => {
  it('opens Leads and Appointments by their codes and keeps the fixture rooms on the matrix', async () => {
    // A member with only lead and appointment codes: no clinic role and no staff profile, so
    // the fixture matrix would show them Today only. Offerings is on the API too and every
    // member reads it (`organization:read`, research §7).
    signIn([
      'organization:read',
      'lead:read',
      'lead:create',
      'appointment:read',
      'appointment:update',
    ]);

    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    expect(result.current.can('leads', 'view')).toBe(true);
    expect(result.current.can('leads', 'create')).toBe(true);
    expect(result.current.can('leads', 'delete')).toBe(false);
    expect(result.current.can('appointments', 'view')).toBe(true);
    expect(result.current.can('appointments', 'edit')).toBe(true);
    expect(result.current.can('appointments', 'create')).toBe(false);
    expect(result.current.can('patients', 'view')).toBe(false);
    expect(result.current.viewableSections).toEqual([
      'today',
      'leads',
      'appointments',
      'offerings',
    ]);
    expect(result.current.can('offerings', 'edit')).toBe(false);
  });

  it('a live room loses what the codes do not grant, whatever the matrix says', async () => {
    // The org owner's codes without any lead, appointment or patient code: the matrix gives
    // Owner everything, and a room still on fixtures keeps it.
    signIn(['organization:read', 'organization:delete', 'membership:read', 'role:read']);

    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    expect(result.current.roles).toEqual(['owner']);
    expect(result.current.can('leads', 'view')).toBe(false);
    expect(result.current.can('appointments', 'view')).toBe(false);
    expect(result.current.can('patients', 'view')).toBe(false);
    expect(result.current.can('medical', 'view')).toBe(true);
  });

  it('shows Today to every member and gives it no write of its own — its actions ask their rooms’ codes', async () => {
    signIn(['organization:read', 'organization:delete', 'membership:read', 'role:read']);

    const { result } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    expect(result.current.can('today', 'view')).toBe(true);
    expect(result.current.can('today', 'edit')).toBe(false);
    // Today's work queue is the tasks' (D155): the owner's codes hold no task code here.
    expect(result.current.can('tasks', 'view')).toBe(false);
  });

  it('canCode answers one exact code, and nothing while View-as runs', async () => {
    signIn(['organization:read', 'lead:export']);

    const { result, rerender } = renderAccess();
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.canCode('lead:export')).toBe(true);
    expect(result.current.canCode('appointment:export')).toBe(false);

    useUIStore.getState().setPreviewRole('doctor');
    rerender();
    await waitFor(() => expect(result.current.previewRole).toBe('doctor'));
    expect(result.current.canCode('lead:export')).toBe(false);
  });
});

describe("canExportRows — the bulk bar's Export", () => {
  const access = (over: Partial<Parameters<typeof canExportRows>[0]> = {}) => ({
    isResolved: true,
    previewRole: null,
    canCode: (code: string) => code === 'patient:export',
    canAbility: () => true,
    ...over,
  });

  it('asks a room on the API for its own export code, not the matrix', () => {
    expect(canExportRows(access(), 'patient:export')).toBe(true);
    expect(canExportRows(access(), 'payment:export')).toBe(false);
    expect(canExportRows(access({ canAbility: () => false }), 'patient:export')).toBe(
      true,
    );
  });

  it('asks the matrix while View-as runs, or for a room still on fixtures', () => {
    expect(
      canExportRows(
        access({ previewRole: 'front_desk', canAbility: () => false }),
        'patient:export',
      ),
    ).toBe(false);
    expect(canExportRows(access({ previewRole: 'doctor' }), 'payment:export')).toBe(true);
    expect(canExportRows(access({ canAbility: () => false }), undefined)).toBe(false);
  });

  it('offers nothing until the access has answered', () => {
    expect(canExportRows(access({ isResolved: false }), 'patient:export')).toBe(false);
  });
});
