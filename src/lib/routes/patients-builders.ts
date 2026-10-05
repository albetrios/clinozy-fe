/**
 * Route builders for the Patients room and New patient (KICKOFF §6.5; `S:30–31`) —
 * `{ to, params }` for TanStack Router's typed `navigate` / `Link`, like
 * `builders.ts`. A module of their own, imported by path and never through the
 * `@/lib/routes/index.ts` barrel, which rides the entry chunk: only the code that
 * goes to these routes loads them.
 */

/** The Patients room — the list the New patient drawer opens over. */
export function organizationPatients(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/patients',
    params: { organizationSlug },
  } as const;
}

/** The New patient drawer over the list; `?name=&phone=&fromLead=` prefill it (`S:31`). */
export function organizationPatientCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/patients/create',
    params: { organizationSlug },
  } as const;
}
