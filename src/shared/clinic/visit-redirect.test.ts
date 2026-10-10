import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAppointment } from '@/shared/api/clinic/appointments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { VISIT_REFERRER } from './clinic-referrer.ts';
import { patientVisitTarget, visitRedirect } from './visit-redirect.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAppointment: vi.fn(),
}));

const TIMELINE = '/organization/$organizationSlug/patients/$patientId/timeline';
const BOOKING_ID = 'appt_priya000000000000000';
const TODAY = {
  to: '/organization/$organizationSlug/today',
  params: { organizationSlug: 'acme' },
  replace: true,
};

beforeEach(() => {
  vi.mocked(notify.info).mockReset();
  vi.mocked(fetchAppointment).mockReset();
});

describe('patientVisitTarget (L-64)', () => {
  it('is the patient’s Overview with the visit flow open and Today the way back', () => {
    expect(VISIT_REFERRER).toBe('today');
    expect(patientVisitTarget('acme', 'P1')).toEqual({
      to: TIMELINE,
      params: { organizationSlug: 'acme', patientId: 'P1' },
      search: { visit: 'open', from: 'today' },
    });
  });
});

describe('visitRedirect — an old Visit link, read as its booking (L-64)', () => {
  it('lands on the booking’s patient’s page with the flow open, replacing the old link', async () => {
    vi.mocked(fetchAppointment).mockResolvedValue(
      appointmentRow({ id: BOOKING_ID, patientId: TEST_PATIENT_ID }),
    );
    expect(await visitRedirect('acme', BOOKING_ID)).toEqual({
      to: TIMELINE,
      params: { organizationSlug: 'acme', patientId: TEST_PATIENT_ID },
      search: { visit: 'open', from: 'today' },
      replace: true,
    });
    expect(fetchAppointment).toHaveBeenCalledWith(BOOKING_ID);
    expect(notify.info).not.toHaveBeenCalled();
  });

  it.each([
    ['a booking the server doesn’t know (404)', 404],
    ['an id that is no booking’s — the retired Visit’s (400)', 400],
  ])('sends %s to Today with “Visit not found”', async (_what, status) => {
    vi.mocked(fetchAppointment).mockRejectedValue(
      new HttpError('No', status, '/app/appointments/x', 'GET'),
    );
    expect(await visitRedirect('acme', 'visit_old')).toEqual(TODAY);
    expect(notify.info).toHaveBeenCalledWith(
      'Visit not found · it may have been deleted',
    );
  });

  it('sends a booking whose person has no patient file to Today too', async () => {
    vi.mocked(fetchAppointment).mockResolvedValue(appointmentRow({ patientId: null }));
    expect(await visitRedirect('acme', BOOKING_ID)).toEqual(TODAY);
    expect(notify.info).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a server error', new HttpError('Server error', 500, '/app/appointments', 'GET')],
    ['a dropped connection', new TypeError('Failed to fetch')],
  ])(
    'throws %s for the route’s error boundary — never “Visit not found”',
    async (_what, failure) => {
      vi.mocked(fetchAppointment).mockRejectedValue(failure);
      await expect(visitRedirect('acme', BOOKING_ID)).rejects.toBe(failure);
      expect(notify.info).not.toHaveBeenCalled();
    },
  );
});
