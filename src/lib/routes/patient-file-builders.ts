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
