import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  branchRef,
  MAIN_BRANCH,
} from '@/shared/api/app/fixtures/organization.fixtures.ts';
import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';
import {
  listFixtureLedger,
  payFixtureExpense,
} from '@/shared/api/app/payments-fixture-api.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { collectSale } from '../shared/medical-flows-api.ts';
import { MedicalPaymentsPage } from './MedicalPaymentsPage.tsx';

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

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const ROOM = '/organization/acme/medical/payments';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('MedicalPaymentsPage', () => {
  it('is the ledger limited to Medical under the Medical toolbar, its New sale primary', async () => {
    const medical = (await listFixtureLedger({ scope: 'medical' })).items;
    const { container } = renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    expect(await screen.findByTestId('medical-payments-new')).toHaveTextContent(
      'New sale',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Payments');
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-payments-table-row')).toHaveLength(
        medical.length,
      ),
    );
    expect(screen.getByTestId('medical-payments-table-end')).toHaveTextContent(
      'All Medical payments loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a Collect lands here, and opens in Payments while its day is open', async () => {
    const user = setup();
    const receipt = await collectSale(ref.medicalSale(978));
    const { router } = renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    await waitFor(() => expect(screen.getByText('Sale · Invoice #788')).toBeVisible());
    const row = screen
      .getAllByTestId('medical-payments-table-row')
      .find((entry) => entry.textContent?.includes('Sale · Invoice #788'));
    await user.click(row as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/payments/${receipt.id}/edit`,
      ),
    );
  });

  it('a closed day’s entry answers with its lock', async () => {
    const user = setup();
    const locked = (await listFixtureLedger({ scope: 'medical' })).items.find(
      (row) => row.isSettled,
    );
    if (!locked) throw new Error('expected a closed day’s Medical entry in the seed');
    renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-payments-table-row').length).toBeGreaterThan(
        0,
      ),
    );
    const row = screen
      .getAllByTestId('medical-payments-table-row')
      .find((entry) => entry.textContent?.includes(`PAY-${locked.seq}`));
    await user.click(row as HTMLElement);
    expect(notifyMock.info).toHaveBeenCalledWith(`PAY-${locked.seq} · Day closed`);
  });

  it('the What filter narrows the list to money out: a Medical PO paid through Send payment', async () => {
    await payFixtureExpense({
      branchId: branchRef(MAIN_BRANCH),
      billRef: { kind: 'medical_po', purchaseId: ref.purchaseOrder(431), billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'upi',
      paidOn: '2026-10-03',
      note: null,
    });
    renderMedicalRoutes(`${ROOM}?kind=expense`, { payments: MedicalPaymentsPage });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-payments-table-row').length).toBeGreaterThan(
        0,
      ),
    );
    for (const row of screen.getAllByTestId('medical-payments-table-row')) {
      expect(within(row).getByText('Paid')).toBeInTheDocument();
    }
  });

  it('shows the empty state with nothing in the Medical scope', async () => {
    renderMedicalRoutes(`${ROOM}?kind=money_back`, { payments: MedicalPaymentsPage });
    expect(await screen.findByText('No matches')).toBeVisible();
  });
});
