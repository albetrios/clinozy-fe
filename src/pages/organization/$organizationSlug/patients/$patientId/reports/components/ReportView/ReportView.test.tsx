import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

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

const DHARTI = patientRef('Dharti Galani');
/** Dharti's "CBC + Thyroid profile" (Lab), added by Riya S. */
const CBC = ref.patientReport(1);
const url = (rest: string) => patientFileUrl(DHARTI, `/reports${rest}`);

async function openView(id = CBC, role: 'therapist' | 'admin' = 'therapist') {
  const user = userEvent.setup();
  const view = renderPatientFile(url(`/${id}`), { role });
  const drawer = await screen.findByTestId('report-view');
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Report view (KICKOFF §6.6; S:43)', () => {
  it('shows the report read-only to anyone who reads the file', async () => {
    const { user, drawer, baseElement } = await openView();
    expect(within(drawer).getByTestId('report-view-title')).toHaveTextContent(
      'CBC + Thyroid profile',
    );
    expect(within(drawer).getByTestId('report-view-tag')).toHaveTextContent('Lab');
    // The sub's name and date are isolated tokens.
    expect(drawer).toHaveTextContent(`${fsi('Dharti Galani')} · `);
    expect(withoutBidiMarks(drawer.textContent)).toMatch(
      /Dharti Galani · \w{3} \d{1,2}, \d{4}/,
    );
    expect(within(drawer).getByTestId('report-view-type')).toHaveTextContent('Lab');
    await user.click(within(drawer).getByTestId('report-view-step-details-trigger'));
    expect(within(drawer).getByTestId('report-view-added-by')).toHaveTextContent(/^Riya/);
    expect(within(drawer).getByTestId('report-view-file')).toHaveTextContent(
      'CBC + Thyroid profile · PDF · shared with the patient on request',
    );
    await user.click(within(drawer).getByTestId('report-view-step-notes-trigger'));
    expect(within(drawer).getByTestId('report-view-notes')).toHaveTextContent(
      'No notes on this report',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('names an image file’s format and shows the notes', async () => {
    await clinicFixtures.patientReports.update(CBC, {
      files: ['reports/cbc-page-1.PNG'],
      notes: 'TSH slightly high\nrecheck in 6 weeks',
    });
    const { user, drawer } = await openView();
    await user.click(within(drawer).getByTestId('report-view-step-details-trigger'));
    expect(within(drawer).getByTestId('report-view-file')).toHaveTextContent(
      'CBC + Thyroid profile · PNG · shared with the patient on request',
    );
    await user.click(within(drawer).getByTestId('report-view-step-notes-trigger'));
    expect(within(drawer).getByTestId('report-view-notes')).toHaveTextContent(
      'TSH slightly high recheck in 6 weeks',
    );
  });

  it('downloads — “Downloading CBC + Thyroid profile” — and closes', async () => {
    const { user, drawer, router } = await openView();
    await user.click(within(drawer).getByTestId('report-view-save'));
    expect(notifyMock.info).toHaveBeenCalledWith('Downloading CBC + Thyroid profile');
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
  });

  it('goes back to Reports when the report is gone', async () => {
    const { router } = renderPatientFile(url(`/${ref.patientReport(99)}`));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Report not found · it may have been deleted',
    );
  });
});
