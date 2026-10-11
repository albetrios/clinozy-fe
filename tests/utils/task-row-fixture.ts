/**
 * Today's work-queue test data on clinozy-be's shapes (`/app/tasks`): the front desk member Riya
 * and a counsellor colleague as the team directory names them, and an open "Confirm visits" task
 * for the patient Priti Soni, owned by Riya — the card the queue suites draw. The Tasks room's
 * rows are `tests/utils/task-doubles.ts`; this one is built on them.
 */
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { TaskRow } from '@/shared/api/app/tasks-contracts.ts';

import { taskPerson, taskRow } from './task-doubles.ts';

/** A team member as `useTeamDirectory` reads them. */
const teamMember = (id: string, name: string, initials: string): DirectoryMember => ({
  id,
  userId: `usr_${id.slice(4)}`,
  name,
  initials,
  tone: 'sage',
  roleIds: [],
  branchIds: [],
});

/** Riya Shah, the signed-in front desk member. */
export const RIYA = teamMember('mem_riya00000000000000000', 'Riya Shah', 'RS');

/** Asha Mehta, a counsellor colleague. */
export const ASHA = teamMember('mem_asha00000000000000000', 'Asha Mehta', 'AM');

/** Priti Soni's confirm task's visit. */
export const PRITI_VISIT_ID = 'appt_priti0000000000000000';

/** Priti Soni, a patient (#3508, C-31) with no open lead. */
export const PRITI = taskPerson({
  id: 'con_priti0000000000000000',
  name: 'Priti Soni',
  phone: '+919812345678',
  firstName: 'Priti',
  contactNumber: 31,
  patientId: 'pat_priti0000000000000000',
  patientNumber: 3508,
  openLeadId: null,
});

/**
 * An open "Confirm visits" task for Priti's laser session, owned by Riya, due 10:50 on 4 Oct
 * (clinic time) — as a list row with its person — with `overrides` on top.
 */
export function taskRowFixture(overrides: Partial<TaskRow> = {}): TaskRow {
  return taskRow({
    id: 'task_priticonfirm000000000',
    kind: 'rule',
    ruleKey: 'confirm',
    type: 'confirm',
    title: 'Confirm Priti’s visit',
    why: 'Laser session not confirmed. Reminder read at 08:10, no reply.',
    ownerId: RIYA.id,
    ownerRole: null,
    contact: {
      id: PRITI.id,
      name: PRITI.name,
      phone: PRITI.phone,
      preferenceTags: [],
    },
    link: { kind: 'appointment', id: PRITI_VISIT_ID },
    dueAt: '2026-10-04T05:20:00.000Z',
    priority: 'normal',
    createdAt: '2026-10-04T02:40:00.000Z',
    updatedAt: '2026-10-04T02:40:00.000Z',
    person: PRITI,
    ...overrides,
  });
}
