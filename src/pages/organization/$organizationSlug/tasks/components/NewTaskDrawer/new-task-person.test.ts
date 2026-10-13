import { describe, expect, it } from 'vitest';

import { personOfContact, personOfLead } from './new-task-person.ts';

const LEAD = 'lead_hplz5ew0h3tw99ntqf39w';

const contact = {
  id: 'con_8hb15isod6txlpljrn1f7',
  name: 'Anaya Desai',
  firstName: 'Anaya',
  primaryPhone: '+919826005869',
  patientId: null,
  openLeadId: LEAD,
};

describe('personOfContact (a search hit, `?contact=`)', () => {
  it('reads a lead’s person as a lead, her task pointing at the open lead', () => {
    expect(personOfContact(contact)).toEqual({
      contactId: contact.id,
      name: 'Anaya Desai',
      firstName: 'Anaya',
      kind: 'lead',
      phone: '+919826005869',
      openLeadId: LEAD,
      leadId: LEAD,
    });
  });

  it('never points a patient’s task at their open lead — a reassign would move the lead', () => {
    expect(
      personOfContact({ ...contact, patientId: 'pat_9e6j52vjb8uhvz44ebe94' }),
    ).toMatchObject({ kind: 'patient', openLeadId: LEAD, leadId: null });
  });

  it('reads someone with neither as a contact', () => {
    expect(personOfContact({ ...contact, openLeadId: null })).toMatchObject({
      kind: 'contact',
      openLeadId: null,
      leadId: null,
    });
  });
});

describe('personOfLead (`?lead=`)', () => {
  const lead = {
    id: LEAD,
    contactId: contact.id,
    name: 'Anaya Desai',
    person: null,
    phone: null,
    patientId: null,
    ownerId: 'mem_asha0000000000000000',
  };

  it('points the task at the lead it was opened from', () => {
    expect(personOfLead(lead)).toEqual({
      contactId: contact.id,
      name: 'Anaya Desai',
      firstName: 'Anaya',
      kind: 'lead',
      phone: null,
      openLeadId: LEAD,
      leadOwnerId: 'mem_asha0000000000000000',
      leadId: LEAD,
    });
  });

  it('keeps the lead link for a patient’s lead it was opened from', () => {
    expect(
      personOfLead({ ...lead, patientId: 'pat_9e6j52vjb8uhvz44ebe94' }),
    ).toMatchObject({ kind: 'patient', leadId: LEAD });
  });
});
