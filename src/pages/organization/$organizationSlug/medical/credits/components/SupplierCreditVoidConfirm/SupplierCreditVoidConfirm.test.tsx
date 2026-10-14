import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  voidSupplierCredit: vi.fn(),
  restoreSupplierCredit: vi.fn(),
}));
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  supplierCreditRow,
  TEST_SUPPLIER_CREDIT_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  restoreSupplierCredit,
  voidSupplierCredit,
} from '../../../shared/medical-records-api.ts';
import { SupplierCreditVoidConfirm } from './SupplierCreditVoidConfirm.tsx';

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

describe('SupplierCreditVoidConfirm (clinozy-be MD32)', () => {
  it('voids the credit with its reason and offers Undo, which applies it again', async () => {
    const user = setup();
    vi.mocked(voidSupplierCredit).mockResolvedValue(undefined);
    vi.mocked(restoreSupplierCredit).mockResolvedValue(supplierCreditRow());
    const onClose = vi.fn();
    renderMedicalDrawer(
      <SupplierCreditVoidConfirm credit={supplierCreditRow()} onClose={onClose} />,
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this credit?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Azelaic gel 15g · 026-312');
    await user.click(within(dialog).getByRole('radio', { name: 'Wrong quantity' }));
    await user.click(within(dialog).getByRole('button', { name: 'Void credit' }));
    await waitFor(() =>
      expect(voidSupplierCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: TEST_SUPPLIER_ID,
          creditId: TEST_SUPPLIER_CREDIT_ID,
          reason: 'wrong_quantity',
          note: null,
        }),
      ),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Credit · 026-312 voided',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() =>
      expect(restoreSupplierCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: TEST_SUPPLIER_ID,
          creditId: TEST_SUPPLIER_CREDIT_ID,
        }),
      ),
    );
  });

  it('stays closed without a credit', () => {
    renderMedicalDrawer(<SupplierCreditVoidConfirm credit={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
