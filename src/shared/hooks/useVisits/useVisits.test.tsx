import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useCompleteVisit,
  useCreateVisitBill,
  useOpenVisit,
  useSetVisitChecks,
  useShareVisit,
  useStartVisit,
  useVisitCatalog,
  useVisitDetail,
  withVisitChecks,
} from './useVisits.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(notify.error).mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the visit flow’s reads and writes (L-49)', () => {
  it('reads a visit, the patient’s open visit and the catalog; idle without ids', async () => {
    const { result } = renderHook(
      () => ({
        detail: useVisitDetail(ref.visit(2865)),
        none: useVisitDetail(null),
        catalog: useVisitCatalog(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.detail.data?.person.name).toBe('Dhruv Patel'),
    );
    await waitFor(() => expect(result.current.catalog.data?.kits).toHaveLength(3));
    expect(result.current.none.fetchStatus).toBe('idle');
    const patientId = result.current.detail.data?.person.patientId ?? '';
    const open = renderHook(() => useOpenVisit(patientId), { wrapper });
    await waitFor(() => expect(open.result.current.data?.id).toBe(ref.visit(2865)));
    expect(
      renderHook(() => useOpenVisit(''), { wrapper }).result.current.fetchStatus,
    ).toBe('idle');
  });

  it('ticks a check at once and keeps it once the server answers', async () => {
    const { result } = renderHook(
      () => ({ detail: useVisitDetail(ref.visit(2866)), checks: useSetVisitChecks() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.detail.data).toBeDefined());
    await act(async () => {
      await result.current.checks.mutateAsync({
        visitId: ref.visit(2866),
        checks: { consent: true },
      });
    });
    await waitFor(() =>
      expect(result.current.detail.data?.visit.checks.consent).toBe(true),
    );
  });

  it('patches only the visit a check write names', () => {
    const detail = {
      visit: { id: 'v', checks: { consent: false, photos: false, allergies: false } },
    };
    expect(withVisitChecks(detail, { visitId: 'v', checks: { photos: true } })).toEqual({
      visit: { id: 'v', checks: { consent: false, photos: true, allergies: false } },
    });
    expect(withVisitChecks(detail, { visitId: 'w', checks: { photos: true } })).toBe(
      detail,
    );
    expect(withVisitChecks(undefined, { visitId: 'v', checks: {} })).toBeUndefined();
  });

  it('patches the file’s open visit too, and leaves the catalogue and “none” alone', () => {
    const open = { id: 'v', checks: { consent: false, photos: false, allergies: false } };
    expect(withVisitChecks(open, { visitId: 'v', checks: { consent: true } })).toEqual({
      id: 'v',
      checks: { consent: true, photos: false, allergies: false },
    });
    expect(withVisitChecks(open, { visitId: 'w', checks: { consent: true } })).toBe(open);
    const catalog = { diagnoses: [], kits: [] };
    expect(withVisitChecks(catalog, { visitId: 'v', checks: { consent: true } })).toBe(
      catalog,
    );
    expect(withVisitChecks(null, { visitId: 'v', checks: { consent: true } })).toBeNull();
  });

  it('starts a visit, bills it, shares and completes it — a bill failure stays quiet by default', async () => {
    const { result } = renderHook(
      () => ({
        start: useStartVisit(),
        bill: useCreateVisitBill(),
        complete: useCompleteVisit({ notifyOnError: true }),
        share: useShareVisit(),
      }),
      { wrapper },
    );
    await act(() => result.current.share.mutateAsync({ visitId: ref.visit(2865) }));
    // The flow shows a record write's failure itself — no toast from the hook.
    await act(async () => {
      await result.current.bill
        .mutateAsync({ visitId: ref.visit(2865) })
        .catch(() => undefined);
      await result.current.bill
        .mutateAsync({ visitId: ref.visit(2865) })
        .catch(() => undefined);
    });
    expect(notify.error).not.toHaveBeenCalled();
    const done = await act(() =>
      result.current.complete.mutateAsync({ visitId: ref.visit(2865) }),
    );
    expect(done.visit.stage).toBe('done');
    await act(async () => {
      await result.current.complete
        .mutateAsync({ visitId: ref.visit(2865) })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledWith('This visit is already completed');
    expect(result.current.start).toBeDefined();
  });
});
