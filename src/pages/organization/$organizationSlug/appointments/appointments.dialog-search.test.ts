import { describe, expect, it } from 'vitest';

import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';

import {
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
} from './appointments.dialog-search.ts';

const DOCTOR = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
const OTHER_DOCTOR = '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d';

describe('validateAppointmentCreateSearch — the booking prefill (S:27)', () => {
  it('keeps the time, the person, the copy source, the opener and the referrer', () => {
    expect(
      validateAppointmentCreateSearch({
        time: '10:15',
        who: DOCTOR,
        copyOf: OTHER_DOCTOR,
        source: 'chat',
        from: 'today',
      }),
    ).toEqual({
      time: '10:15',
      who: DOCTOR,
      copyOf: OTHER_DOCTOR,
      source: 'chat',
      from: 'today',
    });
  });

  it('drops a bad time, an id that is not one and an unknown opener', () => {
    expect(
      validateAppointmentCreateSearch({
        time: '25:00',
        who: 'Rhea',
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
