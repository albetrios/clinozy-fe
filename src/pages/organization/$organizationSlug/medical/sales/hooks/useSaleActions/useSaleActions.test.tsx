import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { fetchMedicalSale } from '../../../shared/medical-api.ts';
import { useSaleActions } from './useSaleActions.ts';

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
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The hook for a member previewed as `role`, once their access has answered. */
async function actionsAs(role: Role) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
  const view = renderHook(useSaleActions, { wrapper });
  await waitFor(() => expect(view.result.current.canReturn).toBeDefined());
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of [...Object.values(notifyMock), printMock]) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
  resetClinicFixtures();
});

describe('useSaleActions (medical.md:29, 338)', () => {
  it('an Admin collects, returns and voids an unpaid sale with nothing on it', async () => {
    const unpaid = await fetchMedicalSale(ref.medicalSale(978));
    const paid = await fetchMedicalSale(ref.medicalSale(983));
    const { result } = await actionsAs('admin');
    await waitFor(() => expect(result.current.canVoid(unpaid)).toBe(true));
    expect(result.current.canCollect(unpaid)).toBe(true);
    expect(result.current.canReturn).toBe(true);
    expect(result.current.canCollect(paid)).toBe(false);
    expect(result.current.canVoid(paid)).toBe(false);
    // A return on it keeps it: a void would undo stock already counted back.
    const returned = [
      { items: [], amount: 16_200, reason: 'unused', at: NOW.toISOString() },
    ];
    expect(result.current.canVoid({ ...unpaid, returns: returned })).toBe(false);
  });

  it('a Pharmacist collects but never voids; an Accountant does neither', async () => {
    const unpaid = await fetchMedicalSale(ref.medicalSale(978));
    const pharmacist = await actionsAs('pharmacist');
    await waitFor(() => expect(pharmacist.result.current.canCollect(unpaid)).toBe(true));
    expect(pharmacist.result.current.canVoid(unpaid)).toBe(false);
    pharmacist.unmount();
    const accountant = await actionsAs('accountant');
    await waitFor(() => expect(accountant.result.current.canReturn).toBe(false));
    expect(accountant.result.current.canCollect(unpaid)).toBe(false);
  });

  it('Collect puts the due on the ledger; its Undo takes the receipt back', async () => {
    const { result } = await actionsAs('admin');
    const onDone = vi.fn();
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    act(() => result.current.collect(sale, onDone));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '₹563 received',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    expect((await fetchMedicalSale(ref.medicalSale(978))).status).toBe('paid');
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    act(() => options.onUndo());
    await waitFor(async () =>
      expect((await fetchMedicalSale(ref.medicalSale(978))).status).toBe('unpaid'),
    );
  });

  it('Print reads the sale’s invoice and prints it; a failed read is told', async () => {
    const { result } = await actionsAs('admin');
    const sale = await fetchMedicalSale(ref.medicalSale(983));
    act(() => result.current.print(sale));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    act(() => result.current.print({ invoiceId: ref.invoice(9999) }));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
  });
});
