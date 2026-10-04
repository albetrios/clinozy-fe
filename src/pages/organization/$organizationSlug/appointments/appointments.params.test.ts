import { describe, expect, it } from 'vitest';

import {
  appointmentListParamsOf,
  appointmentRangeParamsOf,
} from './appointments.params.ts';
import { validateAppointmentsSearch } from './appointments.search.ts';

const DOCTOR = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

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

describe('appointmentRangeParamsOf — the URL as a calendar read', () => {
  const search = validateAppointmentsSearch({
    view: 'week',
    date: '2026-10-05',
    doctor: DOCTOR,
    status: 'all',
    q: 'meera',
  });

  it('reads the range with the page’s filters, the picked doctors by default', () => {
    expect(
      appointmentRangeParamsOf(search, { from: '2026-10-04', to: '2026-10-10' }),
    ).toEqual({
      from: '2026-10-04',
      to: '2026-10-10',
      status: 'all',
      doctorIds: [DOCTOR],
      q: 'meera',
      created: undefined,
      followUp: undefined,
    });
  });

  it('reads every doctor when the view counts them itself (the Day)', () => {
    expect(
      appointmentRangeParamsOf(search, { from: '2026-10-05', to: '2026-10-05' }, 'every')
        .doctorIds,
    ).toEqual([]);
    expect(
      appointmentRangeParamsOf(validateAppointmentsSearch({}), {
        from: '2026-10-05',
        to: '2026-10-05',
      }).status,
    ).toBe('active');
  });
});
