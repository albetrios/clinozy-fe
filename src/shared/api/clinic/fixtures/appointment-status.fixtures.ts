import type { AppointmentRecord } from '@/shared/api/clinic/appointments-fixture-contracts.ts';
import type {
  CreateInput,
  FixtureChange,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  AppointmentStatus,
  CancelReason,
  LeadStatus,
} from '@/shared/api/clinic/clinic-schema.ts';
import { LEAD_CLOSED_STATUSES } from '@/shared/api/clinic/leads-fixture-contracts.ts';

import { systemLine } from './messages.fixtures.ts';
import { clinicFixtures } from './world.fixtures.ts';

const CLOSED: ReadonlySet<LeadStatus> = new Set(LEAD_CLOSED_STATUSES);

/**
 * The fixture server's status writes (REPLACE_WITH_API): a booking's new
 * status with the record effects it brings (`APPOINTMENT_STATUS_EFFECTS`) —
 * the check-in and completion stamps, a cancel's reason and note, a fresh
 * confirm request on Scheduled, and every open lead of the person moved to
 * Clinic visited with a system line (`S:1610`, H:6047). Every write lands in
 * `change`, so one Undo takes the status and its effects back. The
 * appointments server and the tasks server's outcome effects both write here.
 */

/** When the status changes, and — for a cancel — why. */
export interface AppointmentStatusWrite {
  now: Date;
  cancelReason?: CancelReason;
  cancelNote?: string | null;
}

type AppointmentWrite = Partial<CreateInput<AppointmentRecord>>;

/** The record effects of arriving at `status`. */
function statusPatch(
  visit: AppointmentRecord,
  status: AppointmentStatus,
  write: AppointmentStatusWrite,
): AppointmentWrite {
  const stamp = write.now.toISOString();
  switch (status) {
    case 'scheduled':
      // New, moved, restored or un-confirmed: the slot is held again and the
      // confirm request goes out afresh.
      return {
        status,
        cancelReason: null,
        cancelNote: null,
        reminder: null,
        repliedYes: false,
      };
    case 'checked_in':
      return { status, checkedInAt: visit.checkedInAt ?? stamp };
    case 'completed':
      return { status, checkedInAt: visit.checkedInAt ?? stamp, completedAt: stamp };
    case 'cancelled':
      return {
        status,
        cancelReason: write.cancelReason ?? 'other',
        cancelNote: write.cancelNote?.trim() || null,
      };
    default:
      return { status };
  }
}

/**
 * The person's open leads — their own (or the booking's) and those linked to
 * their patient record, never a contact thread, never a closed one.
 */
function openLeadsOf(visit: AppointmentRecord) {
  return clinicFixtures.leads.snapshot(
    (lead) =>
      !lead.isContactThread &&
      (lead.id === visit.leadId ||
        (visit.patientId !== null && lead.patientId === visit.patientId)) &&
      (lead.status === null || !CLOSED.has(lead.status)),
  );
}

/** "Status → Clinic visited · checked in for appointment #2847" (H:6047). */
function visitedLine(visit: AppointmentRecord): string {
  const how = visit.status === 'completed' ? 'completed' : 'checked in';
  return `Status → Clinic visited · ${how} for appointment #${visit.seq}`;
}

async function moveLeadsToVisited(
  change: FixtureChange,
  visit: AppointmentRecord,
  now: Date,
): Promise<void> {
  for (const lead of openLeadsOf(visit)) {
    await change.update(clinicFixtures.leads, lead.id, { status: 'clinic_visited' });
    await change.create(
      clinicFixtures.leadMessages,
      systemLine(lead.id, visitedLine(visit), null, now),
    );
  }
}

/**
 * Write a booking's new status and its record effects into `change`; answers
 * the saved record. No guard runs here — each caller checks its own rules
 * first (the status machine for the appointments server, a task rule's
 * outcome for the tasks server).
 */
export async function writeAppointmentStatus(
  change: FixtureChange,
  visit: AppointmentRecord,
  status: AppointmentStatus,
  write: AppointmentStatusWrite,
): Promise<AppointmentRecord> {
  const saved = await change.update(
    clinicFixtures.appointments,
    visit.id,
    statusPatch(visit, status, write),
  );
  if (status === 'checked_in' || status === 'completed') {
    await moveLeadsToVisited(change, saved, write.now);
  }
  return saved;
}
