import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { appointmentQueryKeys } from './appointments-api.ts';
import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  setVisitStage,
  undoVisitChange,
  VISIT_WRITE_KEYS,
  visitQueryKeys,
} from './visits-api.ts';

const TODAY = '2026-10-03';

/** The rejection a call ends in: its status and the envelope's code and detail. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (error.data as { error: { code: string; detail: string } }).error;
  return { status: error.status, code: body.code, detail: body.detail };
}

const visitsOf = (seq: number) =>
  clinicFixtures.visits.snapshot((visit) => visit.appointmentId === ref.appointment(seq));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('setVisitStage (D18; Appendix F, fixture)', () => {
  it('starts a waiting visit’s record with its first move — Send in', async () => {
    expect(visitsOf(2867)).toEqual([]);
    const change = await setVisitStage({
      appointmentId: ref.appointment(2867),
      stage: 'with_doctor',
    });
    expect(change.visit).toMatchObject({
      appointmentId: ref.appointment(2867),
      stage: 'with_doctor',
      stageAt: clinicInstant(TODAY, '10:42'),
    });
    expect(visitsOf(2867)).toHaveLength(1);
  });

  it('moves a visit on record and Undo puts it back, once', async () => {
    const change = await setVisitStage({
      appointmentId: ref.appointment(2866),
      stage: 'checkout',
    });
    expect(change.visit).toMatchObject({ id: ref.visit(2866), stage: 'checkout' });
    await undoVisitChange(change.undoToken);
    expect(visitsOf(2866)[0]?.stage).toBe('with_doctor');
    expect(await failureOf(undoVisitChange(change.undoToken))).toMatchObject({
      status: 409,
      code: 'undo_unavailable',
    });
  });

  it('Undo of a first move leaves the visit waiting again', async () => {
    const change = await setVisitStage({
      appointmentId: ref.appointment(2868),
      stage: 'with_doctor',
    });
    await undoVisitChange(change.undoToken);
    expect(visitsOf(2868)).toEqual([]);
  });

  it('refuses a booking not checked in, and a move the machine does not allow', async () => {
    expect(
      await failureOf(
        setVisitStage({ appointmentId: ref.appointment(2848), stage: 'with_doctor' }),
      ),
    ).toEqual({ status: 409, code: 'not_checked_in', detail: 'Check them in first' });
    expect(
      await failureOf(
        setVisitStage({ appointmentId: ref.appointment(2867), stage: 'checkout' }),
      ),
    ).toEqual({
      status: 409,
      code: 'invalid_transition',
      detail: 'Waiting can’t move to Checkout',
    });
  });

  it('refreshes the visits and the floor', () => {
    expect(VISIT_WRITE_KEYS).toEqual([visitQueryKeys.all, appointmentQueryKeys.all]);
  });
});
