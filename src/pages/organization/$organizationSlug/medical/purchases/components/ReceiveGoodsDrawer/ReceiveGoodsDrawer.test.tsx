import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMedicines: vi.fn(),
}));
vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  receivePurchaseOrder: vi.fn(),
}));
import { fetchAllMedicines } from '@/shared/api/app/medicines-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { medicineRow, purchaseOrderRow } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { receivePurchaseOrder } from '../../../shared/medical-records-api.ts';
import { typedMedicineKey } from '../PurchaseOrderDrawer/purchase-order-form.ts';
import {
  emptyUnexpectedLine,
  expiryProblems,
  receiveInputOf,
  type ReceiveLineValues,
  receiveTotal,
  unexpectedProblems,
} from './receive-form.ts';
import { ReceiveGoodsDrawer } from './ReceiveGoodsDrawer.tsx';

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

const D = 'receive-goods-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const KR_ID = 'sup_krmedical000000000000';
const EPRIVA_ID = 'med_epriva000000000000000';
const GLYCOLAC_ID = 'med_glyco0000000000000000';
const AZELAN_ID = 'med_azelan000000000000000';
const EPRIVA_LINE_ID = 'mpoi_epriva00000000000000';
const GLYCOLAC_LINE_ID = 'mpoi_glyco000000000000000';

/** PO #430 from K R Medical Agency, Ordered: Epriva Tab 10 + 2 at ₹212, Glycolac Cream 4 at ₹529. */
const ORDER = purchaseOrderRow({
  seq: 430,
  stage: 'ordered',
  apiStage: 'ordered',
  receivedAt: null,
  supplier: { id: KR_ID, name: 'K R Medical Agency', phone: null, gstNumber: null },
  lines: [
    {
      id: EPRIVA_LINE_ID,
      lineNo: 1,
      medicineId: EPRIVA_ID,
      medicineName: 'Epriva Tab',
      qty: 10,
      free: 2,
      rate: 212,
      amount: 2120,
      received: null,
      batchNo: null,
      expiry: null,
    },
    {
      id: GLYCOLAC_LINE_ID,
      lineNo: 2,
      medicineId: GLYCOLAC_ID,
      medicineName: 'Glycolac Cream',
      qty: 4,
      free: 0,
      rate: 529,
      amount: 2116,
      received: null,
      batchNo: null,
      expiry: null,
    },
  ],
  itemCount: 2,
  freeCount: 2,
  total: 4236,
  paid: 0,
  due: 0,
  paymentStatus: 'unpaid',
});

/** The store's medicines: Azelan on K R Medical Agency's price list at ₹190. */
const CATALOGUE = [
  medicineRow({
    id: AZELAN_ID,
    name: 'Azelan 20% Cream',
    supplierRates: [
      {
        supplierId: KR_ID,
        supplierName: 'K R Medical Agency',
        rate: 190,
        free: 0,
        leadDays: 1,
      },
    ],
  }),
  medicineRow({ id: EPRIVA_ID, name: 'Epriva Tab' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchAllMedicines).mockResolvedValue(CATALOGUE);
  vi.mocked(receivePurchaseOrder).mockResolvedValue(
    purchaseOrderRow({ ...ORDER, stage: 'received', apiStage: 'received' }),
  );
});
afterEach(() => resetMedicalRoutes());

/** An ordered line of #430 — Epriva Tab, 10 + 2 free at ₹212 (paise in the form). */
const ORDERED: ReceiveLineValues = {
  lineId: EPRIVA_LINE_ID,
  medicineId: EPRIVA_ID,
  name: 'Epriva Tab',
  qty: 10,
  free: 2,
  rate: 21_200,
  mrp: 0,
  arrived: true,
  batchNo: ' ',
  expiry: '',
  unexpected: false,
};

/** An unexpected line with Azelan picked: 2 at ₹190, batch AZ900. */
const AZELAN: ReceiveLineValues = {
  ...emptyUnexpectedLine(),
  medicineId: AZELAN_ID,
  name: 'Azelan 20% Cream',
  qty: 2,
  rate: 19_000,
  batchNo: 'AZ900',
  expiry: '06/28',
};

describe('receive-form (medical.md:269–279)', () => {
  it('needs an arrived line’s expiry as "MM/YY"; each ordered line goes by its id, one that did not arrive with nothing', () => {
    const line = ORDERED;
    expect(
      expiryProblems([
        { ...line, arrived: true },
        { ...line, arrived: true, expiry: '13/27' },
        { ...line, arrived: true, expiry: '12/27' },
        { ...line, arrived: false },
      ]),
    ).toEqual([
      { index: 0, problem: 'missing' },
      { index: 1, problem: 'invalid' },
    ]);
    expect(
      receiveInputOf({
        lines: [
          { ...line, arrived: true, expiry: '12/27' },
          { ...line, arrived: false, expiry: '12/27' },
        ],
        note: '',
      }),
    ).toEqual({
      lines: [
        { id: EPRIVA_LINE_ID, arrived: true, batchNo: null, expiry: '12/27', mrp: null },
        { id: EPRIVA_LINE_ID, arrived: false, batchNo: null, expiry: null, mrp: null },
      ],
      extras: [],
      note: null,
    });
  });

  it('sends an unexpected line once its medicine is picked, without an id, in rupees; a blank one is left out (H:5388, MD26)', () => {
    const blank = emptyUnexpectedLine();
    expect(blank).toMatchObject({
      lineId: null,
      medicineId: null,
      qty: 1,
      arrived: true,
      unexpected: true,
    });
    const typed = { ...AZELAN, medicineId: typedMedicineKey('Azel cream'), name: '' };
    const lines = [{ ...ORDERED, expiry: '12/27' }, AZELAN, typed, blank];
    expect(receiveInputOf({ lines, note: ' 30 DAYS DUE ' })).toEqual({
      note: '30 DAYS DUE',
      lines: [
        { id: EPRIVA_LINE_ID, arrived: true, batchNo: null, expiry: '12/27', mrp: null },
      ],
      extras: [
        {
          medicineId: AZELAN_ID,
          qty: 2,
          free: 0,
          rate: 190,
          mrp: null,
          batchNo: 'AZ900',
          expiry: '06/28',
        },
        {
          medicineId: null,
          newMedicineName: 'Azel cream',
          qty: 2,
          free: 0,
          rate: 190,
          mrp: null,
          batchNo: 'AZ900',
          expiry: '06/28',
        },
      ],
    });
    // The blank line asks for nothing; a picked one is checked like an ordered one.
    expect(expiryProblems([blank, { ...AZELAN, expiry: '' }])).toEqual([
      { index: 1, problem: 'missing' },
    ]);
    // Ticked ✗, an unexpected line is not sent either.
    expect(
      receiveInputOf({ lines: [{ ...AZELAN, arrived: false }], note: '' }).extras,
    ).toEqual([]);
  });

  it('names an unexpected line with no count or no rate, and bills what comes in', () => {
    const lines = [
      { ...ORDERED, expiry: '12/27' },
      { ...AZELAN, qty: 0 },
      { ...AZELAN, rate: 0 },
      emptyUnexpectedLine(),
    ];
    expect(unexpectedProblems(lines)).toEqual({ qty: [1], rate: [2] });
    // #430's ₹4,236 (the API's rupees) and 2 × ₹190, in paise; free units cost nothing.
    expect(receiveTotal({ total: 4236 }, [ORDERED, { ...AZELAN, free: 3 }])).toBe(
      423_600 + 38_000,
    );
    expect(receiveTotal({ total: 4236 }, [{ ...AZELAN, arrived: false }])).toBe(423_600);
  });
});

describe('ReceiveGoodsDrawer (medical.md:269–279)', () => {
  it('ticks every line, needs each arrived expiry, and marks the order received', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={ORDER} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent(
      `${fsi('K R Medical Agency')} · tick each item and enter batch & expiry`,
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,236');
    // The chip row (H:5394): the supplier in sky, the lines and their bill.
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect([...badges.children].map((badge) => badge.textContent)).toEqual([
      'K R Medical Agency',
      '2 items',
      '₹4,236',
    ]);
    // The section's heading shows (H:5388), and names the table's group.
    expect(
      within(drawer).getByRole('group', { name: 'Tick what arrived' }),
    ).toBeInTheDocument();
    // A long sub wraps to a second line on a phone instead of being cut.
    expect(
      within(drawer).getByText(
        `${fsi('K R Medical Agency')} · tick each item and enter batch & expiry`,
      ),
    ).toHaveClass('max-md:line-clamp-2', 'max-md:whitespace-normal');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // Nothing typed: each arrived line's expiry is asked for.
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the expiry');

    // The second line did not come; the first came without a batch number.
    const [first, second] = within(drawer).getAllByTestId(`${D}-lines-arrived`);
    if (!(first && second)) throw new Error('expected two lines');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAccessibleName('Not arrived');
    const [expiry] = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    if (!expiry) throw new Error('expected an expiry cell');
    await user.type(expiry, '12/27');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Goods received · stock and free quantity added',
    );
    // Each ordered line by its id; an empty batch is the server's "NEW-430".
    expect(receivePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ORDER.id,
        input: {
          lines: [
            {
              id: EPRIVA_LINE_ID,
              arrived: true,
              batchNo: null,
              expiry: '12/27',
              mrp: null,
            },
            {
              id: GLYCOLAC_LINE_ID,
              arrived: false,
              batchNo: null,
              expiry: null,
              mrp: null,
            },
          ],
          extras: [],
          note: null,
        },
      }),
    );
  });

  it('asks for something that arrived, and names an expiry not "MM/YY"', async () => {
    const user = setup();
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={ORDER} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    const [expiry] = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    if (!expiry) throw new Error('expected an expiry cell');
    await user.type(expiry, '1227');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the expiry as MM/YY');

    for (const toggle of within(drawer).getAllByTestId(`${D}-lines-arrived`)) {
      await user.click(toggle);
    }
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Tick what arrived');
  });

  it('adds an unexpected item — medicine, count, rate, batch, expiry — into stock and onto the bill', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <ReceiveGoodsDrawer open order={ORDER} onClose={onClose} openChild={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const table = within(drawer).getByTestId(`${D}-lines-table`);
    // The design's columns until an unexpected line comes: no Rate, no ×.
    expect(within(table).queryByRole('columnheader', { name: 'Rate' })).toBeNull();
    expect(within(drawer).queryByTestId(`${D}-lines-remove`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    expect(within(drawer).getByTestId(`${D}-lines-add`)).toHaveTextContent(
      'Add unexpected item',
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3);
    expect(within(table).getByRole('columnheader', { name: 'Rate' })).toBeInTheDocument();
    expect(within(drawer).getAllByTestId(`${D}-lines-remove`)).toHaveLength(1);

    // Azelan from K R Medical Agency's price list: its ₹190 fills the rate.
    await user.click(within(drawer).getByTestId(`${D}-lines-medicine`));
    await user.click(
      await screen.findByTestId(`${D}-lines-medicine-option-${AZELAN_ID}`),
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,426');
    const qty = within(drawer).getByTestId(`${D}-lines-qty`);
    await user.clear(qty);
    await user.type(qty, '2');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,616');
    // The chips follow the lines, the unexpected one included.
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'K R Medical Agency3 items₹4,616',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // Nothing on the order came; Azelan did, in batch AZ900.
    const [first, second] = within(drawer).getAllByTestId(`${D}-lines-arrived`);
    if (!(first && second)) throw new Error('expected the ordered lines');
    await user.click(first);
    await user.click(second);
    const batches = within(drawer).getAllByTestId(`${D}-lines-batch`);
    const expiries = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    await user.type(batches[2] as HTMLElement, 'AZ900');
    await user.type(expiries[2] as HTMLElement, '06/28');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The unexpected line goes as an extra, without an id (MD26) — rupees.
    expect(receivePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          extras: [
            {
              medicineId: AZELAN_ID,
              qty: 2,
              free: 0,
              rate: 190,
              mrp: 650,
              batchNo: 'AZ900',
              expiry: '06/28',
            },
          ],
        }),
      }),
    );
  });

  it('asks for an unexpected line’s count and rate, and drops it with its ×', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={ORDER} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    await user.click(within(drawer).getByTestId(`${D}-lines-medicine`));
    await user.click(
      await screen.findByTestId(`${D}-lines-medicine-option-${AZELAN_ID}`),
    );
    for (const expiry of within(drawer).getAllByTestId(`${D}-lines-expiry`)) {
      await user.type(expiry, '12/27');
    }

    await user.clear(within(drawer).getByTestId(`${D}-lines-qty`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a quantity');

    await user.type(within(drawer).getByTestId(`${D}-lines-qty`), '1');
    await user.clear(within(drawer).getByTestId(`${D}-lines-rate`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Enter the rate for Azelan 20% Cream',
    );
    expect(onClose).not.toHaveBeenCalled();

    // × drops the line, and the Rate column with it.
    await user.click(within(drawer).getByTestId(`${D}-lines-remove`));
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(
      within(within(drawer).getByTestId(`${D}-lines-table`)).queryByRole('columnheader', {
        name: 'Rate',
      }),
    ).toBeNull();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(receivePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ extras: [] }) }),
    );
  });

  it('names an unexpected line’s figures on a phone, where the header row is gone', async () => {
    viewport.tier = 'phone';
    const user = setup();
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={ORDER} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    const [, , added] = within(drawer).getAllByTestId(`${D}-lines-row`);
    const row = within(added as HTMLElement);
    for (const name of ['Qty', 'Free', 'Rate']) {
      // A visible caption, and the same name on the field itself.
      expect(row.getByText(name)).toBeVisible();
      expect(row.getByRole('textbox', { name })).toBeInTheDocument();
    }
    expect(row.getByRole('textbox', { name: 'Qty' })).toHaveClass('max-md:w-14');
    // The ordered lines keep the design's bare figures.
    const [ordered] = within(drawer).getAllByTestId(`${D}-lines-row`);
    expect(within(ordered as HTMLElement).queryByText('Qty')).toBeNull();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    viewport.tier = 'desktop';
  });

  it('shimmers until the order is read', async () => {
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
