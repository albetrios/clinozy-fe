import { describe, expect, it } from 'vitest';

import {
  organizationAppointment,
  organizationAppointmentCreate,
  organizationAppointments,
} from './appointments-builders.ts';

describe('the Appointments room builders', () => {
  it('build the Appointments room and its dialog routes (S:26–28)', () => {
    expect(organizationAppointments('acme')).toEqual({
      to: '/organization/$organizationSlug/appointments',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationAppointment('acme', 'A1')).toEqual({
      to: '/organization/$organizationSlug/appointments/$appointmentId',
      params: { organizationSlug: 'acme', appointmentId: 'A1' },
    });
    expect(organizationAppointmentCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/appointments/create',
      params: { organizationSlug: 'acme' },
    });
  });
});
