import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchPersonAppointments } from '@/shared/api/app/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { APPOINTMENT_NOW, appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientVisitsPage } from './PatientVisitsPage.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));
// The person's bookings (`GET /app/appointments?contact_id=`).
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPersonAppointments: vi.fn(),
}));

/** Priya's bookings, newest first: tomorrow's consultation, a completed Hydrafacial. */
const VISITS: AppointmentRow[] = [
  appointmentRow({ contactId: TEST_CONTACT_ID, patientId: TEST_PATIENT_ID }),
  appointmentRow({
    id: 'appt_older0000000000000000',
    seq: 2790,
    contactId: TEST_CONTACT_ID,
    patientId: TEST_PATIENT_ID,
    date: '2026-09-12',
    status: 'completed',
    serviceLabel: 'Hydrafacial',
    type: 'treatment',
  }),
];

function renderVisits(options: Parameters<typeof renderInPatientFile>[1] = {}) {
  return renderInPatientFile(<PatientVisitsPage />, {
    file: patientFile(),
    section: 'visits',
    ...options,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  viewport.tier = 'desktop';
  vi.mocked(fetchPersonAppointments).mockResolvedValue(VISITS);
});
afterEach(() => {
  resetPatientFile();
  vi.useRealTimers();
});

describe('PatientVisitsPage', () => {
  it('lists the person’s bookings, newest first, with their status (H:4746)', async () => {
    const { container } = renderVisits();
    expect(await screen.findByTestId('patient-section-visits')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Visits' })).toBeInTheDocument();
    const rows = await screen.findAllByTestId('patient-visits-table-row');
    expect(rows).toHaveLength(2);
    expect(fetchPersonAppointments).toHaveBeenCalledWith(TEST_CONTACT_ID);
    expect(rows[0]).toHaveTextContent('#2861');
    expect(rows[0]).toHaveTextContent('Consultation');
    expect(rows[0]).toHaveTextContent('Scheduled');
    expect(rows[1]).toHaveTextContent('#2790');
    expect(rows[1]).toHaveTextContent('Hydrafacial');
    expect(rows[1]).toHaveTextContent('Completed');
    expect(screen.getByText('2 appointments')).toBeInTheDocument();
    expect(screen.getByText('All appointments loaded')).toBeInTheDocument();
    // The Columns chooser sits in the section header.
    expect(screen.getByTestId('patient-visits-columns-trigger')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names each booking’s doctor from the team the read joined', async () => {
    renderVisits();
    const table = await screen.findByTestId('patient-visits-table');
    await screen.findAllByTestId('patient-visits-table-row');
    expect(within(table).getAllByText(/Nisha/).length).toBeGreaterThan(0);
  });

  it('says so when the person has no appointments', async () => {
    vi.mocked(fetchPersonAppointments).mockResolvedValue([]);
    renderVisits();
    expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
    expect(screen.queryByText(/appointments loaded/)).not.toBeInTheDocument();
  });

  it('reads nothing while the file loads', async () => {
    renderVisits({ file: undefined });
    expect(await screen.findByTestId('patient-section-visits')).toBeInTheDocument();
    expect(fetchPersonAppointments).not.toHaveBeenCalled();
  });

  it('books a new appointment for the person from "New appointment"', async () => {
    const user = userEvent.setup();
    const { router } = renderVisits();
    await user.click(await screen.findByTestId('patient-section-primary'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(shownLocation(router).search).toMatchObject({ who: TEST_CONTACT_ID });
  });
});
