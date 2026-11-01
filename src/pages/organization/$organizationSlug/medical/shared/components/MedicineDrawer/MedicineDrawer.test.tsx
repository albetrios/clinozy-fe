import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createMedicine: vi.fn(),
  updateMedicine: vi.fn(),
}));
vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
import { createMedicine, updateMedicine } from '@/shared/api/app/medicines-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import {
  manufacturerRow,
  medicineRow,
  supplierRow,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../../medical-api.ts';
import { MedicineDrawer } from './MedicineDrawer.tsx';

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

const D = 'medicine-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
const ALVI_ID = 'mfr_alvi00000000000000000';
const AVRI_ID = 'mfr_avri00000000000000000';
const AKSHAR_ID = 'sup_akshar000000000000000';

/** Glycolac Cream by AVRI: ₹162.50, 3 in batch 026-312, ₹123 from Akshar Medicines. */
const GLYCOLAC = medicineRow({
  id: 'med_glyco0000000000000000',
  seq: 456,
  name: 'Glycolac Cream',
  composition: 'Glycolic acid 6%',
  manufacturer: { id: AVRI_ID, name: 'AVRI', tone: 'lav' },
  mrp: 162.5,
  minStock: 2,
  maxStock: 10,
  stock: 3,
  batches: [
    {
      id: 'mbt_glyco0260000000000000',
      batchNo: '026-312',
      expiry: '11/26',
      qty: 3,
      purchaseRate: 123,
      mrp: null,
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
  bestRate: { supplierId: AKSHAR_ID, supplierName: 'Akshar Medicines', rate: 123 },
});

/** What a save answers: the record as the API returns it. */
const saved = (name: string) => medicineRow({ id: 'med_azelcream000000000000', name });

beforeEach(() => {
  vi.resetAllMocks();
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  // ALVI first: a new medicine starts on it.
  vi.mocked(fetchAllManufacturers).mockResolvedValue([
    manufacturerRow({ id: ALVI_ID, name: 'ALVI', tone: 'sky' }),
    manufacturerRow({ id: AVRI_ID, name: 'AVRI', tone: 'lav' }),
  ]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow({ id: AKSHAR_ID, name: 'Akshar Medicines', manufacturerIds: [AVRI_ID] }),
  ]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
  vi.mocked(createMedicine).mockImplementation(async (input) => saved(input.name));
  vi.mocked(updateMedicine).mockImplementation(async (record, input) => ({
    ...record,
    composition: input.composition,
  }));
});
afterEach(() => resetMedicalRoutes());

describe('MedicineDrawer — New medicine (medical.md:170–188)', () => {
  it('opens on the typed name and the first maker; Save without an MRP opens its step', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <MedicineDrawer
        mode="create"
        prefill={{ name: 'Azel cream' }}
        open
        onClose={onClose}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New medicine');
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('Azel cream');
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-manufacturer`)).toHaveTextContent('ALVI'),
    );
    expect(within(drawer).getByTestId(`${D}-stock-state`)).toHaveTextContent(
      '0 in stock · Out',
    );
    expect(within(drawer).getByTestId(`${D}-stock-hint`)).toHaveTextContent(
      'Order 10 to fill up to 10. Shows under Stock › Low stock.',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the MRP');
    expect(createMedicine).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('prices the MRP live and adds the medicine: "Added …", then closes', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <MedicineDrawer
        mode="create"
        prefill={{ name: 'Azel cream' }}
        open
        onClose={onClose}
      />,
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-manufacturer`)).toHaveTextContent('ALVI'),
    );
    await user.type(within(drawer).getByTestId(`${D}-mrp`), '650');
    await user.click(within(drawer).getByTestId(`${D}-gst-18`));
    expect(within(drawer).getByTestId(`${D}-split-gst`)).toHaveTextContent('GST 18%');
    expect(within(drawer).getByTestId(`${D}-split-before-gst`)).toHaveTextContent(
      '550.85',
    );
    expect(within(drawer).getByTestId(`${D}-split-best-rate`)).toHaveTextContent(
      'Add a supplier price',
    );
    await user.click(within(drawer).getByTestId(`${D}-sold-with-rx`));

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Added Azel cream');
    // A full record, rupees: `POST /app/medicines` with `is_quick: false`.
    expect(createMedicine).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Azel cream',
        manufacturerId: ALVI_ID,
        mrp: 650,
        gstPct: 18,
        prescriptionOnly: true,
        batches: [],
        supplierRates: [],
      }),
      expect.any(String),
    );
  });

  it('turns a picked supplier without a rate red, with its own words, and saves nothing', async () => {
    const user = setup();
    renderMedicalDrawer(
      <MedicineDrawer
        mode="create"
        prefill={{ name: 'Azel cream' }}
        open
        onClose={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-manufacturer`)).toHaveTextContent('ALVI'),
    );
    await user.type(within(drawer).getByTestId(`${D}-mrp`), '650');
    await user.click(within(drawer).getByTestId(`${D}-step-batches-trigger`));
    await user.click(await within(drawer).findByTestId(`${D}-rates-add`));

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Enter a rate for every supplier price',
    );
    const rate = within(drawer).getByRole('textbox', { name: 'Rate' });
    await waitFor(() => expect(rate).toHaveAttribute('aria-invalid', 'true'));
    expect(within(drawer).getByText('Enter this supplier’s rate')).toBeInTheDocument();
    expect(createMedicine).not.toHaveBeenCalled();
  });
});

describe('MedicineDrawer — Edit medicine', () => {
  it('shows the saved medicine: tag, sub line, badges, price split, stock and its rows', async () => {
    const user = setup();
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={GLYCOLAC} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#456');
    // The maker's name arrives with the manufacturer catalogue.
    await waitFor(() =>
      expect(drawer).toHaveTextContent(`${fsi('AVRI')} · ${fsi('Glycolic acid 6%')}`),
    );
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
        `Best ${fsi('₹123')} · ${fsi('Akshar Medicines')}`,
      ),
    );
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent('3 in stock');
    expect(within(drawer).getByTestId(`${D}-split-margin`)).toHaveTextContent('24%');
    expect(within(drawer).getByTestId(`${D}-stock-state`)).toHaveTextContent(
      '3 in stock · Healthy',
    );
    expect(within(drawer).getByTestId(`${D}-stock-hint`)).toHaveTextContent(
      'Reorder alert when stock falls to 2.',
    );
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-batches-trigger`));
    expect(within(drawer).getByDisplayValue('026-312')).toBeInTheDocument();
  });

  it('keeps the reorder level at or below the fill-up level', async () => {
    const user = setup();
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={GLYCOLAC} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const fill = within(drawer).getByRole('button', { name: 'Decrease fill level' });
    for (let step = 0; step < 9; step += 1) await user.click(fill);
    expect(within(drawer).getByTestId(`${D}-fill-up-to`)).toHaveValue('2');
    expect(
      within(drawer).getByRole('button', { name: 'Increase reorder level' }),
    ).toBeDisabled();
  });

  it('saves the edit: "Saved …" — the record as read, and the drawer’s fields', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={GLYCOLAC} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    const composition = within(drawer).getByTestId(`${D}-composition`);
    await user.clear(composition);
    await user.click(composition);
    await user.paste('Glycolic acid 8%');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Saved Glycolac Cream');
    // Its `updated_at` guards the save; the batch goes back with its id.
    expect(updateMedicine).toHaveBeenCalledWith(
      GLYCOLAC,
      expect.objectContaining({
        composition: 'Glycolic acid 8%',
        batches: [
          {
            id: 'mbt_glyco0260000000000000',
            batchNo: '026-312',
            expiry: '11/26',
            qty: 3,
            purchaseRate: 123,
            mrp: null,
            supplierId: AKSHAR_ID,
          },
        ],
      }),
      expect.any(String),
    );
  });

  it('opens view only for a role without Edit, and without Delete for one without Delete', async () => {
    const medicine = GLYCOLAC;
    const viewer = renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={medicine} open onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
        'View only · your role can’t change this',
      ),
    );
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    viewer.unmount();

    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={medicine} open onClose={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const editor = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(editor).getByTestId(`${D}-save`)).toBeInTheDocument(),
    );
    expect(within(editor).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('shows the drawer’s shell while a deep-linked record loads', async () => {
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={undefined} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});

describe('MedicineDrawer — stacked', () => {
  it('reads "Back" · "Add medicine" and hands the new medicine back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    renderMedicalDrawer(
      <MedicineDrawer
        mode="create"
        prefill={{ name: 'Azel cream' }}
        open
        onClose={vi.fn()}
        stacked
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    expect(within(drawer).getByTestId(`${D}-stacked-save`)).toHaveTextContent(
      'Add medicine',
    );
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-stacked-manufacturer`)).toHaveTextContent(
        'ALVI',
      ),
    );
    await user.type(within(drawer).getByTestId(`${D}-stacked-mrp`), '120');
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Azel cream' }),
      ),
    );
  });
});
