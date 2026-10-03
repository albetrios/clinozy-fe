# `pages/organization/$organizationSlug/appointments` — Appointments

Route: `/organization/$organizationSlug/appointments`. Bookings by doctor, room and machine (KICKOFF §6.4).

Gated like every clinic room: membership (`organization:read`) and the `clinic-appointments`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                        | Responsibility                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `appointments.route.tsx`    | Route marker — exports `Component` rendering `AppointmentsPage`.                                                     |
| `appointments.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-appointments`, nav section `appointments`. |
| `appointments.constants.ts` | `APPOINTMENTS_NS` / `APPOINTMENTS_KEYS` (the `appointments` namespace).                                              |
| `AppointmentsPage.tsx`      | Room page. Owns `data-testid="appointments-page"`.                                                                   |
