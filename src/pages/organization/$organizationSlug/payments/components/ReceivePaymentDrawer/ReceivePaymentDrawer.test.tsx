import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import {
  fetchInvoiceTotals,
  listOpenInvoices,
} from '@/shared/api/clinic/invoices-api.ts';
import { searchPatientPicker } from '@/shared/api/clinic/patient-search-api.ts';
import { fetchPatient } from '@/shared/api/clinic/patients-api.ts';
import {
  fetchPayment,
  receivePayment,
  updatePayment,
} from '@/shared/api/clinic/payments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import {
  invoiceRecord,
  ledgerRow,
  TEST_INVOICE_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';
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
vi.mock('@/shared/api/clinic/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  receivePayment: vi.fn(),
  updatePayment: vi.fn(),
  fetchPayment: vi.fn(),
}));
vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listOpenInvoices: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patient-search-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchPatientPicker: vi.fn(),
}));

const D = 'receive-drawer';

/** Every code the Front desk holds in the ledger. */
const DESK: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'contact:read',
];

/** Kavya Mehta, patient #2. */
const KAVYA = patientRecord({
  id: TEST_MONEY_PATIENT_ID,
  contactId: TEST_MONEY_CONTACT_ID,
  seq: 2,
  firstName: 'Kavya',
  lastName: 'Mehta',
  name: 'Kavya Mehta',
});

/** Her open invoices, oldest first: #4 (₹1,250.50 due) and #5 (₹100 due). */
const OPEN = [
  invoiceRecord({ id: 'invc_older0000000000000001', seq: 4, due: 1250.5 }),
  invoiceRecord(),
];

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string, detail = 'Refused') =>
  new HttpError(detail, 409, '/app/payments', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Sign in a member holding `codes`. */
function signIn(codes: readonly OrganizationPermission[] = DESK) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listOpenInvoices).mockReset().mockResolvedValue(OPEN);
  vi.mocked(fetchInvoiceTotals).mockReset().mockResolvedValue({ due: 1350.5, paid: 400 });
  vi.mocked(fetchPatient).mockReset().mockResolvedValue(KAVYA);
  vi.mocked(searchPatientPicker)
    .mockReset()
    .mockResolvedValue({
      items: [
        {
          kind: 'patient',
          id: KAVYA.id,
          contactId: KAVYA.contactId,
          seq: 2,
          name: 'Kavya Mehta',
          phone: KAVYA.phone,
          due: null,
        },
      ],
      nextCursor: null,
    });
  vi.mocked(receivePayment).mockReset();
  vi.mocked(updatePayment).mockReset();
  vi.mocked(fetchPayment).mockReset();
  signIn();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

/** Open a new receipt prefilled with Kavya (`?patient=`), and wait for her invoice. */
async function openForKavya(onClose = vi.fn(), invoice?: string) {
  renderWithProviders(
    <ReceivePaymentDrawer
      open
      mode="create"
      prefill={{ patient: TEST_MONEY_PATIENT_ID, invoice }}
      onClose={onClose}
    />,
  );
  await screen.findByTestId(`${D}-invoice-${invoice ?? 'invc_older0000000000000001'}`);
  return onClose;
}

describe('ReceivePaymentDrawer — new (payments.md:95–110)', () => {
  it('opens on "Who is paying" with the invoice field waiting for a patient', async () => {
    const { baseElement } = renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Receive payment')).toBeInTheDocument();
    expect(within(drawer).getByText('Who is paying')).toBeInTheDocument();
    expect(part('invoice')).toHaveTextContent('Pick the patient first');
    expect(part('summary')).toHaveTextContent('UPI · ₹0');
    expect(part('save')).toHaveTextContent('Record ₹0');
    expect(screen.queryByTestId(`${D}-quick-fill`)).toBeNull();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('requires a patient: "Pick a patient", and nothing is sent', async () => {
    const user = setUser();
    renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a patient');
    expect(receivePayment).not.toHaveBeenCalled();
  });

  it('arrives filled from ?patient=: their oldest open invoice, its due in UPI, Quick fill', async () => {
    await openForKavya();
    const chip = part('invoice-invc_older0000000000000001');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveTextContent('#4 · ₹1,250.50');
    expect(part(`invoice-${TEST_INVOICE_ID}`)).toHaveTextContent('#5 · ₹100');
    expect(part('splits-total')).toHaveTextContent('Total ₹1,250.50 · due ₹1,250.50');
    expect(part('save')).toHaveTextContent('Record ₹1,250.50');
    expect(part('quick-fill-full')).toHaveTextContent('Full · ₹1,250.50');
    expect(part('quick-fill-half')).toHaveTextContent('Half · ₹625');
    expect(part('tag')).toHaveTextContent('#2');
    expect(listOpenInvoices).toHaveBeenCalledWith(TEST_MONEY_PATIENT_ID);
  });

  it('refuses more than the invoice’s due, and records the due against it — her contact, in rupees', async () => {
    const user = setUser();
    vi.mocked(receivePayment).mockResolvedValue(ledgerRow({ amount: 100 }));
    const onClose = await openForKavya(vi.fn(), TEST_INVOICE_ID);
    const amount = part('splits-amount');
    await user.clear(amount);
    await user.type(amount, '800');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('More than the ₹100 due');
    expect(receivePayment).not.toHaveBeenCalled();

    await user.click(part('quick-fill-full'));
    await user.type(part('reference'), '4321');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(receivePayment).toHaveBeenCalledWith({
      input: expect.objectContaining({
        contactId: TEST_MONEY_CONTACT_ID,
        invoiceId: TEST_INVOICE_ID,
        splits: [{ mode: 'upi', amount: 100 }],
        reference: '4321',
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('₹100 received from Kavya Mehta');
  });

  it('fills the oldest open invoice and its due when a patient is picked; "+ Split" adds a mode', async () => {
    const user = setUser();
    renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-patient`));
    await user.type(await screen.findByTestId(`${D}-patient-search`), 'Kavya');
    await user.click(await screen.findByTestId(`${D}-patient-option-${KAVYA.id}`));
    const chip = await screen.findByTestId(`${D}-invoice-invc_older0000000000000001`);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(part('splits-total')).toHaveTextContent('Total ₹1,250.50 · due ₹1,250.50');
    await user.click(part('splits-add'));
    expect(screen.getAllByTestId(`${D}-splits-row`)).toHaveLength(2);
  });

  it('records an advance when the invoice is cleared — against no invoice, with no due', async () => {
    const user = setUser();
    vi.mocked(receivePayment).mockResolvedValue(
      ledgerRow({ invoiceId: null, invoice: null }),
    );
    await openForKavya();
    await user.click(part('invoice-invc_older0000000000000001'));
    expect(part('invoice-invc_older0000000000000001')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(part('splits-total')).toHaveTextContent(
      words('receive.totalAdvance', { total: '₹1,250.50' }),
    );
    expect(screen.queryByTestId(`${D}-quick-fill`)).toBeNull();
    await user.click(part('save'));
    await waitFor(() =>
      expect(receivePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ invoiceId: null, contactId: KAVYA.contactId }),
        }),
      ),
    );
  });

  it('offers Retry in place when the open invoices can’t be read', async () => {
    const user = setUser();
    vi.mocked(listOpenInvoices).mockRejectedValue(new Error('offline'));
    renderWithProviders(
      <ReceivePaymentDrawer
        open
        mode="create"
        prefill={{ patient: TEST_MONEY_PATIENT_ID }}
        onClose={vi.fn()}
      />,
    );
    const retry = await screen.findByTestId(`${D}-invoice-retry`);
    vi.mocked(listOpenInvoices).mockResolvedValue(OPEN);
    await user.click(retry);
    expect(
      await screen.findByTestId(`${D}-invoice-${TEST_INVOICE_ID}`),
    ).toBeInTheDocument();
  });

  it('says so when the invoice was paid meanwhile (409 more_than_due), keeping the drawer', async () => {
    const user = setUser();
    vi.mocked(receivePayment).mockRejectedValue(conflict('more_than_due'));
    const onClose = await openForKavya();
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words('receive.moreThanDue')),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(part('save')).toBeInTheDocument();
  });

  it('is view only without payment:create', async () => {
    signIn(['organization:read', 'payment:read']);
    renderWithProviders(
      <ReceivePaymentDrawer open mode="create" prefill={{}} onClose={vi.fn()} />,
    );
    await screen.findByTestId(D);
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
  });
});

describe('ReceivePaymentDrawer — edit (S:1710)', () => {
  it('saves an open day’s receipt — what changed, against the read — "PAY-5 updated · change logged"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const entry = ledgerRow();
    vi.mocked(updatePayment).mockResolvedValue(ledgerRow({ amount: 200 }));
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={entry} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit payment in')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('PAY-5');
    // Its own ₹150 is back on invoice #5's ₹100 due while it is changed.
    expect(part('invoice')).toHaveTextContent('#5 · ₹250');
    expect(part('splits-total')).toHaveTextContent('Total ₹150 · due ₹250');
    const [cash] = screen.getAllByTestId(`${D}-splits-amount`);
    if (!cash) throw new Error('no cash row');
    await user.clear(cash);
    await user.type(cash, '150');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updatePayment).toHaveBeenCalledWith({
      record: entry,
      patch: {
        splits: [
          { mode: 'cash', amount: 150 },
          { mode: 'upi', amount: 50 },
        ],
        reference: 'REF9',
        note: 'At the desk',
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('PAY-5 updated · change logged');
  });

  it('turns view only when the day closed meanwhile (409 day_closed)', async () => {
    const user = setUser();
    const onClose = vi.fn();
    vi.mocked(updatePayment).mockRejectedValue(conflict('day_closed'));
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={ledgerRow()} onClose={onClose} />,
    );
    await screen.findByText('Edit payment in');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Day closed · this can’t be saved now',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers Reload on a save over a newer change (409 record_changed), and starts over on it', async () => {
    const user = setUser();
    const saved = ledgerRow({
      reference: 'SAVED',
      updatedAt: '2026-10-10T06:00:00.000Z',
    });
    vi.mocked(updatePayment).mockRejectedValueOnce(
      conflict('record_changed', 'Someone saved it since'),
    );
    vi.mocked(fetchPayment).mockResolvedValue(saved);
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={ledgerRow()} onClose={vi.fn()} />,
    );
    await screen.findByText('Edit payment in');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone saved it since',
        expect.objectContaining({ action: expect.anything() }),
      ),
    );
    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() => expect(part('reference')).toHaveValue('SAVED'));
    vi.mocked(updatePayment).mockResolvedValue(saved);
    await user.click(part('save'));
    await waitFor(() =>
      expect(updatePayment).toHaveBeenLastCalledWith(
        expect.objectContaining({ record: saved }),
      ),
    );
  });

  it('is view only without payment:update', async () => {
    signIn(['organization:read', 'payment:read', 'payment:create']);
    renderWithProviders(
      <ReceivePaymentDrawer open mode="edit" entry={ledgerRow()} onClose={vi.fn()} />,
    );
    await screen.findByText('Edit payment in');
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
  });
});
