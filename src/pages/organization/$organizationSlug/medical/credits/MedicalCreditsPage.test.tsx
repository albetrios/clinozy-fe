import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listSupplierCredits: vi.fn(),
}));
vi.mock('../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  voidSupplierCredit: vi.fn(),
  restoreSupplierCredit: vi.fn(),
}));
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreCredits: vi.fn(),
}));

import { listStoreCredits } from '@/shared/api/app/credits-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  medicalPage,
  supplierCreditRow,
  TEST_SUPPLIER_CREDIT_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';
import { creditRow, TEST_CREDIT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { listSupplierCredits } from '../shared/medical-api.ts';
import { voidSupplierCredit } from '../shared/medical-records-api.ts';
import { MedicalCreditsPage } from './MedicalCreditsPage.tsx';

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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const ROOM = '/organization/acme/medical/credits';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rows = () => screen.getAllByTestId('medical-credits-table-row');

/** A row's action button, by its id. */
const rowAction = (row: HTMLElement, id: string) =>
  within(row).queryByTestId(`medical-credits-row-action-${id}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listSupplierCredits).mockReset();
  vi.mocked(listSupplierCredits).mockResolvedValue(
    medicalPage([
      supplierCreditRow(),
      supplierCreditRow({
        id: 'scr_adjusted0000000000000',
        batchNo: '026-298',
        applied: 840,
        status: 'adjusted',
      }),
    ]),
  );
  vi.mocked(listStoreCredits).mockReset();
  vi.mocked(listStoreCredits).mockResolvedValue({
    rows: [creditRow({ partyName: 'Priya Shah', direction: 'give', status: 'open' })],
    next: null,
    total: 1,
  });
  vi.mocked(voidSupplierCredit).mockReset();
  vi.mocked(voidSupplierCredit).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
});

describe('MedicalCreditsPage', () => {
  it('opens on the suppliers’ credits — the Credits tab current, no search', async () => {
    const { container } = renderMedicalRoutes(ROOM, { credits: MedicalCreditsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Credits');
    expect(rows()[0]).toHaveTextContent('Azelaic gel 15g');
    expect(rows()[0]).toHaveTextContent('026-312');
    expect(rows()[0]).toHaveTextContent('Ankur Pharma');
    expect(rows()[0]).toHaveTextContent('Open');
    expect(rows()[1]).toHaveTextContent('Adjusted');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the state the URL picks', async () => {
    renderMedicalRoutes(`${ROOM}?state=open`, { credits: MedicalCreditsPage });
    await waitFor(() => expect(listSupplierCredits).toHaveBeenCalled());
    expect(vi.mocked(listSupplierCredits).mock.calls[0]?.[0]).toEqual({ status: 'open' });
  });

  it('a supplier credit’s row opens its supplier', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(ROOM, { credits: MedicalCreditsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rows()[0] as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/medical/suppliers/${TEST_SUPPLIER_ID}/edit`,
      ),
    );
  });

  it('voids a supplier credit with its reason, offering Undo', async () => {
    const user = setup();
    renderMedicalRoutes(ROOM, { credits: MedicalCreditsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rowAction(rows()[0] as HTMLElement, 'void') as HTMLElement);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this credit?')).toBeVisible();
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('radio', { name: 'Wrong quantity' }));
    await user.click(within(dialog).getByRole('button', { name: 'Void credit' }));
    await waitFor(() =>
      expect(voidSupplierCredit).toHaveBeenCalledWith({
        supplierId: TEST_SUPPLIER_ID,
        creditId: TEST_SUPPLIER_CREDIT_ID,
        reason: 'wrong_quantity',
        note: null,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Credit · 026-312 voided',
        expect.anything(),
      ),
    );
  });

  it('offers no Void without Medical Delete', async () => {
    renderMedicalRoutes(ROOM, { credits: MedicalCreditsPage }, { role: 'pharmacist' });
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rowAction(rows()[0] as HTMLElement, 'void')).toBeNull();
  });

  it('switches to the customers’ credits — the store’s Pending, with its search', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(ROOM, { credits: MedicalCreditsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(screen.getByTestId('medical-credits-side-customers'));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ side: 'customers' }),
    );
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Priya Shah');
    expect(rows()[0]).toHaveTextContent('CR-');
    expect(rows()[0]).toHaveTextContent('We give back');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('reads the customers’ credits with the URL’s filters', async () => {
    renderMedicalRoutes(`${ROOM}?side=customers&direction=take&status=open&q=Priya`, {
      credits: MedicalCreditsPage,
    });
    await waitFor(() => expect(listStoreCredits).toHaveBeenCalled());
    expect(vi.mocked(listStoreCredits).mock.calls[0]?.[0]).toMatchObject({
      direction: ['take'],
      status: ['open'],
      q: 'Priya',
    });
  });

  it('a customer credit’s row opens it in Pending', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(`${ROOM}?side=customers`, {
      credits: MedicalCreditsPage,
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(rows()[0] as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/payments/pending/${TEST_CREDIT_ID}/edit`,
      ),
    );
  });

  it('an open credit the store owes offers Give back to those who may refund', async () => {
    const user = setup();
    renderMedicalRoutes(`${ROOM}?side=customers`, { credits: MedicalCreditsPage });
    await waitFor(() => expect(rows()).toHaveLength(1));
    const settle = rowAction(rows()[0] as HTMLElement, 'settle');
    expect(settle).toHaveAccessibleName('Give back');
    await user.click(settle as HTMLElement);
    expect(await screen.findByTestId('settle-credit-drawer')).toBeInTheDocument();
  });

  it('a credit the Pharmacist cannot refund offers no Give back', async () => {
    renderMedicalRoutes(
      `${ROOM}?side=customers`,
      { credits: MedicalCreditsPage },
      {
        role: 'pharmacist',
      },
    );
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rowAction(rows()[0] as HTMLElement, 'settle')).toBeNull();
  });
});
