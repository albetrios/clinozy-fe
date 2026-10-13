import { describe, expect, it } from 'vitest';

import { taskPerson } from '@/tests/utils/task-doubles.ts';

import { lowerFirst, taskContactCard, taskPersonKind } from './tasks.display.ts';

describe('taskPersonKind', () => {
  it('reads a patient file first, then an open lead, else a contact', () => {
    expect(taskPersonKind({ patientId: 'pat_a', openLeadId: 'lead_b' })).toBe('patient');
    expect(taskPersonKind({ patientId: null, openLeadId: 'lead_b' })).toBe('lead');
    expect(taskPersonKind({ patientId: null, openLeadId: null })).toBe('contact');
  });
});

describe('taskContactCard (D32)', () => {
  it('reads the person as their card does: kind, number and WhatsApp', () => {
    expect(taskContactCard({ person: taskPerson() })).toEqual({
      kind: 'patient',
      name: 'Kavya Mehta',
      displayId: '#2',
      reach: [{ channel: 'whatsapp', phone: '+919825005865' }],
    });
    expect(
      taskContactCard({
        person: taskPerson({
          patientId: null,
          patientNumber: null,
          openLeadId: 'lead_hplz5ew0h3tw99ntqf39w',
          phone: null,
        }),
      }),
    ).toEqual({ kind: 'lead', name: 'Kavya Mehta', displayId: 'C-4', reach: [] });
    expect(taskContactCard({ person: null })).toBeNull();
  });
});

describe('lowerFirst', () => {
  it('continues a sentence after a dot, keeping acronyms and caseless scripts', () => {
    expect(lowerFirst('A lead wrote and nobody replied')).toBe(
      'a lead wrote and nobody replied',
    );
    expect(lowerFirst('Tomorrow 11 am')).toBe('tomorrow 11 am');
    expect(lowerFirst('LHR session done')).toBe('LHR session done');
    expect(lowerFirst('明天上午 11 点')).toBe('明天上午 11 点');
    expect(lowerFirst('')).toBe('');
  });
});
