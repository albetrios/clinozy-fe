import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReportsApiModule from '@/shared/api/clinic/patient-reports-api.ts';
import { listPatientReports } from '@/shared/api/clinic/patient-reports-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  reportDouble,
  seedReports,
  storedReports,
} from './__tests__/integration/report-api-double.ts';
import {
  renderReports,
  REPORT_CODES,
  reportsUrl,
  resetReports,
} from './__tests__/integration/reports-test-router.tsx';

vi.mock('@/shared/api/clinic/patient-reports-api.ts', async (importOriginal) => {
  const double = await import('./__tests__/integration/report-api-double.ts');
  return {
    ...(await importOriginal<typeof ReportsApiModule>()),
    listPatientReports: vi.fn(double.listPatientReports),
    fetchPatientReport: vi.fn(double.fetchPatientReport),
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

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const CONSENT = reportDouble({
  id: 'prep_consent0000000000000',
  type: 'consent',
  name: 'Chemical peel consent',
  date: '2026-09-28',
  fileKeys: [],
  files: [],
});
const CBC = reportDouble();
const rows = () => screen.findAllByTestId('patient-reports-table-row');

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  seedReports([CBC, CONSENT]);
});
afterEach(() => resetReports());

describe('PatientReportsPage', () => {
  it('renders the Reports section in the patient file', async () => {
    renderReports(reportsUrl());
    expect(await screen.findByTestId('patient-section-reports')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Reports' }),
    ).toBeInTheDocument();
  });

  it('lists her reports newest first, each with its type and files, and the server’s count', async () => {
    renderReports(reportsUrl());
    const [consent, lab] = await rows();
    if (!(consent && lab)) throw new Error('no rows');
    expect(within(consent).getByText('Chemical peel consent')).toBeInTheDocument();
    expect(within(consent).getAllByText('Consent').length).toBeGreaterThan(0);
    expect(within(consent).getByText('0 files')).toBeInTheDocument();
    expect(within(lab).getByText('CBC + Thyroid profile')).toBeInTheDocument();
    expect(
      within(lab).getByText('PDF · shared with patient on request'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 reports')).toBeInTheDocument();
    // The API does not say who added a report (G4).
    expect(screen.queryByText('Uploaded by')).not.toBeInTheDocument();
  });

  it('says so when the patient has no reports', async () => {
    seedReports([]);
    renderReports(reportsUrl());
    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
  });

  it('says a failed read failed, and reads again on Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(listPatientReports).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderReports(reportsUrl());
    await user.click(await screen.findByTestId('retry-button'));
    expect(await rows()).toHaveLength(2);
  });

  it('opens a report from its action; a row opens nothing', async () => {
    const user = userEvent.setup();
    const { router } = renderReports(reportsUrl());
    const [consent] = await rows();
    if (!consent) throw new Error('no row');
    await user.click(within(consent).getByText('Chemical peel consent'));
    expect(router.state.location.pathname).toBe(reportsUrl());
    await user.click(within(consent).getByTestId('patient-reports-row-action-open'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(reportsUrl(`/${CONSENT.id}`)),
    );
    expect(await screen.findByTestId('report-view')).toBeInTheDocument();
  });

  it('asks before deleting a report and offers Undo', async () => {
    const user = userEvent.setup();
    renderReports(reportsUrl());
    const [consent] = await rows();
    if (!consent) throw new Error('no row');
    await user.click(
      await within(consent).findByTestId('patient-reports-row-action-delete'),
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this report?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Chemical peel consent',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(storedReports().find((row) => row.report.id === CONSENT.id)?.deleted).toEqual({
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Report deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(async () => expect(await rows()).toHaveLength(2));
  });

  it('keeps Delete from a member without patient:update', async () => {
    renderReports(reportsUrl(), {
      codes: REPORT_CODES.filter((code) => code !== 'patient:update'),
    });
    await rows();
    expect(await screen.findAllByTestId('patient-reports-row-action-open')).toHaveLength(
      2,
    );
    expect(
      screen.queryByTestId('patient-reports-row-action-delete'),
    ).not.toBeInTheDocument();
  });
});
