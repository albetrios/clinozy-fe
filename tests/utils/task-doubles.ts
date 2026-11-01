/**
 * Test data for the Tasks room on clinozy-be (`/app/tasks`): a task as the API answers it — the
 * local stack's "Reply to Anaya" rule task and the patient Kavya Mehta's people — and the same as
 * the rooms read it (`TaskRecord`, `TaskRow`, `TaskPerson`). Today's work queue, still on
 * fixtures, reads `task-row-fixture.ts` instead.
 */
import type {
  TaskPerson,
  TaskRecord,
  TaskRow,
} from '@/shared/api/app/tasks-contracts.ts';

/** The rule task's id on the local stack ("Reply to Anaya"). */
export const TEST_TASK_ID = 'task_h7etxlhnxwzy1e2dxrins';
/** Anaya Desai, a lead's person. */
export const TEST_TASK_CONTACT_ID = 'con_8hb15isod6txlpljrn1f7';
/** Anaya's open lead — the task's link. */
export const TEST_TASK_LEAD_ID = 'lead_hplz5ew0h3tw99ntqf39w';
/** The front desk member the tests sign in as. */
export const TEST_TASK_MEMBER_ID = 'mem_yls33gz5jj66ful8q4ads';

/** A task as clinozy-be answers it — an open reply task in the front desk's queue — with `patch` on top. */
export function taskWireRow(patch: Record<string, unknown> = {}) {
  return {
    id: TEST_TASK_ID,
    kind: 'rule',
    rule_key: 'reply',
    title: 'Reply to Anaya',
    why: 'Their message is waiting for a reply',
    owner_membership_id: null,
    owner_role: 'front_desk',
    contact: {
      id: TEST_TASK_CONTACT_ID,
      name: 'Anaya Desai',
      primary_phone: '+919826005869',
      preference_tags: [],
    },
    lead_id: TEST_TASK_LEAD_ID,
    appointment_id: null,
    patient_treatment_id: null,
    patient_check_in_id: null,
    patient_review_id: null,
    invoice_id: null,
    pending_credit_id: null,
    medical_rep_id: null,
    branch_id: 'brn_53j4b7hz7nfb0otr2d920',
    due_at: '2026-10-09T20:31:53.787Z',
    status: 'open',
    snoozed_until: null,
    snooze_label: null,
    outcome: null,
    result_text: null,
    note: null,
    resolved_at: null,
    is_resolved_automatically: false,
    resolved_by_membership_id: null,
    priority: 'high',
    owner_changes: [],
    can_clinozy_handle: false,
    next_task_id: null,
    created_at: '2026-10-09T20:05:00.130Z',
    updated_at: '2026-10-09T20:05:00.130Z',
    ...patch,
  };
}

/** Anaya's person as `GET /app/contacts?ids=` answers a row — an open lead, no patient file. */
export function taskContactWireRow(patch: Record<string, unknown> = {}) {
  return {
    id: TEST_TASK_CONTACT_ID,
    contact_number: 9,
    first_name: 'Anaya',
    last_name: 'Desai',
    gender: null,
    date_of_birth: null,
    date_of_birth_is_approximate: false,
    age: null,
    primary_phone: '+919826005869',
    email: null,
    address: null,
    instagram_handles: [],
    default_channel: 'whatsapp',
    preference_tags: [],
    has_marketing_consent: false,
    referral_source: null,
    referred_by_contact_id: null,
    referred_by_name: null,
    patient_id: null,
    patient_number: null,
    open_lead_id: TEST_TASK_LEAD_ID,
    last_activity_at: '2026-10-09T20:01:53.787Z',
    last_received_at: '2026-10-09T20:01:53.787Z',
    is_awaiting_reply: true,
    updated_at: '2026-10-09T20:01:53.622Z',
    ...patch,
  };
}

/** The reply task as the rooms read it, with `patch` on top. */
export function taskRecord(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: TEST_TASK_ID,
    kind: 'rule',
    ruleKey: 'reply',
    type: 'reply',
    title: 'Reply to Anaya',
    why: 'Their message is waiting for a reply',
    ownerId: null,
    ownerRole: 'front_desk',
    contact: {
      id: TEST_TASK_CONTACT_ID,
      name: 'Anaya Desai',
      phone: '+919826005869',
      preferenceTags: [],
    },
    link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
    branchId: 'brn_53j4b7hz7nfb0otr2d920',
    dueAt: '2026-10-09T20:31:53.787Z',
    status: 'open',
    snoozedUntil: null,
    snoozeLabel: null,
    outcome: null,
    resultText: null,
    note: null,
    resolvedAt: null,
    isResolvedAutomatically: false,
    resolvedById: null,
    priority: 'high',
    ownerChanges: [],
    nextTaskId: null,
    createdAt: '2026-10-09T20:05:00.130Z',
    updatedAt: '2026-10-09T20:05:00.130Z',
    ...patch,
  };
}

/** Kavya Mehta as a row's person — a patient (#2, C-4) — with `patch` on top. */
export function taskPerson(patch: Partial<TaskPerson> = {}): TaskPerson {
  return {
    id: 'con_ebj92x3oamfu4qjwim3wq',
    name: 'Kavya Mehta',
    phone: '+919825005865',
    preferenceTags: [],
    firstName: 'Kavya',
    contactNumber: 4,
    patientId: 'pat_9e6j52vjb8uhvz44ebe94',
    patientNumber: 2,
    openLeadId: null,
    ...patch,
  };
}

/** The reply task as a list row — Anaya's person decorated from her contact — with `patch` on top. */
export function taskRow(patch: Partial<TaskRow> = {}): TaskRow {
  return {
    ...taskRecord(),
    person: {
      id: TEST_TASK_CONTACT_ID,
      name: 'Anaya Desai',
      phone: '+919826005869',
      preferenceTags: [],
      firstName: 'Anaya',
      contactNumber: 9,
      patientId: null,
      patientNumber: null,
      openLeadId: TEST_TASK_LEAD_ID,
    },
    ...patch,
  };
}
