import { describe, expect, it } from 'vitest';

import { safeReferrer } from '@/shared/app/app-referrer.ts';
import { appointmentRow, contactHit } from '@/tests/utils/appointment-doubles.ts';

import {
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
} from './appointments.dialog-search.ts';

const CONTACT = contactHit().id;
const BOOKING = appointmentRow().id;

describe('validateAppointmentCreateSearch — the booking prefill (S:27)', () => {
  it('keeps the time, the contact, the booking copied, the opener and the referrer', () => {
    expect(
      validateAppointmentCreateSearch({
        time: '10:15',
        who: CONTACT,
        copyOf: BOOKING,
        source: 'chat',
        from: 'today',
      }),
    ).toEqual({
      time: '10:15',
      who: CONTACT,
      copyOf: BOOKING,
      source: 'chat',
      from: 'today',
    });
  });

  it('drops a bad time, an id that is not a public id and an unknown opener', () => {
    expect(
      validateAppointmentCreateSearch({
        time: '25:00',
        who: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b',
        copyOf: '2861',
        source: 'email',
        from: '  ',
      }),
    ).toEqual({
      time: undefined,
      who: undefined,
      copyOf: undefined,
      source: undefined,
      from: undefined,
    });
    expect(validateAppointmentCreateSearch({ who: 'Riya Mehta' }).who).toBeUndefined();
  });

  it('carries the referrer as given — the allow-list decides where it is read', () => {
    const { from } = validateAppointmentCreateSearch({ from: 'https://evil.example' });
    expect(from).toBe('https://evil.example');
    expect(safeReferrer(from, 'appointments')).toBe('appointments');
    expect(
      safeReferrer(validateAppointmentCreateSearch({ from: 'today' }).from, ''),
    ).toBe('today');
  });
});

describe('validateAppointmentSearch — the drawer (S:28)', () => {
  it('keeps the Reschedule mode and the referrer, nothing else', () => {
    expect(validateAppointmentSearch({ mode: 'reschedule', from: 'tasks' })).toEqual({
      mode: 'reschedule',
      from: 'tasks',
    });
    expect(validateAppointmentSearch({ mode: 'edit' })).toEqual({
      mode: undefined,
      from: undefined,
    });
    expect(safeReferrer(validateAppointmentSearch({ from: '//evil' }).from, '')).toBe('');
  });
});
