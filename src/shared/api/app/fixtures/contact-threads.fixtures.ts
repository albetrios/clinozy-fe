import { z } from 'zod';

import {
  appHttpError,
  type FixtureChange,
  recordFixtureChange,
  validateAppInput,
} from '@/shared/api/app/app-fixture-store.ts';
import {
  type Appointment,
  type LeadInterest,
  type Patient,
  phoneSchema,
} from '@/shared/api/app/app-schema.ts';
import type { LeadRecord } from '@/shared/api/app/leads-fixture-contracts.ts';

import { systemLine } from './messages.fixtures.ts';
import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { FIXTURE_VIEWER_ID } from './staff.fixtures.ts';
import { appFixtures } from './world.fixtures.ts';

/**
 * The fixture server's contact threads (Appendix F) — TEST SUPPORT ONLY, like the
 * rest of this folder: the lookup that binds a fixture person to their thread — by
 * id, never by name — and the lookup-or-create the fixture chat opens a patient's
 * first thread with (`chat.fixtures.ts`).
 */

/** What opens the thread — it seeds the first system line. */
const contactThreadContextSchema = z.discriminatedUnion('kind', [
  /** "Appointment #<seq> · <service>"; its service becomes the thread's interest. */
  z.object({ kind: z.literal('appointment'), appointmentId: z.uuid() }),
  /** "Task · <title>" (an appointment task seeds its appointment's line). */
  z.object({ kind: z.literal('task'), taskId: z.uuid() }),
]);
/** What opens a thread. */
type ContactThreadContext = z.infer<typeof contactThreadContextSchema>;

/**
 * The person, by id — their own lead or thread, their patient record, or (for
 * a contact with neither) their mobile. Never by name.
 */
const ensureContactThreadInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    patientId: z.uuid().nullable().default(null),
    leadId: z.uuid().nullable().default(null),
    phone: phoneSchema.nullable().default(null),
    context: contactThreadContextSchema.nullable().default(null),
  })
  .refine(
    (person) =>
      person.patientId !== null || person.leadId !== null || person.phone !== null,
    { message: 'Name the patient, the lead or a mobile number', path: ['phone'] },
  );
/** A lookup-or-create as callers write it. */
export type EnsureContactThreadInput = z.input<typeof ensureContactThreadInputSchema>;

/** The person's thread, and whether this call opened it. */
export interface EnsureContactThreadResult {
  lead: LeadRecord;
  created: boolean;
}

/** Whom to look up: their own lead or thread, their patient record, or their mobile. */
export interface PersonThreadLookup {
  leadId: string | null;
  patientId: string | null;
  phone: string | null;
}

const newestFirst = (a: LeadRecord, b: LeadRecord) =>
  b.updatedAt.localeCompare(a.updatedAt);

/**
 * The person's thread (KICKOFF §6.10 chat binding, D32): the lead the record
 * names; else the patient's own lead (the most recently active), else the
 * patient's contact thread; for a contact with no patient record, a lead or
 * thread on their mobile. Null when they have none yet.
 */
export function findPersonThread(
  leads: readonly LeadRecord[],
  person: PersonThreadLookup,
): LeadRecord | null {
  const live = leads.filter((lead) => lead.deletedAt === null);
  if (person.leadId) {
    const own = live.find((lead) => lead.id === person.leadId);
    if (own) return own;
  }
  if (person.patientId) {
    const mine = live.filter((lead) => lead.patientId === person.patientId);
    return (
      mine.filter((lead) => !lead.isContactThread).sort(newestFirst)[0] ??
      mine.find((lead) => lead.isContactThread) ??
      null
    );
  }
  if (person.phone) {
    const onPhone = live.filter((lead) => lead.phone === person.phone);
    return (
      onPhone.filter((lead) => !lead.isContactThread).sort(newestFirst)[0] ??
      onPhone.find((lead) => lead.isContactThread && lead.patientId === null) ??
      null
    );
  }
  return null;
}

/**
 * The lead interest a booked service stands for — the prototype stored the
 * service label itself (H:4272); the contract keeps `lead_interest` values.
 */
export function interestsForService(service: string): LeadInterest[] {
  const label = service.toLowerCase();
  if (/\blhr\b|laser hair/.test(label)) return ['lhr'];
  if (label.includes('hydrafacial')) return ['hydrafacial'];
  if (label.includes('peel')) return ['peel'];
  if (label.includes('prp')) return ['prp'];
  return ['others'];
}

const fullName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ');

/** The visit a context names (a task's own appointment for a task context). */
function contextVisit(context: ContactThreadContext | null): {
  visit: Appointment | null;
  line: string | null;
} {
  if (!context) return { visit: null, line: null };
  const visitById = (id: string | null) =>
    id
      ? (appFixtures.appointments.snapshot((visit) => visit.id === id)[0] ?? null)
      : null;
  if (context.kind === 'appointment') {
    const visit = visitById(context.appointmentId);
    if (!visit) throw appHttpError(404, 'not_found', 'Appointment not found');
    return { visit, line: `Appointment #${visit.seq} · ${visit.serviceLabel}` };
  }
  const task = appFixtures.tasks.snapshot((row) => row.id === context.taskId)[0];
  if (!task) throw appHttpError(404, 'not_found', 'Task not found');
  const visit = task.sourceType === 'appointment' ? visitById(task.sourceId) : null;
  return {
    visit,
    line: visit
      ? `Appointment #${visit.seq} · ${visit.serviceLabel}`
      : `Task · ${task.title}`,
  };
}

/** The person a new thread is for: their patient record (if any) and the mobile it uses. */
function contactOf(input: { patientId: string | null; phone: string | null }): {
  patient: Patient | undefined;
  phone: string;
} {
  const patient = input.patientId
    ? appFixtures.patients.snapshot((row) => row.id === input.patientId)[0]
    : undefined;
  if (input.patientId && !patient) {
    throw appHttpError(404, 'not_found', 'Patient not found');
  }
  const phone = patient?.phone ?? input.phone;
  if (!phone) {
    throw appHttpError(422, 'validation', 'Add a mobile number to start a chat', {
      phone: ['Add a mobile number to start a chat'],
    });
  }
  return { patient, phone };
}

/**
 * Find the person's thread or open a contact thread for them — one idempotent
 * operation, so opening the same person's task twice never makes a second
 * thread (the prototype did, H:4272). `change` records the writes for Undo.
 */
export async function ensureContactThreadInWorld(
  raw: EnsureContactThreadInput,
  change: FixtureChange = recordFixtureChange(),
): Promise<EnsureContactThreadResult> {
  const input = validateAppInput(ensureContactThreadInputSchema, raw);
  const existing = findPersonThread(appFixtures.leads.snapshot(), input);
  if (existing) return { lead: existing, created: false };

  const { patient, phone } = contactOf(input);
  const { visit, line } = contextVisit(input.context);
  const now = new Date().toISOString();
  const lead = await change.create(appFixtures.leads, {
    name: patient ? fullName(patient) : input.name,
    phone,
    email: null,
    status: null,
    source: null,
    interests: visit ? interestsForService(visit.serviceLabel) : [],
    ownerId: FIXTURE_VIEWER_ID,
    involvedIds: [],
    followUpAt: null,
    branchId: patient?.homeBranchId ?? branchRef(MAIN_BRANCH),
    patientId: input.patientId,
    isContactThread: true,
    kind: 'contact_thread',
    retargetReason: null,
    notes: null,
    customInterests: [],
    touchedAt: now,
    releasedAt: null,
    unreadCount: 0,
  });
  if (line) {
    const taskId = input.context?.kind === 'task' ? input.context.taskId : null;
    await change.create(
      appFixtures.leadMessages,
      systemLine(lead.id, line, taskId, new Date(now)),
    );
  }
  return { lead, created: true };
}
