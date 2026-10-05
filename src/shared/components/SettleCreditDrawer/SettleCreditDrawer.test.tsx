import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCredit, fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SettleCreditDrawer } from './SettleCreditDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

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
const D = 'settle-credit-drawer';
const CR_TWO = ref.pendingCredit(2);
const CR_ONE = ref.pendingCredit(1);

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
/** The ledger entries a credit's settlements wrote. */
const entriesOf = (creditId: string) =>
  clinicFixtures.payments.snapshot((row) => row.pendingCreditId === creditId);

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('SettleCreditDrawer — Give back (payments.md:170–180)', () => {
  it('opens on everything owed in UPI, stacked with "Back" and "Return ₹500"', async () => {
    const credit = await fetchCredit(CR_TWO);
    const { baseElement } = renderWithProviders(
      <SettleCreditDrawer credit={credit} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Give back')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('CR-2');
    expect(
      within(drawer).getByText(
        `To ${fsi('Tanvi Shah')} · ${fsi('Charged twice for corn removal')} · adds an Out entry to Payments`,
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('How it goes back')).toBeInTheDocument();
    expect(within(drawer).getAllByText('Paid back by').length).toBeGreaterThan(0);
    expect(part('splits-mode')).toHaveTextContent('UPI');
    expect(part('splits-amount')).toHaveValue('500');
    expect(part('splits-total')).toHaveTextContent('Total ₹500 · of ₹500');
    expect(part('dismiss')).toHaveTextContent('Back');
    expect(part('save')).toHaveTextContent('Return ₹500');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('gives it all back: the Out entry, the credit returned', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const credit = await fetchCredit(CR_TWO);
    renderWithProviders(<SettleCreditDrawer credit={credit} onClose={onClose} />);
    await user.click(await screen.findByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith(
      '₹500 given back to Tanvi Shah · Out entry added',
    );
    expect(entriesOf(CR_TWO)).toEqual([
      expect.objectContaining({ direction: 'paid', kind: 'refund', amount: 50_000 }),
    ]);
    expect((await fetchCredit(CR_TWO)).status).toBe('given_back');
  });

  it('gives back part of it in two modes, the rest staying open', async () => {
    const user = setUser();
    const credit = await fetchCredit(CR_TWO);
    renderWithProviders(<SettleCreditDrawer credit={credit} onClose={vi.fn()} />);
    const amount = await screen.findByTestId(`${D}-splits-amount`);
    await user.clear(amount);
    await user.type(amount, '100');
    await user.click(part('splits-add'));
    // The added row takes the next mode and what is left of the ₹500.
    expect(screen.getAllByTestId(`${D}-splits-amount`)[1]).toHaveValue('400');
    await user.clear(screen.getAllByTestId(`${D}-splits-amount`)[1] as HTMLElement);
    await user.type(screen.getAllByTestId(`${D}-splits-amount`)[1] as HTMLElement, '50');
    expect(part('save')).toHaveTextContent('Return ₹150');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        '₹150 given back to Tanvi Shah · Out entry added',
      ),
    );
    expect(await fetchCredit(CR_TWO)).toMatchObject({ status: 'open', adjusted: 15_000 });
    expect(entriesOf(CR_TWO)[0]?.splits).toEqual([
      { mode: 'upi', amount: 10_000 },
      { mode: 'cash', amount: 5_000 },
    ]);
  });

  it('wants an amount, and never more than is owed', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const credit = await fetchCredit(CR_TWO);
    renderWithProviders(<SettleCreditDrawer credit={credit} onClose={onClose} />);
    const amount = await screen.findByTestId(`${D}-splits-amount`);
    await user.clear(amount);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the amount');
    await user.type(amount, '600');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('More than the ₹500 owed');
    expect(onClose).not.toHaveBeenCalled();
    expect(entriesOf(CR_TWO)).toEqual([]);
  });

  it('writes the credit note for a patient’s credit on an invoice', async () => {
    const user = setUser();
    const credit = await createCredit({
      direction: 'give',
      partyName: 'Rhea Shah',
      patientId: patientRef('Rhea Shah'),
      amount: 30_000,
      reasonKey: 'overpaid',
      invoiceId: ref.invoice(785),
      settleBy: null,
      note: null,
    });
    renderWithProviders(
      <SettleCreditDrawer credit={credit} reasonLabel="Overpaid" onClose={vi.fn()} />,
    );
    expect(
      await screen.findByText(
        `To ${fsi('Rhea Shah')} · ${fsi('Overpaid')} · adds an Out entry to Payments`,
      ),
    ).toBeInTheDocument();
    await user.click(part('save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(clinicFixtures.creditNotes.snapshot()).toEqual([
      expect.objectContaining({ invoiceId: ref.invoice(785), amount: 30_000 }),
    ]);
  });
});

describe('SettleCreditDrawer — Got it back', () => {
  it('records a party’s money coming in: the In entry, the credit received', async () => {
    const user = setUser();
    const credit = await fetchCredit(CR_ONE);
    renderWithProviders(<SettleCreditDrawer credit={credit} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Got it back')).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        `From ${fsi('Medline Surgicals')} · ${fsi('Returned a box of damaged gloves')} · adds an In entry to Payments`,
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('How it came in')).toBeInTheDocument();
    expect(part('save')).toHaveTextContent('Record ₹800');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        '₹800 got back from Medline Surgicals · In entry added',
      ),
    );
    expect(entriesOf(CR_ONE)).toEqual([
      expect.objectContaining({ direction: 'received', kind: 'money_back' }),
    ]);
    expect((await fetchCredit(CR_ONE)).status).toBe('got_back');
  });

  it('stays shut without a credit', () => {
    renderWithProviders(<SettleCreditDrawer credit={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId(D)).toBeNull();
  });
});
