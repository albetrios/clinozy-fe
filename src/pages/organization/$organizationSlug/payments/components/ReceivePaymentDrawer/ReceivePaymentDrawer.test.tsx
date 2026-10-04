import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  branchRef,
  MAIN_BRANCH,
} from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPayment } from '@/shared/api/clinic/payments-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ReceivePaymentDrawer } from './ReceivePaymentDrawer.tsx';

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
const D = 'receive-drawer';
const RHEA = patientRef('Rhea Shah');

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const receipts = () =>
  clinicFixtures.payments.snapshot(
    (payment) => payment.kind === 'receipt' && payment.patientId === RHEA,
  );

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

describe('ReceivePaymentDrawer — new (payments.md:95–110)', () => {
  it('opens on "Who is paying" with the invoice field waiting for a patient', async () => {
    const { baseElement } = renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Receive payment')).toBeInTheDocument();
    expect(
      within(drawer).getByText('Receipt goes to the patient on WhatsApp'),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Who is paying')).toBeInTheDocument();
    expect(part('invoice')).toHaveTextContent('Pick the patient first');
    expect(within(part('badges')).getByText('UPI')).toBeInTheDocument();
    expect(part('summary')).toHaveTextContent('UPI · ₹0');
    expect(part('save')).toHaveTextContent('Record ₹0');
    expect(screen.queryByTestId(`${D}-quick-fill`)).toBeNull();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('requires a patient: "Pick a patient", and nothing is recorded', async () => {
    const user = setUser();
    const before = clinicFixtures.payments.snapshot().length;
    renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a patient');
    expect(clinicFixtures.payments.snapshot()).toHaveLength(before);
  });

  it('arrives filled from ?patient=: the oldest open invoice, its due in UPI, Quick fill', async () => {
    renderWithProviders(
      <ReceivePaymentDrawer
        open
        mode="create"
        prefill={{ patient: RHEA }}
        onClose={vi.fn()}
      />,
    );
    const chip = await screen.findByTestId(`${D}-invoice-${ref.invoice(785)}`);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveTextContent('#785 · ₹700');
    expect(part('splits-total')).toHaveTextContent('Total ₹700 · due ₹700');
    expect(part('save')).toHaveTextContent('Record ₹700');
    expect(part('quick-fill-full')).toHaveTextContent('Full · ₹700');
    expect(part('quick-fill-half')).toHaveTextContent('Half · ₹350');
    expect(part('quick-fill-cashUpi')).toHaveTextContent('Cash + UPI');
  });

  it('refuses more than the invoice’s due, and records the due with its toast', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(
      <ReceivePaymentDrawer
        open
        mode="create"
        prefill={{ patient: RHEA, invoice: ref.invoice(785) }}
        onClose={onClose}
      />,
    );
    const amount = await screen.findByTestId(`${D}-splits-amount`);
    await user.clear(amount);
    await user.type(amount, '800');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('More than the ₹700 due');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(part('quick-fill-full'));
    const before = receipts().length;
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('₹700 received from Rhea Shah');
    expect(receipts()).toHaveLength(before + 1);
  });

  it('fills the oldest open invoice and its due when a patient is picked; "+ Split" adds a mode', async () => {
    const user = setUser();
    renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-patient`));
    await user.type(await screen.findByTestId(`${D}-patient-search`), 'Kiran');
    await user.click(
      await screen.findByTestId(`${D}-patient-option-${patientRef('Kiran Desai')}`),
    );
    const chip = await screen.findByTestId(`${D}-invoice-${ref.invoice(784)}`);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(part('splits-total')).toHaveTextContent('Total ₹8,550 · due ₹8,550');
    expect(part('tag')).toHaveTextContent('#');
    await user.click(part('splits-add'));
    expect(screen.getAllByTestId(`${D}-splits-row`)).toHaveLength(2);
    expect(part('splits-add')).toHaveTextContent('Split · add a mode');
  });

  it('splits Cash + UPI from the Quick fill, the badge reading both', async () => {
    const user = setUser();
    renderWithProviders(
      <ReceivePaymentDrawer
        open
        mode="create"
        prefill={{ patient: RHEA }}
        onClose={vi.fn()}
      />,
    );
    await user.click(await screen.findByTestId(`${D}-quick-fill-cashUpi`));
    expect(screen.getAllByTestId(`${D}-splits-row`)).toHaveLength(2);
    expect(part('summary')).toHaveTextContent('Cash + UPI · ₹700');
  });
});

describe('ReceivePaymentDrawer — edit (S:1710)', () => {
  it('saves an open day’s receipt: "PAY-5512 updated · change logged", the change logged', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const entry = await fetchPayment(ref.payment(5512));
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={entry} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit payment in')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('PAY-5512');
    // Its own ₹600 is back on the invoice's due while it is changed.
    expect(part('splits-total')).toHaveTextContent('Total ₹600 · due ₹1,300');
    const amount = screen.getByTestId(`${D}-splits-amount`);
    await user.clear(amount);
    await user.type(amount, '700');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('PAY-5512 updated · change logged');
    const saved = await fetchPayment(ref.payment(5512));
    expect(saved.amount).toBe(70_000);
    expect(saved.edits).toHaveLength(1);
  });

  it('turns view only when the day closed meanwhile (409)', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const entry = await fetchPayment(ref.payment(5512));
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={entry} onClose={onClose} />,
    );
    await screen.findByText('Edit payment in');
    await clinicFixtures.dayCloses.create({
      branchId: branchRef(MAIN_BRANCH),
      date: clinicToday(),
      openingCash: 200_000,
      openingSource: 'default_float',
      openingAcceptedAt: NOW.toISOString(),
      countedCash: 200_000,
      closedAt: NOW.toISOString(),
      closedById: null,
    });
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Day closed · this can’t be saved now',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });
});
