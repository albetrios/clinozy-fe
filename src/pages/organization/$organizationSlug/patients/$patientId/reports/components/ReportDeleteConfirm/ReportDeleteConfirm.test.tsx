import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReportsApiModule from '@/shared/api/app/patient-reports-api.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  reportDouble,
  seedReports,
  storedReports,
} from '../../__tests__/integration/report-api-double.ts';
import { ReportDeleteConfirm } from './ReportDeleteConfirm.tsx';

vi.mock('@/shared/api/app/patient-reports-api.ts', async (importOriginal) => {
  const double = await import('../../__tests__/integration/report-api-double.ts');
  return {
    ...(await importOriginal<typeof ReportsApiModule>()),
    deletePatientReport: vi.fn(double.deletePatientReport),
    restorePatientReport: vi.fn(double.restorePatientReport),
  };
});

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
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));

const REPORT = reportDouble();
const deleted = () => storedReports()[0]?.deleted ?? null;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  seedReports([REPORT]);
});

describe('ReportDeleteConfirm', () => {
  it('asks with the report’s name and the delete reasons', async () => {
    const { baseElement } = renderWithProviders(
      <ReportDeleteConfirm
        report={REPORT}
        open
        onOpenChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this report?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'CBC + Thyroid profile',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('deletes it with the reason, then Undo brings it back', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderWithProviders(
      <ReportDeleteConfirm
        report={REPORT}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(deleted()).toEqual({ reason: 'not_needed', note: null });
    expect(notifyMock.undo).toHaveBeenCalledWith('Report deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(deleted()).toBeNull());
  });
});
