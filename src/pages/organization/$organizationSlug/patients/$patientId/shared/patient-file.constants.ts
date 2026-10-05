import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The patient file's i18n namespace (KICKOFF §6.6 Copy: `patient-file.md:495–542`). */
export const PATIENT_FILE_NS = I18N_NAMESPACES.patientFile;

/**
 * The file's shared vocabulary — the document title and each section's label
 * (the prototype's, D26: Overview, Clinical notes, Visits … Team notes) — read
 * by the tab strip, the section popover and every section's header.
 */
export const PATIENT_FILE_KEYS = {
  manifest: { title: 'manifest.title' },
  sections: {
    timeline: 'sections.timeline',
    overview: 'sections.overview',
    visits: 'sections.visits',
    prescriptions: 'sections.prescriptions',
    treatments: 'sections.treatments',
    images: 'sections.images',
    reports: 'sections.reports',
    invoices: 'sections.invoices',
    payments: 'sections.payments',
    packages: 'sections.packages',
    notes: 'sections.notes',
  },
  /** A visit's day and time — the rail's Up next and the Overview's Visits card. */
  visit: {
    /** "Today · 11:00 am". */
    when: 'rail.visitWhen',
    today: 'rail.today',
    tomorrow: 'rail.tomorrow',
  },
  /** A package's session used by hand — Packages and the Overview. */
  package: {
    /** "Session 2 of 7 used". */
    sessionUsed: 'package.card.sessionUsed',
    noneLeft: 'package.card.noneLeft',
  },
} as const;
