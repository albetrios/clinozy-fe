/**
 * Route builders for the patient file (KICKOFF §6.6, §4) — `{ to, params }`
 * for TanStack Router's typed `navigate` / `Link`, like `builders.ts`.
 *
 * A module of their own, imported by path and never through the
 * `@/lib/routes/index.ts` barrel: `builders.ts` and the barrel ride the entry
 * chunk (`routeTree.tsx`, the guards and the resolver import them), and only
 * the patient file's own chunks and ⌘K go to these routes.
 */

/** The patient file — its index lands on the default section, Overview (D19). */
export function organizationPatient(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId',
    params: { organizationSlug, patientId },
  } as const;
}

/**
 * One section of the file: `…/patients/$patientId/<section>` — the D26 slugs
 * (`timeline`, `overview`, `visits` … `notes`), each a literal folder.
 */
export function organizationPatientSection<const S extends string>(
  organizationSlug: string,
  patientId: string,
  section: S,
) {
  return {
    to: `/organization/$organizationSlug/patients/$patientId/${section}` as const,
    params: { organizationSlug, patientId },
  } as const;
}

/** Edit patient — the patient drawer over the file (`S:34`); `?from=<section>` keeps the section behind it (A-F1). */
export function organizationPatientEdit(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/edit',
    params: { organizationSlug, patientId },
  } as const;
}

/** The photo viewer — one photo of the Photos section (`S:40`); the section's `?album=&appointment=` ride along. */
export function organizationPatientPhoto(
  organizationSlug: string,
  patientId: string,
  imageId: string,
) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/images/$imageId',
    params: { organizationSlug, patientId, imageId },
  } as const;
}

/** Photo details — the drawer over the Photos section (`S:41`). */
export function organizationPatientPhotoEdit(
  organizationSlug: string,
  patientId: string,
  imageId: string,
) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/images/$imageId/edit',
    params: { organizationSlug, patientId, imageId },
  } as const;
}

/** New prescription — the Rx drawer over Prescriptions (`S:35`). */
export function organizationPrescriptionCreate(
  organizationSlug: string,
  patientId: string,
) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/prescriptions/create',
    params: { organizationSlug, patientId },
  } as const;
}

/** New treatment — the Treatment drawer over Treatments (`S:38`). */
export function organizationTreatmentCreate(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/treatments/create',
    params: { organizationSlug, patientId },
  } as const;
}

/** Upload report — the Report drawer over Reports (`S:42`). */
export function organizationReportCreate(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/reports/create',
    params: { organizationSlug, patientId },
  } as const;
}

/**
 * A new check-in — the check-in drawer over the file (`S:44`); `?treatment=`
 * makes it an aftercare one, `?appointment=` ties it to a visit, `?from=`
 * keeps the section behind it (A-F1).
 */
export function organizationCheckInCreate(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/check-ins/create',
    params: { organizationSlug, patientId },
  } as const;
}

/** A check-in's edit — the check-in drawer over the file (`S:45`). */
export function organizationCheckInEdit(
  organizationSlug: string,
  patientId: string,
  checkInId: string,
) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit',
    params: { organizationSlug, patientId, checkInId },
  } as const;
}

/** Log a review — the review drawer over the file (`S:46`); `?source=` picks where it was left. */
export function organizationReviewCreate(organizationSlug: string, patientId: string) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/reviews/create',
    params: { organizationSlug, patientId },
  } as const;
}

/** A review's edit — the review drawer over the file (`S:47`). */
export function organizationReviewEdit(
  organizationSlug: string,
  patientId: string,
  reviewId: string,
) {
  return {
    to: '/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit',
    params: { organizationSlug, patientId, reviewId },
  } as const;
}
