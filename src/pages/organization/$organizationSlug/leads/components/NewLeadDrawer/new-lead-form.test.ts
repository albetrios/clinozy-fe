import { describe, expect, it } from 'vitest';

import { NIDHI, RIYA } from '../../__tests__/integration/leads-test-data.ts';
import {
  hasNewLeadContact,
  NEW_LEAD_PRESETS,
  type NewLeadForm,
  newLeadForm,
  newLeadInputOf,
  type NewLeadPicked,
  presetPressed,
  withoutContact,
  withPickedContact,
} from './new-lead-form.ts';

const ME = RIYA.id;

/** A person the search found who already has a patient file. */
const PATIENT: NewLeadPicked = {
  id: 'con_dharti000000000000000',
  contactNumber: 10871,
  name: 'Dharti Galani',
  primaryPhone: '+918200603212',
  instagramHandles: [],
  patientId: 'pat_dharti000000000000000',
  openLeadId: null,
};

/** A person the search found who is only a contact. */
const KNOWN: NewLeadPicked = {
  id: 'con_rhea0000000000000000',
  contactNumber: 10412,
  name: 'Rhea Shah',
  primaryPhone: '+919825011241',
  instagramHandles: ['@rhea'],
  patientId: null,
  openLeadId: null,
};

/** A new person typed into the contact editor. */
function typedForm(overrides: Partial<NewLeadForm> = {}): NewLeadForm {
  const form = newLeadForm({ name: 'Priya Mehta', phone: '+919898011111' }, ME);
  return { ...form, ...overrides };
}

describe('the New lead form', () => {
  it('starts on WhatsApp and New, the signed-in member owning it, no person yet', () => {
    const form = newLeadForm({}, ME);
    expect(form).toMatchObject({
      picked: null,
      source: 'whatsapp',
      status: 'new',
      interests: [],
      ownerId: ME,
      involvedIds: [],
    });
    expect(hasNewLeadContact(form)).toBe(false);
    expect(newLeadForm({}, null).ownerId).toBeNull();
  });

  it('starts with the person known from the prefill, split into first and last name', () => {
    const form = newLeadForm({ name: ' Priya  Mehta Shah ', phone: '+919898011111' }, ME);
    expect(form.contact).toMatchObject({
      firstName: 'Priya',
      lastName: 'Mehta Shah',
      phones: [{ digits: '9898011111', whatsapp: true }],
    });
    expect(hasNewLeadContact(form)).toBe(true);
    expect(hasNewLeadContact(newLeadForm({ phone: '+919898011111' }, ME))).toBe(false);
  });

  it('offers Walk-in and Instagram DM, each setting only the source', () => {
    expect(NEW_LEAD_PRESETS.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: 'walkIn', source: 'walk_in' },
      { id: 'instagramDm', source: 'instagram' },
    ]);
    const [walkIn, instagramDm] = NEW_LEAD_PRESETS as [
      (typeof NEW_LEAD_PRESETS)[number],
      (typeof NEW_LEAD_PRESETS)[number],
    ];
    const form = { ...newLeadForm({}, ME), source: walkIn.source };
    expect(form.status).toBe('new');
    expect(presetPressed(form, walkIn)).toBe(true);
    expect(presetPressed(form, instagramDm)).toBe(false);
    expect(presetPressed({ ...form, status: 'contacted' }, walkIn)).toBe(true);
  });

  it('creates a lead for a picked patient as a Re-target, the typed person cleared', () => {
    const picked = withPickedContact(typedForm({ status: 'contacted' }), PATIENT);
    expect(picked).toMatchObject({
      picked: PATIENT,
      source: 'retarget',
      status: 'contacted',
    });
    expect(picked.contact.firstName).toBe('');
    expect(hasNewLeadContact(picked)).toBe(true);
  });

  it('keeps the source for a picked person with no patient file', () => {
    const picked = withPickedContact({ ...newLeadForm({}, ME), source: 'google' }, KNOWN);
    expect(picked).toMatchObject({ picked: KNOWN, source: 'google' });
  });

  it('"Change" clears the person and puts WhatsApp back, the status kept', () => {
    const changed = withoutContact({
      ...withPickedContact(newLeadForm({}, ME), PATIENT),
      status: 'follow_up',
    });
    expect(hasNewLeadContact(changed)).toBe(false);
    expect(changed).toMatchObject({
      picked: null,
      source: 'whatsapp',
      status: 'follow_up',
    });
    expect(changed.contact.phones).toEqual([{ digits: '', whatsapp: true }]);
  });

  it('sends nothing until a new person has a first name and a 10-digit mobile', () => {
    expect(newLeadInputOf(newLeadForm({}, ME))).toBeNull();
    expect(newLeadInputOf(newLeadForm({ name: 'Priya' }, ME))).toBeNull();
    expect(newLeadInputOf(newLeadForm({ phone: '+919898011111' }, ME))).toBeNull();
    const short = typedForm();
    expect(
      newLeadInputOf({
        ...short,
        contact: { ...short.contact, phones: [{ digits: '98980', whatsapp: true }] },
      }),
    ).toBeNull();
  });

  it('sends a picked person by their contact id, and the lead’s fields', () => {
    const form = {
      ...withPickedContact(newLeadForm({}, ME), PATIENT),
      interests: ['peel' as const, 'others' as const],
    };
    expect(newLeadInputOf(form)).toEqual({
      person: { contactId: PATIENT.id },
      fields: {
        status: 'new',
        source: 'retarget',
        interests: ['peel', 'others'],
        ownerId: ME,
        involvedIds: [],
        followUpAt: null,
        branchId: null,
        notes: null,
      },
    });
  });

  it('sends a new person’s contact fields, the owner never also involved', () => {
    const typed = typedForm({ source: 'instagram', involvedIds: [ME, NIDHI.id] });
    const form = {
      ...typed,
      contact: {
        ...typed.contact,
        lastName: '  ',
        instagram: [' @priya ', ''],
        preferences: ['no_calls'],
      },
    };
    expect(newLeadInputOf(form)).toEqual({
      person: {
        contact: {
          firstName: 'Priya',
          lastName: null,
          phones: [{ phone: '+919898011111', isOnWhatsapp: true }],
          instagramHandles: ['@priya'],
          defaultChannel: 'whatsapp',
          preferenceTags: ['no_calls'],
        },
      },
      fields: {
        status: 'new',
        source: 'instagram',
        interests: [],
        ownerId: ME,
        involvedIds: [NIDHI.id],
        followUpAt: null,
        branchId: null,
        notes: null,
      },
    });
  });
});
