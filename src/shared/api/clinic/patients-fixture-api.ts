import {
  clinicDateOf,
  createdFilterMatches,
  followUpFilterMatches,
} from './clinic-filter-match.ts';
import { compareText, type CursorPage } from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import {
  PATIENT_CONVERSION_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_TYPE_VALUES,
} from './clinic-schema.ts';
import { civilYearsBetween, clinicToday } from './clinic-time.ts';
import {
  type PatientListParams,
  patientName,
  type PatientRecord,
  type PatientRow,
  type PatientSortKey,
  type PatientUpdater,
} from './patients-fixture-contracts.ts';

/*
 * The fixture patients the rooms still on fixtures read (Payments, Medical, Tasks) — the list
 * and one patient (`S:1619`, `S:1629`); the Patients room itself reads clinozy-be
 * (`patients-api.ts`, D152). Every call is REPLACE_WITH_API (D6). The world is imported on
 * demand, so its seed data never lands in a route chunk. A row carries what the patient owes and
 * who last saved it (Appendix F: per-row `dueTotal`, `updatedById`).
 */

/**
 * TanStack Query keys for the fixture patients the rooms still on fixtures read (Payments,
 * Medical, Tasks) — all under `['clinic', 'fixture-patients']`, apart from clinozy-be's.
 */
export const fixturePatientQueryKeys = {
  all: ['clinic', 'fixture-patients'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: () => [...fixturePatientQueryKeys.all, 'list'] as const,
  list: (params: PatientListParams) =>
    [...fixturePatientQueryKeys.lists(), params] as const,
  detail: (id: string) => [...fixturePatientQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

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
