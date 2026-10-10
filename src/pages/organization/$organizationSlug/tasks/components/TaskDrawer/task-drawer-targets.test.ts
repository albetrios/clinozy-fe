import { describe, expect, it } from 'vitest';

import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import { taskPerson } from '@/tests/utils/task-doubles.ts';

import { taskSourceTarget } from './task-drawer-targets.ts';

const PATIENT = 'pat_9e6j52vjb8uhvz44ebe94';

/** A task's link with Kavya (a patient) — or someone without a file, or nobody — as its person. */
function task(
  link: TaskRow['link'],
  person: Partial<NonNullable<TaskRow['person']>> | null = {},
): Pick<TaskRow, 'link' | 'person'> {
  return { link, person: person === null ? null : taskPerson(person) };
}

describe('taskSourceTarget (tasks.md › Task drawer › 1)', () => {
  it('opens the lead, the booking or the bill the task points at, each under its read code', () => {
    expect(taskSourceTarget(task({ kind: 'lead', id: 'lead_a' }))).toEqual({
      kind: 'lead',
      target: { kind: 'lead', leadId: 'lead_a' },
      code: 'lead:read',
    });
    expect(taskSourceTarget(task({ kind: 'appointment', id: 'appt_a' }))).toEqual({
      kind: 'appointment',
      target: { kind: 'appointment', appointmentId: 'appt_a' },
      code: 'appointment:read',
    });
    expect(taskSourceTarget(task({ kind: 'invoice', id: 'inv_a' }))).toEqual({
      kind: 'invoice',
      target: { kind: 'invoice', invoiceId: 'inv_a' },
      code: 'payment:read',
    });
  });

  it('opens a treatment on the file’s Treatments, a check-in or review over the file', () => {
    expect(taskSourceTarget(task({ kind: 'treatment', id: 'ptr_a' }))).toEqual({
      kind: 'treatment',
      target: { kind: 'patient', patientId: PATIENT, section: 'treatments' },
      code: 'patient:read',
    });
    expect(taskSourceTarget(task({ kind: 'checkIn', id: 'chk_a' }))).toEqual({
      kind: 'checkIn',
      target: { kind: 'checkIn', patientId: PATIENT, checkInId: 'chk_a' },
      code: 'patient:read',
    });
    expect(taskSourceTarget(task({ kind: 'review', id: 'rev_a' }))).toEqual({
      kind: 'review',
      target: { kind: 'review', patientId: PATIENT, reviewId: 'rev_a' },
      code: 'patient:read',
    });
  });

  it('opens the patient file for a task that points at nothing', () => {
    expect(taskSourceTarget(task(null))).toEqual({
      kind: 'patient',
      target: { kind: 'patient', patientId: PATIENT, section: 'timeline' },
      code: 'patient:read',
    });
  });

  it('has none for a credit, a medical rep, a record without a file, or nobody', () => {
    expect(taskSourceTarget(task({ kind: 'pendingCredit', id: 'pcr_a' }))).toBeNull();
    expect(taskSourceTarget(task({ kind: 'medicalRep', id: 'mrp_a' }))).toBeNull();
    const noFile = { patientId: null, patientNumber: null };
    expect(taskSourceTarget(task({ kind: 'treatment', id: 'ptr_a' }, noFile))).toBeNull();
    expect(taskSourceTarget(task({ kind: 'checkIn', id: 'chk_a' }, noFile))).toBeNull();
    expect(taskSourceTarget(task({ kind: 'review', id: 'rev_a' }, noFile))).toBeNull();
    expect(taskSourceTarget(task(null, noFile))).toBeNull();
    expect(taskSourceTarget(task(null, null))).toBeNull();
  });
});
