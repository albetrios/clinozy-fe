import { describe, expect, it } from 'vitest';

import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import { taskPerson } from '@/tests/utils/task-doubles.ts';

import { taskFollowOnTarget, taskTargetNavigation } from './task-targets.ts';

const PATIENT = 'pat_9e6j52vjb8uhvz44ebe94';
const CONTACT = 'con_ebj92x3oamfu4qjwim3wq';
const LEAD = 'lead_hplz5ew0h3tw99ntqf39w';
const VISIT = 'appt_a4ofy9lzqqyiquwgqpk4y';
const TREATMENT = 'ptr_q1w2e3r4t5y6u7i8o9p0a';
const INVOICE = 'inv_z9x8c7v6b5n4m3l2k1j0h';

/** What a follow-on reads of a task: its link and Kavya (a patient) as its person. */
function task(
  link: TaskRow['link'],
  person: Partial<NonNullable<TaskRow['person']>> | null = {},
): Pick<TaskRow, 'link' | 'person'> {
  return { link, person: person === null ? null : taskPerson(person) };
}

describe('taskFollowOnTarget (tasks.md:185–227 "Then")', () => {
  const visitTask = task({ kind: 'appointment', id: VISIT });

  it('books the person by their contact, rebooks the visit and moves it', () => {
    expect(taskFollowOnTarget('appointmentNew', visitTask)).toEqual({
      kind: 'newAppointment',
      whoId: CONTACT,
    });
    expect(taskFollowOnTarget('appointmentRebook', visitTask)).toEqual({
      kind: 'newAppointment',
      whoId: CONTACT,
      copyOf: VISIT,
    });
    expect(taskFollowOnTarget('appointmentMove', visitTask)).toEqual({
      kind: 'appointment',
      appointmentId: VISIT,
      reschedule: true,
    });
    expect(
      taskFollowOnTarget('appointmentMove', task({ kind: 'lead', id: LEAD })),
    ).toBeNull();
    expect(taskFollowOnTarget('appointmentNew', task(null, null))).toBeNull();
  });

  it('logs a review or a check-in on the patient file, tied to the visit or treatment (T5)', () => {
    expect(taskFollowOnTarget('reviewLog', visitTask)).toEqual({
      kind: 'review',
      patientId: PATIENT,
      appointmentId: VISIT,
    });
    expect(taskFollowOnTarget('visitCheckIn', visitTask)).toEqual({
      kind: 'checkIn',
      patientId: PATIENT,
      appointmentId: VISIT,
    });
    expect(
      taskFollowOnTarget('aftercareCheckIn', task({ kind: 'treatment', id: TREATMENT })),
    ).toEqual({ kind: 'checkIn', patientId: PATIENT, treatmentId: TREATMENT });
    expect(
      taskFollowOnTarget(
        'visitCheckIn',
        task({ kind: 'appointment', id: VISIT }, { patientId: null }),
      ),
    ).toBeNull();
  });

  it('opens the person’s record for "Call now" and "Fix the number": the file, else the open lead', () => {
    expect(taskFollowOnTarget('patientFile', visitTask)).toEqual({
      kind: 'patient',
      patientId: PATIENT,
      section: 'timeline',
    });
    const lead = task({ kind: 'lead', id: LEAD }, { patientId: null, openLeadId: LEAD });
    expect(taskFollowOnTarget('personRecord', lead)).toEqual({
      kind: 'lead',
      leadId: LEAD,
    });
    expect(
      taskFollowOnTarget(
        'personRecord',
        task(null, { patientId: null, openLeadId: null }),
      ),
    ).toBeNull();
  });
});

describe('taskTargetNavigation', () => {
  it('keeps the referring room behind a booking, and names the file’s section', () => {
    expect(
      taskTargetNavigation(
        { kind: 'newAppointment', whoId: CONTACT, copyOf: VISIT },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/appointments/create',
      params: { organizationSlug: 'acme' },
      search: { who: CONTACT, source: 'task', from: 'tasks', copyOf: VISIT },
    });
    expect(
      taskTargetNavigation(
        { kind: 'appointment', appointmentId: VISIT, reschedule: true },
        'acme',
        'tasks',
      ).search,
    ).toEqual({ from: 'tasks', mode: 'reschedule' });
    expect(
      taskTargetNavigation(
        { kind: 'patient', patientId: PATIENT, section: 'treatments' },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/treatments',
      params: { organizationSlug: 'acme', patientId: PATIENT },
    });
    expect(
      taskTargetNavigation({ kind: 'lead', leadId: LEAD }, 'acme', 'tasks').params,
    ).toEqual({ organizationSlug: 'acme', leadId: LEAD });
    expect(
      taskTargetNavigation({ kind: 'invoice', invoiceId: INVOICE }, 'acme', 'tasks')
        .search,
    ).toEqual({ from: 'tasks' });
  });

  it('opens a new check-in or review over the patient file with its visit or treatment', () => {
    expect(
      taskTargetNavigation(
        { kind: 'checkIn', patientId: PATIENT, treatmentId: TREATMENT },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/check-ins/create',
      params: { organizationSlug: 'acme', patientId: PATIENT },
      search: { treatment: TREATMENT },
    });
    expect(
      taskTargetNavigation(
        { kind: 'review', patientId: PATIENT, appointmentId: VISIT },
        'acme',
        'today',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/reviews/create',
      params: { organizationSlug: 'acme', patientId: PATIENT },
      search: { appointment: VISIT },
    });
  });

  it('opens the check-in or review a task points at, over the patient file', () => {
    expect(
      taskTargetNavigation(
        { kind: 'checkIn', patientId: PATIENT, checkInId: 'chk_kavya00000000000000' },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit',
      params: {
        organizationSlug: 'acme',
        patientId: PATIENT,
        checkInId: 'chk_kavya00000000000000',
      },
    });
    expect(
      taskTargetNavigation(
        { kind: 'review', patientId: PATIENT, reviewId: 'rev_kavya00000000000000' },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit',
      params: {
        organizationSlug: 'acme',
        patientId: PATIENT,
        reviewId: 'rev_kavya00000000000000',
      },
    });
  });

  it('keeps Today behind a booking opened from the work queue', () => {
    expect(
      taskTargetNavigation({ kind: 'newAppointment', whoId: CONTACT }, 'acme', 'today')
        .search,
    ).toEqual({ who: CONTACT, source: 'task', from: 'today' });
  });
});
