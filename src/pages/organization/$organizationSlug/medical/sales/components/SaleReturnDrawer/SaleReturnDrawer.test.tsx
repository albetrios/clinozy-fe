import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  returnSale: vi.fn(),
}));

import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { paidSaleRow, TEST_SALE_ID } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import type { SaleLine, SaleReturn, SaleRow } from '../../../shared/medical-contracts.ts';
import { returnSale } from '../../../shared/medical-records-api.ts';
import { SaleReturnDrawer } from './SaleReturnDrawer.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const D = 'sale-return-drawer';
const ADMOSH_LINE = 'iitm_admosh0000000000000000';
const UNCAP_LINE = 'iitm_uncap00000000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A sold line as the API answers it. */
const line = (patch: Partial<SaleLine>): SaleLine => ({
  invoiceItemId: ADMOSH_LINE,
  medicineId: 'med_admosh000000000000000',
  name: 'Admosh Cream',
  qty: 1,
  batchNo: 'AD2511',
  expiry: '05/27',
  rate: 550,
  discountPct: 0,
  amount: 550,
  returnedQty: 0,
  ...patch,
});

/** Sale #983, paid ₹1,200: Admosh ₹550 + two Uncap at ₹325. */
const SALE = paidSaleRow({
  id: TEST_SALE_ID,
  seq: 983,
  bill: 1200,
  paid: 1200,
  lines: [
    line({}),
    line({
      invoiceItemId: UNCAP_LINE,
      medicineId: 'med_uncap0000000000000000',
      name: 'Uncap Gel',
      qty: 2,
      batchNo: 'UC2604',
      rate: 325,
      amount: 650,
    }),
  ],
});

/** The sale as the server answers the return: one more return on it. */
function answered(entry: Partial<SaleReturn>): SaleRow {
  return {
    ...SALE,
    status: 'returned',
    returns: [
      {
        id: 'msrt_back00000000000000000',
        reason: 'unused',
        refundMode: 'cash',
        note: null,
        amount: 1200,
        creditNoteId: 'icn_back00000000000000000',
        pendingCreditId: null,
        items: [{ invoiceItemId: ADMOSH_LINE, qty: 1, amount: 550, restocked: true }],
        returnedById: null,
        at: '2026-10-10T04:30:00.000Z',
        ...entry,
      },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  vi.mocked(returnSale).mockReset();
});

describe('SaleReturnDrawer (medical.md:283–295)', () => {
  it('asks what is coming back first, then refunds everything back: "₹1,200 refunded · stock added back"', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(returnSale).mockResolvedValue(answered({}));
    renderMedicalDrawer(<SaleReturnDrawer open sale={SALE} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Return from patient',
    );
    expect(drawer).toHaveTextContent(
      `${fsi('Priya Shah')} · returned stock goes back into its batch`,
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);

    // Nothing back yet: the save says what is missing.
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter what is being returned');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-everything`));
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Refund ₹1,200');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Unused · ₹1,200',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(returnSale).toHaveBeenCalledWith({
      id: TEST_SALE_ID,
      input: {
        lines: [
          { invoiceItemId: ADMOSH_LINE, qty: 1 },
          { invoiceItemId: UNCAP_LINE, qty: 2 },
        ],
        reason: 'unused',
        mode: 'cash',
        note: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('₹1,200 refunded · stock added back');
  });

  it('a damaged return kept as store credit (MD33): "₹325 kept as store credit · stock written off"', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(returnSale).mockResolvedValue(
      answered({
        reason: 'damaged',
        refundMode: 'credit',
        amount: 325,
        pendingCreditId: 'pcr_credit000000000000000',
        items: [{ invoiceItemId: UNCAP_LINE, qty: 1, amount: 325, restocked: false }],
      }),
    );
    renderMedicalDrawer(<SaleReturnDrawer open sale={SALE} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    const [, uncap] = within(drawer).getAllByTestId(`${D}-lines-return-increase`);
    if (!uncap) throw new Error('expected the Uncap line');
    await user.click(uncap);

    await user.click(within(drawer).getByTestId(`${D}-step-reason-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-reason-damaged`));
    const credit = within(drawer).getByTestId(`${D}-mode-credit`);
    expect(credit).toHaveTextContent('Store credit');
    await user.click(credit);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Damaged · ₹325',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent(
      'Keep ₹325 as store credit',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(returnSale).mock.calls[0]?.[0].input).toEqual({
      lines: [{ invoiceItemId: UNCAP_LINE, qty: 1 }],
      reason: 'damaged',
      mode: 'credit',
      note: null,
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      '₹325 kept as store credit · stock written off',
    );
  });

  it('a sale still owing takes no return: "collect first" (409 sale_not_paid, MD24)', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(returnSale).mockRejectedValue(
      new HttpError('refused', 409, '/app/medical-sales', 'POST', {
        error: { reason: 'sale_not_paid', detail: 'The sale is not paid in full' },
      }),
    );
    renderMedicalDrawer(<SaleReturnDrawer open sale={SALE} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-quick-fill-everything`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Collect the full bill first · only a sale paid in full takes a return',
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens read-only for a member who gives no money back, and shimmers until the sale is read', async () => {
    const view = renderMedicalDrawer(
      <SaleReturnDrawer open sale={SALE} onClose={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(<SaleReturnDrawer open sale={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
