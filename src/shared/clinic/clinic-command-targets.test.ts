import { describe, expect, it } from 'vitest';

import {
  CLINIC_COMMAND_TARGETS,
  clinicCommandNavigation,
} from './clinic-command-targets.ts';
import { CLINIC_SECTION_ROUTES } from './clinic-home.ts';

const ORG = '/organization/$organizationSlug';
const PATIENT = '0b6d2f0e-5c7a-4c1e-9b2a-3d4e5f6a7b8c';

describe('CLINIC_COMMAND_TARGETS (KICKOFF §6.0, D24)', () => {
  it('opens each create action on its form route and Open tasks on the room', () => {
    expect(CLINIC_COMMAND_TARGETS).toMatchObject({
      newLead: `${ORG}/leads/create`,
      newAppointment: `${ORG}/appointments/create`,
      newPatient: `${ORG}/patients/create`,
      newReceipt: `${ORG}/payments/receive`,
      openTasks: CLINIC_SECTION_ROUTES.tasks,
    });
  });

  it('opens each record on its own route (D19 / D26; §7.3)', () => {
    expect(CLINIC_COMMAND_TARGETS).toMatchObject({
      patient: `${ORG}/patients/$patientId`,
      lead: `${ORG}/leads/$leadId`,
      invoice: `${ORG}/invoices/$invoiceId`,
    });
  });

  it('takes Today’s lane actions and Save & sell to the Visit sheet and the sale drawer (§6.2)', () => {
    expect(
      clinicCommandNavigation('visit', {
        organizationSlug: 'acme',
        recordId: PATIENT,
        search: { tab: 'consult' },
      }),
    ).toEqual({
      to: `${ORG}/visits/$visitId`,
      params: { organizationSlug: 'acme', visitId: PATIENT },
      search: { tab: 'consult' },
    });
    expect(
      clinicCommandNavigation('newSale', {
        organizationSlug: 'acme',
        referrer: 'today',
        search: { prescription: PATIENT },
      }),
    ).toEqual({
      to: `${ORG}/medical/sales/create`,
      params: { organizationSlug: 'acme' },
      search: { prescription: PATIENT, from: 'today' },
    });
    // The Rx drawer's "Save & sell" (L-45) keeps the prescriptions section behind it.
    expect(
      clinicCommandNavigation('newSale', {
        organizationSlug: 'acme',
        referrer: `patients/${PATIENT}/prescriptions`,
        search: { prescription: 'rx-1' },
      }).search,
    ).toEqual({ prescription: 'rx-1', from: `patients/${PATIENT}/prescriptions` });
  });

  it('takes the Patients row actions to the other rooms’ drawers (§6.5)', () => {
    expect(CLINIC_COMMAND_TARGETS).toMatchObject({
      newInvoice: `${ORG}/invoices/create`,
      patientEdit: `${ORG}/patients/$patientId/edit`,
    });
    expect(
      clinicCommandNavigation('patientEdit', {
        organizationSlug: 'acme',
        recordId: PATIENT,
        referrer: 'patients',
      }),
    ).toEqual({
      to: `${ORG}/patients/$patientId/edit`,
      params: { organizationSlug: 'acme', patientId: PATIENT },
    });
    expect(
      clinicCommandNavigation('newInvoice', {
        organizationSlug: 'acme',
        referrer: 'patients',
        search: { type: 'clinic', patient: PATIENT },
      }).search,
    ).toEqual({ type: 'clinic', patient: PATIENT, from: 'patients' });
  });
});

describe('clinicCommandNavigation', () => {
  it('names the record by its route param', () => {
    expect(
      clinicCommandNavigation('patient', {
        organizationSlug: 'acme',
        recordId: PATIENT,
        search: { activity: 'open' },
      }),
    ).toEqual({
      to: `${ORG}/patients/$patientId`,
      params: { organizationSlug: 'acme', patientId: PATIENT },
      search: { activity: 'open' },
    });
    expect(
      clinicCommandNavigation('lead', { organizationSlug: 'acme', recordId: 'l-1' })
        .params,
    ).toEqual({ organizationSlug: 'acme', leadId: 'l-1' });
  });

  it('keeps the page it opens from behind the drawers that take `from`', () => {
    for (const target of [
      'newAppointment',
      'newReceipt',
      'newInvoice',
      'invoice',
      'newSale',
    ] as const) {
      expect(
        clinicCommandNavigation(target, {
          organizationSlug: 'acme',
          recordId: 'i-1',
          referrer: 'today',
        }).search,
      ).toEqual({ from: 'today' });
    }
  });

  it('leaves `from` out where the target opens over its own room, or there is none', () => {
    expect(
      clinicCommandNavigation('newLead', { organizationSlug: 'acme', referrer: 'today' }),
    ).toEqual({ to: `${ORG}/leads/create`, params: { organizationSlug: 'acme' } });
    expect(
      clinicCommandNavigation('newReceipt', { organizationSlug: 'acme', referrer: null }),
    ).toEqual({ to: `${ORG}/payments/receive`, params: { organizationSlug: 'acme' } });
  });
});
