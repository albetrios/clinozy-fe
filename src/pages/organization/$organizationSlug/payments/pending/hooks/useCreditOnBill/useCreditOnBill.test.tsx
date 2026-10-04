import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCredit, fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { canUseOnBill, useCreditOnBill } from './useCreditOnBill.ts';

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

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const CR_TWO = ref.pendingCredit(2);

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('canUseOnBill (Q-G9)', () => {
  it('offers it on an open Give credit of a patient only', () => {
    const credit = { status: 'open', direction: 'give', patientId: 'p' } as const;
    expect(canUseOnBill(credit)).toBe(true);
    expect(canUseOnBill({ ...credit, direction: 'take' })).toBe(false);
    expect(canUseOnBill({ ...credit, patientId: null })).toBe(false);
    expect(canUseOnBill({ ...credit, status: 'used' })).toBe(false);
  });
});

describe('useCreditOnBill (Q-G9)', () => {
  it('adjusts the credit on the oldest due invoice: "₹500 of CR-2 adjusted on invoice #772"', async () => {
    const credit = await fetchCredit(CR_TWO);
    const { result } = renderHook(() => useCreditOnBill(), { wrapper });
    await act(() => result.current(credit));
    expect(notifyMock.success).toHaveBeenCalledWith(
      '₹500 of CR-2 adjusted on invoice #772',
    );
    expect(await fetchCredit(CR_TWO)).toMatchObject({
      status: 'used',
      settledInvoiceSeq: 772,
    });
  });

  it('says so when nothing is due, and writes nothing', async () => {
    const credit = await createCredit({
      direction: 'give',
      partyName: 'Dhruv Patel',
      patientId: patientRef('Dhruv Patel'),
      amount: 10_000,
      reasonKey: 'overpaid',
      invoiceId: null,
      settleBy: null,
      note: null,
    });
    const row = await fetchCredit(credit.id);
    const { result } = renderHook(() => useCreditOnBill(), { wrapper });
    await act(() => result.current(row));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Nothing due for Dhruv Patel to adjust against',
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
    expect((await fetchCredit(credit.id)).status).toBe('open');
  });
});
