# Brief — one step pattern for every create and edit drawer, and a collapsed step that reads at a glance

## What changes

Every create and edit drawer that splits its form into steps (the step cards of `_patterns.md`
"Step cards") follows **one** pattern, and a collapsed step is redesigned so it can be read at a
glance.

1. **One open step at a time, everywhere.** Every multi-step create or edit drawer opens on its first
   step (or the step a shortcut points at — a reorder opens Items, an offering reopens the step last
   open for it), and every other step starts collapsed. Opening a step collapses the one that was
   open. This includes the appointment form, whose two cards today open on their own (step 2 "Date &
   time" is always open next to step 1): step 1 now ends with "Next: Date & time →", and opening one
   card collapses the other.
2. **A step's state is honest.** The number circle and the head mean the same thing in every drawer:
   - **open** — the room's tone, its number;
   - **done ✓** (green) — the step holds something and none of its required fields is empty: a saved
     record's steps, a step prefilled by a default or a Quick fill, a step the user filled;
   - **needs attention !** (red) with "Missing: <fields>" — a required field is empty **and** the
     user has already been to that step, or tried to save. A step the user has not reached yet is
     never red;
   - **not started** (grey number) — nothing filled yet;
   - **locked** — as today (New lead's "Lead details" before a contact).
   The circle's state is also read out (screen readers), not only shown in colour.
3. **The same head on every step.** Number circle · title · one sub line · the hint ("Edit" once the
   step holds something, "Open" before) · a chevron that turns when the step opens. The open step's
   head shows no sub line — its fields are right below it — and keeps the chevron to fold it away.
   The whole collapsed card is the button; it lifts on hover.
4. **A better collapsed step.** The bordered tile grid with a dashed "Empty" tile for every empty
   field is replaced by a quiet summary:
   - the filled values as label / value pairs on the card itself (no tile borders), in columns that
     fit the drawer, toned values as their pill, a multi-select as its picks (four, then "+N");
   - every empty field folded into **one** muted line, "Not filled: <fields>", instead of a dashed
     tile each;
   - an items table as one row, "<Items> · <N> added", and its first names as chips;
   - a step with nothing filled yet reads "Not filled yet" on one line;
   - at most six pairs, then "+N more".
5. **Every step has a collapsed summary.** No step collapses to its bare title any more: the steps
   that do today (the contact editor's "Contact preferences", the supplier's "Account", the new
   task's three steps, New lead's contact, the sale return's steps, the purchase order's and the
   stock purchase's items, the report view's steps) get the same summary as the rest.

## Why

Opening a create or an edit drawer today, the steps do not read the same from one room to the next:
a fresh form shows a red "!" on steps the user has not reached; an edit of a saved record shows its
later steps as grey "not started" although they are filled; some collapsed steps show a tile grid
with a dashed "Empty" box per field, others a single line, others nothing at all; the appointment
form keeps both of its cards open. Front-desk staff, doctors and managers move between these drawers
all day — one pattern and a summary that is quick to scan make each drawer predictable, and make
"what is left to fill" obvious without opening every step.

## Affected screens, entities and routes

- Screens: every screen whose drawers use step cards — `patients`, `patient-file`, `appointments`,
  `leads`, `tasks`, `payments`, `clinic-stock`, `medical`, `offerings`, `users`; and the shared
  `_patterns.md` "Step cards" (collapsed peek, head, circle states).
- Entities: none.
- Routes: none.

## Rules

- No route, permission, API call, payload or validation rule changes; a drawer saves exactly what it
  saved before. "Save with an unfilled required field opens that step instead of saving" stays.
- Single-section drawers (≤ 8 fields, `_patterns.md` "Size", Multi-step "no") keep no step cards.
- The lead drawer's always-open cards are a record view beside the chat (`leads.md` "Lead drawer
  cards"), not a stepped form; they stay as they are.
- A collapsed step shows what is in the form now — the same values Save would send.
- Read-only (view) drawers show the same steps with their summaries; nothing in them is red.
- Phone: the same pattern; the summary columns fold to two, then one.
- Every new string is an i18n key in all locales; semantic tokens and named radius steps only.

## Acceptance criteria

- [ ] Every multi-step create drawer opens with its first step open (or its shortcut's step) and the
      rest collapsed; opening a step collapses the open one.
- [ ] The appointment form shows one open card at a time; step 1 ends with "Next: Date & time →";
      a checked-in visit keeps step 2 locked.
- [ ] A fresh create drawer shows no red "!" on a step the user has not opened; the "!" and
      "Missing: …" appear once the step has been opened and left, or after Save.
- [ ] An edit drawer of a saved record shows its filled steps as done ✓ ("Edit"), not grey.
- [ ] Every step head: circle · title · sub line (collapsed only) · hint · chevron; the open step has
      no sub line.
- [ ] A collapsed step shows its filled values as label / value pairs without tile borders, its empty
      fields as one "Not filled: …" line, and "Not filled yet" when nothing is filled.
- [ ] No step collapses to its bare title.
- [ ] The circle's state is announced to screen readers.
- [ ] Desktop (1440) and phone (390) screenshots and a screen recording per change.

## Out of scope

The fields inside each step, the order and the names of the steps, the drawers' widths, footers,
Quick fill rows and save flows, the lead drawer's cards, single-section drawers, and the backend.
