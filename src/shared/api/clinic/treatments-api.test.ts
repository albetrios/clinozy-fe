import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { patientQueryKeys } from './patients-api.ts';
import {
  createTreatment,
  deleteTreatment,
  fetchTreatment,
  listPatientTreatments,
  restoreTreatment,
  type TreatmentInput,
  treatmentQueryKeys,
  updateTreatment,
} from './treatments-api.ts';

const DHARTI = patientRef('Dharti Galani');
const VARUN = patientRef('Varun Bhimani');
const LHR_PACKAGE = ref.patientPackage(1);
const SECOND_PACKAGE = ref.patientPackage(2);

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

function input(fields: Partial<TreatmentInput> = {}): TreatmentInput {
  return {
    patientId: DHARTI,
    appointmentId: null,
    offeringId: null,
    name: 'LHR Full Face',
    template: 'skin',
    performedAt: '2026-10-03T06:30:00.000Z',
    doctorId: staffRef('DD'),
    therapistId: staffRef('KP'),
    bodyParts: ['face'],
    sessionNo: 2,
    params: { type: 'Laser', machine: 'Soprano Ice' },
    remark: null,
    aftercareCall: 'next_day',
    packageId: null,
    ...fields,
  };
}

const used = (packageId: string) =>
  clinicFixtures.patientPackages.snapshot((row) => row.id === packageId)[0]?.sessionsUsed;

describe('treatments (S:1642)', () => {
  it('sits under the patients key, so a saved treatment refreshes the file', () => {
    expect(treatmentQueryKeys.patient(DHARTI).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
  });

  it('reads one patient’s treatments, newest first', async () => {
    const list = await listPatientTreatments(VARUN);
    expect(list.map((treatment) => treatment.name)).toEqual([
      'Chemical peel · session 1',
      'Mole Removal Medium',
    ]);
  });

  it('reads a treatment with its check-ins', async () => {
    const { treatment, checkIns } = await fetchTreatment(ref.treatment(498));
    expect(treatment.name).toBe('LHR Full Face');
    expect(checkIns).toEqual([expect.objectContaining({ feel: 'better', score: 7 })]);
  });

  it('records a treatment, and a package it uses counts the session', async () => {
    const before = used(LHR_PACKAGE) ?? 0;
    const saved = await createTreatment(input({ packageId: LHR_PACKAGE }));
    expect(saved).toMatchObject({ name: 'LHR Full Face', sessionNo: 2 });
    expect(used(LHR_PACKAGE)).toBe(before + 1);
  });

  it('moves the session when the treatment moves to another package', async () => {
    const saved = await createTreatment(input({ packageId: LHR_PACKAGE }));
    const lhr = used(LHR_PACKAGE) ?? 0;
    const second = used(SECOND_PACKAGE) ?? 0;
    await updateTreatment(saved.id, input({ packageId: SECOND_PACKAGE }));
    expect(used(LHR_PACKAGE)).toBe(lhr - 1);
    expect(used(SECOND_PACKAGE)).toBe(second + 1);
  });

  it('gives a session back on delete and counts it again on restore', async () => {
    const saved = await createTreatment(input({ packageId: LHR_PACKAGE }));
    const counted = used(LHR_PACKAGE) ?? 0;
    await deleteTreatment(saved.id, 'mistake', null);
    expect(used(LHR_PACKAGE)).toBe(counted - 1);
    await restoreTreatment(saved.id);
    expect(used(LHR_PACKAGE)).toBe(counted);
  });

  it('refuses a blank name and a template field over 80 characters', async () => {
    for (const fields of [{ name: '  ' }, { params: { machine: 'x'.repeat(81) } }]) {
      const error = await createTreatment(input(fields)).catch(
        (caught: unknown) => caught,
      );
      expect(isHttpError(error) && error.status).toBe(422);
    }
  });
});
