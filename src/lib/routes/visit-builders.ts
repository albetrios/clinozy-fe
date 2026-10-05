/**
 * Route builder for the Visit sheet (KICKOFF §6.13, §4; D18) — `{ to, params }`
 * for TanStack Router's typed `navigate` / `Link`, like `builders.ts`. A
 * module of its own, imported by path and never through the
 * `@/lib/routes/index.ts` barrel, which rides the entry chunk: only Today's
 * lanes and ⌘K open a visit.
 */

/** The Visit sheet; `?tab=consult|treatment|checkout` opens it on a tab (History by default). */
export function organizationVisit(organizationSlug: string, visitId: string) {
  return {
    to: '/organization/$organizationSlug/visits/$visitId',
    params: { organizationSlug, visitId },
  } as const;
}
