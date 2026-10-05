import { z } from 'zod';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import {
  aftercareCallSchema,
  bodyPartSchema,
  type CheckinFeel,
  type DeleteReason,
  isoDateTimeSchema,
  type Treatment,
  treatmentTemplateSchema,
} from './clinic-schema.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's treatments (`S:1642`; KICKOFF §6.6 Drawers), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). An aftercare call is scheduled server-side from the treatment (the
 * task rules derive it, `S:739`), and a treatment that uses a package session
 * counts it there.
 */

/** TanStack Query keys for treatments — under the patients' key (the file's counts). */
export const treatmentQueryKeys = {
  all: [...patientQueryKeys.all, 'treatments'] as const,
  /** One patient's treatments, newest first. */
  patient: (patientId: string) =>
    [...treatmentQueryKeys.all, 'patient', patientId] as const,
  detail: (id: string) => [...treatmentQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The drawer's limits (`patient-file.md:127–137`; the contract's, `S:404–414`). */
const TREATMENT_LIMITS = {
  name: 120,
  /** The Remark — the UI's 1,000 inside the contract's 2,000. */
  remark: 1000,
  /** Each template field's value (`S:411`). */
  param: 80,
  bodyParts: 12,
  session: { min: 1, max: 99 },
} as const;

/** What a create or an update sends (`createTreatment` / `updateTreatment`, `S:1642`). */
const treatmentInputSchema = z.object({
  patientId: z.uuid(),
  appointmentId: z.uuid().nullable(),
  offeringId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(TREATMENT_LIMITS.name),
  template: treatmentTemplateSchema,
  performedAt: isoDateTimeSchema,
  doctorId: z.uuid().nullable(),
  therapistId: z.uuid().nullable(),
  bodyParts: z.array(bodyPartSchema).max(TREATMENT_LIMITS.bodyParts),
  sessionNo: z
    .number()
    .int()
    .min(TREATMENT_LIMITS.session.min)
    .max(TREATMENT_LIMITS.session.max),
  params: z.record(z.string(), z.string().max(TREATMENT_LIMITS.param)),
  remark: z.string().max(TREATMENT_LIMITS.remark).nullable(),
  aftercareCall: aftercareCallSchema,
  packageId: z.uuid().nullable(),
});

/** A treatment write's fields. */
export type TreatmentInput = z.infer<typeof treatmentInputSchema>;

/** One check-in on a treatment, as "Feedback on this treatment" lists it. */
export interface TreatmentCheckIn {
  date: string;
  feel: CheckinFeel;
  score: number;
}

/** A treatment with the check-ins logged on it, newest first. */
export interface TreatmentDetail {
  treatment: Treatment;
  checkIns: TreatmentCheckIn[];
}

type World = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** Use (+1) or give back (−1) one session of a package, within its total. */
async function countSession(world: World, packageId: string | null, step: 1 | -1) {
  if (!packageId) return;
  const [found] = world.patientPackages.snapshot((row) => row.id === packageId);
  if (!found) return;
  const sessionsUsed = Math.min(
    found.sessionsTotal,
    Math.max(0, found.sessionsUsed + step),
  );
  if (sessionsUsed !== found.sessionsUsed) {
    await world.patientPackages.update(packageId, { sessionsUsed });
  }
}

/** One patient's treatments, newest first (REPLACE_WITH_API). */
export async function listPatientTreatments(patientId: string): Promise<Treatment[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.treatments
    .snapshot((treatment) => treatment.patientId === patientId)
    .sort((a, b) => compareText(b.performedAt, a.performedAt));
}

/** One treatment and its check-ins — a 404 when it is unknown or deleted (REPLACE_WITH_API). */
export async function fetchTreatment(id: string): Promise<TreatmentDetail> {
  const { clinicFixtures } = await fixtureWorld();
  const treatment = await clinicFixtures.treatments.get(id);
  const checkIns = clinicFixtures.checkIns
    .snapshot((checkIn) => checkIn.treatmentId === id)
    .sort((a, b) => compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt))
    .map(({ date, feel, score }) => ({ date, feel, score }));
  return { treatment, checkIns };
}

/**
 * Record a treatment (`createTreatment`, `S:1642`; REPLACE_WITH_API): its
 * aftercare call follows from it, and a package it uses counts the session.
 */
export async function createTreatment(input: TreatmentInput): Promise<Treatment> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(treatmentInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  const saved = await clinicFixtures.treatments.create(fields);
  await countSession(clinicFixtures, saved.packageId, 1);
  return saved;
}

/**
 * Save a treatment's changes (`updateTreatment`, `S:1642`; REPLACE_WITH_API):
 * moving it to another package (or off one) moves the session with it.
 */
export async function updateTreatment(
  id: string,
  input: TreatmentInput,
): Promise<Treatment> {
  const { clinicFixtures } = await fixtureWorld();
  const before = await clinicFixtures.treatments.get(id);
  const fields = validateClinicInput(treatmentInputSchema, input);
  const saved = await clinicFixtures.treatments.update(id, fields);
  if (before.packageId !== saved.packageId) {
    await countSession(clinicFixtures, before.packageId, -1);
    await countSession(clinicFixtures, saved.packageId, 1);
  }
  return saved;
}

/** Soft-delete a treatment (`S:1546`); a package session it used is given back. */
export async function deleteTreatment(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Treatment> {
  const { clinicFixtures } = await fixtureWorld();
  const removed = await clinicFixtures.treatments.remove(id, reason, note);
  await countSession(clinicFixtures, removed.packageId, -1);
  return removed;
}

/** Restore a deleted treatment — the Undo of its toast (D32); its session counts again. */
export async function restoreTreatment(id: string): Promise<Treatment> {
  const { clinicFixtures } = await fixtureWorld();
  const restored = await clinicFixtures.treatments.restore(id);
  await countSession(clinicFixtures, restored.packageId, 1);
  return restored;
}
