/**
 * Test data for the Treatments section as clinozy-be answers it (`/app/patients/:id/treatments`,
 * `/app/patients/:id/offerings?is_package=true`, `/app/memberships`): a session, a package, the
 * team, and an in-memory server the api modules' doubles read and write. Ids are public ids.
 * Override what a test is about; the rest stays Priya's LHR session.
 */
import { vi } from 'vitest';

import type { AppointmentTreatment } from '@/shared/api/clinic/appointments-contracts.ts';
import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import type {
  TreatmentCheckIn,
  TreatmentCreateInput,
  TreatmentFields,
  TreatmentRecord,
} from '@/shared/api/clinic/treatments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

/** Priya's LHR Full Face session. */
export const TEST_TREATMENT_ID = 'trt_lhr00000000000000000';

/** Priya's LHR package (the patient offering). */
export const TEST_PACKAGE_ID = 'poff_lhr0000000000000000';

/** Dr. Nisha Shah, the doctor on the session — and the signed-in member. */
const NISHA_ID = 'mem_nisha0000000000000000';

/** Riya Sen, a therapist. */
const RIYA_ID = 'mem_riya00000000000000000';

/** A done session: LHR Full Face, session 1, Skin · laser, the face, Nisha's. */
export function treatmentRecord(
  overrides: Partial<TreatmentRecord> = {},
): TreatmentRecord {
  return {
    id: TEST_TREATMENT_ID,
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    offeringId: 'off_lhr00000000000000000',
    name: 'LHR Full Face',
    template: 'skin',
    performedAt: '2026-10-01T09:30:00.000Z',
    doctorId: NISHA_ID,
    therapistId: null,
    bodyParts: ['face'],
    sessionNumber: 1,
    parameters: { type: 'Laser', areas: 'Face' },
    remark: null,
    aftercareCall: 'next_day',
    packageId: null,
    isBilled: null,
    status: 'done',
    reversedReason: null,
    reversedAt: null,
    latestCheckIn: null,
    createdAt: '2026-10-01T09:30:00.000Z',
    updatedAt: '2026-10-01T09:30:00.000Z',
    ...overrides,
  };
}

/** Priya's active LHR package: 1 of 7 used. */
export function patientPackage(
  overrides: Partial<PatientPackageRow> = {},
): PatientPackageRow {
  return {
    id: TEST_PACKAGE_ID,
    offeringId: 'off_lhrpack000000000000000',
    name: 'LHR Full Face · B4G7',
    sessionsTotal: 7,
    sessionsUsed: 1,
    sessionsLeft: 6,
    status: 'active',
    validUntil: '2027-09-30',
    invoiceId: 'invc_lhr0000000000000000',
    createdAt: '2026-09-30T05:00:00.000Z',
    updatedAt: '2026-10-01T09:30:00.000Z',
    ...overrides,
  };
}

/** The team: Nisha (the signed-in member) and Riya. */
export const TEAM: DirectoryMember[] = [
  {
    id: NISHA_ID,
    userId: 'usr_test',
    name: 'Dr. Nisha Shah',
    initials: 'NS',
    tone: 'sage',
    roleIds: [],
    branchIds: [],
  },
  {
    id: RIYA_ID,
    userId: 'usr_riya',
    name: 'Riya Sen',
    initials: 'RS',
    tone: 'lav',
    roleIds: [],
    branchIds: [],
  },
];

/** The clinic's active treatments — the name chips. */
export const BOOKABLE_TREATMENTS: AppointmentTreatment[] = [
  {
    id: 'off_peel000000000000000000',
    name: 'Underarm Peel',
    durationMin: 30,
    specialty: 'skin',
    tone: 'blush',
  },
  {
    id: 'off_back000000000000000000',
    name: 'Back Peeling',
    durationMin: 45,
    specialty: 'skin',
    tone: 'sky',
  },
];

/** What the mocked server holds and how it answers. */
export interface TreatmentsWorld {
  treatments: TreatmentRecord[];
  packages: PatientPackageRow[];
  /** Each session's check-ins, newest first. */
  checkIns: Record<string, TreatmentCheckIn[]>;
  /** The list read fails (a dropped connection). */
  failList: boolean;
  /** The next create is refused with these field errors (a 400). */
  refuseFields: { field: string; message: string }[] | null;
  /** The next create is refused as a conflict with this reason (a 409, `offering_used_up`). */
  refuseConflict: string | null;
}

/** Priya with her LHR session (its check-in "Better · 7/10") and her LHR package. */
export function seededTreatmentsWorld(): TreatmentsWorld {
  const checkIn: TreatmentCheckIn = {
    id: 'chk_one00000000000000000',
    date: '2026-10-02',
    feel: 'better',
    score: 7,
  };
  return {
    treatments: [treatmentRecord({ latestCheckIn: checkIn })],
    packages: [patientPackage()],
    checkIns: { [TEST_TREATMENT_ID]: [checkIn] },
    failList: false,
    refuseFields: null,
    refuseConflict: null,
  };
}

let created = 0;

/** A 400 as clinozy-be words it. */
function validationError(errors: { field: string; message: string }[]): HttpError {
  return new HttpError('Invalid', 400, '/app/patients/treatments', 'POST', {
    error: { type: 'validation_error', code: 'invalid_field', errors },
  });
}

/** A session with its fields applied. */
function withFields(record: TreatmentRecord, fields: TreatmentFields): TreatmentRecord {
  return { ...record, ...fields, updatedAt: new Date().toISOString() };
}

/**
 * `treatments-api.ts` over the world: a create spends a package session and takes its number,
 * a reverse gives it back — the server's work, as clinozy-be does it.
 */
export function treatmentsApiDouble(world: TreatmentsWorld) {
  const find = (treatmentId: string) => {
    const found = world.treatments.find((row) => row.id === treatmentId);
    if (!found)
      throw new HttpError('Not found', 404, `/treatments/${treatmentId}`, 'GET');
    return found;
  };
  const store = (saved: TreatmentRecord) => {
    world.treatments = world.treatments.map((row) => (row.id === saved.id ? saved : row));
    return structuredClone(saved);
  };
  return {
    listPatientTreatments: vi.fn(async () => {
      if (world.failList) throw new Error('connection dropped');
      return structuredClone(world.treatments);
    }),
    fetchTreatment: vi.fn(async (_patientId: string, treatmentId: string) =>
      structuredClone(find(treatmentId)),
    ),
    listTreatmentCheckIns: vi.fn(async (_patientId: string, treatmentId: string) =>
      structuredClone(world.checkIns[treatmentId] ?? []),
    ),
    createTreatment: vi.fn(
      async ({
        patientId,
        input,
      }: {
        patientId: string;
        input: TreatmentCreateInput;
        idempotencyKey: string;
      }) => {
        if (world.refuseFields) throw validationError(world.refuseFields);
        if (world.refuseConflict) {
          throw new HttpError('Conflict', 409, '/app/patients/treatments', 'POST', {
            error: {
              code: 'conflict',
              reason: world.refuseConflict,
              detail: 'No sessions left on this package',
            },
          });
        }
        created += 1;
        const { packageId, appointmentId, performedAt, ...fields } = input;
        const spent = world.packages.find((row) => row.id === packageId);
        if (spent) {
          spent.sessionsUsed += 1;
          spent.sessionsLeft -= 1;
        }
        const saved = withFields(
          treatmentRecord({
            id: `trt_new${String(created).padStart(17, '0')}`,
            patientId,
            appointmentId: appointmentId ?? null,
            performedAt: performedAt ?? new Date().toISOString(),
            packageId: spent ? spent.id : null,
            latestCheckIn: null,
          }),
          {
            ...fields,
            offeringId: spent ? spent.offeringId : fields.offeringId,
            sessionNumber: spent ? spent.sessionsUsed : fields.sessionNumber,
          },
        );
        world.treatments = [saved, ...world.treatments];
        return structuredClone(saved);
      },
    ),
    updateTreatment: vi.fn(
      async ({
        treatment,
        fields,
      }: {
        treatment: TreatmentRecord;
        fields: TreatmentFields;
        idempotencyKey: string;
      }) => store(withFields(find(treatment.id), fields)),
    ),
    reverseTreatment: vi.fn(
      async ({
        treatment,
        reason,
      }: {
        treatment: TreatmentRecord;
        reason: string;
        idempotencyKey: string;
      }) => {
        const current = find(treatment.id);
        const spent = world.packages.find((row) => row.id === current.packageId);
        if (spent) {
          spent.sessionsUsed -= 1;
          spent.sessionsLeft += 1;
        }
        return store({
          ...current,
          status: 'reversed',
          reversedReason: reason,
          reversedAt: new Date().toISOString(),
          packageId: null,
        });
      },
    ),
  };
}

/** `patient-packages-api.ts` over the world. */
export function packagesApiDouble(world: TreatmentsWorld) {
  return {
    listPatientPackages: vi.fn(async () => structuredClone(world.packages)),
  };
}
