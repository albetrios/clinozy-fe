import { describe, expect, it } from 'vitest';

import { lowerFirst, taskContactCard, taskSourceId } from './tasks.display.ts';

describe('taskSourceId', () => {
  it('numbers a record with a seq, an invoice its own way', () => {
    expect(taskSourceId({ kind: 'lead', seq: 2363 })).toBe('#2363');
    expect(taskSourceId({ kind: 'appointment', seq: 2848 })).toBe('#2848');
    expect(taskSourceId({ kind: 'treatment', seq: null })).toBe('');
    expect(taskSourceId({ kind: 'invoice', seq: 12 })).toMatch(/12/);
  });
});

describe('taskContactCard (D32)', () => {
  it('reads the person as their card does: kind, record and WhatsApp', () => {
    expect(
      taskContactCard({
        person: {
          name: 'Priti Soni',
          firstName: 'Priti',
          patientId: '11111111-1111-4111-8111-111111111111',
          leadId: null,
          isPatient: true,
          kind: 'patient',
          seq: 3508,
          phone: '+919812345678',
        },
      }),
    ).toEqual({
      kind: 'patient',
      name: 'Priti Soni',
      displayId: '#3508',
      reach: [{ channel: 'whatsapp', phone: '+919812345678' }],
    });
    expect(
      taskContactCard({
        person: {
          name: 'Zoya',
          firstName: 'Zoya',
          patientId: null,
          leadId: '22222222-2222-4222-8222-222222222222',
          isPatient: false,
          kind: 'contact',
          seq: null,
          phone: null,
        },
      }),
    ).toMatchObject({ kind: 'contact', displayId: null, reach: [] });
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
