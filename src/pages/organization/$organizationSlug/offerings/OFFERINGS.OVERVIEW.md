# `pages/organization/$organizationSlug/offerings` — Offerings

Route: `/organization/$organizationSlug/offerings`. What the clinic sells: offerings, packages, offers and prices (KICKOFF §6.11).

Gated like every clinic room: membership (`organization:read`) and the `clinic-offerings`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                     | Responsibility                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `offerings.route.tsx`    | Route marker — exports `Component` rendering `OfferingsPage`.                                                  |
| `offerings.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-offerings`, nav section `offerings`. |
| `offerings.constants.ts` | `OFFERINGS_NS` / `OFFERINGS_KEYS` (the `offerings` namespace).                                                 |
| `OfferingsPage.tsx`      | Room page. Owns `data-testid="offerings-page"`.                                                                |
