# `pages/organization/$organizationSlug/appointments/$appointmentId` — Appointment

Route: `/organization/$organizationSlug/appointments/$appointmentId` (`S:28`). A URL-driven dialog
over the Appointments page (KICKOFF §4, D24): show is edit (the form with its status strip and
chat column, L-38). The route renders nothing; the page reads the id
(`useAppointmentsDialogRoute`), resolves the booking with `useDialogRouteRecord` and opens the
drawer over itself. An unknown or deleted id opens nothing: the URL goes back to `/appointments`
in place, the page's filters kept, with "Appointment not found · it may have been deleted"
(`S:115`).

Params: the plan's `mode=reschedule` ("Move to another time", "Reschedule": the form opens as
"Reschedule #<seq>") and `from` (the room it was opened from — allow-listed, the drawer closes
back to it), parsed by `validateAppointmentSearch` in `../appointments.search.ts`.
`/appointments/$appointmentId/edit` is a `@/app/routes/routeTree.tsx` redirect to this URL, search kept
(`S:29`). The drawer is read-only without Edit (Therapists, Q-A16).

## Files

| File                         | Responsibility                                                               |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `appointment-id.route.tsx`   | Route marker — exports `Component` rendering `AppointmentPage` (nothing).    |
| `appointment-id.manifest.ts` | Manifest — `kind: 'leaf'`, test id `appointment-drawer` (the form's drawer). |
| `AppointmentPage.tsx`        | Renders `null` — the dialog opens on the parent page.                        |
