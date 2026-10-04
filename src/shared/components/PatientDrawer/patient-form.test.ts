import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';

import {
  emptyPatientForm,
  followUpPresets,
  invalidPatientPhones,
  missingPatientFields,
  PATIENT_FORM_LIMITS,
  PATIENT_QUICK_FILLS,
  patientFormName,
  patientFormOf,
  patientInputOf,
  splitPatientName,
} from './patient-form.ts';

const BRANCH = '8f6a3e64-6b5c-4a76-9d0e-3f2d1c0b9a87';
const LEAD = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

describe('the patient form', () => {
  it('splits a prefilled name into First and Last', () => {
    expect(splitPatientName('  Priya   Shah Mehta ')).toEqual({
      firstName: 'Priya',
      lastName: 'Shah Mehta',
    });
    expect(splitPatientName('Priya')).toEqual({ firstName: 'Priya', lastName: '' });
    expect(splitPatientName('')).toEqual({ firstName: '', lastName: '' });
  });

  it('starts a new patient at New and Aesthetic, the prefill’s name and mobile in', () => {
    const form = emptyPatientForm({ name: 'Priya Shah', phone: '+919876543210' });
    expect(form).toMatchObject({
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '9876543210',
      phone2: '',
      status: 'new',
      conversion: null,
      types: ['aesthetic'],
      consents: [],
      homeBranchId: null,
      followUpDate: null,
    });
    expect(emptyPatientForm().firstName).toBe('');
  });

  it('takes a booking’s care types and reason as the types and notes it starts with', () => {
    const form = emptyPatientForm({
      name: 'Riya',
      types: ['lhr', 'clinical'],
      notes: 'x'.repeat(1200),
    });
    expect(form.types).toEqual(['lhr', 'clinical']);
    expect(form.notes).toHaveLength(PATIENT_FORM_LIMITS.notes);
    expect(emptyPatientForm({ notes: 'Pigmentation on cheeks' }).notes).toBe(
      'Pigmentation on cheeks',
    );
  });

  it('reads a saved patient back, the follow-up as its clinic-local day and time', () => {
    const patient = {
      firstName: 'Dharti',
      lastName: null,
      phone: '+919825044120',
      phone2: null,
      address: null,
      homeBranchId: BRANCH,
      gender: 'female',
      dateOfBirth: '1995-10-27',
      types: ['aesthetic'],
      status: 'regular',
      conversion: 'converted',
      referredByName: null,
      referralSource: 'instagram',
      followUpAt: clinicInstant('2026-10-05', '14:50'),
      notes: 'Prefers mornings',
      consents: ['data'],
    } as unknown as PatientRecord;
    expect(patientFormOf(patient)).toMatchObject({
      firstName: 'Dharti',
      lastName: '',
      phone: '9825044120',
      phone2: '',
      followUpDate: '2026-10-05',
      followUpTime: '14:50',
      notes: 'Prefers mornings',
    });
  });

  it('turns the form into the contract’s fields: trimmed, E.164, the follow-up instant', () => {
    const input = patientInputOf(
      {
        ...emptyPatientForm({ name: ' Priya  Shah ' }),
        phone: '9876543210',
        phone2: '9123456780',
        address: '  ',
        types: ['lhr'],
        followUpDate: '2026-10-05',
        followUpTime: null,
        notes: ' Allergic to latex ',
      },
      { defaultBranchId: BRANCH, leadId: LEAD },
    );
    expect(input).toMatchObject({
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '+919876543210',
      phone2: '+919123456780',
      address: null,
      homeBranchId: BRANCH,
      types: ['lhr'],
      // Only the day picked: 11:00, the quick chips' hour.
      followUpAt: clinicInstant('2026-10-05', '11:00'),
      notes: 'Allergic to latex',
      leadId: LEAD,
    });
  });

  it('leaves the home branch to the server when none is known, and no lead without one', () => {
    const input = patientInputOf(
      { ...emptyPatientForm(), firstName: 'A', phone: '9876543210' },
      { defaultBranchId: null },
    );
    expect(input).not.toHaveProperty('homeBranchId');
    expect(input).not.toHaveProperty('leadId');
    expect(input.followUpAt).toBeNull();
  });

  it('names the empty required fields and the mobiles that are not ten digits', () => {
    expect(missingPatientFields({ firstName: ' ', phone: '' })).toEqual([
      'firstName',
      'phone',
    ]);
    expect(missingPatientFields({ firstName: 'Priya', phone: '98' })).toEqual([]);
    expect(invalidPatientPhones({ phone: '98765', phone2: '' })).toEqual(['phone']);
    // A mobile starts 6–9 (`S:297`).
    expect(invalidPatientPhones({ phone: '9876543210', phone2: '1234567890' })).toEqual([
      'phone2',
    ]);
    expect(invalidPatientPhones({ phone: '9876543210', phone2: '' })).toEqual([]);
  });

  it('names the patient from the form', () => {
    expect(patientFormName({ firstName: ' Priya ', lastName: '' })).toBe('Priya');
    expect(patientFormName({ firstName: 'Priya', lastName: 'Shah' })).toBe('Priya Shah');
  });

  it('computes the Follow-up chips from today: tomorrow 10:30, then 11:00', () => {
    expect(followUpPresets('2026-09-28')).toEqual([
      { id: 'tomorrow', date: '2026-09-29', time: '10:30' },
      { id: 'week', date: '2026-10-05', time: '11:00' },
      { id: 'twentyDays', date: '2026-10-18', time: '11:00' },
      { id: 'month', date: '2026-10-28', time: '11:00' },
    ]);
    expect(followUpPresets('2027-01-31').at(-1)).toMatchObject({ date: '2027-02-28' });
  });

  it('keeps the Quick fill presets of the design, in order', () => {
    expect(PATIENT_QUICK_FILLS.map((fill) => [fill.id, fill.tone])).toEqual([
      ['walkIn', 'butter'],
      ['referred', 'lav'],
      ['instagram', 'blush'],
      ['lhr', 'blush'],
    ]);
    expect(PATIENT_QUICK_FILLS[0]?.values).toEqual({
      status: 'new',
      referralSource: 'walk_in',
      followUpDate: null,
      followUpTime: null,
    });
    expect(PATIENT_QUICK_FILLS[3]?.values).toEqual({ types: ['lhr'], status: 'new' });
  });
});
