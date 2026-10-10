import type { Role } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * The patient file's sections (KICKOFF §6.6, D19, D26): literal route folders
 * with the schema's slugs and the prototype's labels, in the file's order.
 * `timeline` is the Overview, the default section (D19); `overview` is
 * Clinical notes; `visits` is the prototype's section (a backend request,
 * Appendix F). The schema's `team` has no tab and is not built.
 */
export const PATIENT_FILE_SECTIONS = [
  'timeline',
  'overview',
  'visits',
  'prescriptions',
  'treatments',
  'images',
  'reports',
  'invoices',
  'payments',
  'packages',
  'notes',
] as const;

/** One patient-file section, as its folder and URL segment name it. */
export type PatientFileSectionSlug = (typeof PATIENT_FILE_SECTIONS)[number];

/** Where `/patients/$patientId` and an unknown section land (D19; the schema says `overview`, `S:32`). */
export const PATIENT_FILE_DEFAULT_SECTION =
  'timeline' as const satisfies PatientFileSectionSlug;

/** The sections that also need billing view (`S:33`): Invoices and Payments. */
const PATIENT_FILE_BILLING_SECTIONS = [
  'invoices',
  'payments',
] as const satisfies readonly PatientFileSectionSlug[];

/** Whether a value names one of the file's sections. */
export function isPatientFileSection(value: unknown): value is PatientFileSectionSlug {
  return (PATIENT_FILE_SECTIONS as readonly unknown[]).includes(value);
}

/** Whether a section shows billing records (and so needs billing view). */
export function isBillingSection(section: PatientFileSectionSlug): boolean {
  return (PATIENT_FILE_BILLING_SECTIONS as readonly string[]).includes(section);
}

/**
 * The clinozy-be code a section's records need beyond Patients view: the clinical record
 * (Clinical notes, Photos, Reports), prescriptions and treatments (api-integration §5.4 Gate).
 */
const SECTION_READ_CODES: Readonly<Partial<Record<PatientFileSectionSlug, string>>> = {
  overview: 'patient:clinical_record:read',
  images: 'patient:clinical_record:read',
  reports: 'patient:clinical_record:read',
  prescriptions: 'patient_prescription:read',
  treatments: 'patient_treatment:read',
};

/**
 * What the member may see of a patient file (Q-F1, AMBER A-F14): the clinical
 * and care sections with Patients view, the billing sections with Payments
 * view (`billing.view`, `S:33`) — so an Accountant reads Invoices and Payments
 * and nothing else. A signed-in member (`canCode`; none during View-as, which
 * previews by role) also needs each section's own read code. In the file's
 * order.
 */
export function viewablePatientFileSections(access: {
  patients: boolean;
  billing: boolean;
  canCode?: (code: string) => boolean;
}): PatientFileSectionSlug[] {
  return PATIENT_FILE_SECTIONS.filter((section) => {
    if (isBillingSection(section)) return access.billing;
    const code = SECTION_READ_CODES[section];
    return access.patients && (!(code && access.canCode) || access.canCode(code));
  });
}

/**
 * The schema's role-named gates on the file's records (D22; `S:35–40`,
 * AMBER A-F15) as a View-as preview reads them: writing a prescription is
 * Doctor or Admin, a treatment Doctor or Therapist, and the Private photo
 * album is Doctor or Admin. The clinic's Owner always passes.
 */
const PATIENT_FILE_ROLE_GATES = {
  prescriptions: ['doctor', 'admin'],
  treatments: ['doctor', 'therapist'],
  privateAlbum: ['doctor', 'admin'],
} as const satisfies Readonly<Record<string, readonly Role[]>>;

/** A role-named gate of the file. */
export type PatientFileRoleGate = keyof typeof PATIENT_FILE_ROLE_GATES;

/** The clinozy-be code behind each gate: writing a prescription or a treatment, the Private album. */
const PATIENT_FILE_GATE_CODES: Readonly<Record<PatientFileRoleGate, string>> = {
  prescriptions: 'patient_prescription:create',
  treatments: 'patient_treatment:create',
  privateAlbum: 'patient:private_album:read',
};

/**
 * Whether the access in force passes one of the file's gates: the signed-in member by their own
 * code; a View-as preview by its role (the Owner always passes).
 */
export function passesPatientFileGate(
  access: {
    roles: readonly Role[];
    previewRole: string | null;
    canCode: (code: string) => boolean;
  },
  gate: PatientFileRoleGate,
): boolean {
  if (!access.previewRole) return access.canCode(PATIENT_FILE_GATE_CODES[gate]);
  const allowed: readonly Role[] = PATIENT_FILE_ROLE_GATES[gate];
  return access.roles.some((role) => role === 'owner' || allowed.includes(role));
}
