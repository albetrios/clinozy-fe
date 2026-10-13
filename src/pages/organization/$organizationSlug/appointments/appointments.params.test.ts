import { describe, expect, it } from 'vitest';

import { DOCTOR_NISHA, TEST_BRANCH_ID } from '@/tests/utils/appointment-doubles.ts';

import {
  appointmentListParamsOf,
  appointmentRangeParamsOf,
} from './appointments.params.ts';
import { validateAppointmentsSearch } from './appointments.search.ts';

const BRANCHES = [TEST_BRANCH_ID];

describe('appointmentListParamsOf — the URL as the Agenda read', () => {
  it('applies the defaults: from today on, Active, every doctor, every branch', () => {
    expect(appointmentListParamsOf(validateAppointmentsSearch({}), [])).toEqual({
      date: undefined,
      status: 'active',
      doctorId: undefined,
      q: undefined,
      created: undefined,
      branchIds: [],
    });
  });

  it('hands the contract the one day, the status, the one doctor, the search and the header’s branches', () => {
    expect(
      appointmentListParamsOf(
        validateAppointmentsSearch({
          date: '2026-10-05',
          doctor: DOCTOR_NISHA.id,
          status: 'all',
          q: 'riya',
          created: 'today',
        }),
        BRANCHES,
      ),
    ).toEqual({
      date: '2026-10-05',
      status: 'all',
      doctorId: DOCTOR_NISHA.id,
      q: 'riya',
      created: 'today',
      branchIds: BRANCHES,
    });
  });
});

describe('appointmentRangeParamsOf — the URL as a calendar read', () => {
  const search = validateAppointmentsSearch({
    view: 'week',
    date: '2026-10-05',
    doctor: DOCTOR_NISHA.id,
    status: 'all',
    q: 'meera',
  });

  it('reads the range with the page’s filters and branches, the picked doctor by default', () => {
    expect(
      appointmentRangeParamsOf(search, {
        from: '2026-10-04',
        to: '2026-10-10',
        branchIds: BRANCHES,
      }),
    ).toEqual({
      from: '2026-10-04',
      to: '2026-10-10',
      status: 'all',
      doctorId: DOCTOR_NISHA.id,
      q: 'meera',
      created: undefined,
      branchIds: BRANCHES,
    });
  });

  it('reads every doctor when the view counts them itself (the Day), Active by default', () => {
    expect(
      appointmentRangeParamsOf(search, {
        from: '2026-10-05',
        to: '2026-10-05',
        branchIds: [],
        doctors: 'every',
      }).doctorId,
    ).toBeUndefined();
    expect(
      appointmentRangeParamsOf(validateAppointmentsSearch({}), {
        from: '2026-10-05',
        to: '2026-10-05',
        branchIds: [],
      }).status,
    ).toBe('active');
  });
});
