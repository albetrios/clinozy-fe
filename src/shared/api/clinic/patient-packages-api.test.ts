import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { addCivilDays, clinicToday } from './clinic-time.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  addPatientPackage,
  listPackageOfferings,
  listPatientPackages,
  patientPackageQueryKeys,
} from './patient-packages-api.ts';
import { patientQueryKeys } from './patients-api.ts';

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('patient packages (S:452–466)', () => {
  it('sits under the patients key, so an added package refreshes the file', () => {
    expect(patientPackageQueryKeys.patient(DHARTI).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
  });

  it('reads a patient’s packages with their offerings, all invoiced', async () => {
    const rows = await listPatientPackages(DHARTI);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.invoiced && row.offering !== null)).toBe(true);
  });

  it('offers the active multi-session offerings in the catalogue order', async () => {
    const offerings = await listPackageOfferings();
    expect(offerings.length).toBeGreaterThan(0);
    expect(offerings.every((offering) => offering.sessions > 1)).toBe(true);
    const catalogue = clinicFixtures.offerings
      .snapshot((offering) => offering.active && offering.sessions > 1)
      .map((offering) => offering.id);
    expect(offerings.map((offering) => offering.id)).toEqual(catalogue);
  });

  it('adds an uninvoiced package with every session left (A-F6)', async () => {
    const [offering] = await listPackageOfferings();
    if (!offering) throw new Error('no package offering');
    const added = await addPatientPackage({ patientId: DHARTI, offeringId: offering.id });
    expect(added).toMatchObject({
      invoiceId: null,
      sessionsTotal: offering.sessions,
      sessionsUsed: 0,
      validUntil: addCivilDays(clinicToday(), offering.validityDays || 1095),
    });
    const rows = await listPatientPackages(DHARTI);
    expect(rows.find((row) => row.package.id === added.id)?.invoiced).toBe(false);
  });

  it('refuses an offering of one session — “Pick a package”', async () => {
    const [single] = clinicFixtures.offerings.snapshot(
      (offering) => offering.sessions === 1,
    );
    if (!single) throw new Error('no single-session offering');
    const error = await addPatientPackage({
      patientId: DHARTI,
      offeringId: single.id,
    }).catch((caught: unknown) => caught);
    expect(isHttpError(error) && error.status).toBe(422);
    expect(isHttpError(error) && error.message).toBe('Pick a package');
  });
});
