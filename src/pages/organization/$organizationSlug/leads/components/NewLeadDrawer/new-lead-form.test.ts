import { describe, expect, it } from 'vitest';

import type { LeadContactHit } from '@/shared/api/clinic/leads-contracts.ts';

import {
  hasNewLeadContact,
  NEW_LEAD_PRESETS,
  newLeadForm,
  newLeadInputOf,
  presetPressed,
  withoutContact,
  withoutOrigin,
  withPickedContact,
} from './new-lead-form.ts';

const ME = '7a1d1c3e-9a43-4f0b-8f43-0d6f0b8f5d11';
const PATIENT: LeadContactHit = {
  kind: 'patient',
  id: 'b0f9a2e4-8f1a-4c51-9b9c-3c2f5d7e1a01',
  seq: 3508,
  name: 'Dharti Galani',
  phone: '+918200603212',
  lastVisit: '2026-09-24',
};
const LEAD: LeadContactHit = {
  kind: 'lead',
  id: 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b',
  seq: 2365,
  name: 'Rhea Shah',
  phone: '+919825011241',
  contactThread: false,
  contact: {
    phones: [
      { phone: '+919825011241', whatsapp: true },
      { phone: '+919099055120', whatsapp: true },
    ],
    instagram: ['@rhea'],
    defaultChannel: 'instagram',
    preferences: ['No calls'],
  },
};

describe('the New lead form', () => {
  it('starts on WhatsApp and New, the signed-in member owning it', () => {
    const form = newLeadForm({}, ME);
    expect(form).toMatchObject({ source: 'whatsapp', status: 'new', ownerId: ME });
    expect(hasNewLeadContact(form)).toBe(false);
  });

  it('starts with the person known from the prefill', () => {
    const form = newLeadForm({ name: ' Priya Shah ', phone: '+919898011111' }, ME);
    expect(hasNewLeadContact(form)).toBe(true);
    expect(form.contact.phones).toEqual([{ digits: '9898011111', whatsapp: true }]);
  });

  it('presses a preset only while the form holds both of its values', () => {
    const [walkIn, phoneCall] = NEW_LEAD_PRESETS;
    const form = {
      ...newLeadForm({}, ME),
      source: walkIn!.source,
      status: walkIn!.status,
    };
    expect(presetPressed(form, walkIn!)).toBe(true);
    expect(presetPressed(form, phoneCall!)).toBe(false);
    expect(presetPressed({ ...form, status: 'new' }, walkIn!)).toBe(false);
  });

  it('links a picked patient as a Re-target, and a picked lead with their contact', () => {
    const fromPatient = withPickedContact(newLeadForm({}, ME), PATIENT);
    expect(fromPatient).toMatchObject({
      source: 'retarget',
      origin: { kind: 'patient', id: PATIENT.id, seq: 3508 },
    });
    expect(fromPatient.contact.name).toBe('Dharti Galani');

    const fromLead = withPickedContact(newLeadForm({}, ME), LEAD);
    expect(fromLead.source).toBe('whatsapp');
    expect(fromLead.origin).toEqual({ kind: 'lead', id: LEAD.id, seq: 2365 });
    expect(fromLead.contact).toMatchObject({
      instagram: ['@rhea'],
      defaultChannel: 'instagram',
      preferences: ['No calls'],
    });
  });

  it('"Change" clears the person and the link, and puts WhatsApp back', () => {
    const changed = withoutContact({
      ...withPickedContact(newLeadForm({}, ME), PATIENT),
      status: 'contacted',
    });
    expect(hasNewLeadContact(changed)).toBe(false);
    expect(changed).toMatchObject({
      origin: null,
      source: 'whatsapp',
      status: 'contacted',
    });
  });

  it('the linked notice’s Undo keeps the person, unlinked', () => {
    const unlinked = withoutOrigin(withPickedContact(newLeadForm({}, ME), PATIENT));
    expect(unlinked.origin).toBeNull();
    expect(unlinked.source).toBe('whatsapp');
    expect(unlinked.contact.name).toBe('Dharti Galani');

    const keptSource = withoutOrigin({
      ...withPickedContact(newLeadForm({}, ME), LEAD),
      source: 'google',
    });
    expect(keptSource.source).toBe('google');
  });

  it('sends nothing until there is a name and a 10-digit mobile', () => {
    expect(newLeadInputOf(newLeadForm({}, ME))).toBeNull();
    expect(newLeadInputOf(newLeadForm({ name: 'Priya' }, ME))).toBeNull();
  });

  it('sends the person, the details and the patient link', () => {
    const form = {
      ...withPickedContact(newLeadForm({}, ME), PATIENT),
      interests: ['peel' as const],
      customInterests: ['Acne scars'],
      involvedIds: [ME, 'd2e3f4a5-b6c7-4d8e-9f01-a2b3c4d5e6f7'],
    };
    expect(newLeadInputOf(form)).toEqual({
      name: 'Dharti Galani',
      phone: '+918200603212',
      contact: {
        phones: [{ phone: '+918200603212', whatsapp: true }],
        instagram: [],
        defaultChannel: 'whatsapp',
        preferences: [],
      },
      source: 'retarget',
      status: 'new',
      interests: ['peel'],
      customInterests: ['Acne scars'],
      ownerId: ME,
      // The owner is never also involved.
      involvedIds: ['d2e3f4a5-b6c7-4d8e-9f01-a2b3c4d5e6f7'],
      patientId: PATIENT.id,
    });
  });
});
