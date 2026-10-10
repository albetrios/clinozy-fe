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
with "Appointment not found · it may have been deleted" (`S:115`); a drawer closes back to the
page with the page's own params — a new booking moves the page's `date` to its day (H:6051,
D28). Opened from another room (`from` on the referrer allow-list), the form opens over that
room, which stays behind it while the URL bar shows the drawer's route (A-P1): the app's
cross-room host renders `components/AppointmentDialog/` there.

The URL (`appointments.search.ts`, D27): `view` — Agenda (default) · Day · Week · Month, Week
rendering Day on a phone with the URL replaced (`useAppointmentsView`); `date` (the Agenda's one
day, the calendars' anchor); `doctor` (one membership id — the API takes one); `status` (Active by
default); `q`; `created`. There is no follow-up filter and no column sort: the API has no
follow-up on bookings and sorts by date and start (api-integration §5.3, G3). The dialog routes'
`who` is a contact id and `copyOf` a booking id (public ids). The page, `create/` and
`$appointmentId/` share one search string, so a booking from an empty Day slot keeps the same day
behind it. The data — reads, writes, the status machine — lives in the shared clinic layer on
clinozy-be (`@/shared/hooks/useAppointments/`, `@/shared/api/clinic/appointments-api.ts`,
`@/shared/api/clinic/appointment-status.ts`); every read is within the header's branches.

The views (L-36b): the toolbar on the shared `RoomToolbar` — the view tabs, on a calendar the
period controls (`period`), the search, the room's own Filters popover (`filtersSlot`: a month
calendar with load dots from the day counts, "Appointed to", the status chips, Created) and "New
appointment". The Agenda is the shared `DataTable` grouped by day (`groups`: sticky day headers
with the day's "<n> confirmed · <n> awaiting reply" from `GET /app/appointments/daily-counts` over
the days loaded — whatever the status, search and created filters say), in the API's date-and-start
order, re-gridded on a phone. Every booking surface
reads one `AppointmentActionsProvider`: the Change status popover (the status machine's moves and
guards, its cancel view with the contract's reasons — one tap cancels, "Other" takes its required
note in the view itself, asked once — L-64),
the booking card (hover after 420ms, pinned from the row's eye, a sheet-like popover on a phone)
and the row click into the drawer. A status move is its own route and optimistic — a check-in's
toast offers Undo, a cancel's Undo reinstates it; a list that fails to load keeps the last copy and
toasts Retry (`useListLoadError`). A doctor is the team directory's member (a name, initials and a
tone — no role or presence, api-integration M41); every active member is bookable.

The calendars (L-37) read their range (`useCalendarRange` → `fetchAppointmentRange`, the last
range kept as the in-place skeleton while the next loads) and lay bookings out with the pure rules
of `appointments.calendar.ts`. Day: the 9 am – 10 pm rail at 88px an hour and one "All doctors"
column — a sticky header with the day's load and the doctor picker from `md`, the Doctor strip on
a phone — where an empty spot books its 15-minute slot (Create only, never a past day). Week: seven
columns, Sunday first, under day headers with each day's chair-time load; not on a phone. Month:
the 7-column board, each cell fitting what its height holds, the rest in the day popover. Blocks
split overlapping bookings into lanes, show the card on hover and open the drawer on a press.

## Files

| File                                                        | Responsibility                                                                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appointments.route.tsx`                                    | Route marker — exports `Component` rendering `AppointmentsPage`.                                                                                                                                           |
| `appointments.manifest.ts`                                  | Manifest — `kind: 'layout'`, children `create` and `$appointmentId`; permission `organization:read`, module `clinic-appointments`, nav section.                                                            |
| `appointments.constants.ts`                                 | `APPOINTMENTS_NS` / `APPOINTMENTS_KEYS` (the `appointments` namespace) and `APPOINTMENTS_TEST_IDS`.                                                                                                        |
| `appointments.search.ts`                                    | `validateSearch` for the page (shared readers, no zod — the route tree is the entry chunk).                                                                                                                |
| `appointments.dialog-search.ts`                             | Both dialog routes' params (the booking prefill, the drawer's `mode`) — the routes keep the raw values, `useAppointmentsDialogRoute` parses them; loads with the room.                                     |
| `appointments.params.ts`                                    | The views' reads from the URL — `appointmentListParamsOf` (Agenda), `appointmentRangeParamsOf` (calendars) — off the entry chunk.                                                                          |
| `appointments.calendar.ts`                                  | Pure calendar rules: the hour rail, `blockGeometry`, `laneLayout`, `dayLoad`, `weekLoad`, `monthFit`, `nowLineTop`, `slotFromPointer`, month cells.                                                        |
| `appointments.display.ts`                                   | Pure display rules: person and service tones, the Agenda's day-group tone and words, the "Latest update" pill — the booking's latest event.                                                                |
| `AppointmentsPage.tsx`                                      | Room page. Owns `data-testid="appointments-page"` (`data-view` = the view shown), the toolbar, the view's panel and the dialog routes' `<Outlet />`.                                                       |
| `hooks/useAppointmentsDialogRoute/`                         | Which dialog the URL opens — New or the booking (Edit / Reschedule, read-only without Edit) — the not-found and no-Create returns, `close`.                                                                |
| `hooks/useAppointmentsView/`                                | The view shown: the URL's, Week → Day on a phone with the URL replaced in place.                                                                                                                           |
| `hooks/useAppointmentsNavigation/`                          | The room's URL moves: set a view, shift / jump the period (`shiftAnchor`), open a day, open New appointment with a prefill — params kept.                                                                  |
| `hooks/useLatestUpdateWords/`                               | Words and tooltips for the "Latest update" pill (the moved-from slot named clinic-local).                                                                                                                  |
| `hooks/useCalendarRange/`                                   | A calendar's bookings for the view's days around the URL's anchor (every doctor for the Day), the list-error toast, `refreshing` while it reloads.                                                         |
| `hooks/useCalendarClock/`                                   | Today and the minutes after midnight on the clinic's clock, moving on every minute — the now line and the past veil.                                                                                       |
| `components/AppointmentActions/`                            | `AppointmentActionsProvider` / `useAppointmentActions`: Edit / Create, the guards' clock, move (one route each) · cancel (its note for "Other") · next · open.                                             |
| `components/AppointmentsToolbar/`                           | The room toolbar: view tabs (no Week on a phone), "Today" + "‹ period ›" on a calendar, search, Filters, "New appointment" (Create only).                                                                  |
| `components/AppointmentFilters/`                            | Filters popover (bottom sheet on a phone): `FiltersCalendar` (the shared month grid — load dots — and "Upcoming"), "Appointed to", status chips, Created, Apply.                                           |
| `components/DoctorPicker/`                                  | "Appointed to" single picker over the team directory ("All doctors" or one name), with optional per-doctor meta and footer.                                                                                |
| `components/AppointmentsAgenda/`                            | The Agenda: its columns, cells (reading `AgendaCellsContext`, so state never remounts them), `AgendaDayHeader`, empty state, skeleton, infinite scroll.                                                    |
| `components/AppointmentStatusPill/`                         | The status pill in the status's tone (H:3420).                                                                                                                                                             |
| `components/AppointmentStatusPopover/`                      | Change status (260px): the moves with their tiles and guards, then the cancel view ("Why is it cancelled?", Back).                                                                                         |
| `components/AppointmentCard/`                               | The booking card (340px): contact, when, doctor, last update, status tracker, next action · Open · Reschedule · Cancel; hover and quick view.                                                              |
| `components/CalendarBlock/`                                 | One booking on a calendar: the Day / Week block, the Month chip, the day popover's row — hover card, its Cancel's status popover, press to open.                                                           |
| `components/CalendarGrid/`                                  | `CalendarCard`, `HourRail` and `DayColumn` (hour lines, past veil, now line, lanes, the Day's slot surface).                                                                                               |
| `components/AppointmentsDay/`                               | The Day: header (load, doctor picker) or the phone Doctor strip, the rail and the "All doctors" column, slot booking.                                                                                      |
| `components/AppointmentsWeek/`                              | The Week: day headers (load bar, double-booking dot, open the day) over seven columns; 1,102px wide at least.                                                                                              |
| `components/AppointmentsMonth/`                             | The Month board: cells with fitted chips and "+<n> more" → `MonthDayPopover`; a cell opens its day.                                                                                                        |
| `create/`, `$appointmentId/`                                | The dialog routes (four files each; their pages render nothing).                                                                                                                                           |
| `__tests__/integration/appointments-test-router.tsx`        | The family's routes for tests — the page, both dialog routes, a room to close back to; `grantClinicAccess`, `renderAppointmentsRoutes`.                                                                    |
| `__tests__/integration/appointments-test-data.ts`           | A `vi.hoisted` world of bookings and the doubles of the appointments API and the team directory the room's suites mock with (cursor pages, ranges, day counts, writes, a hold that keeps a write pending). |
| `__tests__/integration/appointment-form-stand-in.tsx`       | A stand-in for the shared `AppointmentForm` showing its props, with Save, Close, Copy and Open — the room's suites test the room, the form's own suites the form.                                          |
| `__tests__/integration/appointments-dialog-routes.test.tsx` | Deep links, the not-found toast, the prefill kept in the URL, axe behind a dialog route.                                                                                                                   |
