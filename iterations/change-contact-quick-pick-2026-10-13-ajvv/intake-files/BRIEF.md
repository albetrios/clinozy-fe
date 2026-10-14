# Brief — Pick or add the person faster, with one shared contact picker and a loading look that shows it is working

## What changes

One shared contact picker, **`ContactQuickPick`**, becomes the person step of every drawer that searches
the clinic's people inline: the New lead drawer's Contact step and the appointment form's "who"
search (New appointment and the appointment drawer). Same search, same rows, same keyboard, same
quick add, same loading — each drawer keeps its own row line and action words.

1. **Select faster**
   - Before anything is typed: the clinic's **5 most recently active people**, under "Recent", so
     the person who just messaged, called or visited is one tap (or ↵) away.
   - Typed but too short to search: a hint, "Keep typing — 3 letters or 4 digits".
   - Results: the typed part of each name is highlighted; ↑ / ↓ move a highlight that starts on the
     first row, ↵ picks the highlighted row, a click or tap still picks. The highlighted row shows a
     small ↵ key hint (tablet and desktop).
   - Each row keeps its drawer's second line and action: New lead "Open lead" / "Re-create lead" /
     "Use contact"; the appointment form "Use contact".
2. **Add faster**
   - The add row at the bottom reads what was typed: "New contact" when nothing is typed,
     "Add “Meera Iyer” as a new contact" for a name, "Add +91 98250 11241 as a new contact" for a
     number, both for "Meera 98250 11241".
   - Choosing it opens an **inline quick add** in the same card — Name and Mobile (+91), prefilled from
     the search (letters fill Name, digits fill Mobile; a typed `C-12345` or `#2371` fills nothing),
     the focus on the first empty field. ↵ adds; Esc or "Back to search" returns with the search kept.
   - When the search has its answer and it is empty, ↵ in the search opens the quick add at once.
   - New lead: "Add contact" sets the new person exactly as the contact editor's "Done" did (the
     person strip, then Lead details). "More details" opens the full contact editor seeded with the
     quick-add values; cancelling it commits nothing.
   - Appointment form: "Add contact" sets a new person with the mobile, as "+ Create contact" and the
     card's mobile field did.
3. **Loading that shows it is working** (shared, reusable pieces)
   - **Shimmer**: skeleton bars gain an opt-in soft highlight that sweeps along each bar in the
     reading direction (right to left on a right-to-left page), rows staggered, on the existing
     `SkeletonBar` / `SkeletonRows`. Used by the contact picker and by the shared Picker's loading
     rows, so every drawer that picks a person, patient, offering or member shimmers the same way.
   - **Progress line**: one shared indeterminate line, `ProgressLine`, under the search field while a
     search is in flight; the page-top `RouteProgressBar` is rebuilt on it (same look).
   - The search glyph turns into the spinner while a search is in flight.
   - A new answer loading over the previous one keeps the previous rows, dimmed — never a blank list.
   - Screen readers hear "Searching…", then "3 people found" or "No existing match".

## Why

The front desk opens a lead or a booking while the person is on the phone or standing at the desk:
every second and every retyped character counts. Today the search shows nothing until 3 letters, gives
no sign it is working (the skeleton is a flat fill, nothing moves), has no keyboard selection, and
"New contact" opens a blank editor so the name or number just typed is typed again. The two drawers
also draw two different searches for the same people.

## Affected screens, entities and routes

- Screens: leads (New lead drawer), appointments (the appointment form's who — New appointment and
  the appointment drawer); the shared Picker's loading rows (every drawer picker)
- Entities: Contact (read; a new one is still created by the existing lead and appointment writes)
- Routes: `GET /app/contacts` — `q` as today; Recent is the same route with
  `sort=last_activity_at&order=desc&limit=5` (no new route, no backend change); `POST /app/leads`,
  `POST /app/contacts` unchanged

## Rules

- The search threshold, debounce and limits stay: 3 letters, 4 digits of a number or a whole
  `C-12345`; 250ms; New lead 8 people, the appointment form 5.
- Recent fails quietly (no toast): the search still works. A member without `contact:read` sees what
  the search shows them today.
- Quick-add checks on "Add contact": a name is required ("Add a name"); New lead also requires a
  10-digit mobile ("Add a 10-digit mobile" — the lead cannot be created without it); the appointment
  form takes a mobile only when it is 10 digits ("Mobile needs 10 digits"), as its card did.
- Prefill: the digits of a number-like run (separators and a leading `+91` allowed) fill Mobile, at
  most 10; the remaining words fill Name, at most 60 characters; a contact or record number fills
  neither.
- Picking keeps every existing outcome: the toasts, the Re-target source for a patient, "Open lead"
  for a person with an open lead, the appointment's connected lead.
- Every new string ships in all 11 locales; numbers stay isolated on a right-to-left page.
- Reduced motion: no sweep and no spin — still bars and a still line.

## Acceptance criteria

- [ ] New lead opens with the search focused and up to 5 Recent people, shimmering skeleton rows while they load.
- [ ] 1–2 typed letters show the "Keep typing" hint; 3 letters show the progress line and spinner (skeleton rows when nothing is shown yet), then the results with the typed part highlighted.
- [ ] ↓ / ↑ move the highlight, ↵ picks it; a pick by keyboard gives the same form, toast and source as a click.
- [ ] With no match, ↵ opens the quick add prefilled from the search, the focus on the empty field; "Add contact" sets the person and opens Lead details.
- [ ] "More details" opens the contact editor with the quick-add values; cancelling it leaves the form without a person.
- [ ] The appointment form's who search is the same component — Recent, highlight, keyboard — and its quick add sets a new person with the mobile.
- [ ] The shared Picker's loading rows shimmer; `RouteProgressBar` looks and announces as before.
- [ ] With reduced motion nothing sweeps or spins.
- [ ] Screen readers hear "Searching…", then the count or "No existing match".
- [ ] Unit tests cover the component, the query parsing, the shimmer and the progress line; the drawer suites pass, updated only where the markup moved; every gate is green.

## Out of scope

The backend (no change); the Picker's structure beyond its skeleton rows; the patient drawer's duplicate
check; ⌘K's command search; the contact editor's own fields; the rooms' in-place `[data-refreshing]`
skeletons and `SkeletonRows` users other than the ones named (they stay flat unless they opt in).
