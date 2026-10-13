import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  bodyPartSchema,
  type Branch,
  offeringSpecialtySchema,
  type Organization,
  type PrescriptionItem,
  rxMealSchema,
  rxTimingSchema,
} from './app-schema.ts';
import { type MedicineForm, medicineForm } from './medicines-contracts.ts';

/*
 * The patient file's prescriptions on clinozy-be (`/app/patients/:patient_id/prescriptions`,
 * the member's kits at `/app/prescription-kits`; api-integration §5.4). A prescription is a
 * draft until a member holding `patient_prescription:update` approves it, then final (Q19):
 * neither changed nor deleted. A line's `medicine_name` is free text; `medicine_id` names the
 * store's medicine when the line was picked from it (the quick-create drafts go — §5.4).
 */

// ── The wire ──

type ApiPrescription = NonNullable<
  ApiData<'/app/patients/{patient_id}/prescriptions/{patient_prescription_id}', 'get'>
>;
type ApiPrescriptionRow = NonNullable<
  ApiData<'/app/patients/{patient_id}/prescriptions', 'get'>
>[number];
type ApiPrescriptionLine = NonNullable<ApiPrescription['items']>[number];
type ApiKit = NonNullable<ApiData<'/app/prescription-kits', 'get'>>[number];
type ApiMedicineRow = NonNullable<ApiData<'/app/medicines', 'get'>>[number];
type ApiOrganization = NonNullable<ApiData<'/tenancy/organization', 'get'>>;
type ApiBranch = NonNullable<ApiData<'/app/branches/{branch_id}', 'get'>>;

/** A new prescription as `POST …/prescriptions` takes it. */
type ApiPrescriptionCreate = NonNullable<
  ApiBody<'/app/patients/{patient_id}/prescriptions', 'post'>
>;
/** One line as a prescription write takes it. */
type ApiPrescriptionLineBody = NonNullable<ApiPrescriptionCreate['items']>[number];

/**
 * One line as the server keeps it: as written — a field the write left out is absent from the
 * read (a kit's or a seeded line may carry only `medicine_name` and `quantity`).
 */
const lineWire = wireSchema<ApiPrescriptionLine>()(
  z.object({
    medicine_name: z.string(),
    medicine_id: z.string().nullable().optional(),
    dose_morning: z.number().int().optional(),
    dose_afternoon: z.number().int().optional(),
    dose_night: z.number().int().optional(),
    is_sos: z.boolean().optional(),
    meal: rxMealSchema.nullable().optional(),
    timing: rxTimingSchema.nullable().optional(),
    timing_text: z.string().nullable().optional(),
    body_part: bodyPartSchema.nullable().optional(),
    body_part_text: z.string().nullable().optional(),
    quantity: z.number().int().optional(),
    remarks: z.string().nullable().optional(),
  }),
);

const prescriptionFieldsWire = {
  id: z.string(),
  prescription_number: z.number().int(),
  patient_id: z.string(),
  appointment_id: z.string().nullable(),
  doctor_membership_id: z.string(),
  prescription_date: z.string(),
  items: z.array(lineWire),
  advice: z.string().nullable(),
  lab_report: z.string().nullable(),
  procedure_today: z.string().nullable(),
  follow_up_date: z.string().nullable(),
  status: z.enum(['draft', 'approved']),
  approved_at: z.string().nullable(),
  approved_by_membership_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One prescription (`GET …/prescriptions/:patient_prescription_id` and every write's answer). */
export const prescriptionWire = wireSchema<ApiPrescription>()(
  z.object(prescriptionFieldsWire),
);

/** A row of a patient's prescriptions (`GET …/prescriptions`). */
export const prescriptionRowWire = wireSchema<ApiPrescriptionRow>()(
  z.object(prescriptionFieldsWire),
);

/** One of the member's kits (`GET /app/prescription-kits`). */
export const prescriptionKitWire = wireSchema<ApiKit>()(
  z.object({ id: z.string(), name: z.string(), items: z.array(lineWire) }),
);

/** A medicine as the Rx drawer suggests it (`GET /app/medicines`): its name, composition, stock. */
export const rxMedicineWire = wireSchema<ApiMedicineRow>()(
  z.object({
    id: z.string(),
    name: z.string(),
    composition: z.string().nullable(),
    quantity: z.number(),
  }),
);

/** The clinic as the printed sheet's footer names it (`GET /tenancy/organization`). */
export const rxOrganizationWire = wireSchema<ApiOrganization>()(
  z.object({ name: z.string(), specialties: z.array(offeringSpecialtySchema) }),
);

/** The branch's phone and GSTIN for the printed sheet's footer (`GET /app/branches/:branch_id`). */
export const rxBranchWire = wireSchema<ApiBranch>()(
  z.object({ phone: z.string(), gst_number: z.string().nullable() }),
);

// ── The rooms' shapes ──

/** A prescription's state: a draft until approved, then final (Q19). */
export type PrescriptionStatus = 'draft' | 'approved';

/** One prescription as the file reads it. */
export interface PrescriptionRecord {
  /** `rx_…`. */
  id: string;
  /** "#500" is this number (`prescription_number`). */
  seq: number;
  patientId: string;
  /** The booking it was written at; null outside a visit. */
  appointmentId: string | null;
  /** The prescribing doctor's membership id. */
  doctorId: string;
  /** The prescription's day, clinic-local `YYYY-MM-DD`. */
  date: string;
  items: PrescriptionItem[];
  advice: string | null;
  labReport: string | null;
  procedureToday: string | null;
  followUpDate: string | null;
  status: PrescriptionStatus;
  approvedAt: string | null;
  /** Who approved it (a membership id). */
  approvedById: string | null;
  createdAt: string;
  /** What a save sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** What a create or a save writes: the doctor, the day, the lines and the notes. */
export interface PrescriptionFields {
  doctorId: string;
  date: string;
  items: PrescriptionItem[];
  advice: string | null;
  labReport: string | null;
  procedureToday: string | null;
}

/** One of the member's own kits — lines a draft copies (no server-side apply). */
export interface PrescriptionKit {
  /** `rxk_…`. */
  id: string;
  name: string;
  items: PrescriptionItem[];
}

/** A wire line as the rooms read it: a field the write left out reads as none. */
function prescriptionItemOf(line: z.output<typeof lineWire>): PrescriptionItem {
  return {
    medicineId: line.medicine_id ?? null,
    medicineName: line.medicine_name,
    doseMorning: line.dose_morning ?? 0,
    doseAfternoon: line.dose_afternoon ?? 0,
    doseNight: line.dose_night ?? 0,
    sos: line.is_sos ?? false,
    meal: line.meal ?? null,
    timing: line.timing ?? null,
    timingText: line.timing_text ?? null,
    bodyPart: line.body_part ?? null,
    bodyPartText: line.body_part_text ?? null,
    // The API leaves `quantity` optional with no default: a line without one reads as one.
    qty: line.quantity ?? 1,
    remarks: line.remarks ?? null,
  };
}

/** A wire prescription as the file reads it. */
export function toPrescriptionRecord(
  row: z.output<typeof prescriptionWire>,
): PrescriptionRecord {
  return {
    id: row.id,
    seq: row.prescription_number,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    doctorId: row.doctor_membership_id,
    date: row.prescription_date,
    items: row.items.map(prescriptionItemOf),
    advice: row.advice,
    labReport: row.lab_report,
    procedureToday: row.procedure_today,
    followUpDate: row.follow_up_date,
    status: row.status,
    approvedAt: row.approved_at,
    approvedById: row.approved_by_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A wire kit as the drawer reads it. */
export function toPrescriptionKit(
  row: z.output<typeof prescriptionKitWire>,
): PrescriptionKit {
  return { id: row.id, name: row.name, items: row.items.map(prescriptionItemOf) };
}

/** A line as a write sends it — every field, so the read gives back what was written. */
function prescriptionLineBodyOf(item: PrescriptionItem): ApiPrescriptionLineBody {
  return {
    medicine_name: item.medicineName,
    medicine_id: item.medicineId,
    dose_morning: item.doseMorning,
    dose_afternoon: item.doseAfternoon,
    dose_night: item.doseNight,
    is_sos: item.sos,
    meal: item.meal,
    timing: item.timing,
    timing_text: item.timingText,
    body_part: item.bodyPart,
    body_part_text: item.bodyPartText,
    quantity: item.qty,
    remarks: item.remarks,
  };
}

/** A write's body: the doctor, the day, the lines and the notes, as the API names them. */
export function prescriptionBodyOf(
  fields: PrescriptionFields,
): Pick<
  ApiPrescriptionCreate,
  | 'doctor_membership_id'
  | 'prescription_date'
  | 'items'
  | 'advice'
  | 'lab_report'
  | 'procedure_today'
> {
  return {
    doctor_membership_id: fields.doctorId,
    prescription_date: fields.date,
    items: fields.items.map(prescriptionLineBodyOf),
    advice: fields.advice,
    lab_report: fields.labReport,
    procedure_today: fields.procedureToday,
  };
}

// ── The drawer's medicines ──

/** A medicine of the store, as `GET /app/medicines` answers it. */
export interface RxStoreMedicine {
  /** `med_…`. */
  id: string;
  name: string;
  composition: string | null;
  /** Units in stock — the server's balance across batches. */
  stock: number;
}

/** A store medicine as the drawer reads it. */
export function toRxStoreMedicine(row: z.output<typeof rxMedicineWire>): RxStoreMedicine {
  return {
    id: row.id,
    name: row.name,
    composition: row.composition,
    stock: row.quantity,
  };
}

/** One medicine the Rx drawer offers: the store's, or a name only this patient's Rx carry. */
export interface RxCatalogMedicine {
  /** The option's key and the line's name. */
  name: string;
  /** The store's medicine; null for a name the store does not carry. */
  medicineId: string | null;
  composition: string | null;
  /** Units in stock; null when the store does not carry it. */
  stock: number | null;
  /** Browse's Oral · Topical group, by the name (H:5058). */
  form: MedicineForm;
  /** This patient's last line of it — a new line takes its dose, timing, place and quantity. */
  last: PrescriptionItem | null;
}

/** The Rx drawer's medicines, A to Z. */
export interface RxCatalog {
  medicines: RxCatalogMedicine[];
}

/** Each medicine's newest line in `prescriptions` (newest first), by lower-cased name. */
function lastLines(
  prescriptions: readonly PrescriptionRecord[],
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
 * The Rx drawer's medicines (H:4806), composed from two reads the file already makes: the
 * store's medicines (none without `medicine:read`) and the patient's own prescriptions — each
 * with the patient's last line of it, plus every name their prescriptions carry that the store
 * does not. The clinic's "Often prescribed" and its last dose of a medicine have no read (G4).
 */
export function rxCatalogOf(
  store: readonly RxStoreMedicine[],
  prescriptions: readonly PrescriptionRecord[],
): RxCatalog {
  const mine = lastLines(prescriptions);
  const stocked = new Set(store.map((medicine) => medicine.name.toLowerCase()));
  const fromStore = store.map((medicine): RxCatalogMedicine => ({
    name: medicine.name,
    medicineId: medicine.id,
    composition: medicine.composition,
    stock: medicine.stock,
    form: medicineForm(medicine.name),
    last: mine.get(medicine.name.toLowerCase()) ?? null,
  }));
  const typed = [...mine.values()]
    .filter((item) => !stocked.has(item.medicineName.toLowerCase()))
    .map((item): RxCatalogMedicine => ({
      name: item.medicineName,
      medicineId: null,
      composition: null,
      stock: null,
      form: medicineForm(item.medicineName),
      last: item,
    }));
  return {
    medicines: [...fromStore, ...typed].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    ),
  };
}

// ── The printed sheet ──

/** The clinic part of the printed sheet: its name and specialties, the branch's phone and GSTIN. */
export interface RxSheetClinic {
  organization: Pick<Organization, 'name' | 'specialties'>;
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}
