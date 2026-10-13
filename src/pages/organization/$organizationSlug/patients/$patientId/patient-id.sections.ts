import { lazyRouteComponent } from '@tanstack/react-router';

import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { Component as PrescriptionEdit } from './prescriptions/$prescriptionId/edit/edit.route.tsx';
import { Component as Prescription } from './prescriptions/$prescriptionId/prescription-id.route.tsx';
import { Component as PrescriptionCreate } from './prescriptions/create/create.route.tsx';
import { Component as Report } from './reports/$reportId/report-id.route.tsx';
import { Component as ReportCreate } from './reports/create/create.route.tsx';
import { Component as TreatmentEdit } from './treatments/$treatmentId/edit/edit.route.tsx';
import { Component as TreatmentCreate } from './treatments/create/create.route.tsx';

/*
 * The patient file's route components (KICKOFF §6.6, L-42), behind ONE
 * dynamic import from `routeTree.tsx` — the entry chunk carries a single
 * import for the layout and every section and dialog route instead of one per
 * route (it has well under a kilobyte to spare). Each component is still its
 * own lazy chunk; `routeTree.tsx` preloads it after this module, so a
 * navigation never suspends on the second hop.
 */

/** The file layout: bar, rail, the open section, Activity. */
export const PatientFileLayout = lazyRouteComponent(
  () => import('./patient-id.route.tsx'),
  'Component',
);

/** Edit patient — the patient drawer over the section it opened from (`S:34`, A-F1). */
export const PatientFileEdit = lazyRouteComponent(
  () => import('./edit/edit.route.tsx'),
  'Component',
);

/** A new check-in — the check-in drawer over the section it opened from (`S:44`). */
export const PatientCheckInCreate = lazyRouteComponent(
  () => import('./check-ins/create/create.route.tsx'),
  'Component',
);

/** A check-in's edit — the check-in drawer over the section it opened from (`S:45`). */
export const PatientCheckInEdit = lazyRouteComponent(
  () => import('./check-ins/$checkInId/edit/edit.route.tsx'),
  'Component',
);

/** Log a review — the review drawer over the section it opened from (`S:46`). */
export const PatientReviewCreate = lazyRouteComponent(
  () => import('./reviews/create/create.route.tsx'),
  'Component',
);

/** A review's edit — the review drawer over the section it opened from (`S:47`). */
export const PatientReviewEdit = lazyRouteComponent(
  () => import('./reviews/$reviewId/edit/edit.route.tsx'),
  'Component',
);

/** The photo viewer — a dialog over Photos (`S:41`). */
export const PatientPhotoViewer = lazyRouteComponent(
  () => import('./images/$imageId/image-id.route.tsx'),
  'Component',
);

/** Photo details — a drawer over Photos (`S:42`). */
export const PatientPhotoDetails = lazyRouteComponent(
  () => import('./images/$imageId/edit/edit.route.tsx'),
  'Component',
);

/**
 * Each section's page (S:33): the route component `routeTree.tsx` mounts for
 * it, and what a file-level drawer shows behind it (A-F1).
 */
export const PATIENT_FILE_SECTION_PAGES = {
  timeline: lazyRouteComponent(
    () => import('./timeline/timeline.route.tsx'),
    'Component',
  ),
  overview: lazyRouteComponent(
    () => import('./overview/overview.route.tsx'),
    'Component',
  ),
  visits: lazyRouteComponent(() => import('./visits/visits.route.tsx'), 'Component'),
  prescriptions: lazyRouteComponent(
    () => import('./prescriptions/prescriptions.route.tsx'),
    'Component',
  ),
  treatments: lazyRouteComponent(
    () => import('./treatments/treatments.route.tsx'),
    'Component',
  ),
  images: lazyRouteComponent(() => import('./images/images.route.tsx'), 'Component'),
  reports: lazyRouteComponent(() => import('./reports/reports.route.tsx'), 'Component'),
  invoices: lazyRouteComponent(
    () => import('./invoices/invoices.route.tsx'),
    'Component',
  ),
  // The ledger's row actions and their confirms speak the Payments room's copy.
  payments: lazyRouteComponent(async () => {
    const [module] = await Promise.all([
      import('./payments/payments.route.tsx'),
      ensureNamespace(useLocaleStore.getState().locale, I18N_NAMESPACES.payments),
    ]);
    return module;
  }, 'Component'),
  packages: lazyRouteComponent(
    () => import('./packages/packages.route.tsx'),
    'Component',
  ),
  notes: lazyRouteComponent(() => import('./notes/notes.route.tsx'), 'Component'),
} as const satisfies Record<PatientFileSectionSlug, unknown>;

/**
 * The sections' URL-driven dialogs (`S:35–43`; D24): each renders nothing —
 * its section reads the URL and opens the drawer or viewer over itself — so
 * they ride this module rather than a chunk each.
 */
export const PATIENT_FILE_DIALOG_PAGES = {
  prescriptionCreate: PrescriptionCreate,
  prescription: Prescription,
  prescriptionEdit: PrescriptionEdit,
  treatmentCreate: TreatmentCreate,
  treatmentEdit: TreatmentEdit,
  reportCreate: ReportCreate,
  report: Report,
} as const;
