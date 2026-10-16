import { describe, expect, it } from 'vitest';

import {
  initialLocationForm,
  locationBranchInput,
  type LocationFormValues,
  locationProblems,
  SETUP_BRANCH_HOURS,
} from './setup-location-form.ts';

/** A step filled in as an owner would, ready to save. */
function filled(overrides: Partial<LocationFormValues> = {}): LocationFormValues {
  return {
    ...initialLocationForm({ clinicName: 'Acme Skin Clinic', email: 'owner@acme.test' }),
    pin: '395007',
    area: 'Vesu',
    city: 'Surat',
    state: 'Gujarat',
    addressLine: '12 Ring Road',
    phone: '98250 44120',
    ...overrides,
  };
}

describe('initialLocationForm', () => {
  it('starts on the clinic’s name, the owner’s email and Monday–Saturday 10:00–20:00', () => {
    expect(
      initialLocationForm({ clinicName: 'Acme Skin Clinic', email: 'owner@acme.test' }),
    ).toEqual({
      pin: '',
      area: '',
      city: '',
      state: '',
      addressLine: '',
      phone: '',
      email: 'owner@acme.test',
      name: 'Acme Skin Clinic',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      opensAt: '10:00',
      closesAt: '20:00',
    });
  });

  it('cuts the clinic’s name to the branch name’s 60 characters (F3), trimmed', () => {
    const long = `  ${'A'.repeat(80)}  `;
    expect(initialLocationForm({ clinicName: long, email: '' }).name).toBe(
      'A'.repeat(60),
    );
  });

  it('gives each form its own working days — the default is never shared', () => {
    const form = initialLocationForm({ clinicName: 'Acme', email: '' });
    form.workingDays.push('sun');
    expect(SETUP_BRANCH_HOURS.workingDays).not.toContain('sun');
  });
});

describe('locationProblems', () => {
  it('finds nothing in a filled step', () => {
    expect(locationProblems(filled())).toEqual({});
  });

  it('names every required field left empty or blank', () => {
    expect(
      locationProblems(
        filled({
          pin: '',
          addressLine: ' ',
          area: '',
          city: '',
          phone: '',
          email: '',
          name: '',
        }),
      ),
    ).toEqual({
      pin: 'required',
      addressLine: 'required',
      area: 'required',
      city: 'required',
      phone: 'required',
      email: 'required',
      name: 'required',
    });
  });

  it('needs no state — the PIN directory may not know it', () => {
    expect(locationProblems(filled({ state: '' }))).toEqual({});
  });

  it('takes six digits not starting with 0 as a PIN', () => {
    expect(locationProblems(filled({ pin: '395007' })).pin).toBeUndefined();
    expect(locationProblems(filled({ pin: '012345' })).pin).toBe('pin');
    expect(locationProblems(filled({ pin: '39500' })).pin).toBe('pin');
    expect(locationProblems(filled({ pin: '3950071' })).pin).toBe('pin');
    expect(locationProblems(filled({ pin: '39500a' })).pin).toBe('pin');
  });

  it('refuses an email or a phone that does not read as one', () => {
    expect(locationProblems(filled({ email: 'owner@' })).email).toBe('email');
    expect(
      locationProblems(filled({ email: ' owner@acme.test ' })).email,
    ).toBeUndefined();
    expect(locationProblems(filled({ phone: '12345' })).phone).toBe('phone');
    expect(locationProblems(filled({ phone: '+91 98250-44120' })).phone).toBeUndefined();
  });

  it('refuses hours that close at or before they open', () => {
    expect(
      locationProblems(filled({ opensAt: '10:00', closesAt: '10:00' })).closesAt,
    ).toBe('hours');
    expect(
      locationProblems(filled({ opensAt: '18:00', closesAt: '09:00' })).closesAt,
    ).toBe('hours');
  });
});

describe('locationBranchInput', () => {
  it('is the branch create’s fields, trimmed, the phone as the contract stores it', () => {
    expect(
      locationBranchInput(
        filled({
          name: ' Acme Vesu ',
          addressLine: ' 12 Ring Road ',
          area: ' Vesu ',
          city: ' Surat ',
          state: ' Gujarat ',
          email: ' owner@acme.test ',
        }),
      ),
    ).toEqual({
      name: 'Acme Vesu',
      tone: 'sage',
      active: true,
      addressLine1: '12 Ring Road',
      addressLine2: null,
      area: 'Vesu',
      city: 'Surat',
      state: 'Gujarat',
      pin: '395007',
      phone: '+919825044120',
      email: 'owner@acme.test',
      gstNumber: null,
      reviewLink: null,
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      opensAt: '10:00',
      closesAt: '20:00',
      defaultDoctorId: null,
      defaultDeskId: null,
      defaultTherapistId: null,
      defaultPharmacistId: null,
    });
  });

  it('keeps a phone it cannot read as typed — the server says what is wrong', () => {
    expect(locationBranchInput(filled({ phone: '12345' })).phone).toBe('12345');
  });
});
