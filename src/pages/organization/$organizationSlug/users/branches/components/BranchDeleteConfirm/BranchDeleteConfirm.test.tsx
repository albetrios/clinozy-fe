import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { BranchDeleteConfirm } from './BranchDeleteConfirm.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/notify.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const VESU = { id: 'b-vesu', name: 'Vesu' } as Branch;

beforeEach(() => {
  resetClinicFixtures();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetClinicFixtures());

describe('BranchDeleteConfirm (users.md:238–252)', () => {
  it('asks once with the branch’s name, then offers Undo for 10s', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderWithProviders(
      <BranchDeleteConfirm
        target={{ branch: VESU, record: 'Vesu · Surat · 5 people' }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this branch?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Vesu · Surat · 5 people',
    );
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    expect(onDeleted).toHaveBeenCalled();
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Vesu removed',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
      ),
    );
  });

  it('is closed with no target', () => {
    renderWithProviders(<BranchDeleteConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
