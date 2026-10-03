# `pages/organization/$organizationSlug/medical` — Medical

Route: `/organization/$organizationSlug/medical`. The medicine store: medicines for sale, suppliers, MRs, purchases, sales (KICKOFF §6.7).

Gated like every clinic room: membership (`organization:read`) and the `clinic-medical`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                   | Responsibility                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `medical.route.tsx`    | Route marker — exports `Component` rendering `MedicalLayout`.                                                |
| `medical.manifest.ts`  | Manifest — `kind: 'layout'`, permission `organization:read`, module `clinic-medical`, nav section `medical`. |
| `medical.constants.ts` | `MEDICAL_NS` / `MEDICAL_KEYS` (the `medical` namespace).                                                     |
| `MedicalLayout.tsx`    | Layout over the tab routes (`<Outlet />`).                                                                   |
