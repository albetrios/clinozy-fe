# Brief — the prescription composer: write an Rx from anywhere, many lines at once, checked as you write

## What changes

1. **Write a prescription from anywhere.**
   - **⌘K / Ctrl K → "Write prescription".** A new action in the command menu's Actions group
     (also found by typing "rx", "prescription" or "medicine"). Choosing it keeps the menu open
     and turns it into a patient finder: a "Write prescription" chip leads the search line, the
     placeholder asks "Which patient? Type a name or phone", and the results are patients only.
     Opened over a patient's file, that patient is the first row ("This patient"), so
     ⌘K → ↵ → ↵ writes for them. Picking a patient opens their file with the New prescription
     drawer on top. Backspace on an empty line, or the chip's ×, goes back to the full menu.
   - **Patients room → a row's "Write prescription".** A new row action beside New invoice,
     opening the same drawer for that patient.
2. **Straight to medicines.** New and Edit prescription open on step 2, "Medicines", with
   Date and Doctor shown in step 1's summary. A new prescription puts the cursor in the quick
   line, so the first keystroke is the first medicine. When no doctor could be chosen for the
   patient, the drawer still opens on step 1.
3. **The Rx Pad — many lines at once.** A "Pad" button beside Browse opens a multi-line pad
   under the quick line. Each line is one medicine in the quick line's shorthand
   (`flu 0-0-1 af 10d`), typed or pasted, so a whole prescription from notes, WhatsApp or a
   colleague arrives in one go. Bullets, numbering ("1.", "-", "•") and dosage-form prefixes
   ("Tab.", "Cap.", "Syp.", "Inj.", "Oint.") are ignored.
   - **A live preview** under the pad reads every line as it is typed: the medicine it found
     (the store's, with its stock) or the name it will add as typed, and the shorthand's pills
     (dose, timing, place, days, quantity). A line it cannot read is marked and skipped.
   - **"Add N medicines"** (or ⌘/Ctrl ↵) adds every readable line to the table, filling a blank
     row first, as the quick line does, and empties the pad. Esc closes it.
4. **The Rx sidekick — checked as you write.**
   - **Allergy guard.** When the patient has allergies on file, a band under the drawer's
     header lists them in a danger tone. A line whose medicine name or composition matches
     an allergy is named in the band, and saving asks "Prescribe despite the allergy?" with
     the matching lines listed, "Go back" and "Save anyway". Matching is by word stem
     ("Sulfa drugs" → sulfamethoxazole) plus a few drug families (penicillins, sulfonamides,
     cephalosporins, tetracyclines, NSAIDs).
   - **Since last Rx.** Against the patient's previous prescription (an edit compares with the
     one before it): each medicine marked New, Changed (old → new directions), or Unchanged
     (counted); each stopped one listed with "Continue", which adds its last line back. The
     first prescription says so.
   - **What the patient reads.** The lines in plain words, numbered as the sheet prints them:
     "1 morning + 1 night · After meal · Scalp · 10 days · 20 in all".
   - **Where it sits.** From `xl` (1280px) a 320px column at the drawer's inline end — the
     drawer grows to keep the form at its width. Below `xl`, one card above the steps,
     folded to a one-line summary ("1 allergy match · 2 changes since Rx #12") that opens.

## Why

Doctors write a prescription at every consultation, and today it takes the patient's file,
then the Prescriptions section, then a step of Date and Doctor that are already right, then
one medicine at a time. Nothing on screen says the patient is allergic to what is being
written, or what changed since their last prescription — a doctor has to remember or go
looking. The composer makes the common case three keystrokes from anywhere, lets a whole
prescription be typed or pasted at once, and puts the safety and continuity checks next to
the lines being written.

## Affected screens, entities and routes

- Screens: the command menu (⌘K); the Patients room's table; the patient file's Prescriptions
  section — the New / Edit prescription drawer.
- Entities: none (the prescription, its kits and the medicines are read and written as today;
  the patient's `allergies` are already read by the file).
- Routes: none new. `GET /app/patients/{patient_id}/prescriptions`, `GET /app/medicines`,
  `GET /app/prescription-kits`, `POST` / `PATCH /app/patients/{patient_id}/prescriptions` and
  `…/approve`, and the contacts search behind ⌘K, as today.

## Rules

- The ⌘K action and the Patients row action show only to a member who may write prescriptions
  (the Prescriptions section's create gate, `patient_prescription:create`) and view Patients;
  View-as previews follow the role in force.
- The finder lists patients only — a lead without a patient file is not offered.
- The Pad never saves: it only adds lines to the form, and the drawer's save is unchanged
  (draft or "Save & approve", "Save & sell"). An approved prescription is read-only, so its
  drawer shows neither the quick line, the Pad nor the confirm; the sidekick still reads.
- The allergy guard warns, it never blocks: "Save anyway" saves as asked, including
  "Save & sell". A patient whose allergies the member may not see (`null`) gets no band and no
  guard; an empty list reads "No allergies recorded" in the sidekick only.
- "Continue" adds the stopped medicine's last line exactly as it was prescribed.
- Every new word is translated in all 11 locales (plurals per language); every surface works in
  light and dark, right-to-left, and on a phone; motion respects reduced motion.

## Acceptance criteria

- [ ] ⌘K shows "Write prescription" to a prescriber; "rx" finds it; choosing it shows the chip, the patient placeholder and patients only; picking one opens their New prescription drawer.
- [ ] Opened over a patient file, the finder's first row is that patient; Backspace on an empty line leaves the finder.
- [ ] A member without `patient_prescription:create` sees neither the ⌘K action nor the Patients row action.
- [ ] The Patients room's row actions include "Write prescription", opening that patient's drawer.
- [ ] New and Edit prescription open on Medicines; a new one focuses the quick line; with no doctor it opens on step 1.
- [ ] The Pad reads pasted multi-line shorthand (bullets, numbering and "Tab." ignored) into a live preview, and "Add N medicines" adds them all to the table.
- [ ] A patient with allergies shows the band; a matching line is named in it, and saving asks to confirm; "Save anyway" saves.
- [ ] The sidekick shows New / Changed / Unchanged / Stopped against the previous Rx, and "Continue" adds a stopped line back.
- [ ] "What the patient reads" shows each line in plain words.
- [ ] From 1280px the sidekick is a column; below it a folded card; light, dark, Arabic (RTL) and a 390px phone all read correctly.
- [ ] Existing prescription flows, test ids and suites pass unchanged.

## Out of scope

- Saving the lines as a kit (kit create/edit) — not chosen for this iteration.
- Any clinozy-be change: no new route, field or entity; `follow_up_date` and `print_language`
  stay unsent.
- Server-side drug–drug interaction or dose-range checking; the allergy guard is a client-side
  text match on the patient's own allergy list, not a clinical database.
- The visit flow's one-tap kit, the print sheet and the pharmacy lane — unchanged.
