import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { MedicineRecord } from '@/shared/api/app/medicines-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
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
const glycolac = () =>
  appFixtures.medicines.get(ref.medicine(456)) as Promise<MedicineRecord>;

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

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

    const before = appFixtures.medicines.snapshot().length;
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the MRP');
    expect(appFixtures.medicines.snapshot()).toHaveLength(before);
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
    const added = appFixtures.medicines.snapshot((row) => row.name === 'Azel cream');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ mrp: 65_000, gstPct: 18, prescriptionOnly: true });
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
  });
});

describe('MedicineDrawer — Edit medicine', () => {
  it('shows the saved medicine: tag, sub line, badges, price split, stock and its rows', async () => {
    const user = setup();
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={await glycolac()} open onClose={vi.fn()} />,
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
      <MedicineDrawer mode="edit" medicine={await glycolac()} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const fill = within(drawer).getByRole('button', { name: 'Decrease fill level' });
    for (let step = 0; step < 9; step += 1) await user.click(fill);
    expect(within(drawer).getByTestId(`${D}-fill-up-to`)).toHaveValue('2');
    expect(
      within(drawer).getByRole('button', { name: 'Increase reorder level' }),
    ).toBeDisabled();
  });

  it('saves the edit: "Saved …", the record updated', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <MedicineDrawer mode="edit" medicine={await glycolac()} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    const composition = within(drawer).getByTestId(`${D}-composition`);
    await user.clear(composition);
    await user.click(composition);
    await user.paste('Glycolic acid 8%');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Saved Glycolac Cream');
    expect((await glycolac()).composition).toBe('Glycolic acid 8%');
  });

  it('opens view only for a role without Edit, and without Delete for one without Delete', async () => {
    const medicine = await glycolac();
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
