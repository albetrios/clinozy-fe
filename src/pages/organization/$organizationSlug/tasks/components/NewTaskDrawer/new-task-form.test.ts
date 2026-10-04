import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import {
  newTaskForm,
  newTaskInputOf,
  newTaskOwnerId,
  type NewTaskPerson,
  personFirstName,
  withDuePreset,
} from './new-task-form.ts';

const TODAY = '2026-10-03';
const PRITI: NewTaskPerson = {
  kind: 'patient',
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Priti Soni',
  seq: 3508,
  contact: false,
  ownerId: null,
};
const KABIR: NewTaskPerson = {
  kind: 'lead',
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Kabir Mehta',
  seq: 2370,
  contact: false,
  ownerId: '77777777-7777-4777-8777-777777777777',
};
const ME = '88888888-8888-4888-8888-888888888888';

describe('newTaskForm (H:6063)', () => {
  it('opens on Call back, due tomorrow 11 am, Normal, reminded 15 min before', () => {
    expect(newTaskForm(TODAY)).toEqual({
      person: null,
      type: 'call_back',
      title: '',
      duePreset: 'tomorrow',
      dueDate: '2026-10-04',
      dueTime: '11:00',
      ownerId: null,
      priority: 'normal',
      remind: true,
      notes: '',
    });
    expect(newTaskForm(TODAY, PRITI).person).toBe(PRITI);
  });
});

describe('withDuePreset (H:6057)', () => {
  it('sets each chip’s day and clinic time', () => {
    const form = newTaskForm(TODAY);
    expect(withDuePreset(form, 'today', TODAY)).toMatchObject({
      duePreset: 'today',
      dueDate: TODAY,
      dueTime: '17:00',
    });
    expect(withDuePreset(form, 'inThreeDays', TODAY)).toMatchObject({
      dueDate: '2026-10-06',
      dueTime: '11:00',
    });
    expect(withDuePreset(form, 'nextWeek', TODAY).dueDate).toBe('2026-10-10');
  });
});

describe('newTaskOwnerId', () => {
  it('takes the pick, else the lead’s owner, else the member', () => {
    const form = newTaskForm(TODAY, KABIR);
    expect(newTaskOwnerId({ ...form, ownerId: ME }, null)).toBe(ME);
    expect(newTaskOwnerId(form, ME)).toBe(KABIR.ownerId);
    expect(newTaskOwnerId(newTaskForm(TODAY, PRITI), ME)).toBe(ME);
    expect(newTaskOwnerId(newTaskForm(TODAY), null)).toBeNull();
  });
});

describe('personFirstName', () => {
  it('reads the first word of the name', () => {
    expect(personFirstName(PRITI)).toBe('Priti');
    expect(personFirstName({ name: '  Kabir  Mehta ' })).toBe('Kabir');
  });
});

describe('newTaskInputOf', () => {
  it('waits for a person and an assignee', () => {
    const form = newTaskForm(TODAY);
    expect(newTaskInputOf(form, { ownerId: ME, fallbackTitle: 'Call back' })).toBeNull();
    expect(
      newTaskInputOf(newTaskForm(TODAY, PRITI), { ownerId: null, fallbackTitle: 'x' }),
    ).toBeNull();
  });

  it('writes a patient’s task: the clinic instant, the plan fields, the notes as why', () => {
    const form = {
      ...withDuePreset(newTaskForm(TODAY, PRITI), 'today', TODAY),
      title: '  Share the laser price ',
      type: 'send_price' as const,
      priority: 'high' as const,
      notes: '  Asked yesterday  ',
    };
    expect(newTaskInputOf(form, { ownerId: ME, fallbackTitle: 'unused' })).toEqual({
      title: 'Share the laser price',
      why: 'Asked yesterday',
      ownerId: ME,
      patientId: PRITI.id,
      leadId: null,
      dueAt: clinicInstant(TODAY, '17:00'),
      rule: 'manual',
      manualType: 'send_price',
      priority: 'high',
      remindMinutesBefore: 15,
    });
  });

  it('writes a lead’s task with the fallback title, no notes and no reminder', () => {
    const form = { ...newTaskForm(TODAY, KABIR), remind: false };
    expect(
      newTaskInputOf(form, { ownerId: ME, fallbackTitle: 'Call back · Kabir' }),
    ).toMatchObject({
      title: 'Call back · Kabir',
      why: null,
      patientId: null,
      leadId: KABIR.id,
      remindMinutesBefore: null,
    });
  });
});
