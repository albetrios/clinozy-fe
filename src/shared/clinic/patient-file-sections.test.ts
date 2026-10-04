import { describe, expect, it } from 'vitest';

import { PATIENT_FILE_SECTION_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  isBillingSection,
  isPatientFileSection,
  passesPatientFileGate,
  PATIENT_FILE_DEFAULT_SECTION,
  PATIENT_FILE_SECTIONS,
  viewablePatientFileSections,
} from './patient-file-sections.ts';

describe('the patient file sections (D26)', () => {
  it('are the schema slugs bar `team`, plus the prototype Visits, in the file order', () => {
    const schema = PATIENT_FILE_SECTION_VALUES.filter((slug) => slug !== 'team');
    expect([...PATIENT_FILE_SECTIONS].sort()).toEqual([...schema, 'visits'].sort());
    expect(PATIENT_FILE_SECTIONS[0]).toBe(PATIENT_FILE_DEFAULT_SECTION);
  });

  it('recognises a section slug and nothing else', () => {
    expect(isPatientFileSection('images')).toBe(true);
    expect(isPatientFileSection('team')).toBe(false);
    expect(isPatientFileSection(undefined)).toBe(false);
  });

  it('marks Invoices and Payments as billing sections', () => {
    expect(PATIENT_FILE_SECTIONS.filter(isBillingSection)).toEqual([
      'invoices',
      'payments',
    ]);
  });
});

describe('viewablePatientFileSections (Q-F1)', () => {
  it('shows an Accountant (billing view only) the billing sections alone', () => {
    expect(viewablePatientFileSections({ patients: false, billing: true })).toEqual([
      'invoices',
      'payments',
    ]);
  });

  it('hides the billing sections without billing view', () => {
    const sections = viewablePatientFileSections({ patients: true, billing: false });
    expect(sections).not.toContain('invoices');
    expect(sections).toContain('timeline');
    expect(sections).toHaveLength(PATIENT_FILE_SECTIONS.length - 2);
  });

  it('shows nothing without either', () => {
    expect(viewablePatientFileSections({ patients: false, billing: false })).toEqual([]);
  });
});

describe('passesPatientFileGate (S:35–40, A-F15)', () => {
  it('lets a Doctor or an Admin write prescriptions, not a Front desk', () => {
    expect(passesPatientFileGate(['doctor'], 'prescriptions')).toBe(true);
    expect(passesPatientFileGate(['admin'], 'prescriptions')).toBe(true);
    expect(passesPatientFileGate(['front_desk'], 'prescriptions')).toBe(false);
  });

  it('lets a Therapist write treatments but not open the Private album', () => {
    expect(passesPatientFileGate(['therapist'], 'treatments')).toBe(true);
    expect(passesPatientFileGate(['therapist'], 'privateAlbum')).toBe(false);
    expect(passesPatientFileGate(['admin'], 'treatments')).toBe(false);
  });

  it('always passes the Owner, and passes any one role of several', () => {
    expect(passesPatientFileGate(['owner'], 'treatments')).toBe(true);
    expect(passesPatientFileGate(['counsellor', 'doctor'], 'privateAlbum')).toBe(true);
    expect(passesPatientFileGate([], 'prescriptions')).toBe(false);
  });
});
