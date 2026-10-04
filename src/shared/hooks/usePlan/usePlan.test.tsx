import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { PatientPlan } from '@/shared/api/clinic/plan-contracts.ts';

import {
  useAddSuggestion,
  usePlan,
  useRemoveSuggestion,
  useRestoreSuggestion,
  useUpdateSuggestion,
  withSuggestionPatch,
} from './usePlan.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const dharti = () =>
  clinicFixtures.patients.snapshot((row) => row.firstName === 'Dharti')[0]?.id ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('usePlan', () => {
  it('reads a patient’s plan, and stays idle without one', async () => {
    const patientId = dharti();
    const { result } = renderHook(
      () => ({ plan: usePlan(patientId), none: usePlan(null) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.data).toBeDefined());
    expect(result.current.plan.data?.suggestions.length).toBeGreaterThan(0);
    expect(result.current.none.fetchStatus).toBe('idle');
  });

  it('adds, edits, removes and restores a suggestion — the plan refetched each time', async () => {
    const patientId = dharti();
    const { result } = renderHook(
      () => ({
        plan: usePlan(patientId),
        add: useAddSuggestion(),
        update: useUpdateSuggestion(),
        remove: useRemoveSuggestion(),
        restore: useRestoreSuggestion(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.data).toBeDefined());
    const taken = new Set(
      result.current.plan.data?.suggestions.map((row) => row.offeringId),
    );
    const offering = clinicFixtures.offerings.snapshot(
      (row) => row.active && !taken.has(row.id),
    )[0];
    if (!offering) throw new Error('no free offering');
    const before = result.current.plan.data?.suggestions.length ?? 0;
    let added = '';
    await act(async () => {
      added = (
        await result.current.add.mutateAsync({
          patientId,
          offeringId: offering.id,
          sourceLabel: 'Patient file',
        })
      ).id;
    });
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions).toHaveLength(before + 1),
    );
    await act(async () => {
      await result.current.update.mutateAsync({
        id: added,
        patientId,
        patch: { qty: 2 },
      });
    });
    await waitFor(() =>
      expect(
        result.current.plan.data?.suggestions.find((row) => row.id === added)?.qty,
      ).toBe(2),
    );
    await act(async () => {
      await result.current.remove.mutateAsync({
        id: added,
        reason: 'mistake',
        note: null,
      });
    });
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions).toHaveLength(before),
    );
    await act(async () => {
      await result.current.restore.mutateAsync(added);
    });
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions).toHaveLength(before + 1),
    );
  });
});

describe('withSuggestionPatch (the optimistic edit)', () => {
  it('patches the one suggestion and leaves the plan otherwise alone', () => {
    const plan = {
      suggestions: [
        { id: 'a', qty: 1, price: null, status: 'planned' },
        { id: 'b', qty: 1, price: null, status: 'planned' },
      ],
    } as unknown as PatientPlan;
    const next = withSuggestionPatch(plan, {
      id: 'b',
      patch: { qty: 3, status: 'accepted' },
    });
    expect(next?.suggestions.map((row) => [row.id, row.qty, row.status])).toEqual([
      ['a', 1, 'planned'],
      ['b', 3, 'accepted'],
    ]);
    expect(withSuggestionPatch(undefined, { id: 'b', patch: {} })).toBeUndefined();
  });
});
