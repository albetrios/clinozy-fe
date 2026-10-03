import {
  clinicHttpError,
  type FixtureChange,
  recordFixtureChange,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  Appointment,
  Lead,
  LeadInterest,
  Patient,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  type ContactThreadContext,
  type EnsureContactThreadInput,
  ensureContactThreadInputSchema,
  type EnsureContactThreadResult,
} from '@/shared/api/clinic/contact-threads-api.ts';

import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { FIXTURE_VIEWER_ID } from './staff.fixtures.ts';
import { clinicFixtures } from './world.fixtures.ts';

/**
 * The fixture server's contact threads (REPLACE_WITH_API, Appendix F): the
 * lookup that binds a person to their thread — by id, never by name — and the
 * lookup-or-create behind `ensureContactThread`.
 */

/** Whom to look up: their own lead or thread, their patient record, or their mobile. */
export interface PersonThreadLookup {
  leadId: string | null;
  patientId: string | null;
  phone: string | null;
}

const newestFirst = (a: Lead, b: Lead) => b.updatedAt.localeCompare(a.updatedAt);

/**
 * The person's thread (KICKOFF §6.10 chat binding, D32): the lead the record
 * names; else the patient's own lead (the most recently active), else the
 * patient's contact thread; for a contact with no patient record, a lead or
 * thread on their mobile. Null when they have none yet.
 */
export function findPersonThread(
  leads: readonly Lead[],
  person: PersonThreadLookup,
): Lead | null {
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
      ? (clinicFixtures.appointments.snapshot((visit) => visit.id === id)[0] ?? null)
      : null;
  if (context.kind === 'appointment') {
    const visit = visitById(context.appointmentId);
    if (!visit) throw clinicHttpError(404, 'not_found', 'Appointment not found');
    return { visit, line: `Appointment #${visit.seq} · ${visit.serviceLabel}` };
  }
  const task = clinicFixtures.tasks.snapshot((row) => row.id === context.taskId)[0];
  if (!task) throw clinicHttpError(404, 'not_found', 'Task not found');
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
    ? clinicFixtures.patients.snapshot((row) => row.id === input.patientId)[0]
    : undefined;
  if (input.patientId && !patient) {
    throw clinicHttpError(404, 'not_found', 'Patient not found');
  }
  const phone = patient?.phone ?? input.phone;
  if (!phone) {
    throw clinicHttpError(422, 'validation', 'Add a mobile number to start a chat', {
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
  const input = validateClinicInput(ensureContactThreadInputSchema, raw);
  const existing = findPersonThread(clinicFixtures.leads.snapshot(), input);
  if (existing) return { lead: existing, created: false };

  const { patient, phone } = contactOf(input);
  const { visit, line } = contextVisit(input.context);
  const now = new Date().toISOString();
  const lead = await change.create(clinicFixtures.leads, {
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
  });
  if (line) {
    await change.create(clinicFixtures.leadMessages, {
      leadId: lead.id,
      channel: 'note',
      direction: 'sent',
      body: line,
      deliveryStatus: 'sent',
      isSystem: true,
      authorId: null,
      taskId: input.context?.kind === 'task' ? input.context.taskId : null,
      sentAt: now,
    });
  }
  return { lead, created: true };
}
