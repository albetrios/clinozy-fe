# `pages/organization/$organizationSlug/today` — Today

Route: `/organization/$organizationSlug/today`. The clinic floor now: arrivals, waiting, with doctor, checkout (KICKOFF §6.2).

Gated like every clinic room: membership (`organization:read`) and the `clinic-today`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                 | Responsibility                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `today.route.tsx`    | Route marker — exports `Component` rendering `TodayPage`.                                              |
| `today.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-today`, nav section `today`. |
| `today.constants.ts` | `TODAY_NS` / `TODAY_KEYS` (the `today` namespace).                                                     |
| `TodayPage.tsx`      | Room page. Owns `data-testid="today-page"`.                                                            |
