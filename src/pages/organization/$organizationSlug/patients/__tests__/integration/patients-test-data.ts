import { vi } from 'vitest';

import { clinicDateOf } from '@/shared/api/clinic/clinic-filter-match.ts';
import { clinicInstant, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  ContactProfile,
  ContactSummary,
} from '@/shared/api/clinic/contacts-contracts.ts';
import type {
  PatientFields,
  PatientListParams,
  PatientPersonInput,
  PatientRecord,
  PatientRow,
} from '@/shared/api/clinic/patients-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { contactHit } from '@/tests/utils/appointment-doubles.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';

/** 10:00 on 3 Oct 2026, clinic time — every Patients room test's "now". */
export const NOW = new Date(clinicInstant('2026-10-03', '10:00'));

/** Dharti Galani, #3508 — Regular, Aesthetic, a follow-up at 2:50 pm today. */
export const DHARTI = patientRecord({
  id: 'pat_dharti000000000000000',
  seq: 3508,
  contactId: 'con_dharti000000000000000',
  firstName: 'Dharti',
  lastName: 'Galani',
  name: 'Dharti Galani',
  phone: '+918200603212',
  phones: [{ phone: '+918200603212', isPrimary: true, isOnWhatsapp: true }],
  gender: 'female',
  dateOfBirth: '1995-10-27',
  status: 'regular',
  types: ['aesthetic'],
  followUpAt: clinicInstant('2026-10-03', '14:50'),
  consents: ['data', 'photos'],
  createdAt: '2026-09-24T09:10:00.000Z',
  updatedAt: clinicInstant('2026-10-03', '09:00'),
});

/** Raam Shah, #3441 — New, Clinical, no follow-up. */
const RAAM = patientRecord({
  id: 'pat_raam00000000000000000',
  seq: 3441,
  contactId: 'con_raam00000000000000000',
  firstName: 'Raam',
  lastName: 'Shah',
  name: 'Raam Shah',
  phone: '+919879521034',
  phones: [{ phone: '+919879521034', isPrimary: true, isOnWhatsapp: true }],
  gender: 'male',
  dateOfBirth: '1988-02-14',
  status: 'new',
  types: ['clinical'],
  createdAt: '2026-09-10T06:00:00.000Z',
  updatedAt: '2026-09-30T06:00:00.000Z',
});

/** Kiran Desai, #3412 — Inactive (Recall), LHR, a follow-up overdue since 28 Sep. */
const KIRAN = patientRecord({
  id: 'pat_kiran0000000000000000',
  seq: 3412,
  contactId: 'con_kiran0000000000000000',
  firstName: 'Kiran',
  lastName: 'Desai',
  name: 'Kiran Desai',
  phone: '+919825044120',
  phones: [{ phone: '+919825044120', isPrimary: true, isOnWhatsapp: true }],
  status: 'inactive',
  types: ['lhr'],
  conversion: 'converted',
  followUpAt: clinicInstant('2026-09-28', '11:00'),
  createdAt: '2026-08-01T06:00:00.000Z',
  updatedAt: '2026-09-28T06:00:00.000Z',
});

/** Meera Joshi, #198 — VIP, Dental, a follow-up next Friday. */
const MEERA = patientRecord({
  id: 'pat_meera0000000000000000',
  seq: 198,
  contactId: 'con_meera0000000000000000',
  firstName: 'Meera',
  lastName: 'Joshi',
  name: 'Meera Joshi',
  phone: '+919099911223',
  phones: [{ phone: '+919099911223', isPrimary: true, isOnWhatsapp: true }],
  status: 'vip',
  types: ['dental'],
  followUpAt: clinicInstant('2026-10-09', '12:00'),
  createdAt: '2026-01-05T06:00:00.000Z',
  updatedAt: '2026-09-01T06:00:00.000Z',
});

/**
 * The clinozy-be a Patients room test runs against: the patients `GET /app/patients` lists
 * (newest first) and the ones removed. Hoist it (`vi.hoisted`) and hand it to the doubles.
 */
export interface PatientsWorld {
  patients: PatientRecord[];
  removed: PatientRecord[];
  /** Set to fail every list read — a dropped connection. */
  listFails: boolean;
}

/** A fresh world: Dharti, Raam, Kiran and Meera, newest first. */
export function seededPatientsWorld(): PatientsWorld {
  return {
    patients: [DHARTI, RAAM, KIRAN, MEERA].map((patient) => structuredClone(patient)),
    removed: [],
    listFails: false,
  };
}

/** A record with the drawer's fields written over it, as the server answers the save. */
function recordWith(base: PatientRecord, fields: PatientFields): PatientRecord {
  const phones = [fields.phone, fields.phone2].filter((phone): phone is string =>
    Boolean(phone),
  );
  return {
    ...base,
    firstName: fields.firstName,
    lastName: fields.lastName,
    name: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
    phone: fields.phone,
    phone2: fields.phone2,
    phones: phones.map((phone, index) => ({
      phone,
      isPrimary: index === 0,
      isOnWhatsapp: true,
    })),
    gender: fields.gender,
    dateOfBirth: fields.dateOfBirth,
    address: fields.address,
    referralSource: fields.referralSource,
    referredByName: fields.referredByName,
    homeBranchId: fields.homeBranchId,
    types: fields.types,
    status: fields.status,
    conversion: fields.conversion ?? 'not_converted',
    followUpAt: fields.followUpAt,
    notes: fields.notes,
    consents: fields.consents,
    hasMarketingConsent: fields.consents.includes('marketing'),
    updatedAt: new Date().toISOString(),
  };
}

/** Whether a patient is in the list's view: everyone, follow-up due (today or before), Recall. */
function inView(patient: PatientRecord, params: PatientListParams): boolean {
  if (params.view === 'follow') {
    return (
      patient.followUpAt !== null && clinicDateOf(patient.followUpAt) <= clinicToday()
    );
  }
  if (params.view === 'recall') return patient.status === 'inactive';
  return true;
}

/** Whether a patient passes the search ("name, mobile or #ID") and the Type, Status and Conversion filters. */
function inFilters(patient: PatientRecord, params: PatientListParams): boolean {
  const q = params.q?.toLowerCase().replace('#', '');
  const matchesQuery =
    !q ||
    patient.name.toLowerCase().includes(q) ||
    patient.phone.includes(q.replaceAll(' ', '')) ||
    String(patient.seq) === q;
  const matchesTypes =
    !params.types?.length || patient.types.some((type) => params.types?.includes(type));
  const matchesStatus = !params.status || patient.status === params.status;
  const matchesConversion =
    !params.conversion || patient.conversion === params.conversion;
  return matchesQuery && matchesTypes && matchesStatus && matchesConversion;
}

/** The list's order for a sort — by #ID or by follow-up (none last); else as stored. */
function sorted(rows: PatientRecord[], params: PatientListParams): PatientRecord[] {
  const direction = params.order === 'desc' ? -1 : 1;
  if (params.sort === 'seq') return [...rows].sort((a, b) => direction * (a.seq - b.seq));
  if (params.sort === 'followUp') {
    return [...rows].sort((a, b) => {
      if (a.followUpAt === b.followUpAt) return 0;
      if (a.followUpAt === null) return 1;
      if (b.followUpAt === null) return -1;
      return direction * a.followUpAt.localeCompare(b.followUpAt);
    });
  }
  return rows;
}

/** A list row: the record without the numbers beyond the primary one. */
function rowOf({ phone2: _phone2, phones: _phones, ...row }: PatientRecord): PatientRow {
  return structuredClone(row);
}

/**
 * `@/shared/api/clinic/patients-api.ts` over a {@link PatientsWorld} — every read answers from
 * it and every write changes it, so a later read shows the write. An unknown id is a 404.
 */
export function patientsApiDouble(world: PatientsWorld) {
  const find = (patientId: string) => {
    const patient = world.patients.find((entry) => entry.id === patientId);
    if (!patient) {
      throw new HttpError('Not found', 404, `/app/patients/${patientId}`, 'GET');
    }
    return patient;
  };
  return {
    listPatients: vi.fn(async (params: PatientListParams, _after?: string) => {
      if (world.listFails) throw new TypeError('Failed to fetch');
      const rows = sorted(
        world.patients.filter(
          (patient) => inView(patient, params) && inFilters(patient, params),
        ),
        params,
      );
      return { rows: rows.map(rowOf), next: null, total: rows.length };
    }),
    fetchPatient: vi.fn(async (patientId: string) => structuredClone(find(patientId))),
    createPatient: vi.fn(
      async ({
        fields,
        person,
      }: {
        fields: PatientFields;
        person: PatientPersonInput;
        idempotencyKey: string;
      }) => {
        const seq = Math.max(...world.patients.map((patient) => patient.seq)) + 1;
        const created = recordWith(
          patientRecord({
            id: `pat_new${String(seq).padStart(18, '0')}`,
            seq,
            contactId:
              person === 'new'
                ? `con_new${String(seq).padStart(18, '0')}`
                : person.contactId,
            consents: [],
            createdAt: new Date().toISOString(),
          }),
          fields,
        );
        world.patients = [created, ...world.patients];
        return structuredClone(created);
      },
    ),
    updatePatient: vi.fn(
      async ({
        record,
        fields,
      }: {
        record: PatientRecord;
        fields: PatientFields;
        idempotencyKey: string;
      }) => {
        const next = recordWith(find(record.id), fields);
        world.patients = world.patients.map((entry) =>
          entry.id === next.id ? next : entry,
        );
        return structuredClone(next);
      },
    ),
    deletePatient: vi.fn(
      async ({
        patientId,
      }: {
        patientId: string;
        reason: string;
        note: string | null;
      }) => {
        world.removed.push(find(patientId));
        world.patients = world.patients.filter((entry) => entry.id !== patientId);
      },
    ),
    restorePatient: vi.fn(async (patientId: string, _idempotencyKey: string) => {
      const patient = world.removed.find((entry) => entry.id === patientId);
      if (!patient) {
        throw new HttpError('Not found', 404, `/app/patients/${patientId}`, 'POST');
      }
      world.removed = world.removed.filter((entry) => entry.id !== patientId);
      world.patients = [...world.patients, patient].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return structuredClone(patient);
    }),
  };
}

/**
 * `@/shared/api/clinic/contacts-api.ts`'s duplicate-number check over a {@link PatientsWorld}:
 * the person on a number is the patient's, with their file.
 */
export function contactsApiDouble(world: PatientsWorld) {
  return {
    findContactByPhone: vi.fn(
      async (phone: string): Promise<(ContactSummary & ContactProfile) | null> => {
        const patient = world.patients.find((entry) => entry.phone === phone);
        if (!patient) return null;
        return {
          ...contactHit({
            id: patient.contactId,
            contactNumber: patient.contactNumber,
            firstName: patient.firstName,
            lastName: patient.lastName,
            name: patient.name,
            primaryPhone: patient.phone,
            patientId: patient.id,
            openLeadId: null,
          }),
          ...EMPTY_CONTACT_PROFILE,
          patientNumber: patient.seq,
        };
      },
    ),
  };
}
