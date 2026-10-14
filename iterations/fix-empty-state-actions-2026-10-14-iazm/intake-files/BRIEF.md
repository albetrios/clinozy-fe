# Brief — an empty list shows no create or add button

## What changes

Every empty list in the clinic rooms keeps its colorful, centered illustration, its title and its
line, but loses the primary "+ …" button under them. The button duplicated the one the room's
toolbar already shows a few hundred pixels above it.

Screen by screen, on the `empty-states` screen (inventory rows from `empty-states.md`):

- R8 Leads (every view): no "New lead".
- R10 Appointments › Agenda: no "New appointment".
- R15 Patient file › Photos: no "Upload images".
- R21–R27 Medical (Sales, Medicines, Purchases, Suppliers, Manufacturers, MRs, Payments): no "New …".
- R28–R31 Clinic stock (Items, Purchases, Movements, Vendors): no "New …".
- R32 Payments › ledger: no "Receive".
- R33 Payments › Pending: no "Add pending".
- R34 Tasks › To do: no "New task".
- R37 Offerings: no "New offering".
- R38 Offerings › Offers: no "New offer".

## Why

The user asked for it after seeing the build: "please remove "+ add" button from each empty list
space". An empty list should say what is empty and why. The way to add stays where it always is, in
the room's toolbar (the floating pill on a phone), so there is one button for one action on every
screen.

## Affected screens, entities and routes

- Screens: `empty-states`
- Entities: none
- Routes: none

## Rules

- **Only create/add buttons go.** "Clear filters" on a filtered list stays: it is not an add, and
  it is the only way out of a filter that hides everything.
- These stay as they are, because they are not empty lists: the error states' Retry, the
  suspended-organization page's switch, the invitation page's actions, the settings search's
  "Clear search", and the organization picker's retry.
- The rooms' toolbars keep their "New …" (Create only, as today); nothing else about access changes.
- Each illustration, tone, icon, title and line stays exactly as `change-empty-states-2026-10-13-ssai`
  built it.
- Phone (375px): the same. The floating "New …" pill stays.

## Acceptance criteria

- [ ] No empty list in the inventory above renders a button inside its empty state, for any role.
- [ ] Filtered empty states still offer "Clear filters", and it still clears them.
- [ ] Each room's toolbar (or phone pill) still offers its "New …" / Upload / Receive / Add pending to
      a member with Create.
- [ ] The test ids that named the removed buttons (`appointments-book-one`, `tasks-empty-new`) are
      gone from code, tests and `docs/reference/e2e-testids-inventory.md`.
- [ ] The strings only those buttons used are removed from all eleven locales.
- [ ] The visual baselines of the clinic rooms show the empty states without a button.

## Out of scope

- The illustration, its tones and icons; the compact look; centering. All unchanged.
- The Day, Week and Month appointment calendars (their empty slot is still where you book).
- clinozy-be: nothing changes there.
