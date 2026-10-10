import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import {
  defaultAssigneeKey,
  newTaskFieldsOf,
  type NewTaskForm,
  newTaskForm,
  withDuePreset,
} from './new-task-form.ts';
import type { NewTaskPerson } from './new-task-person.ts';

const TODAY = '2026-10-10';
const RIYA = 'mem_yls33gz5jj66ful8q4ads';
const ASHA = 'mem_asha0000000000000000';

/** Anaya — a lead: her task points at her lead. */
const ANAYA: NewTaskPerson = {
  contactId: 'con_8hb15isod6txlpljrn1f7',
  name: 'Anaya Desai',
  firstName: 'Anaya',
  kind: 'lead',
  phone: '+919826005869',
  openLeadId: 'lead_hplz5ew0h3tw99ntqf39w',
  leadId: 'lead_hplz5ew0h3tw99ntqf39w',
};

/** Kavya — a patient: her task points at her only. */
const KAVYA: NewTaskPerson = {
  contactId: 'con_ebj92x3oamfu4qjwim3wq',
  name: 'Kavya Mehta',
  firstName: 'Kavya',
  kind: 'patient',
  phone: '+919825005865',
  openLeadId: null,
  leadId: null,
};

const form = (patch: Partial<NewTaskForm> = {}): NewTaskForm => ({
  ...newTaskForm(TODAY),
  ...patch,
});

describe('newTaskForm (H:6063)', () => {
  it('opens on the URL’s person, no title, due tomorrow 11:00, the default assignee, Normal', () => {
    expect(newTaskForm(TODAY)).toEqual({
      person: undefined,
      title: '',
      duePreset: 'tomorrow',
      dueDate: '2026-10-11',
      dueTime: '11:00',
      owner: null,
      priority: 'normal',
      notes: '',
    });
  });

  it('sets each Due chip’s clinic day and time', () => {
    expect(withDuePreset(form(), 'today', TODAY)).toMatchObject({
      duePreset: 'today',
      dueDate: TODAY,
      dueTime: '17:00',
    });
    expect(withDuePreset(form(), 'inThreeDays', TODAY).dueDate).toBe('2026-10-13');
    expect(withDuePreset(form(), 'nextWeek', TODAY).dueDate).toBe('2026-10-17');
  });
});

describe('defaultAssigneeKey (H:6056)', () => {
  it('defaults to the lead’s owner when they can work tasks, else the member', () => {
    const workerIds = new Set([RIYA, ASHA]);
    expect(
      defaultAssigneeKey({ leadOwnerId: ASHA, myMembershipId: RIYA, workerIds }),
    ).toBe(ASHA);
    expect(
      defaultAssigneeKey({ leadOwnerId: null, myMembershipId: RIYA, workerIds }),
    ).toBe(RIYA);
    // A lead owned by someone who can't work tasks (say, Marketing) falls back to the member.
    expect(
      defaultAssigneeKey({
        leadOwnerId: 'mem_marketing000000000000',
        myMembershipId: RIYA,
        workerIds,
      }),
    ).toBe(RIYA);
    expect(
      defaultAssigneeKey({ leadOwnerId: null, myMembershipId: undefined, workerIds }),
    ).toBeNull();
    expect(
      defaultAssigneeKey({
        leadOwnerId: null,
        myMembershipId: RIYA,
        workerIds: new Set(),
      }),
    ).toBeNull();
  });
});

describe('newTaskFieldsOf (POST /app/tasks)', () => {
  it('writes a lead’s task on her contact and her lead, due at the picked clinic time', () => {
    const fields = newTaskFieldsOf(
      form({
        title: '  Share the laser price ',
        notes: ' Asked on Instagram ',
        priority: 'high',
      }),
      { person: ANAYA, owner: RIYA, fallbackTitle: 'Follow up · Anaya' },
    );
    expect(fields).toEqual({
      title: 'Share the laser price',
      why: 'Asked on Instagram',
      dueAt: clinicInstant('2026-10-11', '11:00'),
      assignee: { membershipId: RIYA },
      priority: 'high',
      contactId: ANAYA.contactId,
      link: { kind: 'lead', id: ANAYA.leadId },
    });
  });

  it('points a patient’s task at the person alone, into a role queue', () => {
    expect(
      newTaskFieldsOf(form({ title: 'Call about the package' }), {
        person: KAVYA,
        owner: 'role:front_desk',
        fallbackTitle: 'Follow up · Kavya',
      }),
    ).toMatchObject({
      assignee: { role: 'front_desk' },
      contactId: KAVYA.contactId,
      link: null,
      why: null,
    });
  });

  it('saves an empty title as the person’s fallback', () => {
    expect(
      newTaskFieldsOf(form(), {
        person: KAVYA,
        owner: RIYA,
        fallbackTitle: 'Follow up · Kavya',
      })?.title,
    ).toBe('Follow up · Kavya');
  });

  it('writes a task about no one from its title alone', () => {
    expect(
      newTaskFieldsOf(form({ title: 'Order more gloves' }), {
        person: null,
        owner: RIYA,
        fallbackTitle: '',
      }),
    ).toMatchObject({ title: 'Order more gloves', contactId: null, link: null });
  });

  it('asks for nothing without a title or an assignee', () => {
    expect(
      newTaskFieldsOf(form(), { person: null, owner: RIYA, fallbackTitle: '' }),
    ).toBeNull();
    expect(
      newTaskFieldsOf(form({ title: 'Order more gloves' }), {
        person: null,
        owner: null,
        fallbackTitle: '',
      }),
    ).toBeNull();
  });
});
