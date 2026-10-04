import { describe, expect, it } from 'vitest';

import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';

import {
  taskDrawerNavigation,
  taskFollowOnTarget,
  taskSourceTarget,
} from './task-drawer-targets.ts';

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

describe('taskSourceTarget (tasks.md › Task drawer › 1)', () => {
  it('opens the booking, the lead, the file’s Treatments, the file or the invoice', () => {
    expect(taskSourceTarget(row({ kind: 'appointment', id: VISIT, seq: 2848 }))).toEqual({
      kind: 'appointment',
      target: { kind: 'appointment', appointmentId: VISIT },
    });
    expect(taskSourceTarget(row({ kind: 'lead', id: LEAD, seq: 2363 }))?.target).toEqual({
      kind: 'lead',
      leadId: LEAD,
    });
    expect(taskSourceTarget(row({ kind: 'treatment', id: VISIT, seq: null }))).toEqual({
      kind: 'treatment',
      target: { kind: 'patient', patientId: PATIENT, section: 'treatments' },
    });
    expect(
      taskSourceTarget(row({ kind: 'patient', id: null, seq: null }))?.target,
    ).toEqual({ kind: 'patient', patientId: PATIENT, section: 'timeline' });
    expect(taskSourceTarget(row({ kind: 'invoice', id: INVOICE, seq: 12 }))?.kind).toBe(
      'invoice',
    );
  });

  it('offers none for a chat-only contact or a record without an id', () => {
    expect(taskSourceTarget(row({ kind: 'contact', id: null, seq: null }))).toBeNull();
    expect(taskSourceTarget(row({ kind: 'lead', id: null, seq: null }))).toBeNull();
    expect(
      taskSourceTarget(
        row({ kind: 'treatment', id: VISIT, seq: null }, { patientId: null }),
      ),
    ).toBeNull();
  });
});

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

describe('taskDrawerNavigation', () => {
  it('keeps Tasks behind a booking, and names the file’s section', () => {
    expect(
      taskDrawerNavigation(
        { kind: 'newAppointment', whoId: PATIENT, copyOf: VISIT },
        'acme',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/appointments/create',
      params: { organizationSlug: 'acme' },
      search: { who: PATIENT, source: 'task', from: 'tasks', copyOf: VISIT },
    });
    expect(
      taskDrawerNavigation(
        { kind: 'appointment', appointmentId: VISIT, reschedule: true },
        'acme',
      ).search,
    ).toEqual({ from: 'tasks', mode: 'reschedule' });
    expect(
      taskDrawerNavigation(
        { kind: 'patient', patientId: PATIENT, section: 'treatments' },
        'acme',
      ),
    ).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/treatments',
      params: { organizationSlug: 'acme', patientId: PATIENT },
    });
    expect(taskDrawerNavigation({ kind: 'lead', leadId: LEAD }, 'acme').params).toEqual({
      organizationSlug: 'acme',
      leadId: LEAD,
    });
    expect(
      taskDrawerNavigation({ kind: 'invoice', invoiceId: INVOICE }, 'acme').search,
    ).toEqual({ from: 'tasks' });
  });
});
