import { z } from 'zod';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import {
  type Branch,
  civilDateSchema,
  type DeleteReason,
  type Organization,
  type Patient,
  type Prescription,
  type PrescriptionItem,
  prescriptionItemSchema,
  type User,
} from './clinic-schema.ts';
import { quickCreateMedicine } from './medicines-api.ts';
import { type MedicineForm, medicineForm } from './medicines-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's prescriptions (`S:1641`; KICKOFF §6.6 Drawers), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). The world is imported on demand, so its seed data never lands in a
 * route chunk.
 */

/**
 * TanStack Query keys for prescriptions — under the patients' key, so a saved
 * Rx refreshes the file (its section counts) with it.
 */
export const prescriptionQueryKeys = {
  all: [...patientQueryKeys.all, 'prescriptions'] as const,
  /** One patient's prescriptions, newest first. */
  patient: (patientId: string) =>
    [...prescriptionQueryKeys.all, 'patient', patientId] as const,
  detail: (id: string) => [...prescriptionQueryKeys.all, 'detail', id] as const,
  /** The Rx drawer's medicines: the store's, with the patient's last dosage of each. */
  catalog: (patientId: string) =>
    [...prescriptionQueryKeys.all, 'catalog', patientId] as const,
  /** What the printed sheet needs beyond the Rx: the patient, doctor, clinic and branch. */
  sheet: (patientId: string, doctorId: string | null) =>
    [...prescriptionQueryKeys.all, 'sheet', patientId, doctorId] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The drawer's limits (`patient-file.md:109–117`; the contract's, `S:367–388`). */
const RX_LIMITS = {
  /** Notes, Lab report and Today's procedure — the UI's 1,000 inside the contract's 2,000. */
  notes: 1000,
  medicineName: 120,
  timingText: 40,
  bodyPartText: 40,
  remarks: 200,
  /** Each dose tap cycles 0 → 1 → 2. */
  dose: 2,
  qty: 999,
} as const;

const optionalText = (max: number) => z.string().max(max).nullable();

/** One medicine line as a write sends it (`PrescriptionItem`, `S:375–388`). */
const prescriptionLineSchema = prescriptionItemSchema.extend({
  medicineName: z.string().trim().min(1, 'Name the medicine').max(RX_LIMITS.medicineName),
  doseMorning: z.number().int().min(0).max(RX_LIMITS.dose),
  doseAfternoon: z.number().int().min(0).max(RX_LIMITS.dose),
  doseNight: z.number().int().min(0).max(RX_LIMITS.dose),
  timingText: optionalText(RX_LIMITS.timingText),
  bodyPartText: optionalText(RX_LIMITS.bodyPartText),
  qty: z.number().int().min(1).max(RX_LIMITS.qty),
  remarks: optionalText(RX_LIMITS.remarks),
});

/** What a create or an update sends (`createPrescription` / `updatePrescription`, `S:1641`). */
const prescriptionInputSchema = z.object({
  patientId: z.uuid(),
  appointmentId: z.uuid().nullable(),
  doctorId: z.uuid(),
  date: civilDateSchema,
  items: z.array(prescriptionLineSchema).min(1, 'Add a medicine'),
  advice: optionalText(RX_LIMITS.notes),
  labReport: optionalText(RX_LIMITS.notes),
  procedureToday: optionalText(RX_LIMITS.notes),
  followUpDate: civilDateSchema.nullable(),
});

/** A prescription write's fields. */
export type PrescriptionInput = z.infer<typeof prescriptionInputSchema>;

type World = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** Newest first: the date, then the number. */
const newestFirst = (a: Prescription, b: Prescription) =>
  compareText(b.date, a.date) || b.seq - a.seq;

/**
 * Lines whose medicine the store does not know become quick Medicine drafts
 * (`S:378`, Q-M4): a line typed as a known name takes that medicine; any other
 * name is added to Medical first, through Medical's own quick create ("Needs
 * MRP and composition") — while the store has no manufacturer, it stays a name.
 */
async function withStoreMedicines(
  world: World,
  items: readonly PrescriptionItem[],
): Promise<PrescriptionItem[]> {
  const canDraft = world.manufacturers.snapshot().length > 0;
  const lines: PrescriptionItem[] = [];
  for (const item of items) {
    if (item.medicineId) {
      lines.push(item);
      continue;
    }
    const name = item.medicineName.trim();
    const known = world.medicines.snapshot(
      (medicine) => medicine.name.toLowerCase() === name.toLowerCase(),
    )[0];
    const medicine = known ?? (canDraft ? await quickCreateMedicine({ name }) : null);
    lines.push({ ...item, medicineName: name, medicineId: medicine?.id ?? null });
  }
  return lines;
}

/** One patient's prescriptions, newest first (REPLACE_WITH_API). */
export async function listPatientPrescriptions(
  patientId: string,
): Promise<Prescription[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.prescriptions
    .snapshot((prescription) => prescription.patientId === patientId)
    .sort(newestFirst);
}

/** One prescription — a 404 when it is unknown or deleted (REPLACE_WITH_API). */
export async function fetchPrescription(id: string): Promise<Prescription> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.prescriptions.get(id);
}

/**
 * Write a prescription (`createPrescription`, `S:1641`; REPLACE_WITH_API):
 * a 422 names a broken rule ("Add a medicine"), a 404 an unknown patient.
 * Written at the patient's open visit, it moves the visit on (`advanceVisitAfter`).
 */
export async function createPrescription(
  input: PrescriptionInput,
): Promise<Prescription> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(prescriptionInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  const items = await withStoreMedicines(clinicFixtures, fields.items);
  const created = await clinicFixtures.prescriptions.create({ ...fields, items });
  // Written at the patient's open visit, it moves the visit on (Today's card).
  const { advanceVisitAfter } = await import('./visits-api.ts');
  await advanceVisitAfter(created.patientId, 'prescription');
  return created;
}

/** Save a prescription's changes (`updatePrescription`, `S:1641`; REPLACE_WITH_API). */
export async function updatePrescription(
  id: string,
  input: PrescriptionInput,
): Promise<Prescription> {
  const { clinicFixtures } = await fixtureWorld();
  await clinicFixtures.prescriptions.get(id);
  const fields = validateClinicInput(prescriptionInputSchema, input);
  const items = await withStoreMedicines(clinicFixtures, fields.items);
  return clinicFixtures.prescriptions.update(id, { ...fields, items });
}

/** Soft-delete a prescription with the reason confirm's choice (`S:1546`; REPLACE_WITH_API). */
export async function deletePrescription(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Prescription> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.prescriptions.remove(id, reason, note);
}

/** Restore a deleted prescription — the Undo of its toast (D32). */
export async function restorePrescription(id: string): Promise<Prescription> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.prescriptions.restore(id);
}

// ── The Rx drawer's medicines ──

/** One medicine the Rx drawer offers: the store's, or a name only this patient's Rx carry. */
export interface RxCatalogMedicine {
  /** The option's key and the line's name. */
  name: string;
  /** The store's medicine; null for a name the store does not carry. */
  medicineId: string | null;
  composition: string | null;
  /** MRP in paise; null when the store has no price. */
  mrp: number | null;
  /** Units in stock across batches; null when the store does not carry it. */
  stock: number | null;
  form: MedicineForm;
  /** This patient's last line of it — a new line takes its dose, timing, place and quantity. */
  last: PrescriptionItem | null;
}

/** The Rx drawer's medicines and the "Often prescribed" names, most prescribed first. */
export interface RxCatalog {
  medicines: RxCatalogMedicine[];
  often: string[];
}

/** How many "Often prescribed" chips the quick line shows (H:4806 `slice(0, 5)`). */
const OFTEN_COUNT = 5;

/** Each medicine's newest line in `prescriptions` (newest first), by lower-cased name. */
function lastLines(
  prescriptions: readonly Prescription[],
): Map<string, PrescriptionItem> {
  const last = new Map<string, PrescriptionItem>();
  for (const prescription of prescriptions) {
    for (const item of prescription.items) {
      const key = item.medicineName.toLowerCase();
      if (!last.has(key)) last.set(key, item);
    }
  }
  return last;
}

/**
 * The Rx drawer's medicines (H:4806; REPLACE_WITH_API — the medicine picker's
 * read with the prescriptions joined): every live medicine in the store, A to
 * Z, with its composition, MRP and stock, plus any name the clinic's
 * prescriptions carry that the store does not (the drafts Q-M4 makes); each
 * with its last line — the patient's own, else the clinic's. "Often prescribed" is the clinic's five
 * most prescribed (H:4806 counts every prescription).
 */
export async function fetchRxCatalog(patientId: string): Promise<RxCatalog> {
  const { clinicFixtures } = await fixtureWorld();
  const all = clinicFixtures.prescriptions.snapshot().sort(newestFirst);
  const mine = lastLines(
    all.filter((prescription) => prescription.patientId === patientId),
  );
  const clinic = lastLines(all);
  const last = (name: string) =>
    mine.get(name.toLowerCase()) ?? clinic.get(name.toLowerCase()) ?? null;
  const count = new Map<string, number>();
  for (const prescription of all) {
    for (const item of prescription.items) {
      const key = item.medicineName.toLowerCase();
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  const store = clinicFixtures.medicines
    .snapshot()
    .map((medicine): RxCatalogMedicine => ({
      name: medicine.name,
      medicineId: medicine.id,
      composition: medicine.composition,
      mrp: medicine.mrp > 0 ? medicine.mrp : null,
      stock: medicine.batches.reduce((sum, batch) => sum + batch.qty, 0),
      form: medicineForm(medicine.name),
      last: last(medicine.name),
    }));
  const stocked = new Set(store.map((medicine) => medicine.name.toLowerCase()));
  const typed = [...clinic.values()]
    .filter((item) => !stocked.has(item.medicineName.toLowerCase()))
    .map((item): RxCatalogMedicine => ({
      name: item.medicineName,
      medicineId: null,
      composition: null,
      mrp: null,
      stock: null,
      form: medicineForm(item.medicineName),
      last: last(item.medicineName),
    }));
  const medicines = [...store, ...typed].sort((a, b) =>
    compareText(a.name.toLowerCase(), b.name.toLowerCase()),
  );
  const listed = new Map(
    medicines.map((medicine) => [medicine.name.toLowerCase(), medicine.name]),
  );
  const often = [...count.entries()]
    .filter(([key]) => listed.has(key))
    .sort(([, a], [, b]) => b - a)
    .slice(0, OFTEN_COUNT)
    .map(([key]) => listed.get(key) ?? key);
  return { medicines, often };
}

// ── The printed sheet ──

/** What the A4 prescription prints beyond the Rx itself (KICKOFF §3.5, L-22). */
export interface RxSheetContext {
  patient: Pick<Patient, 'firstName' | 'lastName' | 'seq' | 'dateOfBirth'>;
  doctor: Pick<User, 'firstName' | 'lastName'> | null;
  organization: Pick<Organization, 'name' | 'specialties'>;
  /** The patient's home branch — its phone and GSTIN print in the footer. */
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}

/**
 * The sheet's patient, doctor, clinic and branch (REPLACE_WITH_API) — the
 * clinic's own identity, never the design's sample clinic: its name and
 * specialties, and the patient's home branch (else the main branch).
 */
export async function fetchRxSheetContext(
  patientId: string,
  doctorId: string | null,
): Promise<RxSheetContext> {
  const { clinicFixtures, clinicOrganization } = await fixtureWorld();
  const patient = await clinicFixtures.patients.get(patientId);
  const branches = clinicFixtures.branches.snapshot();
  const branch =
    branches.find((candidate) => candidate.id === patient.homeBranchId) ??
    branches.find((candidate) => candidate.isMain) ??
    branches[0];
  const doctor = doctorId
    ? (clinicFixtures.staff.snapshot((person) => person.id === doctorId)[0] ?? null)
    : null;
  const organization = clinicOrganization();
  return {
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      seq: patient.seq,
      dateOfBirth: patient.dateOfBirth,
    },
    doctor: doctor ? { firstName: doctor.firstName, lastName: doctor.lastName } : null,
    organization: { name: organization.name, specialties: organization.specialties },
    branch: { phone: branch?.phone ?? '', gstNumber: branch?.gstNumber ?? null },
  };
}
