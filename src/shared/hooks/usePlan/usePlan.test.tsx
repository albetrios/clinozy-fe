import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import type * as PlanApiModule from '@/shared/api/clinic/plan-api.ts';
import type {
  PatientPlan,
  PlanSuggestionRow,
} from '@/shared/api/clinic/plan-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/api/clinic/plan-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PlanApiModule>()),
  fetchPlan: vi.fn(),
  fetchPlanIdeas: vi.fn(),
  fetchPlanActivity: vi.fn(),
  createPlanSuggestion: vi.fn(),
  updatePlanSuggestion: vi.fn(),
  deletePlanSuggestion: vi.fn(),
  restorePlanSuggestion: vi.fn(),
}));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(),
}));

import { fetchAllOfferings } from '@/shared/api/clinic/offerings-api.ts';
import {
  createPlanSuggestion,
  deletePlanSuggestion,
  fetchPlan,
  fetchPlanActivity,
  fetchPlanIdeas,
  restorePlanSuggestion,
  updatePlanSuggestion,
} from '@/shared/api/clinic/plan-api.ts';

import {
  useAddSuggestion,
  usePlan,
  usePlanActivity,
  usePlanIdeas,
  usePlanOfferings,
  useRemoveSuggestion,
  useRestoreSuggestion,
  useUpdateSuggestion,
  withSuggestionChange,
} from './usePlan.ts';

const PATIENT = 'pat_dharti000000000000000';
const READ_AT = '2026-10-02T05:00:00.000Z';

const row = (overrides: Partial<PlanSuggestionRow> = {}): PlanSuggestionRow => ({
  id: 'osug_lhr0000000000000000000',
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face',
  quantity: 1,
  price: null,
  status: 'planned',
  reason: null,
  sourceLabel: 'Patient file',
  suggestedById: null,
  invoicedQuantity: 0,
  isFullyInvoiced: false,
  isBelowLowestPrice: false,
  createdAt: READ_AT,
  updatedAt: READ_AT,
  ...overrides,
});

/** The plan's server: one row, its total, writes that answer the row. */
const server = vi.hoisted(() => ({ plan: null as PatientPlan | null }));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  server.plan = { suggestions: [row()], planTotal: 4800 };
  vi.mocked(fetchPlan).mockImplementation(async () => structuredClone(server.plan!));
  vi.mocked(fetchPlanIdeas).mockResolvedValue([]);
  vi.mocked(fetchAllOfferings).mockResolvedValue([]);
  vi.mocked(fetchPlanActivity).mockResolvedValue([]);
});
afterEach(() => {
  client.clear();
  vi.resetAllMocks();
});

describe('the plan reads', () => {
  it('reads a patient’s plan, its ideas, the catalogue and a contact’s messages', async () => {
    vi.mocked(fetchAllOfferings).mockResolvedValue([
      offeringRecord({ name: 'Research Peel', isActive: false }),
      offeringRecord({ id: 'off_lhr00000000000000000', name: 'LHR Full Face' }),
    ]);
    const { result } = renderHook(
      () => ({
        plan: usePlan(PATIENT),
        ideas: usePlanIdeas(PATIENT),
        offerings: usePlanOfferings(),
        activity: usePlanActivity('con_dharti000000000000000'),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.data?.planTotal).toBe(4800));
    await waitFor(() => expect(result.current.activity.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.offerings.isSuccess).toBe(true));
    expect(fetchPlanIdeas).toHaveBeenCalledWith(PATIENT);
    expect(fetchAllOfferings).toHaveBeenCalledOnce();
    // The one offerings catalogue, active or not, A to Z.
    expect(result.current.offerings.data?.map((offering) => offering.name)).toEqual([
      'LHR Full Face',
      'Research Peel',
    ]);
    expect(fetchPlanActivity).toHaveBeenCalledWith('con_dharti000000000000000');
  });

  it('stays idle without a patient, a contact, the activity code or an organization', () => {
    const { result } = renderHook(
      () => ({
        plan: usePlan(null),
        ideas: usePlanIdeas(''),
        offerings: usePlanOfferings({ enabled: false }),
        activity: usePlanActivity(null),
        denied: usePlanActivity('con_dharti000000000000000', { enabled: false }),
      }),
      { wrapper },
    );
    for (const query of Object.values(result.current)) {
      expect(query.fetchStatus).toBe('idle');
    }
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    const { result } = renderHook(() => usePlan(PATIENT), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('the plan writes', () => {
  it('adds an offering with its reason and the action’s key, then reads the plan again', async () => {
    vi.mocked(createPlanSuggestion).mockResolvedValue(row({ id: 'osug_new' }));
    const { result } = renderHook(
      () => ({ plan: usePlan(PATIENT), add: useAddSuggestion() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.isSuccess).toBe(true));
    await act(() =>
      result.current.add.mutateAsync({
        patientId: PATIENT,
        offeringId: 'off_hydra',
        reason: 'First visit',
      }),
    );
    expect(createPlanSuggestion).toHaveBeenCalledWith({
      patientId: PATIENT,
      input: { offeringId: 'off_hydra', reason: 'First visit' },
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(fetchPlan).toHaveBeenCalledTimes(2));
  });

  it('moves the card at once and goes back when the edit fails', async () => {
    let fail: ((error: Error) => void) | undefined;
    vi.mocked(updatePlanSuggestion).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const { result } = renderHook(
      () => ({
        plan: usePlan(PATIENT),
        update: useUpdateSuggestion({ notifyOnError: false }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.isSuccess).toBe(true));
    act(() =>
      result.current.update.mutate({
        patientId: PATIENT,
        suggestionId: row().id,
        change: { quantity: 3 },
        expectedUpdatedAt: READ_AT,
      }),
    );
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions[0]?.quantity).toBe(3),
    );
    act(() => fail?.(new Error('refused')));
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions[0]?.quantity).toBe(1),
    );
  });

  it('sends one edit of a row at a time, each with the row’s latest `updated_at`', async () => {
    const answers: ((value: PlanSuggestionRow) => void)[] = [];
    vi.mocked(updatePlanSuggestion).mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        }),
    );
    const { result } = renderHook(() => useUpdateSuggestion(), { wrapper });
    const step = (quantity: number) =>
      result.current.mutateAsync({
        patientId: PATIENT,
        suggestionId: row().id,
        change: { quantity },
        expectedUpdatedAt: READ_AT,
      });
    let second: Promise<PlanSuggestionRow> = Promise.resolve(row());
    act(() => {
      void step(2);
      second = step(3);
    });
    await waitFor(() => expect(updatePlanSuggestion).toHaveBeenCalledOnce());
    expect(updatePlanSuggestion).toHaveBeenLastCalledWith(
      expect.objectContaining({ change: { quantity: 2 }, expectedUpdatedAt: READ_AT }),
    );
    // The first answers: the second goes out with the time the first saved at.
    act(() => answers[0]?.(row({ quantity: 2, updatedAt: '2026-10-03T05:00:00.000Z' })));
    await waitFor(() => expect(updatePlanSuggestion).toHaveBeenCalledTimes(2));
    expect(updatePlanSuggestion).toHaveBeenLastCalledWith(
      expect.objectContaining({
        change: { quantity: 3 },
        expectedUpdatedAt: '2026-10-03T05:00:00.000Z',
      }),
    );
    act(() => answers[1]?.(row({ quantity: 3, updatedAt: '2026-10-03T05:00:01.000Z' })));
    await act(() => second);
  });

  it('removes with the reason and restores — the plan read again each time', async () => {
    vi.mocked(deletePlanSuggestion).mockResolvedValue(undefined);
    vi.mocked(restorePlanSuggestion).mockResolvedValue(row());
    const { result } = renderHook(
      () => ({
        plan: usePlan(PATIENT),
        remove: useRemoveSuggestion(),
        restore: useRestoreSuggestion(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.isSuccess).toBe(true));
    await act(() =>
      result.current.remove.mutateAsync({
        patientId: PATIENT,
        suggestionId: row().id,
        reason: 'not_needed',
        note: null,
      }),
    );
    expect(deletePlanSuggestion).toHaveBeenCalledWith({
      patientId: PATIENT,
      suggestionId: row().id,
      reason: 'not_needed',
      note: null,
      idempotencyKey: expect.any(String),
    });
    await act(() =>
      result.current.restore.mutateAsync({ patientId: PATIENT, suggestionId: row().id }),
    );
    expect(restorePlanSuggestion).toHaveBeenCalledWith({
      patientId: PATIENT,
      suggestionId: row().id,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(fetchPlan).toHaveBeenCalledTimes(3));
  });
});

describe('withSuggestionChange (the optimistic edit)', () => {
  it('changes the one row and leaves the rest', () => {
    const plan: PatientPlan = {
      suggestions: [row(), row({ id: 'osug_other' })],
      planTotal: 9600,
    };
    const next = withSuggestionChange(plan, {
      suggestionId: 'osug_other',
      change: { status: 'declined', price: 100 },
    });
    expect(next.suggestions[0]).toEqual(plan.suggestions[0]);
    expect(next.suggestions[1]).toMatchObject({ status: 'declined', price: 100 });
    expect(next.planTotal).toBe(9600);
  });
});
