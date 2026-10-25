import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANCH_HOURS } from '@/shared/app/branch-hours.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';

import {
  branchInputOf,
  initialLocationForm,
  locationBranchInput,
  locationBranchUpdate,
  locationFormFromBranch,
  type LocationFormValues,
  locationProblems,
  locationQuestionProblems,
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
    expect(DEFAULT_BRANCH_HOURS.workingDays).not.toContain('sun');
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

  it('does not check the hours — setup never asks them', () => {
    expect(locationProblems(filled({ opensAt: '18:00', closesAt: '09:00' }))).toEqual({});
  });
});

describe('locationQuestionProblems', () => {
  it('names only the open question’s own fields', () => {
    const empty = filled({ pin: '', addressLine: '', area: '', phone: '' });
    expect(locationQuestionProblems(empty, 'pin')).toEqual({ pin: 'required' });
    expect(locationQuestionProblems(empty, 'address')).toEqual({
      addressLine: 'required',
      area: 'required',
    });
    expect(locationQuestionProblems(empty, 'phone')).toEqual({ phone: 'required' });
  });

  it('names the defaults the phone saves with it — the branch name and the email', () => {
    expect(locationQuestionProblems(filled({ name: ' ', email: 'x' }), 'phone')).toEqual({
      name: 'required',
      email: 'email',
    });
  });
});

describe('locationFormFromBranch', () => {
  it('reads a saved branch back into the answers, the phone as its ten digits', () => {
    const branch = appBranch({ isMain: true });
    expect(locationFormFromBranch(branch)).toEqual({
      pin: '395007',
      area: 'Vesu',
      city: 'Surat',
      state: 'Gujarat',
      addressLine: '12, Ocean Arcade',
      phone: '9876543210',
      email: 'vesu@clinic.com',
      name: 'Vesu',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      opensAt: '10:00',
      closesAt: '19:00',
    });
  });
});

describe('locationBranchUpdate', () => {
  it('lays the place and the phone over the saved branch, keeping the rest', () => {
    const branch = appBranch({
      isMain: true,
      defaultDoctorId: 'mem_doctoraaaaaaaaaaaaaaa',
    });
    const input = locationBranchUpdate(branch, {
      ...locationFormFromBranch(branch),
      addressLine: '7 Ring Road',
      phone: '9123456780',
      name: 'Ignored',
    });
    expect(input).toEqual({
      ...branchInputOf(branch),
      addressLine1: '7 Ring Road',
      phone: '+919123456780',
    });
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
