/**
 * Route builders for the Leads room and its dialog routes (KICKOFF §6.3;
 * `S:22–25`) — `{ to, params }` for TanStack Router's typed `navigate` / `Link`,
 * like `builders.ts`. A module of their own, imported by path and never through
 * the `@/lib/routes/index.ts` barrel, which rides the entry chunk: only the code
 * that goes to these routes loads them.
 */

/** The Leads room — the list every lead drawer opens over. */
export function organizationLeads(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/leads',
    params: { organizationSlug },
  } as const;
}

/** One lead's drawer over the list — show and edit are one drawer (`S:24–25`). */
export function organizationLead(organizationSlug: string, leadId: string) {
  return {
    to: '/organization/$organizationSlug/leads/$leadId',
    params: { organizationSlug, leadId },
  } as const;
}

/** The New lead drawer over the list; `?name=&phone=` prefill it (`S:23`). */
export function organizationLeadCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/leads/create',
    params: { organizationSlug },
  } as const;
}
