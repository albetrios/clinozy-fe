# Brief — The medicine picker is 44px on touch

Written from the user's request (2026-10-15), after the compact line:

> make the medicine picker 44px on touch too

## What changes

New / Edit prescription › Medicines: on a touch screen (a coarse pointer) the medicine picker of a
medicine line — the button that names the medicine and its source — is 44px high, like the line's
segments and its quantity stepper. With a mouse it stays 32px.

## Why

`change-prescription-compact-line` made every segment and the quantity stepper 44px on touch; the
medicine picker was the one 32px control left on the line (that iteration's Standing deviation).

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the Medicines step).
- Entities: none.
- Routes: none.

## Rules

- Only the prescription line's picker changes; the shared picker keeps its sizes for every other
  items table.
- With a mouse nothing changes.

## Acceptance criteria

- [ ] On a touch screen the line's medicine picker is 44px high; with a mouse, 32px.
- [ ] No other picker changes.
- [ ] The unit suite and the gates pass; screens at 1024 and 390 with touch, and 1440 with a mouse.

## Out of scope

The picker's list, the other items tables' pickers, anything else on the line.
