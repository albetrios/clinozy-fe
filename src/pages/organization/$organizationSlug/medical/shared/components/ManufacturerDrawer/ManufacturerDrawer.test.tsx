import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createManufacturer: vi.fn(),
  updateManufacturer: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  manufacturerRow,
  mrRow,
  supplierRow,
  TEST_MR_ID,
  TEST_SUPPLIER_ID,
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
import { createManufacturer, updateManufacturer } from '../../medical-records-api.ts';
import { ManufacturerDrawer } from './ManufacturerDrawer.tsx';

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

const D = 'manufacturer-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const NH_ID = 'sup_nhpharma00000000000000';

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow(),
    supplierRow({ id: NH_ID, name: 'NH Pharma', manufacturers: [], manufacturerIds: [] }),
  ]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([mrRow()]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('ManufacturerDrawer (medical.md:208–222)', () => {
  it('takes the name in upper case, asks for it when empty, and saves the colour', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(createManufacturer).mockResolvedValue(
      manufacturerRow({ name: 'ACME', tone: 'sky' }),
    );
    renderMedicalDrawer(<ManufacturerDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New manufacturer',
    );
    expect(within(drawer).getByTestId(`${D}-colour-lav`)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(within(drawer).getByTestId(`${D}-name`), 'acme');
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('ACME');
    await user.click(within(drawer).getByTestId(`${D}-colour-sky`));
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Manufacturer saved · connections updated',
    );
    expect(createManufacturer).toHaveBeenCalledWith({
      input: { name: 'ACME', tone: 'sky', supplierIds: [], mrIds: [] },
      idempotencyKey: expect.any(String),
    });
  });

  it('edits the links on the suppliers and MRs, and sums them in the footer', async () => {
    const user = setup();
    const onClose = vi.fn();
    const maker = manufacturerRow();
    vi.mocked(updateManufacturer).mockResolvedValue(maker);
    renderMedicalDrawer(
      <ManufacturerDrawer mode="edit" manufacturer={maker} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'SUN PHARMA · 1 supplier · 1 MR',
    );
    // A maker with medicines can't be deleted.
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-connections-trigger`));
    expect(within(drawer).getByTestId(`${D}-medicines`)).toHaveTextContent(
      '14 medicines in Stock',
    );
    await user.click(within(drawer).getByTestId(`${D}-suppliers`));
    await user.click(await screen.findByRole('option', { name: /NH Pharma/ }));
    await user.keyboard('{Escape}');
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateManufacturer).toHaveBeenCalledWith({
      record: maker,
      input: {
        name: 'SUN PHARMA',
        tone: maker.tone,
        supplierIds: [TEST_SUPPLIER_ID, NH_ID],
        mrIds: [TEST_MR_ID],
      },
      idempotencyKey: expect.any(String),
    });
  });

  it('offers Delete on a maker no medicine names', async () => {
    renderMedicalDrawer(
      <ManufacturerDrawer
        mode="edit"
        manufacturer={manufacturerRow({ medicineCount: 0 })}
        open
        onClose={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();
  });

  it('stacked: "Back" · "Add manufacturer", the new maker handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    vi.mocked(createManufacturer).mockResolvedValue(manufacturerRow({ name: 'ZEN' }));
    renderMedicalDrawer(
      <ManufacturerDrawer
        mode="create"
        prefill={{ name: 'zen' }}
        open
        onClose={vi.fn()}
        stacked
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-name`)).toHaveValue('ZEN');
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZEN' })),
    );
  });
});
