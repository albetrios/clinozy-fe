# Brief — Medicine rows that are quick to change, the allergy warning under its row, and earlier prescriptions you can use

Written from the user's review of the prescription composer (2026-10-15):

> 1. medicine current table with selection and dose - everthing more intutive - easy to change and
>    also user can enter - inside medical and only text or outside medicine - think from user side -
>    they should write less and access much easily with mouse or touch
> 2. and one more feature I liked that you've mentioned with allergy - you've presribed this medicine
>    but it should be below medicine row only instead of the bigger popup
> 3. preview of older prescription much more useful for users

## What changes

### 1 · The medicine rows (New / Edit prescription › Medicines)

- **Store or outside, at a glance.** Every row says where its medicine comes from: the clinic's own
  medical store (with its stock — "24", or "Out of stock") or an **outside** medicine written as
  text, which the patient buys elsewhere. The medicine list groups "In your medical store" and
  "Written for this patient before"; a name the store lacks is added as "Outside medicine “…”".
  A store medicine can be switched to "Write as outside medicine" (the patient buys it elsewhere,
  never sold from this prescription), and an outside name the store carries can be switched to the
  store's — from the list itself.
- **Days are a control, not typing.** A **Days** cell offers 3 · 5 · 7 · 10 · 14 · 21 · 30 · 45 ·
  60 · 90, or any number typed (1–365); it fills the quantity from the dose (days × doses a day).
  The note line is left for real remarks ("apply thin layer"); a note that starts with days ("10
  days, apply thin") is read into the Days cell when an existing prescription opens.
- **Dose taps say what they do.** Morning · Afternoon · Night toggle on and off with one tap; the
  ⌄ beside them holds the common doses in words — 1-0-0 Morning, 0-0-1 Night, 1-0-1 Twice a day,
  1-1-1 Thrice a day, 0-1-0 Afternoon, SOS When needed — and a − / + per time for two tablets.
- **Touch.** On a touch screen the taps and buttons of a row grow to finger size.

### 2 · The allergy warning under its row

- The "Prescribe despite the allergy?" dialog goes. A line that matches the patient's allergies
  carries its warning **directly under the row**: "Septran DS — allergic to Sulfa drugs", with
  **Remove** (the line goes) and **Keep** (prescribed knowingly; the warning quietens to a line
  that says so).
- Saving with a warning not yet answered does not open a dialog: the Medicines step opens, the
  page scrolls to the warning, it takes the focus and a toast says what to do. Keep, then save.
- The allergy band under the header and the sidekick's allergies stay.

### 3 · Earlier prescriptions you can use

- The Rx sidekick (column from `xl`, folded card below) gains **Earlier prescriptions**: one of
  the patient's other prescriptions at a time — its number, day, doctor and status — with ‹ › to
  step through them, newest first. Each line reads in plain words; a line this prescription
  lacks has **+ Add**, a line it holds reads "In this Rx"; **Add all** copies every missing line;
  the advice prints under them.
- The Prescriptions table's Medicines column reads the days too ("1-0-1 · After meal · 7 days").

## Why

The table was the slowest part of writing an Rx: days typed into a note, three 24px taps that
cycle through counts, and nothing saying whether a medicine is the clinic's or bought outside. The
confirm dialog interrupted the save far from the row it was about. The earlier prescriptions were
visible only as a diff against the last one — the doctor could not read, or reuse, an older one.

## Affected screens, entities and routes

- Screens: Patient file › Prescriptions › New prescription, Edit prescription (the drawer, its
  Medicines step and its sidekick); the Prescriptions table.
- Entities: none changed — `prescription` lines keep `medicine_id` (store) or none (outside), and
  the days stay in `remarks` as written today ("7 days · apply thin layer").
- Routes: none new — the existing `GET /app/patients/{patient_id}/prescriptions`, `GET
  /app/medicines` and the prescription create / update.

## Rules

- A line's source is its `medicine_id`: set — the store's (stock from `GET /app/medicines`); none —
  outside. Switching a store medicine to outside keeps its name and drops the id.
- Days save as the first part of the remarks in the drawer's language ("7 days"), followed by the
  note after " · "; a prescription without days saves its note alone.
- The quantity follows days × doses a day whenever both are known; it stays editable.
- An allergy match is a line whose medicine name or the store's composition shares a stem with an
  allergy, or falls in one of the five drug families (as today). Keep is remembered per medicine
  name while the drawer is open; a changed medicine is warned again. A read-only drawer shows the
  warning without its buttons. Nothing is ever blocked — Keep is one tap.
- Earlier prescriptions exclude the one being edited; Add copies the old line's dose, timing,
  place, days, quantity and note into the first blank row, or a new one. A read-only drawer browses
  them without Add.

## Acceptance criteria

- [ ] Each row shows its source: store with its stock, out of stock, or outside.
- [ ] The medicine list groups store medicines and this patient's earlier names; a new name is
      offered as an outside medicine; a picked medicine can be switched store ↔ outside.
- [ ] Days: one tap on a preset (or a typed number) sets the days and the quantity follows the dose.
- [ ] Opening a saved prescription whose note starts with days shows them in Days and the rest as
      the note; saving writes "7 days · rest" back.
- [ ] Morning / Afternoon / Night toggle with one tap; the ⌄ sets a common dose or SOS in one tap,
      and two tablets with + .
- [ ] On a touch screen the row's taps and buttons are at least 36px.
- [ ] A matching line shows its warning under the row with Remove and Keep; there is no dialog.
- [ ] Saving with an unanswered warning opens Medicines, scrolls to it and focuses Keep.
- [ ] The sidekick's Earlier prescriptions steps through the patient's other prescriptions; + Add
      and Add all copy lines; a line already written reads "In this Rx".
- [ ] The Prescriptions table's directions include the days.
- [ ] All copy in the 11 locales; the unit suite, the gates and the screens at 1440, 1280, 1024
      and 390 (light, dark, Arabic) pass.

## Out of scope

Backend changes (a separate `days` field on a line, a "bought outside" flag beyond `medicine_id`),
the A4 sheet, kits ("Save as kit"), and the ⌘K finder.
