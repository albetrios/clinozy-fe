import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicines: vi.fn(),
  fetchAllMedicines: vi.fn(),
  fetchMedicine: vi.fn(),
  setNearExpiryDiscount: vi.fn(),
  setNearExpiryDiscountWithin: vi.fn(),
}));
vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
import {
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  setNearExpiryDiscount,
  setNearExpiryDiscountWithin,
} from '@/shared/api/app/medicines-api.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  medicalPage,
  medicineRow,
  supplierRow,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../shared/medical-api.ts';
import { MedicinesPage } from './MedicinesPage.tsx';

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

const ROOM = '/organization/acme/medical/medicines';
const GLYCOLAC_ID = 'med_glyco0000000000000000';

/** Azelaic gel (12/27, far off) and Glycolac Cream, its batch out in 20 days. */
const AZELAIC = medicineRow();
const GLYCOLAC = medicineRow({
  id: GLYCOLAC_ID,
  seq: 456,
  name: 'Glycolac Cream',
  composition: 'Glycolic acid 6%',
  stock: 3,
  stockLevel: 'low',
  nearest: { batchNo: '026-312', expiry: '11/26', daysLeft: 20 },
  batches: [
    {
      id: 'mbt_glyco0260000000000000',
      batchNo: '026-312',
      expiry: '11/26',
      qty: 3,
      purchaseRate: 123,
      supplierId: 'sup_ankur0000000000000000',
      expired: false,
    },
  ],
});

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The Medicines tab at `url`. */
function renderMedicines(url = ROOM) {
  return renderMedicalRoutes(url, { medicines: MedicinesPage });
}

const rows = () => screen.getAllByTestId('medical-medicines-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  return row;
};

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(listMedicines).mockResolvedValue(medicalPage([AZELAIC, GLYCOLAC]));
  vi.mocked(fetchAllMedicines).mockResolvedValue([AZELAIC, GLYCOLAC]);
  vi.mocked(fetchMedicine).mockResolvedValue(AZELAIC);
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([supplierRow()]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
  vi.mocked(setNearExpiryDiscount).mockImplementation(async (medicines, pct) =>
    medicines.map((medicine) =>
      medicineRow({ id: medicine.id, nearExpiryDiscountPct: pct }),
    ),
  );
  vi.mocked(setNearExpiryDiscountWithin).mockResolvedValue(1);
});
afterEach(() => resetMedicalRoutes());

describe('MedicinesPage', () => {
  it('lists the medicines the API answers under the Medical toolbar, ending with "All medicines loaded"', async () => {
    const { container } = renderMedicines();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(listMedicines).toHaveBeenCalledWith(
      {
        q: undefined,
        stock: undefined,
        expiry: undefined,
        manufacturer: undefined,
        created: undefined,
      },
      undefined,
    );
    // The API's rupees, its stock level, margin and best rate.
    expect(rowOf('Azelaic gel')).toHaveTextContent('₹650');
    expect(rowOf('Azelaic gel')).toHaveTextContent('12 in stock · OK');
    expect(rowOf('Azelaic gel')).toHaveTextContent('35%');
    expect(rowOf('Glycolac Cream')).toHaveTextContent('3 in stock · Low');
    expect(screen.getByTestId('medical-medicines-table-end')).toHaveTextContent(
      'All medicines loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-medicines-tab-medicines',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a batch expiring within 90 days can go back to its supplier', async () => {
    const user = setup();
    renderMedicines();
    await waitFor(() => expect(rows()).toHaveLength(2));
    // Only Glycolac Cream's batch is near its end.
    const actions = await screen.findAllByTestId(
      'medical-medicines-row-action-return-expiring',
    );
    expect(actions).toHaveLength(1);
    const [action] = actions;
    expect(action).toHaveAccessibleName('Return expiring stock to supplier');
    await user.click(action as HTMLElement);
    const drawer = await screen.findByTestId('expiring-return-drawer');
    expect(drawer).toHaveTextContent('Return expiring stock');
    expect(
      within(drawer).getByTestId('expiring-return-drawer-supplier'),
    ).toHaveTextContent('Ankur Pharma');
  });

  it('a row’s near-expiry discount goes on with Undo, which puts the old percent back', async () => {
    const user = setup();
    renderMedicines();
    const [discount] = await screen.findAllByTestId(
      'medical-medicines-row-action-discount',
    );
    expect(discount).toHaveAccessibleName('Sell at 20% off (near expiry)');
    await user.click(discount as HTMLElement);
    await waitFor(() => expect(notifyMock.undo).toHaveBeenCalled());
    expect(setNearExpiryDiscount).toHaveBeenCalledWith(
      [expect.objectContaining({ id: GLYCOLAC_ID })],
      20,
      expect.any(String),
    );
    const [message, options] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    expect(message).toBe('20% off applied to Glycolac Cream');
    options.onUndo();
    await waitFor(() =>
      expect(setNearExpiryDiscount).toHaveBeenLastCalledWith(
        [expect.objectContaining({ id: GLYCOLAC_ID })],
        0,
        expect.any(String),
      ),
    );
  });

  it('"Sell all at 20% off" discounts every medicine in the Nearest expiry window in one write', async () => {
    const user = setup();
    vi.mocked(listMedicines).mockResolvedValue(medicalPage([GLYCOLAC]));
    renderMedicines(`${ROOM}?expiry=30`);
    const action = await screen.findByTestId('medical-medicines-view-action-discount');
    expect(action).toHaveAccessibleName('Sell all at 20% off');
    await user.click(action);
    await waitFor(() =>
      expect(setNearExpiryDiscountWithin).toHaveBeenCalledWith(
        30,
        20,
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        '20% off on expiring medicines',
        expect.anything(),
      ),
    );
    // Its Undo removes the discount over the same window.
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() =>
      expect(setNearExpiryDiscountWithin).toHaveBeenLastCalledWith(
        30,
        0,
        expect.any(String),
      ),
    );
  });
});
