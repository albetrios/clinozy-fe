import { describe, expect, it } from 'vitest';

import type { AppointmentPerson } from '@/shared/api/clinic/appointments-contracts.ts';

import {
  APPOINTMENT_TYPE_TONES,
  appointmentContactCard,
  serviceTone,
} from './appointment-display.ts';

const person = (overrides: Partial<AppointmentPerson>): AppointmentPerson => ({
  kind: 'patient',
  name: 'Dharti Galani',
  phone: '+919825044120',
  patientId: '5f0c4c1e-4f7e-4c9a-8a51-3a0c2b1d9e01',
  leadId: null,
  seq: 3508,
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
  it('reads a patient with their display id and WhatsApp number', () => {
    expect(appointmentContactCard(person({}))).toEqual({
      kind: 'patient',
      name: 'Dharti Galani',
      displayId: '#3508',
      reach: [{ channel: 'whatsapp', phone: '+919825044120' }],
    });
  });

  it('reads a lead by its lead id and a contact with no id or reach', () => {
    expect(appointmentContactCard(person({ kind: 'lead', seq: 2352 })).displayId).toBe(
      '#2352',
    );
    expect(
      appointmentContactCard(person({ kind: 'contact', seq: null, phone: null })),
    ).toMatchObject({ kind: 'contact', displayId: null, reach: [] });
  });
});
