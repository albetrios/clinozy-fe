# PRD — Colorful empty states, everywhere

A standalone change to clinozy-fe: every list, section and tab that has nothing to show yet tells the
user so with a centered, colorful illustration — an icon that belongs to that list, in that list's
tone — its words, and (where the member may act) the one action that fills it. It is not tied to any
earlier iteration: this drop is complete on its own.

## The request (verbatim)

> each section and tabs - without data should be showing icons each related and colorful if possible
> with text - currently I observed appointment shows book one kind of - please follow everywhere what
> we do have in patients empty but in center and more colorful if possible - and do this with all
> sections

Answers given while opening the iteration:

- Small empties inside a populated screen (patient overview cards, Today's work queue, the day-close
  list, settings panels) get a **compact** colorful version, centered — nothing stays a bare grey line.
- Frontend only; no backend change.

## What changes

1. **One look for "nothing here yet"** — the Patients list's illustrated empty state is the model:
   a dashed ring, a tinted disc, an icon tile and small dots, then the title, a line and the action.
   It becomes:
   - **centered** — vertically and horizontally in the space the list would fill (the table card's
     body, the tab's area, the lane panel), never pinned under the header;
   - **more colorful** — the dashed ring takes the tone's border color (was neutral grey); the tile is
     filled with the tone (a gradient from its dot to its ink, the icon knocked out in the page
     background) instead of a white card; the decorative dots come in three tones — the list's own
     and two accents — instead of one tone and one grey.
2. **Every section and every tab uses it** — see `empty-states.md` for the full inventory. The plain
   one-liners go: Appointments' "No appointments here · book one", Leads' "No leads match", Tasks'
   view lines, Today's lane line, the patient file's Photos, Packages and Team notes lines.
3. **Each list has its own related icon** — Medical's seven tabs and Clinic stock's four tabs no longer
   share one glyph (`Pill`, `Package`); each tab names its own (sales a receipt, suppliers a truck, …).
4. **Grey becomes color** — empties drawn in the neutral `stone` tone (Notifications, Sessions, API
   keys, Webhooks, the empty home) take a colorful tone that fits them.
5. **A compact version** for empties inside a populated screen — a 56px version of the same
   illustration over a one-line title, centered in its card.

## Why

An empty list is the first thing a new clinic sees in most rooms. Today the same situation looks four
different ways — an illustration in Patients, a grey sentence in Appointments, a dashed box in Photos,
nothing but muted text in Tasks — and the illustration that exists sits near the top of a tall, empty
card. One centered, colorful look reads as "this is where X will live" in every room, and the icon
tells the member which list they are looking at before they read a word.

## Affected screens, entities and routes

- Screens: `empty-states` (every room's list and tab, the patient file's sections, Today's lanes and
  queue, the settings panels — inventory in `empty-states.md`)
- Entities: none
- Routes: none added, changed or removed (`schema-routes.md`)

## Rules

- **Show it only when the list is truly empty and loaded.** Loading keeps its skeleton; a failed read
  keeps its error with Retry; filters or a search that hide everything keep the filtered state ("No
  matches", "Clear filters") — now drawn in the list's tone with the `Search` icon.
- **The action follows permission.** "New …" / "Book …" / "Upload …" shows only for a member who may
  create there — exactly as today. A member who may not sees the illustration and words only.
- **Tones are the existing tone tokens** (`preset.md`); no new color values. Each section keeps its own
  tone where it has one; a list inside the patient file keeps that section's tone.
- **Decorative only.** The illustration is `aria-hidden`; the title stays the heading it is today, so
  screen readers hear the same words.
- **Copy:** existing strings stay; the few new ones (Appointments, Leads, Tasks) ship in all eleven
  locales.

## Acceptance criteria

- [ ] Every row of `empty-states.md` shows its tone, icon, title, line and action as listed, at 375px
      and 1440px, light and dark.
- [ ] A room's table empty state sits in the vertical middle of the table card's body (± 8px) at 1440
      and on a phone.
- [ ] No grey one-liner remains for an empty section or tab list (search-result empties inside pickers
      and palettes are out of scope).
- [ ] Medical and Clinic stock tabs each show their own icon.
- [ ] Loading, error and filtered states behave as before.
- [ ] The "New …" actions appear only with the create permission.
- [ ] axe passes on the empty states (decorative illustration hidden, heading levels unchanged).
- [ ] Static gates, unit tests and the first-paint size budgets pass.

## Out of scope

- The appointment calendars (Day, Week, Month): an empty slot there is where you click to book, so the
  grid stays the empty state.
- Search-result empties inside pickers, the command palette, the quick line and the settings search.
- Text lines that are not empty lists (dialog notices, session timeout, appearance hints).
- The organization picker, onboarding and sign-in screens (outside the clinic rooms).
- Any backend, route, permission or data change.
