import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteMedicine: vi.fn(),
  restoreMedicine: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteSupplier: vi.fn(),
  restoreSupplier: vi.fn(),
  deleteManufacturer: vi.fn(),
  restoreManufacturer: vi.fn(),
  deleteMedicalRep: vi.fn(),
  restoreMedicalRep: vi.fn(),
}));
import { deleteMedicine, restoreMedicine } from '@/shared/api/app/medicines-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  medicineRow,
  mrRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_MEDICINE_ID,
  TEST_MR_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  deleteManufacturer,
  deleteMedicalRep,
  deleteSupplier,
  restoreManufacturer,
  restoreMedicalRep,
  restoreSupplier,
} from '../../medical-records-api.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from './MedicalDeleteConfirm.tsx';

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

/** Confirm `target` with "Created by mistake"; resolve once the delete is done. */
async function confirm(target: MedicalDeleteTarget, title: string) {
  const user = setup();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  renderMedicalDrawer(
    <MedicalDeleteConfirm target={target} onClose={onClose} onDeleted={onDeleted} />,
  );
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(title)).toBeInTheDocument();
  expect(dialog).toHaveTextContent(target.record ?? target.name);
  await user.click(within(dialog).getByRole('radio', { name: 'Created by mistake' }));
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  return { onClose };
}

/** Press the Undo the delete's toast offers. */
function pressUndo(message: string) {
  expect(notifyMock.undo).toHaveBeenCalledWith(
    message,
    expect.objectContaining({ onUndo: expect.any(Function) }),
  );
  const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
  options.onUndo();
}

describe('MedicalDeleteConfirm (medical.md:357–368)', () => {
  it('deletes a medicine with its reason and offers Undo, which restores it', async () => {
    vi.mocked(deleteMedicine).mockResolvedValue(undefined);
    vi.mocked(restoreMedicine).mockResolvedValue(medicineRow());
    await confirm(
      { kind: 'medicine', id: TEST_MEDICINE_ID, name: 'Azelaic gel' },
      'Delete this medicine?',
    );
    expect(deleteMedicine).toHaveBeenCalledWith(TEST_MEDICINE_ID, 'mistake', null);
    pressUndo('Azelaic gel deleted');
    await waitFor(() =>
      expect(restoreMedicine).toHaveBeenCalledWith(TEST_MEDICINE_ID, expect.any(String)),
    );
  });

  it('names each record kind in its title, and Undo restores an MR', async () => {
    vi.mocked(deleteMedicalRep).mockResolvedValue(undefined);
    vi.mocked(restoreMedicalRep).mockResolvedValue(mrRow());
    await confirm({ kind: 'mr', id: TEST_MR_ID, name: 'Rahul Mehta' }, 'Delete this MR?');
    expect(deleteMedicalRep).toHaveBeenCalledWith(TEST_MR_ID, 'mistake', null);
    pressUndo('Rahul Mehta deleted');
    await waitFor(() =>
      expect(restoreMedicalRep).toHaveBeenCalledWith(TEST_MR_ID, expect.any(String)),
    );
  });

  it('deletes a manufacturer, the drawer’s summary in the pill', async () => {
    vi.mocked(deleteManufacturer).mockResolvedValue(undefined);
    vi.mocked(restoreManufacturer).mockResolvedValue(manufacturerRow());
    await confirm(
      {
        kind: 'manufacturer',
        id: TEST_MAKER_ID,
        name: 'SUN PHARMA',
        record: 'SUN PHARMA · 0 suppliers',
      },
      'Delete this manufacturer?',
    );
    expect(deleteManufacturer).toHaveBeenCalledWith(TEST_MAKER_ID, 'mistake', null);
  });

  it('deletes a supplier with nothing owed; a refusal keeps the confirm open and says why', async () => {
    const user = setup();
    vi.mocked(deleteSupplier).mockRejectedValueOnce(
      new HttpError('Has dues', 409, '/app/suppliers', 'DELETE', {
        error: { type: 'request_error', code: 'conflict', reason: 'supplier_has_dues' },
      }),
    );
    vi.mocked(restoreSupplier).mockResolvedValue(supplierRow());
    const onDeleted = vi.fn();
    renderMedicalDrawer(
      <MedicalDeleteConfirm
        target={{ kind: 'supplier', id: TEST_SUPPLIER_ID, name: 'Ankur Pharma' }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete this supplier?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    vi.mocked(deleteSupplier).mockResolvedValueOnce(undefined);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteSupplier).toHaveBeenLastCalledWith(TEST_SUPPLIER_ID, 'mistake', null);
  });
});
