/**
 * Route builders — no hand-built route strings anywhere in app code.
 *
 * Builders return `{ to, params }` objects consumed by TanStack Router's typed
 * `Link` / `navigate`, so the router's path typing stays intact
 * (docs/reference/routing-and-tenancy.md §9). Add a builder whenever a new
 * routed island lands; never interpolate paths inline.
 */

export function organizationPicker() {
  return { to: '/organization' } as const;
}

/**
 * An organization's index — no UI of its own: it sends the member to their
 * role home (D25), or the dashboard when the deployment enables no clinic room.
 */
export function organizationHome(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug',
    params: { organizationSlug },
  } as const;
}

export function organizationDashboard(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/dashboard',
    params: { organizationSlug },
  } as const;
}

export function organizationSuspended(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/suspended',
    params: { organizationSlug },
  } as const;
}

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
