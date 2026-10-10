import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_STATUS_FILTERS,
  APPOINTMENT_VIEWS,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { DOCTOR_ARJUN, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';

import {
  APPOINTMENTS_SEARCH_DEFAULTS,
  validateAppointmentsSearch,
} from './appointments.search.ts';

const EMPTY = {
  view: undefined,
  date: undefined,
  doctor: undefined,
  status: undefined,
  q: undefined,
  created: undefined,
};

describe('validateAppointmentsSearch — the page URL (D27, S:26)', () => {
  it('answers every key, undefined when the URL says nothing — Agenda and Active stay out of the URL', () => {
    expect(validateAppointmentsSearch({})).toEqual(EMPTY);
    expect(APPOINTMENTS_SEARCH_DEFAULTS).toEqual({ view: 'agenda', status: 'active' });
  });

  it('keeps every valid value — the doctor one membership id', () => {
    expect(
      validateAppointmentsSearch({
        view: 'week',
        date: '2026-10-05',
        doctor: DOCTOR_NISHA.id,
        status: 'no_show',
        q: ' Riya ',
        created: 'last_30',
      }),
    ).toEqual({
      view: 'week',
      date: '2026-10-05',
      doctor: DOCTOR_NISHA.id,
      status: 'no_show',
      q: 'Riya',
      created: 'last_30',
    });
  });

  it('keeps one doctor — the first of an old multi-doctor link, never a list', () => {
    expect(
      validateAppointmentsSearch({ doctor: [DOCTOR_ARJUN.id, DOCTOR_NISHA.id] }).doctor,
    ).toBe(DOCTOR_ARJUN.id);
    expect(
      validateAppointmentsSearch({ doctor: `${DOCTOR_ARJUN.id},${DOCTOR_NISHA.id}` })
        .doctor,
    ).toBeUndefined();
  });

  it('drops invalid values instead of failing — a doctor that is not a public id included', () => {
    expect(
      validateAppointmentsSearch({
        view: 'list',
        date: '5 Oct',
        doctor: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b',
        status: 'open',
        q: '   ',
        created: 'last_90',
      }),
    ).toEqual(EMPTY);
    expect(validateAppointmentsSearch({ date: '2026-13-01' }).date).toBeUndefined();
    expect(validateAppointmentsSearch({ doctor: 'mem_short' }).doctor).toBeUndefined();
  });

  it('reads no follow-up filter and no column sort — the API has neither (G3)', () => {
    expect(
      validateAppointmentsSearch({
        followUp: 'today',
        sort: 'contact:asc',
        type: 'treatment',
      }),
    ).toEqual(EMPTY);
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
  });
});
