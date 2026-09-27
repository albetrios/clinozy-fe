# `pages/organization/$organizationSlug` — Org-scoped shell

Route: `/organization/$organizationSlug` (layout — no UI of its own at the bare path; children
render inside the shared AppLayout). **The URL is the single source of truth for
organization context**: the routeTree `beforeLoad` chain validates the param, confirms
membership, syncs the derived `useOrganizationStore`, and refetches per-organization
permissions on change. Spec: `docs/reference/routing-and-tenancy.md`.

## Files

| File                            | Responsibility                                                        |
| ------------------------------- | --------------------------------------------------------------------- |
| `organization-slug.route.tsx`   | Route marker — exports `Component` rendering `OrganizationLayout`.    |
| `organization-slug.manifest.ts` | Manifest — `kind: 'layout'`, children `dashboard`, `suspended`.       |
| `OrganizationLayout.tsx`        | Thin wrapper mounting the shared AppLayout (sidebar/header/`Outlet`). |

## Guard chain (routeTree `beforeLoad`)

Shell: preload bail-out → `requireAuth` → `requireTeamDeployment` →
`requireProvisionedWorkspace` → `resolveActiveOrg` (URL → store context sync;
malformed/unknown/non-member → 404). Leaves then run `gatewayFromManifest(manifest)`
(session → module → permission) followed by `requireOrgStatus` (suspended → `suspended/`);
the `suspended` leaf runs the gateway but intentionally skips `requireOrgStatus`, so the
blocked state renders without a redirect loop. See `app/guards/GUARDS.OVERVIEW.md`.

## Children (direct nesting — no sub-pages bucket)

| Segment     | URL                                         | Island     |
| ----------- | ------------------------------------------- | ---------- |
| `dashboard` | `/organization/$organizationSlug/dashboard` | dashboard/ |
| `suspended` | `/organization/$organizationSlug/suspended` | suspended/ |
