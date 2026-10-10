import { describe, expect, it } from 'vitest';

import {
  PATIENT_FILE_SECTIONS,
  viewablePatientFileSections,
} from '@/shared/clinic/patient-file-sections.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  PATIENT_FILE_GROUPS,
  patientFileSectionOf,
  patientFileTabs,
  togglePatientFilePin,
} from './patient-file-nav.ts';

const PINS = ['overview', 'visits', 'prescriptions', 'invoices'] as const;

describe('patientFileTabs', () => {
  it('lists the pins in pin order, then the open section while it is not pinned', () => {
    expect(patientFileTabs(PINS, 'timeline', PATIENT_FILE_SECTIONS)).toEqual([
      { section: 'overview', temporary: false },
      { section: 'visits', temporary: false },
      { section: 'prescriptions', temporary: false },
      { section: 'invoices', temporary: false },
      { section: 'timeline', temporary: true },
    ]);
    expect(
      patientFileTabs(PINS, 'visits', PATIENT_FILE_SECTIONS).map((tab) => tab.temporary),
    ).toEqual([false, false, false, false]);
  });

  it('shows only what the member may view, once each', () => {
    const accountant = viewablePatientFileSections({ patients: false, billing: true });
    expect(patientFileTabs([...PINS, 'invoices'], 'payments', accountant)).toEqual([
      { section: 'invoices', temporary: false },
      { section: 'payments', temporary: true },
    ]);
    expect(patientFileTabs(PINS, null, [])).toEqual([]);
  });
});

describe('togglePatientFilePin', () => {
  it('drops a pinned section and adds another at the end', () => {
    expect(togglePatientFilePin(PINS, 'visits')).toEqual([
      'overview',
      'prescriptions',
      'invoices',
    ]);
    expect(togglePatientFilePin(PINS, 'images')).toEqual([...PINS, 'images']);
  });
});

describe('patientFileSectionOf', () => {
  const file = `/organization/acme/patients/${TEST_PATIENT_ID}`;

  it('reads the section from the URL, a record’s dialog included', () => {
    expect(patientFileSectionOf(`${file}/visits`, TEST_PATIENT_ID, undefined)).toBe(
      'visits',
    );
    expect(
      patientFileSectionOf(`${file}/prescriptions/create`, TEST_PATIENT_ID, undefined),
    ).toBe('prescriptions');
  });

  it('keeps the section a file-level drawer opened over, Clinical notes otherwise', () => {
    expect(patientFileSectionOf(`${file}/edit`, TEST_PATIENT_ID, 'images')).toBe(
      'images',
    );
    expect(patientFileSectionOf(`${file}/edit`, TEST_PATIENT_ID, 'nowhere')).toBe(
      'overview',
    );
    expect(
      patientFileSectionOf(`${file}/check-ins/create`, TEST_PATIENT_ID, 'visits'),
    ).toBe('visits');
    expect(
      patientFileSectionOf(`${file}/reviews/create`, TEST_PATIENT_ID, undefined),
    ).toBe('overview');
  });

  it('is none for anything else', () => {
    expect(patientFileSectionOf(`${file}/secret`, TEST_PATIENT_ID, 'images')).toBeNull();
    expect(patientFileSectionOf(file, TEST_PATIENT_ID, undefined)).toBeNull();
    expect(
      patientFileSectionOf(`${file}/visits`, 'pat_other0000000000000000', undefined),
    ).toBeNull();
  });
});

describe('PATIENT_FILE_GROUPS', () => {
  it('holds every section once', () => {
    const grouped = PATIENT_FILE_GROUPS.flatMap((group) => group.sections);
    expect([...grouped].sort()).toEqual([...PATIENT_FILE_SECTIONS].sort());
  });
});
