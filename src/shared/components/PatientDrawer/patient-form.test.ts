import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { TEST_BRANCH_ID } from '@/tests/utils/appointment-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';

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

const BRANCH = TEST_BRANCH_ID;

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
    const patient = patientRecord({
      firstName: 'Dharti',
      lastName: null,
      phone: '+919825044120',
      address: null,
      status: 'regular',
      conversion: 'converted',
      referralSource: 'instagram',
      followUpAt: clinicInstant('2026-10-05', '14:50'),
      notes: 'Prefers mornings',
      consents: ['data', 'marketing'],
    });
    expect(patientFormOf(patient)).toMatchObject({
      firstName: 'Dharti',
      lastName: '',
      phone: '9825044120',
      phone2: '',
      address: '',
      homeBranchId: BRANCH,
      gender: 'female',
      dateOfBirth: '1995-10-27',
      types: ['aesthetic'],
      status: 'regular',
      conversion: 'converted',
      referralSource: 'instagram',
      followUpDate: '2026-10-05',
      followUpTime: '14:50',
      notes: 'Prefers mornings',
      consents: ['data', 'marketing'],
    });
    expect(patientFormOf(patientRecord({ phone2: '+919123456780' })).phone2).toBe(
      '9123456780',
    );
    expect(patientFormOf(patientRecord()).followUpDate).toBeNull();
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
        consents: ['data', 'photos'],
      },
      { defaultBranchId: BRANCH },
    );
    expect(input).toEqual({
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '+919876543210',
      phone2: '+919123456780',
      address: null,
      homeBranchId: BRANCH,
      gender: null,
      dateOfBirth: null,
      types: ['lhr'],
      status: 'new',
      conversion: null,
      referredByName: null,
      referralSource: null,
      // Only the day picked: 11:00, the quick chips' hour.
      followUpAt: clinicInstant('2026-10-05', '11:00'),
      notes: 'Allergic to latex',
      consents: ['data', 'photos'],
    });
  });

  it('saves the picked home branch over the default, and leaves none to the server', () => {
    const picked = patientInputOf(
      {
        ...emptyPatientForm(),
        firstName: 'A',
        phone: '9876543210',
        homeBranchId: 'brn_other',
      },
      { defaultBranchId: BRANCH },
    );
    expect(picked.homeBranchId).toBe('brn_other');
    const unknown = patientInputOf(
      { ...emptyPatientForm(), firstName: 'A', phone: '9876543210' },
      { defaultBranchId: null },
    );
    // Without a branch the server names the field (a 422 on `home_branch_id`).
    expect(unknown.homeBranchId).toBe('');
    expect(unknown.phone2).toBeNull();
    expect(unknown.followUpAt).toBeNull();
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
