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

/** A member who holds exactly these clinozy-be codes. */
const holding =
  (...codes: string[]) =>
  (code: string) =>
    codes.includes(code);

/** The access in force holding exactly these codes. */
function member(...codes: string[]) {
  return { canCode: holding(...codes) };
}

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

  it('shows a member without the record codes only the sections that need none', () => {
    expect(
      viewablePatientFileSections({ patients: true, billing: true, canCode: holding() }),
    ).toEqual(['timeline', 'visits', 'invoices', 'payments', 'packages', 'notes']);
  });

  it('opens Clinical notes, Photos and Reports with the clinical record code', () => {
    const sections = viewablePatientFileSections({
      patients: true,
      billing: false,
      canCode: holding('patient:clinical_record:read'),
    });
    expect(sections).toEqual([
      'timeline',
      'overview',
      'visits',
      'images',
      'reports',
      'packages',
      'notes',
    ]);
  });

  it('opens Prescriptions and Treatments each with its own read code', () => {
    const prescriptions = viewablePatientFileSections({
      patients: true,
      billing: false,
      canCode: holding('patient_prescription:read'),
    });
    expect(prescriptions).toContain('prescriptions');
    expect(prescriptions).not.toContain('treatments');
    const treatments = viewablePatientFileSections({
      patients: true,
      billing: false,
      canCode: holding('patient_treatment:read'),
    });
    expect(treatments).toContain('treatments');
    expect(treatments).not.toContain('prescriptions');
  });

  it('asks for no code during View-as, which previews by role', () => {
    expect(
      viewablePatientFileSections({ patients: true, billing: true, canCode: undefined }),
    ).toEqual([...PATIENT_FILE_SECTIONS]);
  });

  it('opens no record section on its code without Patients view', () => {
    expect(
      viewablePatientFileSections({
        patients: false,
        billing: false,
        canCode: holding('patient:clinical_record:read', 'patient_prescription:read'),
      }),
    ).toEqual([]);
  });
});

describe('passesPatientFileGate (S:35–40, A-F15)', () => {
  it("passes by the gate's own code — the member's, or a previewed role's", () => {
    expect(
      passesPatientFileGate(member('patient_prescription:create'), 'prescriptions'),
    ).toBe(true);
    expect(passesPatientFileGate(member('patient_treatment:create'), 'treatments')).toBe(
      true,
    );
    expect(
      passesPatientFileGate(member('patient:private_album:read'), 'privateAlbum'),
    ).toBe(true);
  });

  it('turns away without the code, whatever else is held', () => {
    expect(passesPatientFileGate(member(), 'prescriptions')).toBe(false);
    expect(
      passesPatientFileGate(member('patient_prescription:create'), 'treatments'),
    ).toBe(false);
    expect(
      passesPatientFileGate(member('patient:clinical_record:read'), 'privateAlbum'),
    ).toBe(false);
  });
});
