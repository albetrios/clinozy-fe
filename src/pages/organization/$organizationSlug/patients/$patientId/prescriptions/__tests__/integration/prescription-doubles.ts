/**
 * Test data for the patient file's prescriptions as clinozy-be answers them, and an in-memory
 * stand-in for `prescriptions-api.ts` (a draft until approved, final once approved, deletes
 * restorable, a stale save refused) — so a section, drawer or hook test can write and read
 * back. A test mocks the module with {@link rxServerApi} and seeds {@link rxWorld}:
 *
 * ```ts
 * vi.mock('@/shared/api/clinic/prescriptions-api.ts', async (importOriginal) => ({
 *   ...(await importOriginal<object>()),
 *   ...(await import('<this file>')).rxServerApi,
 * }));
 * ```
 */
import { vi } from 'vitest';

import type { PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';
import type * as PrescriptionsApi from '@/shared/api/clinic/prescriptions-api.ts';
import type {
  PrescriptionKit,
  PrescriptionRecord,
  RxSheetClinic,
  RxStoreMedicine,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

/** Rx #500's id. */
export const TEST_PRESCRIPTION_ID = 'rx_rx50000000000000000000';

/** One line — Flubolt 400, one at night after meals, eight in all — unless told otherwise. */
export function prescriptionLine(
  overrides: Partial<PrescriptionItem> = {},
): PrescriptionItem {
  return {
    medicineId: null,
    medicineName: 'Flubolt 400',
    doseMorning: 0,
    doseAfternoon: 0,
    doseNight: 1,
    sos: false,
    meal: 'after',
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 8,
    remarks: null,
    ...overrides,
  };
}

/** Priya's Rx #500 by Dr. Nisha, a draft of 1 Oct 2026, unless told otherwise. */
export function prescriptionRecord(
  overrides: Partial<PrescriptionRecord> = {},
): PrescriptionRecord {
  return {
    id: TEST_PRESCRIPTION_ID,
    seq: 500,
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    doctorId: DOCTOR_NISHA.id,
    date: '2026-10-01',
    items: [prescriptionLine()],
    advice: 'Avoid sun',
    labReport: null,
    procedureToday: null,
    followUpDate: null,
    status: 'draft',
    approvedAt: null,
    approvedById: null,
    createdAt: '2026-10-01T05:00:00.000Z',
    updatedAt: '2026-10-01T05:00:00.000Z',
    ...overrides,
  };
}

/** The clinic every printed sheet names in these tests. */
export const TEST_SHEET_CLINIC: RxSheetClinic = {
  organization: { name: 'Cresence Skin Clinic', specialties: ['skin'] },
  branch: { phone: '+919825044120', gstNumber: '24ABCDE1234F1Z5' },
};

/** What the stand-in server holds. */
interface RxWorld {
  prescriptions: PrescriptionRecord[];
  /** Deleted drafts, restorable. */
  deleted: PrescriptionRecord[];
  kits: PrescriptionKit[];
  medicines: RxStoreMedicine[];
  clinic: RxSheetClinic;
  /** The next prescription number. */
  nextNumber: number;
  /** The clock a write stamps `updated_at` with. */
  writes: number;
}

const emptyWorld = (): RxWorld => ({
  prescriptions: [],
  deleted: [],
  kits: [],
  medicines: [],
  clinic: TEST_SHEET_CLINIC,
  nextNumber: 501,
  writes: 0,
});

/** The stand-in server's records; {@link resetRxWorld} empties it. */
export const rxWorld: RxWorld = emptyWorld();

/** Start a test on an empty server, then seed what it is about. */
export function resetRxWorld(seed: Partial<RxWorld> = {}): void {
  Object.assign(rxWorld, emptyWorld(), structuredClone(seed));
}

const notFound = () =>
  new HttpError('Not found', 404, '/app/patients/…/prescriptions/…', 'GET', {
    error: { code: 'not_found', detail: 'Prescription not found' },
  });

const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/patients/…/prescriptions/…', 'PATCH', {
    error: { code: 'conflict', reason, detail },
  });

/** A new `updated_at`, later than every one before it. */
const stamp = () => {
  rxWorld.writes += 1;
  return new Date(Date.UTC(2026, 9, 2, 5, 0, rxWorld.writes)).toISOString();
};

const find = (id: string) => {
  const found = rxWorld.prescriptions.find((prescription) => prescription.id === id);
  if (!found) throw notFound();
  return found;
};

const replace = (next: PrescriptionRecord) => {
  rxWorld.prescriptions = rxWorld.prescriptions.map((prescription) =>
    prescription.id === next.id ? next : prescription,
  );
  return structuredClone(next);
};

type Api = typeof PrescriptionsApi;

/** The stand-in `prescriptions-api.ts` calls, each a spy over {@link rxWorld}. */
export const rxServerApi = {
  listPatientPrescriptions: vi.fn<Api['listPatientPrescriptions']>(async (patientId) =>
    structuredClone(
      rxWorld.prescriptions
        .filter((prescription) => prescription.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq),
    ),
  ),
  fetchPrescription: vi.fn<Api['fetchPrescription']>(async ({ prescriptionId }) =>
    structuredClone(find(prescriptionId)),
  ),
  createPrescription: vi.fn<Api['createPrescription']>(
    async ({ patientId, fields, appointmentId = null }) => {
      const at = stamp();
      const created: PrescriptionRecord = {
        ...prescriptionRecord(),
        ...structuredClone(fields),
        items: structuredClone(fields.items),
        id: `rx_new${String(rxWorld.nextNumber).padStart(18, '0')}`,
        seq: rxWorld.nextNumber,
        patientId,
        appointmentId,
        status: 'draft',
        createdAt: at,
        updatedAt: at,
      };
      rxWorld.nextNumber += 1;
      rxWorld.prescriptions.push(created);
      return structuredClone(created);
    },
  ),
  updatePrescription: vi.fn<Api['updatePrescription']>(
    async ({ prescriptionId, fields, expectedUpdatedAt }) => {
      const current = find(prescriptionId);
      if (current.status === 'approved') {
        throw conflict(
          'prescription_approved',
          'An approved prescription cannot be changed',
        );
      }
      if (current.updatedAt !== expectedUpdatedAt) {
        throw conflict(
          'record_changed',
          'This record was changed — reload and try again',
        );
      }
      return replace({
        ...current,
        ...structuredClone(fields),
        items: structuredClone(fields.items),
        updatedAt: stamp(),
      });
    },
  ),
  approvePrescription: vi.fn<Api['approvePrescription']>(async ({ prescriptionId }) => {
    const current = find(prescriptionId);
    const at = stamp();
    return replace({
      ...current,
      status: 'approved',
      approvedAt: at,
      approvedById: current.doctorId,
      updatedAt: at,
    });
  }),
  deletePrescription: vi.fn<Api['deletePrescription']>(async ({ prescriptionId }) => {
    const current = find(prescriptionId);
    rxWorld.prescriptions = rxWorld.prescriptions.filter(
      (prescription) => prescription.id !== prescriptionId,
    );
    rxWorld.deleted.push(current);
  }),
  restorePrescription: vi.fn<Api['restorePrescription']>(async ({ prescriptionId }) => {
    const restored = rxWorld.deleted.find(
      (prescription) => prescription.id === prescriptionId,
    );
    if (!restored) throw notFound();
    rxWorld.deleted = rxWorld.deleted.filter(
      (prescription) => prescription.id !== prescriptionId,
    );
    rxWorld.prescriptions.push(restored);
    return structuredClone(restored);
  }),
  listPrescriptionKits: vi.fn<Api['listPrescriptionKits']>(async () =>
    structuredClone(rxWorld.kits),
  ),
  listRxMedicines: vi.fn<Api['listRxMedicines']>(async () =>
    structuredClone(rxWorld.medicines),
  ),
  fetchRxSheetClinic: vi.fn<Api['fetchRxSheetClinic']>(async () =>
    structuredClone(rxWorld.clinic),
  ),
};
