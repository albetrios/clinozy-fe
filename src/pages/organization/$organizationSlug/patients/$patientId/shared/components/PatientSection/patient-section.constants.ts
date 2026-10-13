import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** A section's header reads the patient file's namespace. */
export const PATIENT_SECTION_NS = I18N_NAMESPACES.patientFile;

/** The sections' split "New …" labels and the "⌄" name (`patient-file.md:506, 512`). */
export const PATIENT_SECTION_KEYS = {
  primary: {
    visits: 'section.primary.visits',
    prescriptions: 'section.primary.prescriptions',
    treatments: 'section.primary.treatments',
    images: 'section.primary.images',
    reports: 'section.primary.reports',
    invoices: 'section.primary.invoices',
    payments: 'section.primary.payments',
  },
  /** "More for Dharti" — the split's "⌄". */
  more: 'section.more',
} as const;
