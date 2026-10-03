import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_SORT_KEYS,
  APPOINTMENT_STATUS_FILTERS,
  APPOINTMENT_VIEWS,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';

import {
  appointmentListParamsOf,
  APPOINTMENTS_SEARCH_DEFAULTS,
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
  validateAppointmentsSearch,
} from './appointments.search.ts';

const DOCTOR = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
const OTHER_DOCTOR = '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d';
const EMPTY = {
  view: undefined,
  date: undefined,
  doctor: undefined,
  status: undefined,
  q: undefined,
  created: undefined,
  followUp: undefined,
  sort: undefined,
};

describe('validateAppointmentsSearch — the page URL (D27, S:26)', () => {
  it('answers every key, undefined when the URL says nothing — Agenda and Active stay out of the URL', () => {
    expect(validateAppointmentsSearch({})).toEqual(EMPTY);
    expect(APPOINTMENTS_SEARCH_DEFAULTS).toEqual({ view: 'agenda', status: 'active' });
  });

  it('keeps every valid value', () => {
    expect(
      validateAppointmentsSearch({
        view: 'week',
        date: '2026-10-05',
        doctor: [DOCTOR, OTHER_DOCTOR],
        status: 'no_show',
        q: ' Rhea ',
        created: 'last_30',
        followUp: '2026-10-01..',
        sort: 'status:desc',
      }),
    ).toEqual({
      view: 'week',
      date: '2026-10-05',
      doctor: [DOCTOR, OTHER_DOCTOR],
      status: 'no_show',
      q: 'Rhea',
      created: 'last_30',
      followUp: '2026-10-01..',
      sort: 'status:desc',
    });
  });

  it('drops invalid values instead of failing — the schema’s stale `list` view included', () => {
    expect(
      validateAppointmentsSearch({
        view: 'list',
        date: '5 Oct',
        doctor: ['not-an-id'],
        status: 'open',
        q: '   ',
        created: 'last_90',
        followUp: '2026-10-07..2026-10-01',
        sort: 'time:asc',
      }),
    ).toEqual(EMPTY);
    expect(validateAppointmentsSearch({ date: '2026-13-01' }).date).toBeUndefined();
    expect(validateAppointmentsSearch({ sort: 'contact:up' }).sort).toBeUndefined();
    // The schema's `type` filter has no control (B.13 R28) and is not read.
    expect(validateAppointmentsSearch({ type: 'treatment' })).toEqual(EMPTY);
  });

  it('reads the doctors as a JSON array or a comma list, the valid ids once', () => {
    expect(
      validateAppointmentsSearch({ doctor: `${DOCTOR},bogus,${DOCTOR}` }).doctor,
    ).toEqual([DOCTOR]);
  });

  it('reads a numeric search as text, kept to the contract’s 80 characters', () => {
    expect(validateAppointmentsSearch({ q: 2861 }).q).toBe('2861');
    expect(validateAppointmentsSearch({ q: 'x'.repeat(90) }).q).toHaveLength(80);
  });

  it('accepts exactly the contract’s values (pinned: the lists are declared locally for the entry chunk)', () => {
    for (const view of APPOINTMENT_VIEWS) {
      expect(validateAppointmentsSearch({ view }).view).toBe(view);
    }
    for (const status of APPOINTMENT_STATUS_FILTERS) {
      expect(validateAppointmentsSearch({ status }).status).toBe(status);
    }
    for (const key of APPOINTMENT_SORT_KEYS) {
      expect(validateAppointmentsSearch({ sort: `${key}:desc` }).sort).toBe(
        `${key}:desc`,
      );
    }
  });
});

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

describe('appointmentListParamsOf — the URL as the Agenda read', () => {
  it('applies the defaults: from today on, Active, every doctor', () => {
    expect(appointmentListParamsOf(validateAppointmentsSearch({}))).toEqual({
      date: undefined,
      status: 'active',
      doctorIds: [],
      q: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  it('hands the contract its shapes: the doctors as ids, the sort split from its direction', () => {
    expect(
      appointmentListParamsOf(
        validateAppointmentsSearch({
          date: '2026-10-05',
          doctor: DOCTOR,
          status: 'all',
          sort: 'contact:asc',
        }),
      ),
    ).toMatchObject({
      date: '2026-10-05',
      status: 'all',
      doctorIds: [DOCTOR],
      sort: 'contact',
      order: 'asc',
    });
  });
});
