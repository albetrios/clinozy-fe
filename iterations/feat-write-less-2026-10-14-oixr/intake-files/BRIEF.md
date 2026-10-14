# Brief — Write less: speak notes, save with one key, let the fields do the sums, dates and look-ups

## What changes

The clinic's staff write almost everything by hand: every note, every amount, every date, every
place. This change makes the shared field pieces do that work, so every drawer that uses them gets
it at once — nine improvements, each small, all of them on the screens staff use every day.

1. **Speak instead of typing — every drawer note field.** Every multi-line note field in a record
   drawer (appointment notes, task notes and outcome, prescription advice, lab report and procedure,
   treatment remark, check-in, review, report, patient address and notes, the patient's Notes page,
   invoice remark, credit note, stock remark, MR visit notes, offering description, offer note, role
   description) gains a microphone button in its bottom corner, on the inline end.
   - Tap it and speak: the words appear live, softer, under the field while they are still being
     recognised; each settled phrase is written into the field where the cursor is (at the end when
     the field was never focused), with one space before it and a capital letter at the start of a
     sentence. The field's length limit still holds.
   - While listening the button is the Bug report's glowing orb with its five-bar meter, and a
     line under the field says "Listening…" / "Hearing you…". Tap again to stop; leaving the drawer
     stops it too.
   - A blocked microphone, silence or no speech service says so on that line, in words.
   - The button shows only where the browser can recognise speech (Chrome, Edge, Safari), never
     on a read-only or disabled field. The language is the app's language, in the browser's own
     region when it has one (`en-IN` for English on an Indian browser).
2. **⌘ Enter / Ctrl Enter saves any drawer.** In every record drawer with a Save, the keys press
   the drawer's primary button — exactly as a click would: nothing while it is disabled or a save is
   running; "incomplete" still names what is missing; a form drawer submits its form.
   - The primary shows the keys as a quiet hint ("⌘ ↵" on a Mac, iPhone or iPad, "Ctrl ↵"
     elsewhere) from `md` on a device with a fine pointer, and announces them (`aria-keyshortcuts`).
   - The Keyboard shortcuts list gains "Save the open drawer".
3. **Amount fields do the sums.** Every drawer number field (amounts, prices, counted cash,
   quantities) also takes a sum: `1500+300`, `2000-150`, `3x500` (or `3*500`, `3×500`), `4500/3`,
   and the shorthands `1.5k` (1,500) and `2L` / `2 lakh` (2,00,000). While a sum is typed, its result
   shows at the end of the box ("= 1,800"), and the form already holds the result; leaving the field
   or pressing Enter writes the result into it. A sum that does not work out (`12+`, a result below
   zero, division by zero) shows no result and is not taken.
4. **Dates in shorthand.** Every date dropdown's search also reads `3d`, `2w`, `1m`, `1y`, `+10`,
   `in 3 days`, `in 2 weeks`, `-2d`, `today`, `tomorrow`, `yesterday` and a weekday (`fri`,
   `friday`, `next fri`) — the next such day after today — as well as the dates it reads today. The
   date it means is offered first; Enter picks it. The search's placeholder says so: "Type a date —
   12 sep, 2w, fri".
5. **Recent picks in the long pickers.** The stock item and stock vendor pickers, the medical
   supplier, manufacturer and MR pickers and New task's "Assigned to" open on "Recent" — the
   member's last 3 picks there, kept on their preferences (the pickers' existing Recent group, built
   but never switched on).
6. **Steppers answer the arrow keys.** In every drawer stepper (sessions, durations, levels,
   commission): ↑ / ↓ add or take one, Page Up / Page Down ten, within the same limits as − and +.
7. **Check-in: last time's plan in one tap.** In a patient's check-in, "Details" (what they
   followed) offers "Use the advised plan" and "Next plan" offers "Same plan as last time" — chips
   under the field that write the previous check-in's plan into it. They show only when the previous
   check-in had a plan and the field does not already hold it.
8. **A branch's PIN code fills its place.** In Users › Branches, the sixth digit of the PIN fills
   City and State — and Area when the PIN has one area, or offers its areas as chips when it has
   several — from the directory bundled with the app, as the clinic setup already does. An unknown
   PIN fills nothing and says so; every field stays editable.
9. **"Paid to" remembers the clinic's payees.** Send payment's "Paid to" chips are the clinic's own
   four most recent payees (from its sent payments), then "Electricity" — not the two example names
   every clinic sees today ("Medline Surgicals", "Meta ads").

## Why

Front desk, doctors and accounts type the same things all day — notes while the patient is in the
room, amounts worked out on a phone calculator, dates counted on a calendar, places a PIN already
knows. Each improvement removes a step where the app could have known or done it, and because they
live in the shared field pieces, every drawer gets them at once instead of one screen at a time.
Two of them correct what was already there: the pickers' Recent group was built and never turned
on, and Send payment offered every clinic the same two made-up payees.

## Affected screens, entities and routes

- Screens: every record drawer (the shared drawer, its note fields, number fields, steppers and
  date dropdowns); the patient's Notes page; patient check-in; Users › Branches drawer; Send payment;
  the stock and medical pickers and New task's Assigned to; Keyboard shortcuts; Report a bug (its voice button moves to
  the shared piece, unchanged)
- Entities: none changed (Membership preferences' recent picks and Payment read as today)
- Routes: none new — `GET /app/memberships/me/preferences` and `PATCH` (recent picks, as today);
  `GET /app/payments` (the clinic's recent expenses, for the payees)

## Rules

- No backend change, no new route, no new entity: clinozy-be is untouched.
- Dictation uses the browser's own speech recognition, the same as Report a bug: no library, no
  audio through Clinozy. No microphone button where the browser has none.
- ⌘ / Ctrl Enter never fires while text is being composed (an input method) or after a field
  inside already used the keys (the chat composer). A stacked drawer saves itself, never the one
  under it.
- Sums: digits, one decimal point per number, `+ - x * × /`, the shorthands `k` and `L` / `lakh` /
  `lac`; anything else is dropped as today. The result is rounded to the field's decimals and capped
  at its maximum.
- Dates: every shorthand stays inside the dropdown's own earliest and latest dates; one outside them
  is not offered.
- Recent picks: ids only, the last 3 per picker, on the member's preferences — never in browser
  storage; a picker of 7 or fewer options shows no Recent group (as today).
- Payees: read quietly — on a failed read the chips are "Electricity" alone; names as the clinic
  typed them, at most four, newest first, each once.
- Every new string ships in all 11 locales; right-to-left pages mirror the mic and the hints;
  reduced motion keeps the mic still.

## Acceptance criteria

- [ ] A note field in a drawer shows a mic in Chrome; tapping it listens, interim words show under the field, a settled phrase lands at the cursor with spacing and a capital, and tapping again stops.
- [ ] No mic shows without browser speech support, nor on a read-only or disabled note field.
- [ ] ⌘ / Ctrl Enter in a drawer saves exactly as its primary button does; nothing happens on a read-only drawer or while saving; the hint shows on the primary from `md`.
- [ ] Typing `1500+300` in an amount field shows "= 1,800" and the field holds 1800 after leaving it; `1.5k` gives 1500 and `2L` gives 200000; `12+` gives no result.
- [ ] Typing `2w` in a date dropdown offers the date two weeks from today first, and Enter picks it; `fri` offers the next Friday.
- [ ] The stock item, stock vendor, medical supplier, manufacturer and MR pickers and New task's "Assigned to" open on Recent after a pick (lists of more than 7).
- [ ] ↑ / ↓ and Page Up / Page Down move a drawer stepper within its limits.
- [ ] A check-in after one with a plan offers "Use the advised plan" and "Same plan as last time", and each fills its field.
- [ ] A branch's six-digit PIN fills City and State (and Area); an unknown PIN says so.
- [ ] Send payment's "Paid to" chips are the clinic's recent payees, then "Electricity".
- [ ] All 11 locales carry the new strings; `pnpm health` passes.

## Out of scope

- Saved phrases or snippets per member or clinic, and dictation in single-line fields or the chat
  composer.
- On-device-only speech recognition (a browser setting, not the app's).
- Any backend change, new route or new stored field.
- The Send payment quick fill presets themselves (they keep their design values).
