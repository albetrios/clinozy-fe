# Brief — motion that explains what changed: gliding selections, live counts, softer refreshes

## What changes

1. **Two named curves.** The sheet curve the drawers, sheets and the phone tab bar's lens already use
   (`cubic-bezier(0.32, 0.72, 0, 1)`) gets a name, `--ease-sheet`, and its existing uses read it.
   A strong ease-out, `--ease-out-strong` (`cubic-bezier(0.23, 1, 0.32, 1)`), is added for presses,
   pops and arrivals. New motion uses only these two.
2. **Buttons answer a press.** Every button but a text link sinks to 97% while it is held and
   springs back on release (160ms, `--ease-out-strong`).
3. **The segmented tracks glide.** On every room's tab track (the room tabs — Payments, Medical,
   Stock — and the in-page views: Appointments' Agenda · Day · Week · Month, Patients' All ·
   Follow-up due · Recall, Leads', Tasks') and on Today's work-queue Mine · Everyone switch, the
   selected segment's card is one thumb that glides to the segment picked (280ms, `--ease-sheet`)
   instead of jumping. A row whose tabs carry their own selected colours (the chat composer's channels, the
   patient file bar, the timeline filters) keeps its look.
4. **The section bar's lens glides.** From `md`, the current room's tinted capsule in the header's
   pinned tabs is one lens that glides to the room opened and crossfades into its tone (280ms,
   `--ease-sheet`), as the phone tab bar's lens already does. A room opened from "All sections" that
   is not pinned fades the lens out; coming back fades it in where it lands.
5. **Today's counts roll.** A lane tile's count that changes while Today is open (a check-in, a
   send-in, the minute refresh) rolls to its new value — up when it grows, down when it shrinks
   (280ms, `--ease-out-strong`, a 2px blur on the way). The first paint does not roll.
6. **Today's lane panel follows the tile.** Choosing another lane crossfades the panel into the
   lane's tone (200ms) and its cards rise into place one after another (220ms each, 25ms apart,
   the first six; 4px).
7. **Refreshes settle.** Where a list redraws in place with the room skeleton (`data-refreshing` —
   tables, calendars, Today's floor and work queue, task lists), the fresh content settles in from
   half opacity (220ms) instead of snapping from bars to text.
8. **Small controls.** A checkbox's tick pops in (160ms, from 65%); the switch's thumb travels on
   `--ease-out-strong` (200ms) and its track animates only its colours, not `all`; the "All
   sections" menu and the patient file's "Add" menu grow from their trigger (Radix's origin, right
   under RTL too) instead of a fixed corner.

## Why

The app already moves — drawers slide, menus drop, the phone tab bar's lens slides — but most
choices still jump: a tab's card teleports, a desktop room tab blinks to its tone, Today's numbers
swap silently, a refreshed list snaps from grey bars to text. Each of these is a change the eye has
to re-find. Motion here is spatial and causal: it shows where the selection went, which number
changed and in which direction, and that a list was replaced rather than broken. It makes the
clinic floor feel live without adding a single decorative loop.

## Affected screens, entities and routes

- Screens: the app shell's section bar (from `md`); every room toolbar's tab track (Appointments,
  Patients, Leads, Tasks, Payments, Medical, Stock, Offerings, Users, invoices); Today (lane tiles,
  lane panel, work queue); every list that redraws in place (`data-refreshing`); every button,
  checkbox and switch; the "All sections" menu and the patient file's "Add" menu
- Entities: none
- Routes: none — no API route, no URL and no search param changes

## Rules

- Frequency decides: nothing new moves on a keyboard shortcut, the command palette or a hover; a
  glide or roll answers a choice the user made or a fact that changed.
- Only `transform` (`translate`, `scale`), `opacity`, a short `filter: blur` and colours animate —
  plus the width of the one absolutely placed glide thumb, which moves no layout.
- Every new motion stays under 300ms per element and uses one of the two named curves.
- Reduced motion: the app's rule (`prefers-reduced-motion: reduce` → every animation and transition
  at once) holds; the script-driven settle and roll skip their motion too.
- Right-to-left: the thumbs and the lens land under the selected item in Arabic; a count's roll is
  vertical, so it needs no mirror.
- A selected segment never loses its look before its thumb is placed (no unstyled first frame); a
  row without a measured thumb (tests, no layout) keeps the segment's own selected surface.
- The first-paint CSS budget holds (`pnpm size` Initial CSS ≤ 36.0 kB): the new rules ship in
  co-located stylesheets with the lazy chunks that use them, not in `index.css`.
- No new copy, no new dependency, no test id removed; the tabs' roles, `aria-current`,
  `aria-selected` and keyboard behaviour stay as they are.

## Acceptance criteria

- [ ] Holding any non-link button scales it to 97%; releasing restores it.
- [ ] Switching Appointments' views, Patients' views and Today's Mine · Everyone glides one thumb
      to the picked segment; Payments' and Medical's room tabs glide too.
- [ ] From `md`, opening another pinned room glides the header lens to it and into its tone.
- [ ] Checking a patient in on Today rolls Arriving down and Waiting up; the first paint does not
      roll.
- [ ] Choosing a lane crossfades the panel's tone and cascades its cards.
- [ ] A list refreshed in place (a view tab, a filter) settles in from half opacity.
- [ ] A checkbox's tick pops; the switch thumb travels on the strong curve.
- [ ] Arabic: the thumbs and the lens sit under the selected item.
- [ ] Reduced motion: every selection lands at once; counts swap without rolling.
- [ ] Light and dark read the same as before at rest; no raw palette colour.
- [ ] Initial CSS stays within its 36.0 kB budget; every existing test id and tab role is kept.

## Out of scope

- The drawers' and dialogs' exits (the design gives them none; a record drawer is opened and closed
  all day) and the command palette (keyboard-first — it keeps its short drop-in).
- The sign-in screen's journey dial, the onboarding motion and the bug report's — already their own.
- Page transitions (`PageTransition`'s rise is kept as it is).
- New or changed translations, API calls or data.
- The Playwright visual baselines — recorded separately with clinozy-be running.
