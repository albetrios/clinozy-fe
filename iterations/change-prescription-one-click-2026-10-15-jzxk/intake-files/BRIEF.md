# Brief — Every everyday choice on a medicine line is one visible click

Written from the user's review of the medicine rows (2026-10-15):

> instead of dropdwon - think something new and easy so it will be 1 click less - as dropdown adds 1
> more click to select an item? - please use amazing best skills to set up this UIUX - give users to
> amazing experience

## What changes

New / Edit prescription › Medicines — each medicine line shows its choices as chips, so the usual
pick is one click, never "open, then pick":

- **Line 1 — what and how much:** the medicine (its source pill, as today), then **Dose** chips —
  Morning · Afternoon · Night (each one tap on, one tap off, with a sun / moon mark), **×2** (two
  tablets at each lit time) and **SOS** — then the quantity and ×.
- **Line 2 — how long, when, where:** **Days** chips 5 · 7 · 10 · 14 · 30 · 60 and a small number box
  for any other course; **When** chips that fit the medicine — taken by mouth: Before food · After food
  · Empty stomach · With food; put on the skin: Night · Morning · Morning & night · Alternate days ·
  Thrice a week · Once a week; **Where** chips for a medicine put on the skin — Face · Scalp · Body ·
  Hair · Affected area, and "+ more" opening the other places in place.
- **Same days for all:** above the lines, once two medicines are written, one click sets the same
  course on every line ("All medicines: 5 · 7 · 10 · 14 · 30 days").
- A second click on a lit chip clears it. The quantity follows days × doses a day, as today.
- Keyboard: Tab moves between chip groups, the arrow keys within a group. Touch: chips are 44px high.

## Why

A dropdown is two clicks — open, then pick — and hides the choices. The doctor picks the same few
values all day; showing them turns each change into one click and lets the eye read a line at once.

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the Medicines step).
- Entities: none changed.
- Routes: none.

## Rules

- A medicine is "put on the skin" when its store record's form, or its name, says so (lotion,
  cream, gel, shampoo, serum, sunscreen, wash, soap, oil — the app's own rule); otherwise "taken by
  mouth". A value already set that the medicine's chips lack still shows, lit, so nothing is hidden.
- The typed timing and typed place of an older prescription keep showing as a lit chip.
- ×2 doubles every lit time (1 → 2) and a second click halves it back; other combinations stay
  available from the quick line and the Pad ("2-0-1").
- Nothing about saving, the allergy warning, the sidekick or the wire changes.

## Acceptance criteria

- [ ] Dose, Days, When and Where need no dropdown: each usual value is one click.
- [ ] A lit chip clears with a second click; the quantity follows days × doses a day.
- [ ] When shows the meal chips for a tablet and the skin timings for a gel; Where shows for a gel.
- [ ] "+ more" shows every place in place; an unusual saved value still shows lit.
- [ ] "Same days for all" sets every line's days in one click.
- [ ] Tab reaches each chip group once; arrow keys move within it; chips are 44px on touch.
- [ ] Copy in all 11 locales; the unit suite and the gates pass; screens at 1440, 1280, 1024 and 390.

## Out of scope

The medicine picker (a search list by nature), saving, the sidekick, the backend.
