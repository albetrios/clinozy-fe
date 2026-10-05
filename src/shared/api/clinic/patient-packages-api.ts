import { z } from 'zod';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import type { Offering } from './clinic-schema.ts';
import { addCivilDays, clinicToday } from './clinic-time.ts';
import type { PatientPackageRecord } from './patient-packages-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * A patient's packages (`S:452–466`; KICKOFF §6.6 Packages, Add package), on
 * the fixture world until clinozy-be serves them — REPLACE_WITH_API (D6).
 * The contract makes a package only by invoicing its offering (`invoiceId`
 * server-set, `S:461`); "Add package" adds one before its invoice, with no
 * invoice (AMBER A-F6, an Appendix F request — `patient-packages-contracts.ts`).
 */

/** TanStack Query keys for packages — under the patients' key (the file's counts). */
export const patientPackageQueryKeys = {
  all: [...patientQueryKeys.all, 'packages'] as const,
  /** One patient's packages. */
  patient: (patientId: string) =>
    [...patientPackageQueryKeys.all, 'patient', patientId] as const,
  /** The offerings a package can be added from (more than one session). */
  offerings: () => [...patientPackageQueryKeys.all, 'offerings'] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The longest validity an offering may carry (`offerings-contracts.ts`) — "no expiry". */
const NO_EXPIRY_DAYS = 1095;

/** The offering behind a package, as its card and chips name it. */
export type PackageOffering = Pick<
  Offering,
  'id' | 'name' | 'tone' | 'sessions' | 'price' | 'validityDays'
>;

/** A patient's package with its offering. */
export interface PatientPackageRow {
  package: PatientPackageRecord;
  /** Null when its offering is gone. */
  offering: PackageOffering | null;
  /** False until an invoice names it ("Add package", A-F6). */
  invoiced: boolean;
}

const packageOffering = (offering: Offering): PackageOffering => ({
  id: offering.id,
  name: offering.name,
  tone: offering.tone,
  sessions: offering.sessions,
  price: offering.price,
  validityDays: offering.validityDays,
});

/** One patient's packages in the order they were sold — Add package appends (H:4834; REPLACE_WITH_API). */
export async function listPatientPackages(
  patientId: string,
): Promise<PatientPackageRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const offerings = new Map(
    clinicFixtures.offerings.snapshot().map((offering) => [offering.id, offering]),
  );
  return clinicFixtures.patientPackages
    .snapshot((row) => row.patientId === patientId)
    .sort((a, b) => compareText(a.createdAt, b.createdAt))
    .map((row) => {
      const offering = offerings.get(row.offeringId);
      return {
        package: row,
        offering: offering ? packageOffering(offering) : null,
        invoiced: row.invoiceId !== null,
      };
    });
}

/**
 * The offerings Add package lists (H:4833): the live, active ones of more
 * than one session, in the order the catalogue keeps them (the prototype's
 * `OF_SEED` order).
 */
export async function listPackageOfferings(): Promise<PackageOffering[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offerings
    .snapshot((offering) => offering.active && offering.sessions > 1)
    .map(packageOffering);
}

/** What Add package sends: the patient and the offering. */
const addPatientPackageSchema = z.object({
  patientId: z.uuid(),
  offeringId: z.uuid(),
});

/** Add package's fields. */
export type AddPatientPackageInput = z.infer<typeof addPatientPackageSchema>;

/**
 * Add a package before its invoice ("Package added · invoice it from
 * Invoices"; A-F6, REPLACE_WITH_API): every session of the offering, none
 * used, valid for the offering's days from today (no expiry: the longest the
 * contract allows), no invoice yet. A 422 when the offering is not a
 * multi-session one ("Pick a package").
 */
export async function addPatientPackage(
  input: AddPatientPackageInput,
): Promise<PatientPackageRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(
    addPatientPackageSchema.refine(
      (value) =>
        clinicFixtures.offerings.snapshot(
          (offering) => offering.id === value.offeringId && offering.sessions > 1,
        ).length > 0,
      { message: 'Pick a package', path: ['offeringId'] },
    ),
    input,
  );
  await clinicFixtures.patients.get(fields.patientId);
  const offering = await clinicFixtures.offerings.get(fields.offeringId);
  return clinicFixtures.patientPackages.create({
    patientId: fields.patientId,
    offeringId: offering.id,
    invoiceId: null,
    sessionsTotal: offering.sessions,
    sessionsUsed: 0,
    validUntil: addCivilDays(clinicToday(), offering.validityDays || NO_EXPIRY_DAYS),
  });
}
