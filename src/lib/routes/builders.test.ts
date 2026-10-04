import { describe, expect, it } from 'vitest';

import {
  organizationAppointment,
  organizationAppointmentCreate,
  organizationAppointments,
  organizationDashboard,
  organizationLead,
  organizationLeadCreate,
  organizationLeads,
  organizationOfferingCreate,
  organizationOfferingEdit,
  organizationOfferings,
  organizationOffers,
  organizationPatientCreate,
  organizationPatients,
  organizationPicker,
  organizationSuspended,
} from './builders.ts';

describe('route builders', () => {
  it('return {to, params} objects consumable by typed Link/navigate', () => {
    expect(organizationPicker()).toEqual({ to: '/organization' });
    expect(organizationDashboard('acme')).toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationSuspended('acme')).toEqual({
      to: '/organization/$organizationSlug/suspended',
      params: { organizationSlug: 'acme' },
    });
  });

  it('build the Leads room and its dialog routes (S:22–25)', () => {
    expect(organizationLeads('acme')).toEqual({
      to: '/organization/$organizationSlug/leads',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationLead('acme', 'L1')).toEqual({
      to: '/organization/$organizationSlug/leads/$leadId',
      params: { organizationSlug: 'acme', leadId: 'L1' },
    });
    expect(organizationLeadCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/leads/create',
      params: { organizationSlug: 'acme' },
    });
  });

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

  it('build the Offerings room’s tabs and the Offering drawer’s dialog routes (S:98–101)', () => {
    expect(organizationOfferings('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferingCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings/create',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferingEdit('acme', 'O1')).toEqual({
      to: '/organization/$organizationSlug/offerings/$offeringId/edit',
      params: { organizationSlug: 'acme', offeringId: 'O1' },
    });
    expect(organizationOffers('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings/offers',
      params: { organizationSlug: 'acme' },
    });
  });

  it('build the Patients room and its New patient dialog route (S:30–31)', () => {
    expect(organizationPatients('acme')).toEqual({
      to: '/organization/$organizationSlug/patients',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationPatientCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/patients/create',
      params: { organizationSlug: 'acme' },
    });
  });
});
