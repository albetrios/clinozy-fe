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
`@/shared/api/clinic/appointments-api.ts`, `@/shared/api/clinic/appointment-status.ts`).

The views (L-36b): the toolbar on the shared `RoomToolbar` — the view tabs, on a calendar the
period controls (`period`), the search, the room's own Filters popover (`filtersSlot`: a month
calendar with load dots, "Appointed to", the status chips) and "New appointment". The Agenda is
the shared `DataTable` grouped by day (`groups`: sticky day headers with the day's counts across
every page), sorted inside each day through the URL, re-gridded on a phone. Every booking surface
reads one `AppointmentActionsProvider`: the Change status popover (the status machine's moves and
guards, its cancel view with the contract's reasons, "Other" through the reason confirm — A-A3),
the booking card (hover after 420ms, pinned from the row's eye, a sheet-like popover on a phone)
and the row click into the drawer. A move is optimistic with Undo; a list that fails to load keeps
the last copy and toasts Retry (`useListLoadError`).

## Files

| File                                                        | Responsibility                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appointments.route.tsx`                                    | Route marker — exports `Component` rendering `AppointmentsPage`.                                                                                        |
| `appointments.manifest.ts`                                  | Manifest — `kind: 'layout'`, children `create` and `$appointmentId`; permission `organization:read`, module `clinic-appointments`, nav section.         |
| `appointments.constants.ts`                                 | `APPOINTMENTS_NS` / `APPOINTMENTS_KEYS` (the `appointments` namespace) and `APPOINTMENTS_TEST_IDS`.                                                     |
| `appointments.search.ts`                                    | `validateSearch` for the page and both dialog routes (shared readers, no zod — the route tree is the entry chunk).                                      |
| `appointments.params.ts`                                    | The views' reads from the URL — `appointmentListParamsOf` for the Agenda — kept off the entry chunk the search module ships on.                         |
| `appointments.display.ts`                                   | Pure display rules: person and service tones, the Agenda's day-group tone and words, the "Latest update" pills and the card's last event.               |
| `AppointmentsPage.tsx`                                      | Room page. Owns `data-testid="appointments-page"` (`data-view` = the view shown), the toolbar, the view's panel and the dialog routes' `<Outlet />`.    |
| `hooks/useAppointmentsDialogRoute/`                         | Which dialog the URL opens — New or the booking (Edit / Reschedule, read-only without Edit) — the not-found and no-Create returns, `close`.             |
| `hooks/useAppointmentsView/`                                | The view shown: the URL's, Week → Day on a phone with the URL replaced in place.                                                                        |
| `hooks/useAppointmentsNavigation/`                          | The room's URL moves: set a view, shift / jump the period (`shiftAnchor`), open a day, open New appointment with a prefill — params kept.               |
| `hooks/useLatestUpdateWords/`                               | Words and tooltips for the "Latest update" pills (the moved-from slot named clinic-local).                                                              |
| `components/AppointmentActions/`                            | `AppointmentActionsProvider` / `useAppointmentActions`: Edit / Create, the guards' clock, move · cancel (reason confirm for "Other") · next · open.     |
| `components/AppointmentsToolbar/`                           | The room toolbar: view tabs (no Week on a phone), "Today" + "‹ period ›" on a calendar, search, Filters, "New appointment" (Create only).               |
| `components/AppointmentFilters/`                            | Filters popover (bottom sheet on a phone): `FiltersCalendar` (month, load dots, "Upcoming"), "Appointed to", status chips, Clear all / Apply.           |
| `components/DoctorPicker/`                                  | "Appointed to" multi-picker over the bookable staff ("All doctors" · a name · "<n> doctors"), with optional per-doctor meta and footer.                 |
| `components/AppointmentsAgenda/`                            | The Agenda: its columns, cells (reading `AgendaCellsContext`, so state never remounts them), `AgendaDayHeader`, empty state, skeleton, infinite scroll. |
| `components/AppointmentStatusPill/`                         | The status pill in the status's tone (H:3420).                                                                                                          |
| `components/AppointmentStatusPopover/`                      | Change status (260px): the moves with their tiles and guards, then the cancel view ("Why is it cancelled?", Back).                                      |
| `components/AppointmentCard/`                               | The booking card (340px): contact, when, doctor, last update, status tracker, next action · Open · Reschedule · Cancel; hover and quick view.           |
| `create/`, `$appointmentId/`                                | The dialog routes (four files each; their pages render nothing).                                                                                        |
| `__tests__/integration/appointments-test-router.tsx`        | The family's routes for tests — the page, both dialog routes, a room to close back to; `grantClinicAccess`, `renderAppointmentsRoutes`.                 |
| `__tests__/integration/appointments-dialog-routes.test.tsx` | Deep links, the not-found toast, the prefill kept in the URL, axe behind a dialog route.                                                                |
