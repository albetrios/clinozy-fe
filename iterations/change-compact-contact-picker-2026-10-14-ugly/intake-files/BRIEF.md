# Brief — Make the contact picker short: pick or add a person without the list taking over the drawer

## What changes

The shared contact picker (`ContactQuickPick`) — the person step of New lead, the "who" search of
New appointment and the appointment drawer, and, behind a field, New task's "For", Receive payment's
and the Invoice drawer's patient — is redrawn to take a fraction of the height it takes today.
Same search, same people, same keyboard, same quick add; only the shape changes.

1. **Recent becomes a rail of faces.** Before anything is typed, the five most recent people sit on
   **one line**: the "Recent" label, then a chip per person — their avatar and a short name (first
   name and the last name's initial; the whole name on hover and to a screen reader, with their
   line and action). The line scrolls sideways when it does not fit, a soft fade at the edge where
   there is more; ← / → (mirrored on a right-to-left page) move along it, ↑ / ↓ still move through
   every row, ↵ picks the highlighted chip, a click or tap picks.
2. **Results in a short window.** Search results keep their two lines (name over the drawer's line,
   the action at the end) on tighter rows, and the list shows about three and a half rows: the rest
   scroll under it, and a fade above the add row says there is more below. ↑ / ↓ scroll the window
   with the highlight.
3. **A slimmer add row.** The add row ("New contact", "Add “Meera Iyer” as a new contact", …) keeps
   its words and stays pinned at the foot, 36px instead of 40px.
4. **A tighter quick add.** On a narrow card (a phone, a narrow drawer) Name takes the first line and
   Mobile shares the second with the Add button, instead of three stacked lines; on a wide card the
   one line of Name · Mobile · Add stays.
5. **Loading in the same shape.** While Recent loads, chip-shaped shimmer stands in for the rail;
   while a search loads, three shimmer rows at the new row height.

Measured on the demo clinic, an empty picker goes from about 350px to about 125px tall, and a search
with eight people from about 365px to about 245px.

## Why

The desk picks or adds a person in every drawer that starts with one. Today the picker's Recent alone
is five 51px rows and a search shows up to eight more under a 320px list: on New appointment the
appointment's own fields start below the fold on a phone, and New task's "For" popover covers most of
the drawer. Picking should be a moment, not a page.

## Affected screens, entities and routes

- Screens: leads (New lead drawer, Contact step), appointments (the appointment form's who — New
  appointment and the appointment drawer), tasks (New task's "For"), payments (Receive payment's
  patient), invoices (the Invoice drawer's patient) — through the one shared component
- Entities: none (Contact read as today)
- Routes: none — `GET /app/contacts` is read exactly as today (search and Recent); no backend change

## Rules

- Every behaviour of the picker stays: the search threshold (3 letters, 4 digits, a whole `C-12345`),
  250ms debounce, the limits (New lead 8, the appointment form 5), Recent's five people, the
  highlight starting on the first row (the first Recent chip before typing), ↵ waiting for the first
  answer, the add row's words and the quick add's prefill and checks, every host's row line and
  action, every outcome of a pick.
- The test ids stay: the search, each hit (a Recent chip carries the hit's id), the add row, "No
  existing match", and the picker's own ids (`-recent`, `-results`, `-loading`, …).
- The chip's visible name is short; its accessible name is the whole name, the host's line and the
  action, so nothing a screen reader heard before is lost.
- A right-to-left page mirrors the rail: it starts at the right, ← moves forward, the fades swap sides.
- Reduced motion: no shimmer sweep, no smooth scroll (the platform rule).
- No new user-facing copy unless needed; any new string ships in all 11 locales.
- Semantic tokens and the theme's radius only; a round chip carries `data-slot="pill"` so the Sharp
  shape squares it.

## Acceptance criteria

- [ ] With nothing typed, the picker shows Recent as one line of chips (avatar + short name), the first chip highlighted; the picker (search + rail + add row) is under 140px tall in New appointment.
- [ ] A chip's accessible name is the whole name, the line and the action; hovering shows the whole name.
- [ ] ← / → move the highlight along the rail (mirrored under RTL), the highlighted chip scrolls into view; ↵ picks it with the same outcome as a click.
- [ ] Search results show at most about three and a half rows; with more, the list scrolls and a fade shows above the add row; ↑ / ↓ keep the highlighted row in view above the add row.
- [ ] The add row is 36px and keeps its words; the quick add on a narrow card is two lines of fields (Name; Mobile + Add).
- [ ] Recent loading shows chip-shaped shimmer; a search loading shows three compact shimmer rows.
- [ ] New lead, New appointment, the appointment drawer, New task's "For", Receive payment and the Invoice drawer all pick and add as before (their suites pass, updated only where the markup moved).
- [ ] The scroll-edge measuring is one shared hook, used by the picker and by the patient file's Feedback carousel (which keeps its behaviour).
- [ ] Unit tests cover the rail, its keys, the short name and the shared hook; every gate is green.

## Out of scope

The backend (no change); the search, Recent and quick-add logic; the contact editor; the shared
`Picker` (offerings, members, doctors); ⌘K's command search; the patient drawer's duplicate check.
