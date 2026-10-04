import type { TaskRow, TaskStaff } from '@/shared/api/clinic/tasks-contracts.ts';

/** Riya Shah, the fixture viewer, as a row's owner. */
export const RIYA: TaskStaff = {
  id: '11111111-1111-4111-8111-111111111111',
  firstName: 'Riya',
  lastName: 'Shah',
  initials: 'RS',
  tone: 'sage',
  active: true,
  roles: ['front_desk'],
  presence: 'online',
  phone: '+919876500012',
  email: 'riya@example.test',
};

/** Asha Mehta, a second team member. */
export const ASHA: TaskStaff = {
  ...RIYA,
  id: '22222222-2222-4222-8222-222222222222',
  firstName: 'Asha',
  lastName: 'Mehta',
  initials: 'AM',
  tone: 'lav',
  roles: ['counsellor'],
  presence: 'away',
};

/**
 * A list row as `listTasks` answers it — an open Confirm visits task for a
 * patient, owned by Riya — with `overrides` on top.
 */
export function taskRowFixture(overrides: Partial<TaskRow> = {}): TaskRow {
  const stamp = '2026-10-04T03:00:00.000Z';
  return {
    id: '33333333-3333-4333-8333-333333333333',
    organizationId: '44444444-4444-4444-8444-444444444444',
    createdById: RIYA.id,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    kind: 'confirm_visit',
    title: 'Confirm Priti’s visit',
    why: 'Laser session not confirmed. Reminder read at 08:10, no reply.',
    ownerId: RIYA.id,
    ownerRole: null,
    patientId: '55555555-5555-4555-8555-555555555555',
    leadId: null,
    sourceType: 'appointment',
    sourceId: '66666666-6666-4666-8666-666666666666',
    dueAt: '2026-10-04T05:20:00.000Z',
    status: 'open',
    snoozedUntil: null,
    outcome: null,
    resolvedAt: null,
    rule: 'confirm',
    ruleKey: null,
    ruleOutcome: null,
    result: null,
    note: null,
    resolvedBy: null,
    resolvedById: null,
    snoozeLabel: null,
    previousOwnerIds: [],
    person: {
      name: 'Priti Soni',
      firstName: 'Priti',
      patientId: '55555555-5555-4555-8555-555555555555',
      leadId: null,
      isPatient: true,
      kind: 'patient',
      seq: 3508,
      phone: '+919812345678',
    },
    source: {
      kind: 'appointment',
      id: '66666666-6666-4666-8666-666666666666',
      seq: 2848,
    },
    owner: RIYA,
    previousOwners: [],
    ownedByViewer: true,
    exists: true,
    ...overrides,
  };
}
