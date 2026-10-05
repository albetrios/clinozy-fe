/**
 * Route builders — no hand-built route strings anywhere in app code.
 *
 * Builders return `{ to, params }` objects consumed by TanStack Router's typed
 * `Link` / `navigate`, so the router's path typing stays intact
 * (docs/reference/routing-and-tenancy.md §9). Add a builder whenever a new
 * routed island lands; never interpolate paths inline.
 *
 * This module holds the organization-level builders only — the ones the entry
 * chunk's guards, resolver and route tree call — and the `@/lib/routes/index.ts`
 * barrel re-exports them. Each clinic room's builders live in a module of their
 * own (`leads-builders.ts`, `medical-builders.ts`, …), imported by path: here
 * they rode the entry chunk on every first paint for routes most loads never open.
 */

/** The organization picker (`/organization`). */
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

/** An organization's dashboard — the home when the deployment enables no clinic room (D25). */
export function organizationDashboard(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/dashboard',
    params: { organizationSlug },
  } as const;
}

/** The blocked state of a suspended or lapsed organization. */
export function organizationSuspended(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/suspended',
    params: { organizationSlug },
  } as const;
}
