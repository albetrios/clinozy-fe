import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-api.ts';

import { usePackageSession } from './usePackageSession.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** Dharti's LHR Full Face · B4G7 package: 1 of 7 used. */
const LHR = ref.patientPackage(1);
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The package as a card holds it. */
const lhrRow = async (): Promise<PatientPackageRow> => ({
  package: await clinicFixtures.patientPackages.get(LHR),
  offering: null,
  invoiced: true,
  nextVisit: null,
});

const used = async () => (await clinicFixtures.patientPackages.get(LHR)).sessionsUsed;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePackageSession (H:833, H:773)', () => {
  it('uses one session and says which', async () => {
    const row = await lhrRow();
    const { result } = renderHook(() => usePackageSession(), { wrapper });
    act(() => result.current(row));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 of 7 used'),
    );
    expect(await used()).toBe(2);
  });

  it('says so, and uses nothing, when no session is left', async () => {
    await clinicFixtures.patientPackages.update(LHR, { sessionsUsed: 7 });
    const row = await lhrRow();
    const { result } = renderHook(() => usePackageSession(), { wrapper });
    act(() => result.current(row));
    expect(notifyMock.info).toHaveBeenCalledWith('No sessions left');
    expect(await used()).toBe(7);
  });
});
