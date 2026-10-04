import { lazyRouteComponent } from '@tanstack/react-router';

import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';

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
  payments: lazyRouteComponent(
    () => import('./payments/payments.route.tsx'),
    'Component',
  ),
  packages: lazyRouteComponent(
    () => import('./packages/packages.route.tsx'),
    'Component',
  ),
  notes: lazyRouteComponent(() => import('./notes/notes.route.tsx'), 'Component'),
} as const satisfies Record<PatientFileSectionSlug, unknown>;
