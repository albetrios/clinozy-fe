import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  personOfHit,
  personOfLead,
  personOfPatient,
  usePersonRecordLabel,
} from './new-task-person.ts';

const ID = '55555555-5555-4555-8555-555555555555';
const OWNER = '77777777-7777-4777-8777-777777777777';

describe('the New task person', () => {
  it('reads a contact-search hit: a patient, a lead or a chat-only contact', () => {
    expect(
      personOfHit({
        kind: 'patient',
        id: ID,
        seq: 3508,
        name: 'Priti Soni',
        phone: '+919812345678',
        lastVisit: null,
      }),
    ).toEqual({
      kind: 'patient',
      id: ID,
      name: 'Priti Soni',
      seq: 3508,
      contact: false,
      ownerId: null,
    });
    expect(
      personOfHit({
        kind: 'lead',
        id: ID,
        seq: 2401,
        name: 'Zoya',
        phone: '+919812345679',
        contactThread: true,
      }),
    ).toMatchObject({ kind: 'lead', contact: true });
  });

  it('reads the patient or lead the URL names — a lead with its owner', () => {
    expect(
      personOfPatient({ id: ID, firstName: 'Priti', lastName: 'Soni', seq: 3508 }),
    ).toMatchObject({ kind: 'patient', name: 'Priti Soni', ownerId: null });
    expect(
      personOfLead({
        id: ID,
        name: 'Kabir Mehta',
        seq: 2370,
        ownerId: OWNER,
        isContactThread: false,
      }),
    ).toEqual({
      kind: 'lead',
      id: ID,
      name: 'Kabir Mehta',
      seq: 2370,
      contact: false,
      ownerId: OWNER,
    });
  });

  it('names the record: "Patient #…", "Lead #…", a contact by name', () => {
    const { result } = renderHook(() => usePersonRecordLabel());
    const base = { id: ID, contact: false, ownerId: null };
    expect(
      result.current({ ...base, kind: 'patient', name: 'Priti Soni', seq: 3508 }),
    ).toBe('Patient #3508');
    expect(result.current({ ...base, kind: 'lead', name: 'Kabir', seq: 2370 })).toBe(
      'Lead #2370',
    );
    expect(
      result.current({ ...base, kind: 'lead', name: 'Zoya', seq: 2401, contact: true }),
    ).toBe('Zoya');
  });
});
