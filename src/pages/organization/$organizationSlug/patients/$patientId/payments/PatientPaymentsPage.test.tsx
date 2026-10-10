import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import type * as PaymentsApiModule from '@/shared/api/clinic/payments-api.ts';
import {
  deletePayment,
  listPatientPayments,
  reversePayment,
} from '@/shared/api/clinic/payments-api.ts';
import { CROSS_ROOM_PARAM } from '@/shared/clinic/clinic-referrer.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { patientFile, patientRecord } from '@/tests/utils/patient-doubles.ts';
import {
  ledgerRow,
  TEST_MONEY_PATIENT_ID,
  TEST_PAYMENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientPaymentsPage } from './PatientPaymentsPage.tsx';

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

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

vi.mock('@/shared/api/clinic/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PaymentsApiModule>()),
  listPatientPayments: vi.fn(),
  deletePayment: vi.fn(),
  reversePayment: vi.fn(),
}));

/** PAY-5: ₹150 received from Kavya Mehta in cash and UPI against invoice #5, its day open. */
const RECEIPT = ledgerRow();
/** PAY-8: ₹300 received on a closed day — reversed, never edited. */
const SETTLED = ledgerRow({
  id: 'pay_ibrjx0eihnsrd89obek68',
  seq: 8,
  amount: 300,
  splits: [{ mode: 'cash', amount: 300 }],
  invoice: null,
  invoiceId: null,
  isSettled: true,
  editCount: 0,
  lastEdit: null,
});
/** PAY-18: ₹100 given back on invoice #5 — money out. */
const REFUND = ledgerRow({
  id: 'pay_refund00000000000000',
  seq: 18,
  direction: 'paid',
  kind: 'refund',
  amount: 100,
  splits: [{ mode: 'cash', amount: 100 }],
  editCount: 0,
  lastEdit: null,
});

const FILE = patientFile({ patient: patientRecord({ id: TEST_MONEY_PATIENT_ID }) });
const SECTION = `/organization/acme/patients/${TEST_MONEY_PATIENT_ID}/payments`;
const action = (id: string) => `patient-payments-row-action-${id}`;

/** The row of an entry, by its number. */
async function entryRow(number: string) {
  const rows = await screen.findAllByTestId('patient-payments-table-row');
  const row = rows.find((candidate) => within(candidate).queryAllByText(number).length);
  if (!row) throw new Error(`no row ${number}`);
  return row;
}

/** An entry's row action, once the member's access has answered. */
function rowAction(number: string, id: string) {
  return waitFor(async () => within(await entryRow(number)).getByTestId(action(id)));
}

/** The section in the file — the Admin's View-as preview, or a member holding `codes`. */
function renderSection(codes?: readonly OrganizationPermission[]) {
  const view = renderInPatientFile(<PatientPaymentsPage />, {
    file: FILE,
    section: 'payments',
  });
  if (codes) {
    act(() => {
      useUIStore.setState({ previewRole: null });
      useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
    });
  }
  return view;
}

/** Every money code the Owner holds. */
const EVERY_CODE: OrganizationPermission[] = [
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
];

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of [listPatientPayments, deletePayment, reversePayment]) {
    vi.mocked(fn).mockReset();
  }
  vi.mocked(listPatientPayments).mockResolvedValue([RECEIPT, REFUND, SETTLED]);
});
afterEach(() => resetPatientFile());

describe('PatientPaymentsPage', () => {
  it('lists her entries — the receipt, its invoice, the mode and the signed rupees (H:4751)', async () => {
    const { container } = renderSection();
    expect(await screen.findByTestId('patient-section-payments')).toBeInTheDocument();
    const receipt = await entryRow('PAY-5');
    expect(within(receipt).getAllByText('#5').length).toBeGreaterThan(0);
    expect(within(receipt).getAllByText('Cash + UPI').length).toBeGreaterThan(0);
    expect(within(receipt).getByText('+ ₹150')).toBeInTheDocument();
    expect(within(await entryRow('PAY-18')).getByText('− ₹100')).toBeInTheDocument();
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(listPatientPayments).toHaveBeenCalledWith(TEST_MONEY_PATIENT_ID);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says so when the patient has paid nothing', async () => {
    vi.mocked(listPatientPayments).mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('says the read failed, in place, and reads again on Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(listPatientPayments).mockRejectedValueOnce(
      new HttpError('Server error', 500, '/app/payments', 'GET'),
    );
    renderSection();
    await user.click(await screen.findByTestId('retry-button'));
    expect(await entryRow('PAY-5')).toBeInTheDocument();
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('opens an open day’s entry in its drawer over the file’s Payments (A-P1)', async () => {
    const user = userEvent.setup();
    const { router } = renderSection(EVERY_CODE);
    await user.click(await rowAction('PAY-5', 'edit'));
    const drawer = `payments/${TEST_PAYMENT_ID}/edit?from=${encodeURIComponent(
      `patients/${TEST_MONEY_PATIENT_ID}/payments`,
    )}`;
    await waitFor(() =>
      expect(router.history.location.href).toBe(`/organization/acme/${drawer}`),
    );
    expect(router.state.location.pathname).toBe(SECTION);
    expect(router.state.location.search).toEqual({ [CROSS_ROOM_PARAM]: drawer });
  });

  it('deletes an open day’s entry with its reason, and offers Undo', async () => {
    const user = userEvent.setup();
    vi.mocked(deletePayment).mockResolvedValue(undefined);
    renderSection(EVERY_CODE);
    await user.click(await rowAction('PAY-5', 'delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('PAY-5');
    await user.click(within(dialog).getAllByRole('radio')[0]!);
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(deletePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: TEST_PAYMENT_ID, reason: 'duplicate' }),
      ),
    );
    await waitFor(() => expect(notifyMock.undo).toHaveBeenCalled());
  });

  it('reverses a closed day’s entry, and says why when the server refuses', async () => {
    const user = userEvent.setup();
    vi.mocked(reversePayment).mockRejectedValue(
      new HttpError('Refused', 409, '/app/payments/x/reverse', 'POST', {
        error: {
          type: 'request_error',
          code: 'conflict',
          reason: 'already_reversed',
          detail: 'Refused',
        },
      }),
    );
    renderSection(EVERY_CODE);
    const reverse = await rowAction('PAY-8', 'reverse');
    const settled = await entryRow('PAY-8');
    expect(within(settled).queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(within(settled).queryByTestId(action('delete'))).not.toBeInTheDocument();
    await user.click(reverse);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getAllByRole('radio')[1]!);
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(reversePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: SETTLED.id }),
      ),
    );
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        i18n.t('reverseEntry.blocked.alreadyReversed', { ns: 'payments', ref: 'PAY-8' }),
      ),
    );
  });

  it('exports her entries only for a member holding `payment:export`', async () => {
    const user = userEvent.setup();
    renderSection(['payment:read']);
    await entryRow('PAY-5');
    await user.click(await screen.findByTestId('patient-payments-table-select-all'));
    expect(
      screen.queryByTestId('patient-payments-table-bulk-export'),
    ).not.toBeInTheDocument();
    act(() =>
      useOrganizationStore
        .getState()
        .setPermissions(['organization:read', 'payment:read', 'payment:export']),
    );
    expect(
      await screen.findByTestId('patient-payments-table-bulk-export'),
    ).toBeInTheDocument();
  });

  it('keeps every write to its code: a reader’s rows carry no action', async () => {
    renderSection(['payment:read']);
    await waitFor(async () =>
      expect(
        within(await entryRow('PAY-5')).queryByTestId(action('edit')),
      ).not.toBeInTheDocument(),
    );
    for (const number of ['PAY-5', 'PAY-8', 'PAY-18']) {
      const row = await entryRow(number);
      for (const id of ['edit', 'delete', 'reverse']) {
        expect(within(row).queryByTestId(action(id))).not.toBeInTheDocument();
      }
    }
  });

  it('lets a refund be deleted on its open day but never edited — its money is fixed', async () => {
    renderSection(EVERY_CODE);
    expect(await rowAction('PAY-18', 'delete')).toBeInTheDocument();
    expect(
      within(await entryRow('PAY-18')).queryByTestId(action('edit')),
    ).not.toBeInTheDocument();
  });
});
