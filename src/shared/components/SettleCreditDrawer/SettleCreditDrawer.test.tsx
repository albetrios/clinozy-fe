import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { settleCredit } from '@/shared/api/app/credits-api.ts';
import type { CreditRow } from '@/shared/api/app/credits-contracts.ts';
import { branchRef } from '@/shared/api/app/fixtures/organization.fixtures.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { creditRow, TEST_CREDIT_ID } from '@/tests/utils/payments-doubles.ts';
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
// Payment received plays its animation through lottie-web, which jsdom cannot draw.
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: {
    loadAnimation: () => ({ totalFrames: 1, goToAndStop: vi.fn(), destroy: vi.fn() }),
  },
}));
vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientFeedback: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  settleCredit: vi.fn(),
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const D = 'settle-credit-drawer';

/** CR-1: give Kavya Mehta ₹80, ₹50 of it settled — ₹30 left. */
const KAVYA_CREDIT = creditRow();

/** CR-7: take ₹800 from a supplier named by hand, nothing settled. */
const SUPPLIER_CREDIT = creditRow({
  id: 'pcr_supplier0000000000007',
  seq: 7,
  direction: 'take',
  contactId: null,
  contact: null,
  patientId: null,
  partyName: 'Medline Surgicals',
  amount: 800,
  settled: 0,
  left: 800,
  reason: 'damaged_goods',
  reasonKey: 'damaged_goods',
  invoiceId: null,
  paymentIds: [],
});

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'app', ...options });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, `/app/pending-credits/${TEST_CREDIT_ID}/settle`, 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function renderDrawer(credit: CreditRow = KAVYA_CREDIT, onClose = vi.fn()) {
  const view = renderWithProviders(
    <SettleCreditDrawer credit={credit} reasonLabel="Overpaid" onClose={onClose} />,
  );
  return { ...view, onClose };
}

/** The amount of the one row, typed in rupees. */
async function typeAmount(user: ReturnType<typeof setUser>, amount: string) {
  const input = await screen.findByTestId(`${D}-splits-amount`);
  await user.clear(input);
  await user.type(input, amount);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(settleCredit)
    .mockReset()
    .mockImplementation(async ({ credit }) => ({
      credit: { ...credit, settled: credit.amount, left: 0, status: 'given_back' },
      amount: 30,
      paymentSeq: 6,
      invoiceSeq: 5,
      creditNoteSeq: 3,
    }));
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('SettleCreditDrawer — Give back (payments.md:170–180)', () => {
  it('opens on what is left in UPI, today, at the main branch — stacked, "Return ₹30"', async () => {
    const { baseElement } = renderDrawer();
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Give back')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('CR-1');
    expect(
      within(drawer).getByText(
        `To ${fsi('Kavya Mehta')} · ${fsi('Overpaid')} · adds an Out entry to Payments`,
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('How it goes back')).toBeInTheDocument();
    expect(part('splits-mode')).toHaveTextContent('UPI');
    expect(part('splits-amount')).toHaveValue('30');
    expect(part('splits-total')).toHaveTextContent('Total ₹30 · of ₹30');
    expect(part(`branch-${branchRef('Adajan')}`)).toHaveAttribute('aria-pressed', 'true');
    expect(part('date')).toHaveTextContent('Today');
    expect(part('dismiss')).toHaveTextContent('Back');
    expect(part('save')).toHaveTextContent('Return ₹30');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('gives part of it back in cash at the branch picked, with the action’s key, and says so', async () => {
    const user = setUser();
    const { onClose } = renderDrawer();
    await user.click(await screen.findByTestId(`${D}-branch-${branchRef('Vesu')}`));
    await user.click(part('splits-mode'));
    await user.click(await screen.findByTestId(`${D}-splits-mode-option-cash`));
    await typeAmount(user, '20.5');
    await user.click(part('save'));
    await waitFor(() => expect(settleCredit).toHaveBeenCalledTimes(1));
    expect(settleCredit).toHaveBeenCalledWith({
      credit: KAVYA_CREDIT,
      settlement: {
        action: 'give_back',
        branchId: branchRef('Vesu'),
        splits: [{ mode: 'cash', amount: 20.5 }],
      },
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        words('settleCredit.done.give', {
          amount: '₹30',
          name: 'Kavya Mehta',
          entry: 'PAY-6 · CN-003',
        }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('records an earlier day as that day, and an entry whose numbers did not come back as added', async () => {
    vi.mocked(settleCredit).mockImplementation(async ({ credit }) => ({
      credit,
      amount: 30,
      paymentSeq: null,
      invoiceSeq: null,
      creditNoteSeq: null,
    }));
    const user = setUser();
    renderDrawer();
    await user.click(await screen.findByTestId(`${D}-date`));
    await user.click(await screen.findByTestId(`${D}-date-option-2026-10-09`));
    await user.click(part('save'));
    await waitFor(() => expect(settleCredit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(settleCredit).mock.calls[0]?.[0].settlement).toMatchObject({
      paidAt: '2026-10-09T04:30:00.000Z',
    });
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        words('settleCredit.done.give', {
          amount: '₹30',
          name: 'Kavya Mehta',
          entry: words('settleCredit.entry.give'),
        }),
      ),
    );
  });

  it('refuses more than is owed before anything is sent', async () => {
    const user = setUser();
    renderDrawer();
    await typeAmount(user, '40');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('More than the ₹30 owed');
    expect(settleCredit).not.toHaveBeenCalled();
  });

  it('says a closed day on the Date and keeps the drawer open (409 day_closed)', async () => {
    vi.mocked(settleCredit).mockRejectedValue(conflict('day_closed'));
    const user = setUser();
    const { onClose } = renderDrawer();
    await user.click(await screen.findByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words('settleCredit.dayClosed')),
    );
    expect(screen.getByTestId(D)).toHaveTextContent(words('settleCredit.dayClosed'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says more than its invoice has paid on the rows (409 more_than_paid)', async () => {
    vi.mocked(settleCredit).mockRejectedValue(conflict('more_than_paid'));
    const user = setUser();
    renderDrawer();
    await user.click(await screen.findByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words('settleCredit.moreThanPaid')),
    );
  });

  it('closes on a credit settled in full meanwhile (409 credit_closed)', async () => {
    vi.mocked(settleCredit).mockRejectedValue(conflict('credit_closed'));
    const user = setUser();
    const { onClose } = renderDrawer();
    await user.click(await screen.findByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith(
        words('settleCredit.closed', { ref: 'CR-1' }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SettleCreditDrawer — Got it back', () => {
  it('records money coming back from a supplier: "Got it back", "Record ₹800"', async () => {
    const user = setUser();
    renderDrawer(SUPPLIER_CREDIT);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Got it back')).toBeInTheDocument();
    expect(within(drawer).getByText('How it came in')).toBeInTheDocument();
    expect(part('save')).toHaveTextContent('Record ₹800');
    await user.click(part('save'));
    await waitFor(() =>
      expect(vi.mocked(settleCredit).mock.calls[0]?.[0].settlement).toEqual({
        action: 'got_back',
        branchId: branchRef('Adajan'),
        splits: [{ mode: 'upi', amount: 800 }],
      }),
    );
    // A supplier is no person to celebrate with: the toast, as before.
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
  });

  it('turns into Payment received when a patient pays back (feat-payment-celebration D9)', async () => {
    const user = setUser();
    vi.mocked(settleCredit).mockImplementation(async ({ credit }) => ({
      credit: { ...credit, settled: 300, left: 500, status: 'open' },
      amount: 300,
      paymentSeq: 9,
      invoiceSeq: null,
      creditNoteSeq: null,
    }));
    const { onClose } = renderDrawer({
      ...KAVYA_CREDIT,
      direction: 'take',
      amount: 800,
      settled: 0,
      left: 800,
    });
    await typeAmount(user, '300');
    await user.click(part('save'));
    expect(await screen.findByTestId('payment-received-amount')).toHaveTextContent(
      '₹300 received',
    );
    expect(screen.getByTestId('payment-received-outcome')).toHaveTextContent(
      '₹500 still owed on CR-1',
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
    await user.click(part('done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
