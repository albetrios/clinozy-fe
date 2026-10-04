import { describe, expect, it } from 'vitest';

import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';

import { taskFollowOnTarget, taskTargetNavigation } from './task-targets.ts';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const LEAD = '22222222-2222-4222-8222-222222222222';
const VISIT = '33333333-3333-4333-8333-333333333333';
const INVOICE = '44444444-4444-4444-8444-444444444444';

function row(
  source: TaskRow['source'],
  person: Partial<TaskRow['person']> = {},
): Pick<TaskRow, 'source' | 'person'> {
  return {
    source,
    person: {
      name: 'Priti Soni',
      firstName: 'Priti',
      patientId: PATIENT,
      leadId: null,
      isPatient: true,
      kind: 'patient',
      seq: 3508,
      phone: null,
      ...person,
    },
  };
}

describe('taskFollowOnTarget (tasks.md:185–227 "Then")', () => {
  const visitTask = row({ kind: 'appointment', id: VISIT, seq: 2848 });

  it('books the person, rebooks the visit and moves it', () => {
    expect(taskFollowOnTarget('appointmentNew', visitTask)).toEqual({
      kind: 'newAppointment',
      whoId: PATIENT,
    });
    expect(taskFollowOnTarget('appointmentRebook', visitTask)).toEqual({
      kind: 'newAppointment',
      whoId: PATIENT,
      copyOf: VISIT,
    });
    expect(taskFollowOnTarget('appointmentMove', visitTask)).toEqual({
      kind: 'appointment',
      appointmentId: VISIT,
      reschedule: true,
    });
    expect(
      taskFollowOnTarget('appointmentMove', row({ kind: 'lead', id: LEAD, seq: 1 })),
    ).toBeNull();
  });

  it('opens the person’s record for "Call now" and "Fix the number"; the stacked forms have none yet', () => {
    for (const form of ['visitCheckIn', 'aftercareCheckIn', 'reviewLog'] as const) {
      expect(taskFollowOnTarget(form, visitTask)).toBeNull();
    }
    expect(taskFollowOnTarget('patientFile', visitTask)).toEqual({
      kind: 'patient',
      patientId: PATIENT,
      section: 'timeline',
    });
    const lead = row(
      { kind: 'lead', id: LEAD, seq: 2363 },
      { patientId: null, leadId: LEAD, isPatient: false, kind: 'lead' },
    );
    expect(taskFollowOnTarget('personRecord', lead)).toEqual({
      kind: 'lead',
      leadId: LEAD,
    });
    expect(taskFollowOnTarget('appointmentNew', lead)).toEqual({
      kind: 'newAppointment',
      whoId: LEAD,
    });
    expect(
      taskFollowOnTarget(
        'personRecord',
        row(
          { kind: 'contact', id: null, seq: null },
          {
            patientId: null,
            leadId: null,
          },
        ),
      ),
    ).toBeNull();
  });
});

describe('taskTargetNavigation', () => {
  it('keeps the referring room behind a booking, and names the file’s section', () => {
    expect(
      taskTargetNavigation(
        { kind: 'newAppointment', whoId: PATIENT, copyOf: VISIT },
        'acme',
        'tasks',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/appointments/create',
      params: { organizationSlug: 'acme' },
      search: { who: PATIENT, source: 'task', from: 'tasks', copyOf: VISIT },
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

  it('keeps Today behind a booking opened from the work queue', () => {
    expect(
      taskTargetNavigation({ kind: 'newAppointment', whoId: PATIENT }, 'acme', 'today')
        .search,
    ).toEqual({ who: PATIENT, source: 'task', from: 'today' });
  });
});
