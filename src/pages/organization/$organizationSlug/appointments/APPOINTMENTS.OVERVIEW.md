# `pages/organization/$organizationSlug/appointments` — Appointments

Route: `/organization/$organizationSlug/appointments`. Bookings by doctor, room and machine (KICKOFF §6.4).

Gated like every clinic room: membership (`organization:read`) and the `clinic-appointments`
module, then `requireOrgStatus`; in-room View / Create / Edit come from `useClinicAccess`
(KICKOFF §3.7): "New appointment" and slot clicks hide without Create, status moves and saves
need Edit, Therapists read only (Q-A16).

A layout over two URL-driven dialogs (D24, `S:26–29`): `create/` (New appointment) and
`$appointmentId/` (the appointment form — show is edit) render nothing; this page reads the URL
(`useAppointmentsDialogRoute`) and opens the form over itself (the form lands with L-38).
`/appointments/$appointmentId/edit` is a `@/app/routes/routeTree.tsx` redirect to the drawer, search kept. A
dead id stays on the page with "Appointment not found · it may have been deleted" (`S:115`);
a drawer closes to the referrer `from` (allow-listed rooms, A-P1) or back to the page with the
page's own params.

The URL (`appointments.search.ts`, D27): `view` — Agenda (default) · Day · Week · Month, Week
rendering Day on a phone with the URL replaced (`useAppointmentsView`); `date` (the Agenda's one
day, the calendars' anchor); `doctor`; `status` (Active by default); `q`; `created`;
`followUp`; `sort` (Agenda, inside each day). The page, `create/` and `$appointmentId/` share one
search string, so a booking from an empty Day slot keeps the same day behind it. The data —
reads, writes, the status machine — lives in the shared clinic layer (`@/shared/hooks/useAppointments/`,
`@/shared/api/clinic/appointments-api.ts`, `@/shared/api/clinic/appointment-status.ts`); the views arrive with L-36b and L-37.

## Files

| File                                                        | Responsibility                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `appointments.route.tsx`                                    | Route marker — exports `Component` rendering `AppointmentsPage`.                                                                                |
| `appointments.manifest.ts`                                  | Manifest — `kind: 'layout'`, children `create` and `$appointmentId`; permission `organization:read`, module `clinic-appointments`, nav section. |
| `appointments.constants.ts`                                 | `APPOINTMENTS_NS` / `APPOINTMENTS_KEYS` (the `appointments` namespace: the title, the record's name).                                           |
| `appointments.search.ts`                                    | `validateSearch` for the page and both dialog routes (shared readers, no zod — the route tree is the entry chunk); `appointmentListParamsOf`.   |
| `AppointmentsPage.tsx`                                      | Room page. Owns `data-testid="appointments-page"` (`data-view` = the view shown) and the `<Outlet />` the dialog routes render into.            |
| `hooks/useAppointmentsDialogRoute/`                         | Which dialog the URL opens — New or the booking (Edit / Reschedule, read-only without Edit) — the not-found and no-Create returns, `close`.     |
| `hooks/useAppointmentsView/`                                | The view shown: the URL's, Week → Day on a phone with the URL replaced in place.                                                                |
| `create/`, `$appointmentId/`                                | The dialog routes (four files each; their pages render nothing).                                                                                |
| `__tests__/integration/appointments-test-router.tsx`        | The family's routes for tests — the page, both dialog routes, a room to close back to.                                                          |
| `__tests__/integration/appointments-dialog-routes.test.tsx` | Deep links, the not-found toast, the prefill kept in the URL, axe behind a dialog route.                                                        |
