# Brief — One line per medicine

Written from the user's request (2026-10-15), after the compact line and the touch picker:

> dose, days are good but meal in second line is confusing also 2 medicines a lot more options and
> not separating - please work on it and medicine dropdown is longer - please fix it more beautiful
> UI and easy to access would be good

## What changes

New / Edit prescription › Medicines — each medicine line:

- **One line per medicine.** Meal moves up into the line, as its own column beside Days: Before ·
  After for a tablet (the usual two, one click), the usual places for a skin medicine (Face ·
  Scalp). Nothing about how to take a tablet sits on a second line any more.
- **Fewer options in sight.** Everything rarer — the other meal timings, a skin medicine's timings
  and other places, two tablets at each time (×2) and the note — opens from one "More" button at the
  end of that column. A choice made there shows on the button itself, lit, so it is never hidden.
- **The lines separate.** Each medicine is numbered (1, 2, 3 …), and a line is a single row of the
  table; a note shows as one quiet line under its medicine only when there is one.
- **A shorter medicine picker.** The medicine column takes only the room the other columns leave it,
  instead of half the line.
- Dose (`1 0 1`, SOS) and Days stay as they are.

## Why

The compact line put Meal on a second line beside the note, so each medicine had two rows of
options and a dashed note box; with two medicines the table read as one block of choices.

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the Medicines step).
- Entities: none (the line's data is unchanged).
- Routes: none.

## Rules

- The everyday choices stay one click: dose, SOS, days, before / after a meal, face / scalp.
- A rarer choice is two clicks (More, then the choice), and once made it shows on the line.
- Where the table is too narrow for one line (a narrow window, a touch tablet, a phone), Days and Meal
  move under the medicine together, as now.
- Touch targets stay 44px.

## Acceptance criteria

- [ ] A tablet is one line: number, medicine, dose, days, meal, quantity.
- [ ] More opens the other timings, places, ×2 and the note; a choice made there shows on the line.
- [ ] A note shows under its medicine only when there is one.
- [ ] The medicine picker is no wider than the room left by the other columns.
- [ ] Keyboard and touch as before; the unit suite and the gates pass; screens at 1440, 1280, 1024 and
  390 (touch), dark and Arabic, and a walkthrough.

## Out of scope

The quick line, the Pad, Browse, the allergy warning, the Rx sidekick, the saved data.
