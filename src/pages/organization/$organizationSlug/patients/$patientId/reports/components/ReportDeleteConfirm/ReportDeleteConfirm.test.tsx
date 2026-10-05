import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ReportDeleteConfirm } from './ReportDeleteConfirm.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** Dharti's CBC + Thyroid profile. */
let report: PatientReport;
const live = () => clinicFixtures.patientReports.snapshot((row) => row.id === report.id);

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  report = await clinicFixtures.patientReports.get(ref.patientReport(1));
});
afterEach(() => resetClinicFixtures());

describe('ReportDeleteConfirm', () => {
  it('asks with the report’s name and the delete reasons', async () => {
    const { baseElement } = renderWithProviders(
      <ReportDeleteConfirm
        report={report}
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
        report={report}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(live()).toHaveLength(0);
    expect(notifyMock.undo).toHaveBeenCalledWith('Report deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(live()).toHaveLength(1));
  });
});
