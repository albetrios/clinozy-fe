# `pages/organization/$organizationSlug/appointments/create` — New appointment

Route: `/organization/$organizationSlug/appointments/create` (`S:27`). A URL-driven dialog over
the Appointments page (KICKOFF §4, D24): the route renders nothing; the page reads the URL
(`useAppointmentsDialogRoute`) and opens the appointment form over itself
(`@/shared/forms/AppointmentForm/`, New mode), so a refresh or a shared link reopens it. A
booking closes onto its day.

Prefill: the page's own `date` and `doctor` (one doctor picked prefills the doctor), plus
`time`, `who` (a patient's or a lead's id), `copyOf` (Copy and Rebook — a new booking, the old
one stays), the plan's `source` (`chat` or `task`: step 1 collapsed, Date & time open) and
`from` (the room it was opened from — allow-listed, the drawer closes back to it).
`validateAppointmentCreateSearch` in the parent's `../appointments.search.ts` parses them.

Gated like the room (membership, the `clinic-appointments` module, `requireOrgStatus`); a
member without Create who follows a link here lands back on the page with the permission
toast.

## Files

| File                     | Responsibility                                                                   |
| ------------------------ | -------------------------------------------------------------------------------- |
| `create.route.tsx`       | Route marker — exports `Component` rendering `NewAppointmentPage` (nothing).     |
| `create.manifest.ts`     | Manifest — `kind: 'leaf'`, test id `new-appointment-drawer` (the form's drawer). |
| `NewAppointmentPage.tsx` | Renders `null` — the dialog opens on the parent page.                            |
