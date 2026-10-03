# `pages/organization/$organizationSlug/patients` — Patients

Route: `/organization/$organizationSlug/patients`. Registered patients, with prescriptions, sessions and photos (KICKOFF §6.5).

Gated like every clinic room: membership (`organization:read`) and the `clinic-patients`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                    | Responsibility                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `patients.route.tsx`    | Route marker — exports `Component` rendering `PatientsPage`.                                                 |
| `patients.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, nav section `patients`. |
| `patients.constants.ts` | `PATIENTS_NS` / `PATIENTS_KEYS` (the `patients` namespace).                                                  |
| `PatientsPage.tsx`      | Room page. Owns `data-testid="patients-page"`.                                                               |
