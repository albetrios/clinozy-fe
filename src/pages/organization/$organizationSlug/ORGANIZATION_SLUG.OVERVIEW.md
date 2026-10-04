# `pages/organization/$organizationSlug` — Org-scoped shell

Route: `/organization/$organizationSlug` (layout — no UI of its own at the bare path; children
render inside the shared AppLayout). **The URL is the single source of truth for
organization context**: the routeTree `beforeLoad` chain validates the param, confirms
membership, syncs the derived `useOrganizationStore`, and refetches per-organization
permissions on change. Spec: `docs/reference/routing-and-tenancy.md`.

## Files

| File                            | Responsibility                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `organization-slug.route.tsx`   | Route marker — exports `Component` rendering `OrganizationLayout`.                |
| `organization-slug.manifest.ts` | Manifest — `kind: 'layout'`, children `dashboard`, `suspended`.                   |
| `OrganizationLayout.tsx`        | Thin wrapper mounting the shared AppLayout (sidebar/header/`Outlet`).             |
| `hooks/useRoomLanding/`         | Takes the member off a clinic room the access in force can't view (Q-U11, below). |

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

## Clinic rooms (iteration launch-2026-09-30-jxmr)

The ten clinic rooms nest here as islands — `today/`, `leads/`, `appointments/`,
`patients/`, `medical/` (layout; `/medical` → `medical/sales`), `stock/` (layout;
`/stock` → `stock/items`), `payments/`, `tasks/`, `offerings/`, `users/`. Each
gates on membership and its `clinic-*` module and carries its manifest as
`staticData` for the nav (`useAppNav`). The org index (`/organization/<slug>`)
redirects to the member's role home (D25, `shared/clinic/clinic-home.ts`), and
an unknown in-org path redirects there with a "Page not found" toast (S:115).

**Room landing (View-as, Q-U11).** The nav, ⌘K and the rooms follow
`useClinicAccess` — the member's own access, or the role View-as previews
(`useUIStore.previewRole`, a contract role or a custom role's id, never
persisted). When the room in the URL isn't viewable under it, `useRoomLanding`
replaces the URL with the first viewable room in nav order after Today (a Doctor
previewed from Users › Roles & access lands on Leads), skipping a room whose
module is off. The same rule places "Exit preview": it stays on a room the
member's own access views, else moves on. Non-room paths (`dashboard`,
`suspended`) and an unresolved access never move, and the Settings hash rides
along.
