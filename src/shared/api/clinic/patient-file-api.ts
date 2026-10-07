import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';

import { compareText } from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import { clinicToday } from './clinic-time.ts';
import type {
  PatientFile,
  PatientFileCounts,
  PatientFileFeedback,
  PatientNextVisit,
} from './patient-file-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's read (`getPatient` with its rail facts, `S:1629`), on the
 * fixture world until clinozy-be serves it — REPLACE_WITH_API (D6). The world
 * is imported on demand, so its seed data never lands in a route chunk.
 */

/**
 * TanStack Query keys for the file's read — under the patients' key, so every
 * patient write (the Edit drawer, a record saved from the file) refreshes it.
 */
export const patientFileQueryKeys = {
  all: [...patientQueryKeys.all, 'file'] as const,
  detail: (patientId: string) => [...patientFileQueryKeys.all, patientId] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const threadFixtures = () => import('./fixtures/contact-threads.fixtures.ts');
const fileFixtures = () => import('./fixtures/patient-file.fixtures.ts');

type World = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** The statuses a visit still to come can have — not closed, not cancelled. */
const UPCOMING = new Set(['scheduled', 'confirmed', 'checked_in']);

/** Their next visit: the earliest booking from today on that is still to happen. */
function nextVisitOf(
  world: World,
  patientId: string,
  today: string,
): PatientNextVisit | null {
  const [next] = world.appointments
    .snapshot(
      (appointment) =>
        appointment.patientId === patientId &&
        appointment.date >= today &&
        UPCOMING.has(appointment.status),
    )
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.startTime, b.startTime));
  return next
    ? {
        appointmentId: next.id,
        date: next.date,
        startTime: next.startTime,
        serviceLabel: next.serviceLabel,
        durationMin: next.durationMin,
      }
    : null;
}

/** What they owe across their open invoices (paise) and the oldest open invoice's date. */
function duesOf(world: World, patientId: string) {
  const payments = world.payments.snapshot();
  let due = 0;
  let since: string | null = null;
  for (const invoice of world.invoices.snapshot((row) => row.patientId === patientId)) {
    const balance = invoiceBalance(invoice, payments);
    if (balance.due === 0) continue;
    due += balance.due;
    if (since === null || invoice.date < since) since = invoice.date;
  }
  return { due, since };
}

/** The latest check-in's feel and score, else the latest review, and the totals. */
function feedbackOf(world: World, patientId: string): PatientFileFeedback {
  const newest = <T extends { date: string; createdAt: string }>(rows: T[]) =>
    [...rows].sort(
      (a, b) => compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt),
    );
  const checkIns = newest(world.checkIns.snapshot((row) => row.patientId === patientId));
  const reviews = newest(world.reviews.snapshot((row) => row.patientId === patientId));
  const [checkIn] = checkIns;
  const [review] = reviews;
  return {
    feel: checkIn?.feel ?? null,
    score: checkIn?.score ?? null,
    review: review ? { source: review.source, rating: review.rating } : null,
    checkIns: checkIns.length,
    reviews: reviews.length,
  };
}

/** How many records each section holds; Overview and Clinical notes count none (never "Empty"). */
function countsOf(world: World, patientId: string): PatientFileCounts {
  const mine = (row: { patientId: string | null }) => row.patientId === patientId;
  const counts = Object.fromEntries(
    PATIENT_FILE_SECTIONS.map((section) => [section, 0]),
  ) as PatientFileCounts;
  counts.visits = world.appointments.snapshot(mine).length;
  counts.prescriptions = world.prescriptions.snapshot(mine).length;
  counts.treatments = world.treatments.snapshot(mine).length;
  counts.images = world.patientImages.snapshot(mine).length;
  counts.reports = world.patientReports.snapshot(mine).length;
  counts.invoices = world.invoices.snapshot(mine).length;
  counts.payments = world.payments.snapshot(mine).length;
  counts.packages = world.patientPackages.snapshot(mine).length;
  counts.notes = world.patientNotes.snapshot(mine).length;
  return counts;
}

/**
 * One patient's file (`getPatient`, `S:1629`; REPLACE_WITH_API): the record
 * and the rail facts — a 404 when the patient is unknown or deleted. Their
 * thread is the one the chat column reads (their lead, or the contact thread
 * their first message opened, Q-F6).
 */
export async function fetchPatientFile(patientId: string): Promise<PatientFile> {
  const [
    { clinicFixtures: world },
    { findPersonThread },
    { patientInstagram, patientLanguage },
  ] = await Promise.all([fixtureWorld(), threadFixtures(), fileFixtures()]);
  const patient = await world.patients.get(patientId);
  const lead = patient.leadId
    ? (world.leads.snapshot((row) => row.id === patient.leadId)[0] ?? null)
    : null;
  const thread = findPersonThread(world.leads.snapshot(), {
    leadId: null,
    patientId,
    phone: null,
  });
  const { due, since } = duesOf(world, patientId);
  const credits = world.pendingCredits.snapshot(
    (row) =>
      row.patientId === patientId && row.direction === 'give' && row.status === 'open',
  );
  return {
    patient,
    leadPhone:
      lead && lead.phone !== patient.phone && lead.phone !== patient.phone2
        ? lead.phone
        : null,
    instagram: patientInstagram(patient.seq),
    language: patientLanguage(patient.seq),
    nextVisit: nextVisitOf(world, patientId, clinicToday()),
    due,
    dueSince: since,
    credit: credits.length
      ? {
          amount: credits.reduce((sum, row) => sum + row.amount, 0),
          reasons: credits.map((row) => row.reason),
        }
      : null,
    feedback: feedbackOf(world, patientId),
    counts: countsOf(world, patientId),
    unread: thread?.unreadCount ?? 0,
  };
}
