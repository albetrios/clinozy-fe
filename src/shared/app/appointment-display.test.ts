import { describe, expect, it } from 'vitest';

import type { AppointmentPerson } from '@/shared/api/app/appointments-contracts.ts';

import {
  APPOINTMENT_TYPE_TONES,
  appointmentContactCard,
  serviceTone,
} from './appointment-display.ts';

const person = (overrides: Partial<AppointmentPerson>): AppointmentPerson => ({
  kind: 'patient',
  contactId: 'con_dharti000000000000000',
  name: 'Dharti Galani',
  phone: '+919825044120',
  patientId: 'pat_dharti000000000000000',
  leadId: null,
  contactNumber: 10234,
  ...overrides,
});

describe('serviceTone', () => {
  it('paints the design’s services by label (AP_SVC, H:3416)', () => {
    expect(serviceTone({ serviceLabel: 'Hydrafacial', type: 'treatment' })).toBe('mint');
    expect(serviceTone({ serviceLabel: 'LHR Treatment', type: 'treatment' })).toBe('lav');
    expect(serviceTone({ serviceLabel: ' peel ', type: 'treatment' })).toBe('blush');
  });

  it('falls back to the type’s tone for a service the design does not name', () => {
    expect(serviceTone({ serviceLabel: 'Melasma consult', type: 'consultation' })).toBe(
      'sky',
    );
    expect(serviceTone({ serviceLabel: 'Laser session', type: 'package_session' })).toBe(
      'lav',
    );
  });

  it('gives every type the design’s tone (AP_TYPE, H:3418)', () => {
    expect(APPOINTMENT_TYPE_TONES).toEqual({
      consultation: 'sky',
      follow_up: 'mint',
      treatment: 'sage',
      package_session: 'lav',
      other: 'stone',
    });
  });
});

describe('appointmentContactCard', () => {
  it('reads a patient with their contact number and WhatsApp number', () => {
    expect(appointmentContactCard(person({}))).toEqual({
      kind: 'patient',
      name: 'Dharti Galani',
      displayId: 'C-10234',
      reach: [{ channel: 'whatsapp', phone: '+919825044120' }],
    });
  });

  it('names a lead and a contact by their contact number too — a booking carries no other', () => {
    expect(
      appointmentContactCard(
        person({ kind: 'lead', patientId: null, leadId: 'lead_dharti00000000000000' }),
      ).displayId,
    ).toBe('C-10234');
    expect(
      appointmentContactCard(person({ kind: 'contact', patientId: null })).displayId,
    ).toBe('C-10234');
  });

  it('shows no id and no reach once the contact is gone', () => {
    expect(
      appointmentContactCard(
        person({ kind: 'contact', name: '', contactNumber: null, phone: null }),
      ),
    ).toMatchObject({ kind: 'contact', displayId: null, reach: [] });
  });
});
