import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPayment } from '@/shared/api/clinic/payments-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SendPaymentDrawer } from './SendPaymentDrawer.tsx';

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
const D = 'pay-drawer';

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const expenses = () =>
  clinicFixtures.payments.snapshot((payment) => payment.direction === 'paid');

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

describe('SendPaymentDrawer — new (payments.md:112–130)', () => {
  it('opens on "Pay against a bill" while bills are open, Expense and Payment after it', async () => {
    const { baseElement } = renderWithProviders(
      <SendPaymentDrawer open mode="create" onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Send payment')).toBeInTheDocument();
    expect(
      within(drawer).getByText('Clinic spend · shows in day close'),
    ).toBeInTheDocument();
    expect(part('step-bill')).toBeInTheDocument();
    expect(part('step-expense')).toHaveTextContent('Missing: Paid to');
    expect(part('step-payment')).toHaveTextContent('Missing: Amount');
    // The three oldest bills, oldest first — a Medical PO before a stock one on a day.
    const oldest = within(part('oldest')).getAllByRole('button');
    expect(oldest.map((chip) => chip.textContent)).toEqual([
      '#15 · Cranix · ₹1,710 · 5 days pending',
      '#431 · Shree · ₹2,980 · 2 days pending',
      '#16 · Shivam · ₹600 · 2 days pending',
    ]);
    expect(part('quick-fill-consumables')).toHaveTextContent('Consumables');
    expect(part('save')).toHaveTextContent('Add expense');
    expect(part('save-and-add')).toHaveTextContent('Add & another');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('asks for who was paid and the amount, opening the step that misses them', async () => {
    const user = setUser();
    const before = expenses().length;
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={vi.fn()} />);
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add who was paid and the amount');
    expect(screen.getByTestId(`${D}-paid-to`)).toBeVisible();
    expect(expenses()).toHaveLength(before);
  });

  it('pays a bill from ?bill= in full: the PO turns Paid, "₹2,980 paid against Medical PO #431"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(
      <SendPaymentDrawer
        open
        mode="create"
        bill={`md:${ref.purchaseOrder(431)}`}
        onClose={onClose}
      />,
    );
    expect(await screen.findByTestId(`${D}-bill`)).toHaveTextContent(
      'Medical PO #431 · Shree Ramdev Medical Agency',
    );
    expect(part('summary')).toHaveTextContent(
      'Medical PO #431 · Shree Ramdev Medical Agency · Shree Ramdev Medical Agency · ₹2,980',
    );
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith(
      '₹2,980 paid against Medical PO #431',
    );
    const order = await clinicFixtures.purchaseOrders.get(ref.purchaseOrder(431));
    expect(order).toMatchObject({ paid: 298_000, stage: 'paid' });
  });

  it('adds an expense from a Quick fill, then "Add & another" starts again', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={onClose} />);
    await user.click(await screen.findByTestId(`${D}-quick-fill-tea`));
    expect(part('summary')).toHaveTextContent('Misc · Tea & snacks · ₹260');
    const before = expenses().length;
    await user.click(part('save-and-add'));
    await waitFor(() => expect(expenses()).toHaveLength(before + 1));
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Expense PAY-\d+ added$/),
    );
    expect(onClose).not.toHaveBeenCalled();
    // A fresh form: nothing filled, the bill step back on top.
    await waitFor(() => expect(part('summary')).toHaveTextContent(/^Consumables$/));
  });
});

describe('SendPaymentDrawer — edit (S:1710)', () => {
  beforeEach(() => {
    // An admin's Delete (View-as narrows the clinic access to the role's matrix).
    useOrganizationStore.getState().setPermissions(['organization:read']);
    useUIStore.setState({ previewRole: 'admin' });
  });
  afterEach(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().clearPermissions();
  });

  it('saves an open day’s expense with its change logged, its day fixed', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const entry = await fetchPayment(ref.payment(310));
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={entry} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit payment out')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('PAY-310');
    expect(screen.queryByTestId(`${D}-step-bill`)).toBeNull();
    await user.click(part('step-payment-trigger'));
    expect(part('date')).toBeDisabled();
    const amount = part('amount');
    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('PAY-310 saved · change logged');
    expect((await fetchPayment(ref.payment(310))).amount).toBe(30_000);
  });

  it('offers Delete, which asks with the ledger’s reasons', async () => {
    const user = setUser();
    const entry = await fetchPayment(ref.payment(310));
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={entry} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-delete`));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Delete this payment?')).toBeInTheDocument();
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent('PAY-310');
  });
});
