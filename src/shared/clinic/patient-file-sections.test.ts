import { describe, expect, it } from 'vitest';

import {
  PATIENT_FILE_SECTION_VALUES,
  type Role,
} from '@/shared/api/clinic/clinic-schema.ts';

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

/** The access a View-as preview of `role` runs with — no codes, the role alone. */
function previewing(role: Role) {
  return { roles: [role], previewRole: role, canCode: () => false };
}

/** The access a signed-in member runs with — their roles and codes, no preview. */
function member(codes: string[], roles: Role[] = ['front_desk']) {
  return { roles, previewRole: null, canCode: holding(...codes) };
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
  it('passes a signed-in member by their own code, whatever their roles', () => {
    expect(
      passesPatientFileGate(member(['patient_prescription:create']), 'prescriptions'),
    ).toBe(true);
    expect(
      passesPatientFileGate(member(['patient_treatment:create']), 'treatments'),
    ).toBe(true);
    expect(
      passesPatientFileGate(member(['patient:private_album:read']), 'privateAlbum'),
    ).toBe(true);
  });

  it('turns a signed-in member away without the code, even as a Doctor or the Owner', () => {
    expect(passesPatientFileGate(member([], ['doctor']), 'prescriptions')).toBe(false);
    expect(passesPatientFileGate(member([], ['owner']), 'treatments')).toBe(false);
    expect(
      passesPatientFileGate(member(['patient_prescription:create']), 'treatments'),
    ).toBe(false);
  });

  it('lets a previewed Doctor or Admin write prescriptions, not a Front desk', () => {
    expect(passesPatientFileGate(previewing('doctor'), 'prescriptions')).toBe(true);
    expect(passesPatientFileGate(previewing('admin'), 'prescriptions')).toBe(true);
    expect(passesPatientFileGate(previewing('front_desk'), 'prescriptions')).toBe(false);
  });

  it('lets a previewed Therapist write treatments but not open the Private album', () => {
    expect(passesPatientFileGate(previewing('therapist'), 'treatments')).toBe(true);
    expect(passesPatientFileGate(previewing('therapist'), 'privateAlbum')).toBe(false);
    expect(passesPatientFileGate(previewing('admin'), 'treatments')).toBe(false);
  });

  it('always passes a previewed Owner, and passes any one role of several', () => {
    expect(passesPatientFileGate(previewing('owner'), 'treatments')).toBe(true);
    expect(
      passesPatientFileGate(
        { roles: ['counsellor', 'doctor'], previewRole: 'doctor', canCode: () => false },
        'privateAlbum',
      ),
    ).toBe(true);
    expect(
      passesPatientFileGate(
        { roles: [], previewRole: 'custom_role', canCode: () => true },
        'prescriptions',
      ),
    ).toBe(false);
  });
});
