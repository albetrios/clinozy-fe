import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as VisitsApi from '@/shared/api/clinic/visits-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

import { VISIT_REFERRER } from './clinic-referrer.ts';
import { patientVisitTarget, visitRedirect } from './visit-redirect.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** The next visit read's failure, when a test sets one; the fixture server otherwise. */
const read = vi.hoisted(() => ({ failure: null as Error | null }));
vi.mock('@/shared/api/clinic/visits-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof VisitsApi>();
  return {
    ...actual,
    fetchVisit: async (...args: Parameters<typeof actual.fetchVisit>) => {
      const { failure } = read;
      read.failure = null;
      if (failure) throw failure;
      return actual.fetchVisit(...args);
    },
  };
});

const TIMELINE = '/organization/$organizationSlug/patients/$patientId/timeline';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  vi.mocked(notify.info).mockReset();
  read.failure = null;
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  vi.useRealTimers();
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

describe('visitRedirect — an old Visit sheet link (L-64)', () => {
  it('lands on the visit’s patient’s page, replacing the old link', async () => {
    const booking = await clinicFixtures.appointments.get(ref.appointment(2866));
    expect(await visitRedirect('acme', ref.visit(2866))).toEqual({
      to: TIMELINE,
      params: { organizationSlug: 'acme', patientId: booking.patientId },
      search: { visit: 'open', from: 'today' },
      replace: true,
    });
    expect(notify.info).not.toHaveBeenCalled();
  });

  it('sends a visit it does not know to Today with “Visit not found”', async () => {
    expect(await visitRedirect('acme', ref.visit(1))).toEqual({
      to: '/organization/$organizationSlug/today',
      params: { organizationSlug: 'acme' },
      replace: true,
    });
    expect(notify.info).toHaveBeenCalledWith(
      'Visit not found · it may have been deleted',
    );
  });

  it('sends a visit with no patient record yet to Today too', async () => {
    const visit = await clinicFixtures.visits.create({
      appointmentId: null,
      patientId: null,
      leadId: ref.lead(2385),
      stage: 'with_doctor',
      stageAt: new Date().toISOString(),
      checks: { consent: false, photos: false, allergies: false },
      prescriptionId: null,
      treatmentId: null,
      invoiceId: null,
      sharedAt: null,
    });
    expect((await visitRedirect('acme', visit.id)).to).toBe(
      '/organization/$organizationSlug/today',
    );
    expect(notify.info).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a server error', new HttpError('Server error', 500, '/visits', 'GET')],
    ['a dropped connection', new TypeError('Failed to fetch')],
  ])(
    'throws %s for the route’s error boundary — never “Visit not found”',
    async (_what, failure) => {
      read.failure = failure;
      await expect(visitRedirect('acme', ref.visit(2866))).rejects.toBe(failure);
      expect(notify.info).not.toHaveBeenCalled();
    },
  );
});
