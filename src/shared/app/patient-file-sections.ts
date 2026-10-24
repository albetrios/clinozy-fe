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
 * (Clinical notes, Photos, Reports), the person's bookings (Visits — `GET /app/appointments`),
 * prescriptions and treatments (api-integration §5.4 Gate).
 */
const SECTION_READ_CODES: Readonly<Partial<Record<PatientFileSectionSlug, string>>> = {
  overview: 'patient:clinical_record:read',
  visits: 'appointment:read',
  images: 'patient:clinical_record:read',
  reports: 'patient:clinical_record:read',
  prescriptions: 'patient_prescription:read',
  treatments: 'patient_treatment:read',
};

/**
 * What the member may see of a patient file (Q-F1, AMBER A-F14): the clinical
 * and care sections with Patients view, the billing sections with Payments
 * view (`billing.view`, `S:33`), each section also needing its own read code (`canCode`, the
 * codes in force, a View-as preview's too) — so an Accountant (Patients view, no appointments,
 * no clinical record) reads the Overview, Invoices, Payments, Packages and Team notes, never
 * Visits. In the file's order.
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

/** A gate on the file's records: writing a prescription or a treatment, the Private album. */
export type PatientFileGate = 'prescriptions' | 'treatments' | 'privateAlbum';

/** The clinozy-be code behind each gate (D22; `S:35–40`). */
const PATIENT_FILE_GATE_CODES: Readonly<Record<PatientFileGate, string>> = {
  prescriptions: 'patient_prescription:create',
  treatments: 'patient_treatment:create',
  privateAlbum: 'patient:private_album:read',
};

/**
 * Whether the access in force passes one of the file's gates — by its code, for the signed-in
 * member and a View-as preview alike (the previewed role's codes answer `canCode`).
 */
export function passesPatientFileGate(
  access: { canCode: (code: string) => boolean },
  gate: PatientFileGate,
): boolean {
  return access.canCode(PATIENT_FILE_GATE_CODES[gate]);
}
