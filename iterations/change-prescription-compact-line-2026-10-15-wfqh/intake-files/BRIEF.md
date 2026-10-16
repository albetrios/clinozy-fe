# Brief — The compact medicine line

Written from the user's request (2026-10-15), after the one-click chips:

> also now this is not much formatted and please look into that perspective earlier it was perfectly
> formatted - instead of morning, night - go with 1 0 1 and SOS was amazing - make much more
> formatting and smaller buttons so it won't take that much space

## What changes

New / Edit prescription › Medicines — each medicine line:

- **Dose** goes back to the `1 0 1` taps — morning, afternoon, night, under the header
  "Dose · M A N" — with **×2** and **SOS** beside them. No words, no icons; one click each.
- Every choice is a **small segment in a compact tray** instead of a large separate chip — 24px with
  a mouse, 44px on touch. Still no dropdown: the usual pick stays one click.
- **Days** is a column of the line, under its own header, wherever the table has room for it; where
  it has not (a narrow window, a touch tablet, a phone) it leads the line under it.
- **The line under it** holds Meal (a tablet: Before · After · Empty stomach · With meal) or When and
  Where (a skin medicine), **with the note beside them** — a tablet takes two lines, as it did before
  the chips.
- **All medicines** is one slim line of the same tray.

## Why

The one-click chips spread a medicine over three rows of large pills with words. The doctor reads
and writes a dose as `1-0-1`, and the earlier table — one aligned line per medicine — was easier to
scan.

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the Medicines step).
- Entities: none (the line's data is unchanged).
- Routes: none.

## Rules

- One click for every everyday choice — no dropdown comes back.
- The columns line up with their headers at every width the table holds them; nothing squeezes the
  medicine's name.
- Touch targets stay 44px.
- The copy of the earlier table comes back: "Dose · M A N", "Meal", "Before", "After".

## Acceptance criteria

- [ ] A dose reads and is set as `1 0 1`; ×2 doubles the lit times; SOS stands in for the times.
- [ ] Segments are 24px with a mouse and 44px on touch; a line's controls are on one tray each.
- [ ] Days is a column when the table has room, else it leads the second line.
- [ ] A tablet line is two lines (the line, then Meal and the note).
- [ ] Keyboard: each tray is one Tab stop with the arrow keys inside (mirrored for Arabic).
- [ ] The unit suite and the gates pass; screens at 1440, 1280, 1024 and 390 (touch), dark and Arabic.

## Out of scope

The medicine cell and its source, the quick line, the Pad, Browse, the allergy warning, the Rx
sidekick, the saved data.
