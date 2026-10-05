# `pages/organization/$organizationSlug/appointments` — Appointments

Route: `/organization/$organizationSlug/appointments`. Bookings by doctor, room and machine (KICKOFF §6.4).

Gated like every clinic room: membership (`organization:read`) and the `clinic-appointments`
module, then `requireOrgStatus`; in-room View / Create / Edit come from `useClinicAccess`
(KICKOFF §3.7): "New appointment" and slot clicks hide without Create, status moves and saves
need Edit, Therapists read only (Q-A16).

A layout over two URL-driven dialogs (D24, `S:26–29`): `create/` (New appointment) and
`$appointmentId/` (the appointment form — show is edit) render nothing; this page reads the URL
(`useAppointmentsDialogRoute`) and opens the shared appointment form over itself
(`@/shared/forms/AppointmentForm/`, L-38): `create/` in New mode — a chat or task `source`
starts step 1 collapsed — and `$appointmentId/` in Edit or Reschedule, the id passed before the
booking loads so the same drawer fills in. Copy opens `create/?copyOf=`, a chat's
"Appointment #…" chip that booking. `/appointments/$appointmentId/edit` is a
`@/app/routes/routeTree.tsx` redirect to the drawer, search kept. A dead id stays on the page
with "Appointment not found · it may have been deleted" (`S:115`); a drawer closes to the
referrer `from` (allow-listed rooms, A-P1) or back to the page with the page's own params — a
new booking moves the page's `date` to its day (H:6051, D28).

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

The calendars (L-37) read their range (`useCalendarRange` → `listAppointmentsRange`, the last
range kept as the in-place skeleton while the next loads) and lay bookings out with the pure rules
of `appointments.calendar.ts`. Day: the 9 am – 10 pm rail at 88px an hour and one "All doctors"
column — a sticky header with the day's load and the doctor picker from `md`, the Doctor strip on
a phone — where an empty spot books its 15-minute slot (Create only, never a past day). Week: seven
columns, Sunday first, under day headers with each day's chair-time load; not on a phone. Month:
the 7-column board, each cell fitting what its height holds, the rest in the day popover. Blocks
split overlapping bookings into lanes, show the card on hover and open the drawer on a press.

## Files

| File                                                        | Responsibility                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appointments.route.tsx`                                    | Route marker — exports `Component` rendering `AppointmentsPage`.                                                                                                       |
| `appointments.manifest.ts`                                  | Manifest — `kind: 'layout'`, children `create` and `$appointmentId`; permission `organization:read`, module `clinic-appointments`, nav section.                        |
| `appointments.constants.ts`                                 | `APPOINTMENTS_NS` / `APPOINTMENTS_KEYS` (the `appointments` namespace) and `APPOINTMENTS_TEST_IDS`.                                                                    |
| `appointments.search.ts`                                    | `validateSearch` for the page (shared readers, no zod — the route tree is the entry chunk).                                                                            |
| `appointments.dialog-search.ts`                             | Both dialog routes' params (the booking prefill, the drawer's `mode`) — the routes keep the raw values, `useAppointmentsDialogRoute` parses them; loads with the room. |
| `appointments.params.ts`                                    | The views' reads from the URL — `appointmentListParamsOf` (Agenda), `appointmentRangeParamsOf` (calendars) — off the entry chunk.                                      |
| `appointments.calendar.ts`                                  | Pure calendar rules: the hour rail, `blockGeometry`, `laneLayout`, `dayLoad`, `weekLoad`, `monthFit`, `nowLineTop`, `slotFromPointer`, month cells.                    |
| `appointments.display.ts`                                   | Pure display rules: person and service tones, the Agenda's day-group tone and words, the "Latest update" pills and the card's last event.                              |
| `AppointmentsPage.tsx`                                      | Room page. Owns `data-testid="appointments-page"` (`data-view` = the view shown), the toolbar, the view's panel and the dialog routes' `<Outlet />`.                   |
| `hooks/useAppointmentsDialogRoute/`                         | Which dialog the URL opens — New or the booking (Edit / Reschedule, read-only without Edit) — the not-found and no-Create returns, `close`.                            |
| `hooks/useAppointmentsView/`                                | The view shown: the URL's, Week → Day on a phone with the URL replaced in place.                                                                                       |
| `hooks/useAppointmentsNavigation/`                          | The room's URL moves: set a view, shift / jump the period (`shiftAnchor`), open a day, open New appointment with a prefill — params kept.                              |
| `hooks/useLatestUpdateWords/`                               | Words and tooltips for the "Latest update" pills (the moved-from slot named clinic-local).                                                                             |
| `hooks/useCalendarRange/`                                   | A calendar's bookings for the view's days around the URL's anchor (every doctor for the Day), the list-error toast, `refreshing` while it reloads.                     |
| `hooks/useCalendarClock/`                                   | Today and the minutes after midnight on the clinic's clock, moving on every minute — the now line and the past veil.                                                   |
| `components/AppointmentActions/`                            | `AppointmentActionsProvider` / `useAppointmentActions`: Edit / Create, the guards' clock, move · cancel (reason confirm for "Other") · next · open.                    |
| `components/AppointmentsToolbar/`                           | The room toolbar: view tabs (no Week on a phone), "Today" + "‹ period ›" on a calendar, search, Filters, "New appointment" (Create only).                              |
| `components/AppointmentFilters/`                            | Filters popover (bottom sheet on a phone): `FiltersCalendar` (month, load dots, "Upcoming"), "Appointed to", status chips, Clear all / Apply.                          |
| `components/DoctorPicker/`                                  | "Appointed to" multi-picker over the bookable staff ("All doctors" · a name · "<n> doctors"), with optional per-doctor meta and footer.                                |
| `components/AppointmentsAgenda/`                            | The Agenda: its columns, cells (reading `AgendaCellsContext`, so state never remounts them), `AgendaDayHeader`, empty state, skeleton, infinite scroll.                |
| `components/AppointmentStatusPill/`                         | The status pill in the status's tone (H:3420).                                                                                                                         |
| `components/AppointmentStatusPopover/`                      | Change status (260px): the moves with their tiles and guards, then the cancel view ("Why is it cancelled?", Back).                                                     |
| `components/AppointmentCard/`                               | The booking card (340px): contact, when, doctor, last update, status tracker, next action · Open · Reschedule · Cancel; hover and quick view.                          |
| `components/CalendarBlock/`                                 | One booking on a calendar: the Day / Week block, the Month chip, the day popover's row — hover card, its Cancel's status popover, press to open.                       |
| `components/CalendarGrid/`                                  | `CalendarCard`, `HourRail` and `DayColumn` (hour lines, past veil, now line, lanes, the Day's slot surface).                                                           |
| `components/AppointmentsDay/`                               | The Day: header (load, doctor picker) or the phone Doctor strip, the rail and the "All doctors" column, slot booking.                                                  |
| `components/AppointmentsWeek/`                              | The Week: day headers (load bar, double-booking dot, open the day) over seven columns; 1,102px wide at least.                                                          |
| `components/AppointmentsMonth/`                             | The Month board: cells with fitted chips and "+<n> more" → `MonthDayPopover`; a cell opens its day.                                                                    |
| `create/`, `$appointmentId/`                                | The dialog routes (four files each; their pages render nothing).                                                                                                       |
| `__tests__/integration/appointments-test-router.tsx`        | The family's routes for tests — the page, both dialog routes, a room to close back to; `grantClinicAccess`, `renderAppointmentsRoutes`.                                |
| `__tests__/integration/appointments-dialog-routes.test.tsx` | Deep links, the not-found toast, the prefill kept in the URL, axe behind a dialog route.                                                                               |
