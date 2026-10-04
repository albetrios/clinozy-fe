import {
  clinicDateOf,
  createdFilterMatches,
  followUpFilterMatches,
} from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CursorPage,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import {
  type DeleteReason,
  PATIENT_CONVERSION_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_TYPE_VALUES,
  type PatientImage,
} from './clinic-schema.ts';
import { civilYearsBetween, clinicToday } from './clinic-time.ts';
import {
  PATIENT_DEFAULTS,
  patientClinicalSchema,
  type PatientCreateInput,
  type PatientCreateResult,
  type PatientFields,
  patientFieldsSchema,
  type PatientListParams,
  patientName,
  type PatientPatch,
  type PatientRecord,
  type PatientRow,
  type PatientSortKey,
  type PatientUpdater,
} from './patients-contracts.ts';
import { createTask } from './tasks-api.ts';

/*
 * The Patients domain's reads and writes (`S:1615–1623`, `S:1640`), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). The world is imported on demand, so its seed data never lands in a
 * route chunk. A row carries what the patient owes and who last saved it
 * (Appendix F: per-row `dueTotal`, `updatedById`).
 */

/** TanStack Query keys for the patients — all under `['clinic', 'patients']`. */
export const patientQueryKeys = {
  all: ['clinic', 'patients'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: () => [...patientQueryKeys.all, 'list'] as const,
  list: (params: PatientListParams) => [...patientQueryKeys.lists(), params] as const,
  detail: (id: string) => [...patientQueryKeys.all, 'detail', id] as const,
  /** The duplicate-mobile lookup of the patient drawer (Q-P7). */
  byPhone: (phone: string, exceptId: string | null) =>
    [...patientQueryKeys.all, 'phone', phone, exceptId] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

/**
 * What a patient's `conversion` is when none is picked: the contract's default
 * and non-null shape (`S:306`) — a nullable one is a backend request (Appendix F).
 */
const CONVERSION_DEFAULT = 'not_converted' satisfies PatientRecord['conversion'];

/** The onboarding task every new patient opens (H:4718 — server-written text, Appendix F). */
const ONBOARDING_TASK = {
  title: 'Onboarding',
  why: 'New patient. Collect consent, DOB and a first photo.',
} as const;

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

// ── Joins (the fixture server's) ──

/** What each patient owes the clinic: Σ due over their invoices, in paise (`S:319`). */
function duesByPatient(world: FixtureWorld): Map<string, number> {
  const payments = world.payments.snapshot();
  const dues = new Map<string, number>();
  for (const invoice of world.invoices.snapshot()) {
    if (!invoice.patientId) continue;
    const { due } = invoiceBalance(invoice, payments);
    if (due > 0) dues.set(invoice.patientId, (dues.get(invoice.patientId) ?? 0) + due);
  }
  return dues;
}

/** Who is in the clinic today: checked in on today's appointment (Q-P4, `S:319`). */
function inClinicToday(world: FixtureWorld, today: string): Set<string> {
  return new Set(
    world.appointments
      .snapshot(
        (appointment) =>
          appointment.date === today &&
          appointment.status === 'checked_in' &&
          appointment.patientId !== null,
      )
      .flatMap((appointment) => (appointment.patientId ? [appointment.patientId] : [])),
  );
}

/** The team, as the "Updated" cell shows a member. */
function updatersById(world: FixtureWorld): Map<string, PatientUpdater> {
  return new Map(
    world.staff.snapshot().map((member) => [
      member.id,
      {
        id: member.id,
        name: [member.firstName, member.lastName].filter(Boolean).join(' '),
        initials: member.initials,
        tone: member.tone,
      },
    ]),
  );
}

/** What every read needs beside the records. */
interface ReadContext {
  today: string;
  dues: Map<string, number>;
  inClinic: Set<string>;
  updaters: Map<string, PatientUpdater>;
}

function readContext(world: FixtureWorld): ReadContext {
  const today = clinicToday();
  return {
    today,
    dues: duesByPatient(world),
    inClinic: inClinicToday(world, today),
    updaters: updatersById(world),
  };
}

function toRow(patient: PatientRecord, context: ReadContext): PatientRow {
  return {
    ...patient,
    dueTotal: context.dues.get(patient.id) ?? 0,
    updatedBy: context.updaters.get(patient.updatedById) ?? null,
  };
}

// ── Search, views, filters and order (the fixture server's) ──

const squeeze = (text: string) => text.toLowerCase().replace(/[\s#()+-]/g, '');

/** Whether a patient matches `q`: their name, mobile or "#3508", spaces and "#" ignored (`S:1619`). */
function matchesSearch(patient: PatientRecord, query: string): boolean {
  const needle = squeeze(query);
  if (!needle) return true;
  return [patientName(patient), patient.phone, patient.phone2 ?? '', String(patient.seq)]
    .map(squeeze)
    .some((field) => field.includes(needle));
}

/**
 * The views (`S:30`, H:4693): in clinic today — checked in today (Q-P4); with
 * dues — anything owed; follow-up due — a follow-up today or past; Recall —
 * Inactive patients (a backend request, Appendix F).
 */
function inView(patient: PatientRecord, params: PatientListParams, context: ReadContext) {
  switch (params.view ?? 'all') {
    case 'today':
      return context.inClinic.has(patient.id);
    case 'dues':
      return (context.dues.get(patient.id) ?? 0) > 0;
    case 'follow':
      return (
        patient.followUpAt !== null && clinicDateOf(patient.followUpAt) <= context.today
      );
    case 'recall':
      return patient.status === 'inactive';
    default:
      return true;
  }
}

/** No filter, or the value is one of those picked. */
const pickedOrAny = <T extends string>(
  picked: readonly T[] | undefined,
  value: T | null,
) => !picked?.length || (value !== null && picked.includes(value));

/** Whether a patient passes the badge and date filters. */
function passesFilters(
  patient: PatientRecord,
  params: PatientListParams,
  today: string,
): boolean {
  const { created, followUp } = params;
  return (
    (!params.types?.length ||
      patient.types.some((type) => params.types?.includes(type))) &&
    pickedOrAny(params.status, patient.status) &&
    pickedOrAny(params.gender, patient.gender) &&
    pickedOrAny(params.conversion, patient.conversion) &&
    (!created || createdFilterMatches(patient.createdAt, created, today)) &&
    (!followUp || followUpFilterMatches(patient.followUpAt, followUp, today))
  );
}

/** An enum value's position — the order its column sorts in; none first. */
const rank = (values: readonly string[], value: string | null | undefined) =>
  value ? values.indexOf(value) : -1;

/** A patient's age in whole years on the clinic's today; 0 without a birth date (H:4694). */
const ageOf = (patient: PatientRecord, today: string) =>
  patient.dateOfBirth ? civilYearsBetween(patient.dateOfBirth, today) : 0;

type Compare = (a: PatientRecord, b: PatientRecord) => number;

/** The sortable columns (`patients.md:30`), and the default `updatedAt` order. */
function columnOrder(key: PatientSortKey | 'default', context: ReadContext): Compare {
  const due = (patient: PatientRecord) => context.dues.get(patient.id) ?? 0;
  const orders: Record<PatientSortKey | 'default', Compare> = {
    seq: (a, b) => a.seq - b.seq,
    name: (a, b) => patientName(a).localeCompare(patientName(b)),
    types: (a, b) =>
      rank(PATIENT_TYPE_VALUES, a.types[0]) - rank(PATIENT_TYPE_VALUES, b.types[0]),
    status: (a, b) =>
      rank(PATIENT_STATUS_VALUES, a.status) - rank(PATIENT_STATUS_VALUES, b.status),
    conversion: (a, b) =>
      rank(PATIENT_CONVERSION_VALUES, a.conversion) -
      rank(PATIENT_CONVERSION_VALUES, b.conversion),
    age: (a, b) => ageOf(a, context.today) - ageOf(b, context.today),
    followUp: (a, b) => compareText(a.followUpAt ?? '', b.followUpAt ?? ''),
    due: (a, b) => due(a) - due(b),
    updated: (a, b) => compareText(a.updatedAt, b.updatedAt),
    default: (a, b) => compareText(a.updatedAt, b.updatedAt),
  };
  return orders[key];
}

/** The order a read asks for: a column, ascending unless `order` says so; else newest first. */
function listOrder(params: PatientListParams, context: ReadContext): Compare {
  const compare = columnOrder(params.sort ?? 'default', context);
  const defaultOrder = params.sort ? 'asc' : 'desc';
  const direction = (params.order ?? defaultOrder) === 'desc' ? -1 : 1;
  return (a, b) => direction * compare(a, b) || b.seq - a.seq;
}

// ── Reads ──

/**
 * One cursor page of patients (`listPatients`, `S:1619`; REPLACE_WITH_API):
 * the view, then the type, status, gender, conversion, created and follow-up
 * filters and `q`; newest `updatedAt` first unless a column sort is asked for
 * (ascending unless `order` says so). Each row carries its dues and last editor.
 */
export async function listPatients(
  params: PatientListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<PatientRow>> {
  const { clinicFixtures } = await fixtureWorld();
  const context = readContext(clinicFixtures);
  const page = await clinicFixtures.patients.list({
    where: (patient) =>
      inView(patient, params, context) &&
      passesFilters(patient, params, context.today) &&
      matchesSearch(patient, params.q ?? ''),
    sort: listOrder(params, context),
    cursor,
  });
  return {
    items: page.items.map((patient) => toRow(patient, context)),
    nextCursor: page.nextCursor,
  };
}

/** One patient (`getPatient`, `S:1629`; REPLACE_WITH_API) — a 404 when unknown or deleted. */
export async function fetchPatient(id: string): Promise<PatientRow> {
  const { clinicFixtures } = await fixtureWorld();
  const patient = await clinicFixtures.patients.get(id);
  return toRow(patient, readContext(clinicFixtures));
}

/**
 * The patient already on a mobile — the drawer's duplicate notice (Q-P7: a
 * lookup that warns rather than blocks, Appendix F). Either of their numbers
 * counts; `exceptId` leaves out the patient being edited.
 */
export async function findPatientByPhone(
  phone: string,
  exceptId: string | null = null,
): Promise<PatientRow | null> {
  const { clinicFixtures } = await fixtureWorld();
  const [match] = clinicFixtures.patients
    .snapshot(
      (patient) =>
        patient.id !== exceptId && (patient.phone === phone || patient.phone2 === phone),
    )
    .sort((a, b) => b.seq - a.seq);
  return match ? toRow(match, readContext(clinicFixtures)) : null;
}

// ── Writes ──

/** Blank text as none, and the contract's `consentGiven` from the Data chip. */
function patientDraft<T extends PatientFields>(fields: T) {
  const blank = (value: string | null) => (value?.trim() ? value.trim() : null);
  return {
    ...fields,
    lastName: blank(fields.lastName),
    address: blank(fields.address),
    referredByName: blank(fields.referredByName),
    notes: blank(fields.notes),
    types: [...new Set(fields.types)],
    consents: [...new Set(fields.consents)],
  };
}

/** Refuse what the contract's server refuses: branches, people and records the clinic doesn't have (422). */
async function checkPatient(fields: PatientFields, exceptId: string | null) {
  const { clinicFixtures } = await fixtureWorld();
  refuseUnknownIds(
    'homeBranchId',
    [fields.homeBranchId],
    clinicFixtures.branches.snapshot(),
    'Pick a branch the clinic has',
  );
  refuseUnknownIds(
    'doctorId',
    fields.doctorId ? [fields.doctorId] : [],
    clinicFixtures.staff.snapshot(),
    'Pick someone on the team',
  );
  refuseUnknownIds(
    'referredByPatientId',
    fields.referredByPatientId ? [fields.referredByPatientId] : [],
    clinicFixtures.patients.snapshot((patient) => patient.id !== exceptId),
    'Pick a patient the clinic has',
  );
  refuseUnknownIds(
    'leadId',
    fields.leadId ? [fields.leadId] : [],
    clinicFixtures.leads.snapshot(),
    'Pick a lead the clinic has',
  );
}

/** The main branch — a new patient's home when none is picked (`S:299`). */
async function mainBranchId(): Promise<string> {
  const { clinicFixtures } = await fixtureWorld();
  const branches = clinicFixtures.branches.snapshot();
  const main = branches.find((branch) => branch.isMain) ?? branches[0];
  if (!main) throw clinicHttpError(422, 'validation', 'Add a branch first');
  return main.id;
}

/**
 * Create a patient (`createPatient`, `S:1623`; REPLACE_WITH_API) from a first
 * name and a mobile plus whatever else is set — the rest from
 * {@link PATIENT_DEFAULTS}, the home branch the main one. A 422 names a broken
 * rule. A mobile already on file never blocks (Q-P7: the drawer warns on
 * blur). The new patient opens an onboarding task for the member who created
 * it, due today (H:4718; an Onboarding task kind, Appendix F).
 */
export async function createPatient(
  input: PatientCreateInput,
): Promise<PatientCreateResult> {
  const { clinicFixtures } = await fixtureWorld();
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const fields = validateClinicInput(
    patientFieldsSchema,
    patientDraft({
      ...PATIENT_DEFAULTS,
      homeBranchId: await mainBranchId(),
      ...definedFields(input),
    } as PatientFields),
  );
  await checkPatient(fields, null);
  const patient = await clinicFixtures.patients.create({
    ...fields,
    conversion: fields.conversion ?? CONVERSION_DEFAULT,
    consentGiven: fields.consents.includes('data'),
    complaints: null,
    diagnosis: null,
    treatmentSuggestions: null,
    futureSuggestions: null,
    updatedById: FIXTURE_VIEWER_ID,
  });
  const onboarding = await createTask({
    title: ONBOARDING_TASK.title,
    why: ONBOARDING_TASK.why,
    ownerId: FIXTURE_VIEWER_ID,
    patientId: patient.id,
    dueAt: new Date().toISOString(),
  });
  return { patient, onboardingTaskId: onboarding.task.id };
}

/**
 * Update a patient (`updatePatient`, `S:1640`; REPLACE_WITH_API): the patch
 * merged into the saved record and the whole checked again — the drawer's
 * fields and the clinical bento's notes. A 404 when it is gone.
 */
export async function updatePatient(
  id: string,
  patch: PatientPatch,
): Promise<PatientRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const saved = await clinicFixtures.patients.get(id);
  const merged = { ...saved, ...definedFields(patch) };
  const fields = validateClinicInput(patientFieldsSchema, patientDraft(merged));
  const clinical = validateClinicInput(patientClinicalSchema, merged);
  await checkPatient(fields, id);
  return clinicFixtures.patients.update(id, {
    ...fields,
    ...clinical,
    conversion: fields.conversion ?? CONVERSION_DEFAULT,
    consentGiven: fields.consents.includes('data'),
    updatedById: FIXTURE_VIEWER_ID,
  });
}

/**
 * Soft-delete a patient with the Reason confirm's choice (`S:1546`;
 * REPLACE_WITH_API) — "Other" needs a note (422). Their records stay.
 */
export async function deletePatient(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PatientRecord> {
  const { clinicFixtures } = await fixtureWorld();
  await clinicFixtures.patients.get(id);
  return clinicFixtures.patients.remove(id, reason, note);
}

/** Restore a deleted patient — the Undo of its "removed" toast (`POST …/restore`, D32). */
export async function restorePatient(id: string): Promise<PatientRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patients.restore(id);
}

/** What an uploaded first photo files: the patient and the storage key the upload tray confirmed. */
export interface PatientPhotoInput {
  patientId: string;
  key: string;
  fileName: string;
}

/**
 * File an uploaded photo on the patient (`uploadImages`, `S:1643`;
 * REPLACE_WITH_API) — "before photos · filed under today’s visit": the General
 * album, attached to their appointment today when there is one.
 */
export async function attachPatientPhoto(
  input: PatientPhotoInput,
): Promise<PatientImage> {
  const { clinicFixtures } = await fixtureWorld();
  await clinicFixtures.patients.get(input.patientId);
  const today = clinicToday();
  const [visit] = clinicFixtures.appointments.snapshot(
    (appointment) =>
      appointment.patientId === input.patientId &&
      appointment.date === today &&
      appointment.status !== 'cancelled',
  );
  return clinicFixtures.patientImages.create({
    patientId: input.patientId,
    appointmentId: visit?.id ?? null,
    album: 'general',
    fileUrl: input.key,
    fileName: input.fileName,
    bodyPart: null,
    takenOn: today,
    caption: null,
  });
}
