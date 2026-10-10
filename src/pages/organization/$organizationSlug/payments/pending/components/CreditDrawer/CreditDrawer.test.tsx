import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import {
  createCredit,
  fetchCredit,
  searchCreditParties,
  updateCredit,
} from '@/shared/api/clinic/credits-api.ts';
import { fetchAllInvoices } from '@/shared/api/clinic/invoices-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  creditRow,
  invoiceRecord,
  TEST_CREDIT_ID,
  TEST_INVOICE_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { CreditDrawer } from './CreditDrawer.tsx';

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
vi.mock('@/shared/api/clinic/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchCreditParties: vi.fn(),
  createCredit: vi.fn(),
  updateCredit: vi.fn(),
  fetchCredit: vi.fn(),
}));
vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllInvoices: vi.fn(),
}));

const D = 'credit-drawer';

/** Every code a desk that keeps the money holds. */
const MONEY_DESK: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'contact:read',
];

/** CR-2 as just added for Kavya — open, nothing settled. */
const OPEN_CREDIT = creditRow({
  id: 'pcr_open00000000000000002',
  seq: 2,
  amount: 300,
  settled: 0,
  left: 300,
  paymentIds: [],
  invoiceId: null,
  settleBy: null,
  note: null,
});

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** A refusal as clinozy-be answers it. */
const refusal = (status: number, body: Record<string, unknown>) =>
  new HttpError('Refused', status, `/app/pending-credits/${TEST_CREDIT_ID}`, 'PATCH', {
    error: { type: 'request_error', detail: 'Refused', ...body },
  });

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Sign in a member holding `codes`. */
function signIn(codes: readonly OrganizationPermission[] = MONEY_DESK) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
}

/** Picks Kavya in Who through its search. */
async function pickKavya(user: ReturnType<typeof setUser>) {
  await user.click(await screen.findByTestId(`${D}-who`));
  await user.type(await screen.findByTestId(`${D}-who-search`), 'Kavya');
  await user.click(
    await screen.findByTestId(`${D}-who-option-patient:${TEST_MONEY_PATIENT_ID}`),
  );
  await waitFor(() => expect(part('who')).toHaveTextContent('Kavya Mehta'));
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(searchCreditParties)
    .mockReset()
    .mockResolvedValue({
      items: [
        {
          kind: 'patient',
          contactId: TEST_MONEY_CONTACT_ID,
          patientId: TEST_MONEY_PATIENT_ID,
          seq: 2,
          name: 'Kavya Mehta',
          phone: '+919825005865',
        },
      ],
      nextCursor: null,
    });
  vi.mocked(fetchAllInvoices).mockReset().mockResolvedValue([invoiceRecord()]);
  vi.mocked(createCredit)
    .mockReset()
    .mockImplementation(async ({ input }) =>
      creditRow({
        ...OPEN_CREDIT,
        seq: 3,
        amount: input.amount,
        direction: input.direction,
        partyName: input.partyName,
      }),
    );
  vi.mocked(updateCredit)
    .mockReset()
    .mockImplementation(async ({ credit, input }) => ({
      ...credit,
      amount: input.amount,
    }));
  vi.mocked(fetchCredit).mockReset();
  signIn();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('CreditDrawer — Add pending (payments.md:152–168)', () => {
  it('opens on "Which way", Give picked, stacked with "Back"', async () => {
    const { baseElement } = renderWithProviders(
      <CreditDrawer open mode="create" onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Add pending')).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        'Money the clinic has to give back or take · settle it later from Pending',
      ),
    ).toBeInTheDocument();
    expect(part('way-give')).toHaveAttribute('aria-pressed', 'true');
    expect(part('way-give')).toHaveAttribute('title', 'We pay them back');
    expect(part('who')).toHaveTextContent('Search patients, contacts or suppliers');
    expect(part('dismiss')).toHaveTextContent('Back');
    expect(part('save')).toHaveTextContent('Save · give later');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('checks who, the amount and a reason in turn, then adds it for the person’s contact, in rupees', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(<CreditDrawer open mode="create" onClose={onClose} />);
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick who');

    await pickKavya(user);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the amount');

    await user.type(part('amount'), '500.5');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick a reason');
    // The Why step opened on the missing reason.
    await user.click(await screen.findByTestId(`${D}-reason-charged_twice`));
    expect(part('summary')).toHaveTextContent(
      'Give ₹500.50 back to Kavya Mehta · Charged twice',
    );
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createCredit).toHaveBeenCalledWith({
      input: {
        direction: 'give',
        contactId: TEST_MONEY_CONTACT_ID,
        partyName: 'Kavya Mehta',
        amount: 500.5,
        reasonKey: 'charged_twice',
        invoiceId: null,
        settleBy: null,
        note: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      'CR-3 saved · give ₹500.50 to Kavya Mehta',
    );
  });

  it('links one of the person’s invoices through For invoice (their contact’s invoices)', async () => {
    const user = setUser();
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    await pickKavya(user);
    await user.type(part('amount'), '80');
    await user.click(part('step-why-trigger'));
    await user.click(await screen.findByTestId(`${D}-reason-overpaid`));
    const invoice = await screen.findByTestId(`${D}-invoice`);
    expect(fetchAllInvoices).toHaveBeenCalledWith({ contactId: TEST_MONEY_CONTACT_ID });
    expect(invoice).toHaveTextContent('No invoice');
    await user.click(invoice);
    const option = await screen.findByTestId(`${D}-invoice-option-${TEST_INVOICE_ID}`);
    expect(option).toHaveTextContent('Invoice #5');
    expect(option).toHaveTextContent('₹500 · ₹100 due');
    await user.click(option);
    await user.click(part('save'));
    await waitFor(() => expect(createCredit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createCredit).mock.calls[0]?.[0].input.invoiceId).toBe(
      TEST_INVOICE_ID,
    );
  });

  it('takes a typed name, wants a note for "Other", and saves a Take by name', async () => {
    vi.mocked(searchCreditParties).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(fetchAllInvoices).mockClear();
    const user = setUser();
    renderWithProviders(
      <CreditDrawer open mode="create" direction="take" onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-save`)).toHaveTextContent('Save · take later');
    await user.click(part('who'));
    await user.type(await screen.findByTestId(`${D}-who-search`), 'Shree Ram Agencies');
    const create = await screen.findByTestId(`${D}-who-create`);
    expect(create).toHaveTextContent('Add “Shree Ram Agencies”');
    await user.click(create);
    await waitFor(() => expect(part('who')).toHaveTextContent('Shree Ram Agencies'));
    await user.type(part('amount'), '800');
    await user.click(part('step-why-trigger'));
    await user.click(await screen.findByTestId(`${D}-reason-other`));
    expect(part('note')).toHaveAttribute(
      'placeholder',
      'e.g. Supplier will adjust in the next bill',
    );
    expect(screen.queryByTestId(`${D}-invoice`)).toBeNull();
    expect(fetchAllInvoices).not.toHaveBeenCalled();
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a note for “Other”');
    await user.type(part('note'), 'Short on the last delivery');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'CR-3 saved · take ₹800 from Shree Ram Agencies',
      ),
    );
    expect(vi.mocked(createCredit).mock.calls[0]?.[0].input).toMatchObject({
      direction: 'take',
      contactId: null,
      partyName: 'Shree Ram Agencies',
      reasonKey: 'other',
      note: 'Short on the last delivery',
    });
  });

  it('drops the picked reason when the way changes', async () => {
    const user = setUser();
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    await user.click(await screen.findByTestId(`${D}-step-why-trigger`));
    await user.click(await screen.findByTestId(`${D}-reason-overpaid`));
    expect(part('reason-overpaid')).toHaveAttribute('aria-pressed', 'true');
    await user.click(part('step-way-trigger'));
    await user.click(await screen.findByTestId(`${D}-way-take`));
    expect(part('save')).toHaveTextContent('Save · take later');
    await user.click(part('step-why-trigger'));
    expect(await screen.findByTestId(`${D}-reason-short_payment`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByTestId(`${D}-reason-overpaid`)).toBeNull();
  });

  it('puts the server’s field error on its field', async () => {
    vi.mocked(createCredit).mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        errors: [{ field: 'body.amount', message: 'Must be more than 0' }],
      }),
    );
    const user = setUser();
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    await pickKavya(user);
    await user.type(part('amount'), '5');
    await user.click(part('step-why-trigger'));
    await user.click(await screen.findByTestId(`${D}-reason-overpaid`));
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Must be more than 0'),
    );
    expect(part('amount')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is view only without payment:create', async () => {
    signIn(['organization:read', 'payment:read']);
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    expect(await screen.findByText('Add pending')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
  });
});

describe('CreditDrawer — Edit pending (S:90)', () => {
  it('opens an open credit and saves its change with the credit as read: "CR-2 updated"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('CR-2');
    expect(
      screen.getByText('Editable while it is open · changes are logged'),
    ).toBeInTheDocument();
    expect(part('who')).toHaveTextContent('Kavya Mehta');
    expect(part('summary')).toHaveTextContent('Give ₹300 back to Kavya Mehta · Overpaid');
    expect(part('save')).toHaveTextContent('Save changes');
    expect(part('delete')).toBeInTheDocument();
    const amount = part('amount');
    await user.clear(amount);
    await user.type(amount, '250');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateCredit).toHaveBeenCalledWith({
      credit: OPEN_CREDIT,
      input: expect.objectContaining({ amount: 250, contactId: TEST_MONEY_CONTACT_ID }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('CR-2 updated');
  });

  it('offers Reload on a save over a newer change, and starts over on what was saved', async () => {
    vi.mocked(updateCredit).mockRejectedValueOnce(
      refusal(409, { code: 'conflict', reason: 'record_changed' }),
    );
    const saved = { ...OPEN_CREDIT, amount: 280, updatedAt: '2026-10-10T06:00:00.000Z' };
    vi.mocked(fetchCredit).mockResolvedValue(saved);
    const user = setUser();
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} onClose={vi.fn()} />,
    );
    const amount = await screen.findByTestId(`${D}-amount`);
    await user.clear(amount);
    await user.type(amount, '250');
    await user.click(part('save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const [, options] = notifyMock.error.mock.calls[0] ?? [];
    const reload = (options as { action?: { label: string; onClick: () => void } })
      .action;
    expect(reload?.label).toBe('Reload');
    reload?.onClick();
    await waitFor(() => expect(part('amount')).toHaveValue('280'));
    expect(fetchCredit).toHaveBeenCalledWith(OPEN_CREDIT.id);
    await user.click(part('save'));
    await waitFor(() => expect(updateCredit).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateCredit).mock.calls[1]?.[0].credit).toEqual(saved);
  });

  it('turns view only when part of it was settled meanwhile (409 credit_settled)', async () => {
    vi.mocked(updateCredit).mockRejectedValue(
      refusal(409, { code: 'conflict', reason: 'credit_settled' }),
    );
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} onClose={onClose} />,
    );
    await user.click(await screen.findByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        words('pending.conflicts.settled', { ref: 'CR-2' }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
    expect(screen.queryByTestId(`${D}-delete`)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only shows a credit when the route says so', async () => {
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} readOnly onClose={vi.fn()} />,
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-save`)).toBeNull();
    expect(screen.queryByTestId(`${D}-delete`)).toBeNull();
  });

  it('is view only without payment:update, and offers no Delete without payment:delete', async () => {
    signIn(['organization:read', 'payment:read', 'payment:create']);
    const { unmount } = renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} onClose={vi.fn()} />,
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
    unmount();
    signIn(['organization:read', 'payment:read', 'payment:update']);
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={OPEN_CREDIT} onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-save`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-delete`)).toBeNull();
  });
});
