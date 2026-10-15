# Brief — The medicine line's quantity stepper is 44px on touch

Written from the user's request (2026-10-15):

> make the quantity stepper 44px on touch too

## What changes

New / Edit prescription › Medicines: on a touch screen (a coarse pointer) the quantity stepper of a
medicine line — "−" · the count · "+" — is 44px high and its two buttons 44px wide, like the line's
chips. With a mouse it stays as it is.

## Why

The chips of a line became 44px touch targets in `change-prescription-one-click`; the quantity
stepper was the one 32px control left on the line (that iteration's Standing deviation).

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the Medicines step).
- Entities: none.
- Routes: none.

## Rules

- Only the prescription's medicine lines change. The shared stepper gains an opt-in; the other items
  tables (invoices, sales, purchases …) keep their stepper until they are reviewed at that size.
- The quantity column keeps room for the larger buttons at every width.

## Acceptance criteria

- [ ] On a touch screen the line's stepper is 44px high, its buttons 44px wide; with a mouse, 32px.
- [ ] No other items table changes.
- [ ] The unit suite and the gates pass; screens at 390 and 1024 with touch, and 1440 with a mouse.

## Out of scope

The other items tables' steppers; anything else on the line.
