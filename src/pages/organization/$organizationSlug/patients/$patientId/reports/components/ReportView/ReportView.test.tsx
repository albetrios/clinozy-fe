import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReportsApiModule from '@/shared/api/clinic/patient-reports-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import {
  reportDouble,
  seedReports,
} from '../../__tests__/integration/report-api-double.ts';
import {
  renderReports,
  reportsUrl,
  resetReports,
} from '../../__tests__/integration/reports-test-router.tsx';

vi.mock('@/shared/api/clinic/patient-reports-api.ts', async (importOriginal) => {
  const double = await import('../../__tests__/integration/report-api-double.ts');
  return {
    ...(await importOriginal<typeof ReportsApiModule>()),
    listPatientReports: vi.fn(double.listPatientReports),
    fetchPatientReport: vi.fn(double.fetchPatientReport),
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

const CBC = reportDouble({
  fileKeys: ['organization-files/org_test/cbc.pdf', 'organization-files/org_test/p2.PNG'],
});

async function openView(id = CBC.id) {
  const user = userEvent.setup();
  const view = renderReports(reportsUrl(`/${id}`));
  const drawer = await screen.findByTestId('report-view');
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  seedReports([CBC]);
});
afterEach(() => resetReports());

describe('Report view (KICKOFF §6.6; S:43)', () => {
  it('shows the report read-only to anyone who reads the file', async () => {
    const { user, drawer, baseElement } = await openView();
    expect(within(drawer).getByTestId('report-view-title')).toHaveTextContent(
      'CBC + Thyroid profile',
    );
    expect(within(drawer).getByTestId('report-view-tag')).toHaveTextContent('Lab');
    // The sub's name and date are isolated tokens.
    expect(drawer).toHaveTextContent(`${fsi('Priya Shah')} · `);
    expect(withoutBidiMarks(drawer.textContent)).toMatch(
      /Priya Shah · \w{3} \d{1,2}, \d{4}/,
    );
    expect(within(drawer).getByTestId('report-view-type')).toHaveTextContent('Lab');
    await user.click(within(drawer).getByTestId('report-view-step-details-trigger'));
    expect(within(drawer).getByTestId('report-view-file')).toHaveTextContent(
      '2 files · PDF, PNG',
    );
    // The API does not say who added it (G4).
    expect(within(drawer).queryByTestId('report-view-added-by')).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId('report-view-step-notes-trigger'));
    expect(within(drawer).getByTestId('report-view-notes')).toHaveTextContent(
      'No notes on this report',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('offers no download — no stored file can be read back (B1)', async () => {
    const { drawer } = await openView();
    expect(within(drawer).queryByTestId('report-view-save')).not.toBeInTheDocument();
    expect(drawer).not.toHaveTextContent('Download');
  });

  it('shows the notes and a report with no file yet', async () => {
    seedReports([
      reportDouble({ fileKeys: [], notes: 'TSH slightly high\nrecheck in 6 weeks' }),
    ]);
    const { user, drawer } = await openView();
    await user.click(within(drawer).getByTestId('report-view-step-details-trigger'));
    expect(within(drawer).getByTestId('report-view-file')).toHaveTextContent('0 files');
    await user.click(within(drawer).getByTestId('report-view-step-notes-trigger'));
    expect(within(drawer).getByTestId('report-view-notes')).toHaveTextContent(
      'TSH slightly high recheck in 6 weeks',
    );
  });

  it('closes back to Reports', async () => {
    const { user, drawer, router } = await openView();
    await user.click(within(drawer).getByTestId('report-view-close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(reportsUrl()));
  });

  it('goes back to Reports when the report is gone', async () => {
    const { router } = renderReports(reportsUrl('/prep_gone0000000000000000'));
    await waitFor(() => expect(router.state.location.pathname).toBe(reportsUrl()));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Report not found · it may have been deleted',
    );
  });
});
