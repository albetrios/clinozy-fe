import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import type { CreatedFilter, FollowUpFilter } from './clinic-list-filters.ts';
import {
  type Gender,
  PATIENT_CONVERSION_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_TYPE_VALUES,
  type PatientConversion,
  type PatientStatus,
  type PatientType,
  type ReferralSource,
} from './clinic-schema.ts';
import type {
  ApiContactChange,
  ApiContactCreate,
  Contact,
  ContactProfile,
  ContactSummary,
} from './contacts-contracts.ts';

/*
 * The Patients domain on clinozy-be (`/app/patients`, api-integration §5.4). A patient file
 * keeps the clinical side — the types, status, conversion, home branch, doctor, follow-up,
 * consents and notes — and points at its person with `contact_id`; the name, the numbers, the
 * gender, the birth date, the address and the referral are the contact's (§3). The rooms read
 * the two together, flattened, so a row renders from one object.
 */

// ── The wire ──

type ApiPatient = NonNullable<ApiData<'/app/patients/{patient_id}', 'get'>>;
type ApiPatientRow = NonNullable<ApiData<'/app/patients', 'get'>>[number];
/** A new patient as `POST /app/patients` takes it. */
export type ApiPatientCreate = NonNullable<ApiBody<'/app/patients', 'post'>>;
/** A patient change as `PATCH /app/patients/:patient_id` takes it. */
export type ApiPatientChange = NonNullable<
  ApiBody<'/app/patients/{patient_id}', 'patch'>
>;

const patientFieldsWire = {
  id: z.string(),
  patient_number: z.number().int(),
  contact_id: z.string(),
  home_branch_id: z.string(),
  types: z.array(z.enum(PATIENT_TYPE_VALUES)),
  status: z.enum(PATIENT_STATUS_VALUES),
  conversion: z.enum(PATIENT_CONVERSION_VALUES),
  doctor_membership_id: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  notes: z.string().nullable(),
  lead_id: z.string().nullable(),
  has_data_consent: z.boolean(),
  has_photo_consent: z.boolean(),
  allergies: z.array(z.string()),
  contraindications: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One patient (`GET /app/patients/:patient_id`). */
export const patientWire = wireSchema<ApiPatient>()(z.object(patientFieldsWire));

/** A patients list row (`GET /app/patients`). */
export const patientRowWire = wireSchema<ApiPatientRow>()(z.object(patientFieldsWire));

// ── The rooms' shapes ──

/** The consent chips the drawer offers — Data and Photos are the file's, Marketing the person's. */
export const PATIENT_CONSENT_VALUES = ['data', 'photos', 'marketing'] as const;

/** One consent the patient signed. */
export type PatientConsent = (typeof PATIENT_CONSENT_VALUES)[number];

/** The patient file's own fields, as clinozy-be keeps them. */
interface PatientFileFields {
  /** The patient's id (`pat_…`). */
  id: string;
  /** "#3508" is this number. */
  seq: number;
  contactId: string;
  homeBranchId: string;
  types: PatientType[];
  status: PatientStatus;
  conversion: PatientConversion;
  /** Their doctor's membership id. */
  doctorId: string | null;
  followUpAt: string | null;
  notes: string | null;
  /** The lead they came from. */
  leadId: string | null;
  allergies: string[];
  contraindications: string[];
  createdAt: string;
  /** What a file change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** The person a patient is, from their contact (the file's number is the record's `seq`). */
export interface PatientPerson extends Omit<ContactProfile, 'patientNumber'> {
  contactNumber: number;
  firstName: string;
  lastName: string | null;
  /** "Priya Shah". */
  name: string;
  /** The primary number, E.164. */
  phone: string;
  email: string | null;
  /** Data and Photos from the file, Marketing from the person. */
  consents: PatientConsent[];
  /** Their last message is newer than ours — the Activity dot. */
  isAwaitingReply: boolean;
  /** What a person change sends back as `expected_updated_at`. */
  contactUpdatedAt: string;
}

/** A Patients list row: the file and the person, with the primary number. */
export interface PatientRow extends PatientFileFields, PatientPerson {}

/** One patient as the file reads them: the row with every number. */
export interface PatientRecord extends PatientRow {
  /** The second number, if any — the drawer's "Mobile 2". */
  phone2: string | null;
  /** Every number, the primary first. */
  phones: Contact['phones'];
}

/** A patient's full name as every room shows it: "Priya Shah", or the first name alone. */
export function patientName(patient: Pick<PatientPerson, 'firstName' | 'lastName'>) {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
}

/** The file's fields from the wire. */
function toFileFields(row: z.output<typeof patientRowWire>): PatientFileFields {
  return {
    id: row.id,
    seq: row.patient_number,
    contactId: row.contact_id,
    homeBranchId: row.home_branch_id,
    types: row.types,
    status: row.status,
    conversion: row.conversion,
    doctorId: row.doctor_membership_id,
    followUpAt: row.follow_up_at,
    notes: row.notes,
    leadId: row.lead_id,
    allergies: row.allergies,
    contraindications: row.contraindications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The consents a file and its person hold, in the chips' order. */
function consentsOf(
  row: Pick<z.output<typeof patientRowWire>, 'has_data_consent' | 'has_photo_consent'>,
  person: Pick<ContactProfile, 'hasMarketingConsent'> | null,
): PatientConsent[] {
  const held: Record<PatientConsent, boolean> = {
    data: row.has_data_consent,
    photos: row.has_photo_consent,
    marketing: person?.hasMarketingConsent ?? false,
  };
  return PATIENT_CONSENT_VALUES.filter((consent) => held[consent]);
}

/** A person the join could not read (a contact gone since) — the row keeps its number. */
const UNKNOWN_PERSON: Omit<PatientPerson, 'consents'> = {
  contactNumber: 0,
  firstName: '',
  lastName: null,
  name: '',
  phone: '',
  email: null,
  gender: null,
  dateOfBirth: null,
  address: null,
  referralSource: null,
  referredByContactId: null,
  referredByName: null,
  hasMarketingConsent: false,
  isAwaitingReply: false,
  contactUpdatedAt: '',
};

/** A contact as a patient's person. */
function personOf(
  contact: (ContactSummary & ContactProfile) | null,
): Omit<PatientPerson, 'consents'> {
  if (!contact) return UNKNOWN_PERSON;
  return {
    contactNumber: contact.contactNumber,
    firstName: contact.firstName,
    lastName: contact.lastName,
    name: contact.name,
    phone: contact.primaryPhone,
    email: contact.email,
    gender: contact.gender,
    dateOfBirth: contact.dateOfBirth,
    address: contact.address,
    referralSource: contact.referralSource,
    referredByContactId: contact.referredByContactId,
    referredByName: contact.referredByName,
    hasMarketingConsent: contact.hasMarketingConsent,
    isAwaitingReply: contact.isAwaitingReply,
    contactUpdatedAt: contact.updatedAt,
  };
}

/** A list row with its person (null when the contact could not be read). */
export function toPatientRow(
  row: z.output<typeof patientRowWire>,
  contact: (ContactSummary & ContactProfile) | null,
): PatientRow {
  return {
    ...toFileFields(row),
    ...personOf(contact),
    consents: consentsOf(row, contact),
  };
}

/** One patient with their person and every number. */
export function toPatientRecord(
  row: z.output<typeof patientWire>,
  contact: Contact,
): PatientRecord {
  const secondary = contact.phones.find((entry) => !entry.isPrimary);
  return {
    ...toPatientRow(row, contact),
    phone2: secondary?.phone ?? null,
    phones: contact.phones,
  };
}

// ── Writes ──

/**
 * Everything the patient drawer writes: the person's fields (the contact) and the file's. A
 * missing conversion saves as the API's default, Not converted.
 */
export interface PatientFields {
  firstName: string;
  lastName: string | null;
  /** E.164. */
  phone: string;
  /** E.164, or none. */
  phone2: string | null;
  gender: Gender | null;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  address: string | null;
  referralSource: ReferralSource | null;
  referredByName: string | null;
  homeBranchId: string;
  types: PatientType[];
  status: PatientStatus;
  conversion: PatientConversion | null;
  followUpAt: string | null;
  notes: string | null;
  consents: PatientConsent[];
}

/** Who a new patient is: someone the clinic already knows (a lead's person), or a new person. */
export type PatientPersonInput = { contactId: string } | 'new';

/** The person's part of the drawer's fields as the contact routes take it. */
function personBodyOf(
  fields: PatientFields,
  phones: ApiContactCreate['phones'],
): Omit<ApiContactCreate, 'phones'> & { phones: ApiContactCreate['phones'] } {
  return {
    first_name: fields.firstName,
    last_name: fields.lastName,
    phones,
    gender: fields.gender,
    date_of_birth: fields.dateOfBirth,
    address: fields.address,
    referral_source: fields.referralSource,
    referred_by_name: fields.referredByName,
    has_marketing_consent: fields.consents.includes('marketing'),
  };
}

/** The file's part of the drawer's fields as the patient routes take it. */
function fileBodyOf(fields: PatientFields) {
  return {
    home_branch_id: fields.homeBranchId,
    types: fields.types,
    status: fields.status,
    conversion: fields.conversion ?? ('not_converted' as const),
    follow_up_at: fields.followUpAt,
    notes: fields.notes,
    has_data_consent: fields.consents.includes('data'),
    has_photo_consent: fields.consents.includes('photos'),
  } satisfies ApiPatientChange;
}

/** A new patient as `POST /app/patients` takes it — on their known contact, or a new one. */
export function patientCreateBodyOf(
  fields: PatientFields,
  person: PatientPersonInput,
): ApiPatientCreate {
  if (person !== 'new') return { contact_id: person.contactId, ...fileBodyOf(fields) };
  const phones = [fields.phone, fields.phone2]
    .filter((phone): phone is string => Boolean(phone))
    .map((phone, index) => ({ phone, is_primary: index === 0, is_on_whatsapp: true }));
  return { contact: personBodyOf(fields, phones), ...fileBodyOf(fields) };
}

/** Whether any pair differs — what each half of an edit compares, value by value. */
const anyChanged = (pairs: ReadonlyArray<readonly [unknown, unknown]>) =>
  pairs.some(([next, saved]) => next !== saved);

/**
 * The person's numbers after an edit: the drawer's two first (the first primary), then any others
 * they had, each keeping whether it is on WhatsApp (a new number is).
 */
function editedPhones(record: PatientRecord, fields: PatientFields) {
  const kept = record.phones.filter(
    (entry) => entry.phone !== record.phone && entry.phone !== record.phone2,
  );
  const whatsapp = (phone: string) =>
    record.phones.find((entry) => entry.phone === phone)?.isOnWhatsapp ?? true;
  const edited = [fields.phone, fields.phone2].filter((phone): phone is string =>
    Boolean(phone),
  );
  return [...edited, ...kept.map((entry) => entry.phone)].map((phone, index) => ({
    phone,
    is_primary: index === 0,
    is_on_whatsapp: whatsapp(phone),
  }));
}

/**
 * An edit as the two writes it makes — the file's change and the person's — each null when
 * nothing of it changed. The drawer edits the first two numbers; any others stay, after them.
 */
export function patientChangeOf(
  record: PatientRecord,
  fields: PatientFields,
): { file: ApiPatientChange | null; person: ApiContactChange | null } {
  const file = fileBodyOf(fields);
  const fileChanged = anyChanged([
    [file.home_branch_id, record.homeBranchId],
    [file.types.join(), record.types.join()],
    [file.status, record.status],
    [file.conversion, record.conversion],
    [file.follow_up_at, record.followUpAt],
    [file.notes, record.notes],
    [file.has_data_consent, record.consents.includes('data')],
    [file.has_photo_consent, record.consents.includes('photos')],
  ]);
  const person = personBodyOf(fields, editedPhones(record, fields));
  const personChanged = anyChanged([
    [person.first_name, record.firstName],
    [person.last_name, record.lastName],
    [fields.phone, record.phone],
    [fields.phone2, record.phone2],
    [person.gender, record.gender],
    [person.date_of_birth, record.dateOfBirth],
    [person.address, record.address],
    [person.referral_source, record.referralSource],
    [person.referred_by_name, record.referredByName],
    [person.has_marketing_consent, record.hasMarketingConsent],
  ]);
  return { file: fileChanged ? file : null, person: personChanged ? person : null };
}

// ── List reads ──

/**
 * The list's views: everyone; follow-up due (today or before); Recall (status Inactive). The
 * design's In clinic today and With dues go — the API has no filter for either (G4, Q22).
 */
export const PATIENT_VIEW_VALUES = ['all', 'follow', 'recall'] as const;

/** One list view. */
export type PatientView = (typeof PATIENT_VIEW_VALUES)[number];

/**
 * The sortable columns as the API sorts them: ID (`patient_number`) and Follow-up
 * (`follow_up_at`). Without one the list runs newest first (`created_at`).
 */
export const PATIENT_SORT_KEYS = ['seq', 'followUp'] as const;

/** One sortable column. */
export type PatientSortKey = (typeof PATIENT_SORT_KEYS)[number];

/** The list read's params, from the URL. The status and the conversion take one value each. */
export interface PatientListParams {
  view?: PatientView;
  q?: string;
  types?: PatientType[];
  status?: PatientStatus;
  conversion?: PatientConversion;
  created?: CreatedFilter;
  followUp?: FollowUpFilter;
  sort?: PatientSortKey;
  order?: 'asc' | 'desc';
}
