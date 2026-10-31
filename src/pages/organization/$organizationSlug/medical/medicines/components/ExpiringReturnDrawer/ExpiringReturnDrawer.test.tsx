import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createSupplierCredit: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { medicineRow, supplierCreditRow } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { createSupplierCredit } from '../../../shared/medical-records-api.ts';
import { ExpiringReturnDrawer } from './ExpiringReturnDrawer.tsx';

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

const D = 'expiring-return-drawer';
const AKSHAR_ID = 'sup_akshar000000000000000';
const KR_ID = 'sup_krmedical000000000000';
const GLYCOLAC_BATCH_ID = 'mbt_glyco0260000000000000';

/** Glycolac Cream: 3 left in 026-312 at ₹123, bought from Akshar Medicines. */
const GLYCOLAC = medicineRow({
  id: 'med_glyco0000000000000000',
  seq: 456,
  name: 'Glycolac Cream',
  stock: 3,
  nearest: { batchNo: '026-312', expiry: '11/26', daysLeft: 48 },
  batches: [
    {
      id: GLYCOLAC_BATCH_ID,
      batchNo: '026-312',
      expiry: '11/26',
      qty: 3,
      purchaseRate: 123,
      supplierId: AKSHAR_ID,
      expired: false,
    },
  ],
  supplierRates: [
    {
      supplierId: AKSHAR_ID,
      supplierName: 'Akshar Medicines',
      rate: 123,
      free: 0,
      leadDays: 2,
    },
  ],
});

/** Uncap: 8 in CSH26044 at ₹440; K R Medical Agency ₹440 · Akshar ₹452. */
const UNCAP = medicineRow({
  id: 'med_uncap0000000000000000',
  seq: 458,
  name: 'Uncap',
  stock: 8,
  nearest: { batchNo: 'CSH26044', expiry: '12/26', daysLeft: 79 },
  batches: [
    {
      id: 'mbt_uncap0000000000000000',
      batchNo: 'CSH26044',
      expiry: '12/26',
      qty: 8,
      purchaseRate: 440,
      supplierId: KR_ID,
      expired: false,
    },
  ],
  supplierRates: [
    {
      supplierId: AKSHAR_ID,
      supplierName: 'Akshar Medicines',
      rate: 452,
      free: 0,
      leadDays: 2,
    },
    {
      supplierId: KR_ID,
      supplierName: 'K R Medical Agency',
      rate: 440,
      free: 0,
      leadDays: 1,
    },
  ],
});

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(createSupplierCredit).mockResolvedValue(
    supplierCreditRow({
      supplierId: AKSHAR_ID,
      supplierName: 'Akshar Medicines',
      batchId: GLYCOLAC_BATCH_ID,
      qty: 3,
      rate: 123,
      amount: 369,
    }),
  );
});
afterEach(() => resetMedicalRoutes());

describe('ExpiringReturnDrawer (medical.md:297–309)', () => {
  it('returns the whole batch to its supplier as a supplier credit, previewing qty × rate', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={GLYCOLAC} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-supplier`)).toHaveTextContent(
      'Akshar Medicines',
    );
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Return expiring stock',
    );
    // The sub's medicine, batch and expiry are isolated tokens.
    expect(drawer).toHaveTextContent(
      `${fsi('Glycolac Cream')} · batch ${fsi('026-312')}`,
    );
    expect(withoutBidiMarks(drawer.textContent)).toMatch(
      /Glycolac Cream · batch 026-312 · expires 11\/26/,
    );
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent('Credit ₹369');
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent('48 days left');
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹369');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Credit reduces what you owe Akshar Medicines',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The supplier, the batch and the packs (MD34); the server sets the credit off.
    expect(createSupplierCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { supplierId: AKSHAR_ID, batchId: GLYCOLAC_BATCH_ID, qty: 3 },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      '3 returned · ₹369 credit from Akshar Medicines',
    );
  });

  it('starts on the cheapest supplier and caps the quantity at the batch', async () => {
    const user = setup();
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={UNCAP} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-supplier`)).toHaveTextContent(
      'K R Medical Agency',
    );
    expect(drawer).toHaveTextContent('of 8');
    const qty = within(drawer).getByTestId(`${D}-qty`);
    await user.clear(qty);
    await user.type(qty, '2');
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹880');
    await user.click(within(drawer).getByTestId(`${D}-qty-increase`));
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹1,320');
  });

  it('prices a loose-selling medicine per unit, as the server does (D5)', async () => {
    const user = setup();
    // A strip of 10 at ₹125.55: 60 units in stock, one unit ₹12.56 to the paisa.
    const strip = medicineRow({
      ...UNCAP,
      unitsPerPack: 10,
      stock: 60,
      batches: [{ ...UNCAP.batches[0]!, qty: 60, purchaseRate: 125.55 }],
    });
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={strip} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent('of 60');
    const qty = within(drawer).getByTestId(`${D}-qty`);
    await user.clear(qty);
    await user.type(qty, '6');
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹75.36');
  });

  it('is closed without a medicine, and read-only for a viewer', async () => {
    const view = renderMedicalDrawer(
      <ExpiringReturnDrawer medicine={null} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={GLYCOLAC} onClose={vi.fn()} />, {
      role: 'accountant',
    });
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
  });
});
