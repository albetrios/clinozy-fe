# Brief — Today becomes the floor's command center: what needs you now, where everyone is, and who is here

## What changes

Today (`/organization/$organizationSlug/today`) keeps its greeting, lane tiles, lane panel and work
queue, and gains four things that answer the three questions a clinic asks every few minutes —
_what needs me now?_, _where is everyone?_ and _is she here yet?_:

1. **Needs you now — a ranked triage list.** Between the greeting and the lanes, one section lists
   the people on the floor who need someone now, most urgent first, each with the lane's own
   one-tap action:
   - **Late** — an Arriving booking 5 minutes or more past its start ("Late 12 min · booked 10:30").
   - **Due** — an Arriving booking starting within 10 minutes ("Due in 6 min" · "Due now").
   - **Waiting** — 15 minutes or more in Waiting ("Waiting 24 min · since 10:18").
   - **In room** — 30 minutes or more With doctor (no action: the consult is the patient's page).
   - **Checkout** — everyone at Checkout ("₹1,500 to pay" when today's bill is known, else
     "At checkout").
   - **Rx ready** — an approved prescription in Pharmacy ("approved 10:40").
   - **No reply** — an enquiry whose latest message is 30 minutes old or more ("No reply 2 h").
   - Three tiers: _hot_ (late 15+ min, waiting 30+, in room 45+, no reply 2 h+), _warm_ (the rest of
     late, waiting, in room, no reply, checkout, Rx) and _soon_ (due). Hot first, then warm, then
     soon; within a tier the longest overdue first.
   - Only the member's lanes: a member with a role focus sees the items in their focus lanes; Owner
     and Admin see every lane they can read.
   - The first three rows show; "Show n more" opens the rest. Nothing to do: one calm line — "All
     calm — no one is waiting on you."
   - A row: the urgency chip (blush hot, butter warm, sky soon), the name (opens the person, as a
     card does), the lane chip (jumps to the card on the floor) and the context, the action at the
     end. One line from `md`; two on a phone.
2. **The journey strip.** The seven lane tiles become one connected path — Enquiries › Arriving ›
   Waiting › With doctor › Treatment › Checkout › Pharmacy — a chevron between each tile, one row
   that scrolls with snap when it does not fit. A tile with late, long-waiting, long-in-room or
   unanswered people wears an alert badge at its top end: a clock and the number, blush when any is
   hot, butter otherwise; its accessible name says what it counts ("Running late: 2").
3. **The floor finder.** A search field in the greeting row — "Find on the floor" — matches today's
   floor by name (any word, from its start, accents ignored) or by phone (3+ digits). Results drop
   down under the field (up to 8): the person, their lane chip, time and service. Arrow keys move,
   Enter picks, Escape closes. Picking opens the person's lane and spotlights the card (scrolled
   into view, focus on its name, a 2s ring in the lane's tone). No match: "No one by that name on
   today's floor" and "Search all contacts" (opens the command menu). `/` focuses the field.
4. **Live cues and shortcuts.**
   - An Arriving card adds its timing flag before Confirmed/Unconfirmed: "Late n min" (blush), "Due
     now" (butter), "In n min" (sky, within the hour).
   - A Waiting or With-doctor card shows a wait meter under its name: a 3px bar filling to 30 min
     (waiting) or 45 min (in room), sage → butter → blush as it crosses the tiers; its flag turns
     blush when hot.
   - The pulse starts with a live dot (the floor refreshes every minute).
   - "New booking" becomes the primary button; "Walk-in" stays outline.
   - Keys on Today: `/` find, `[` and `]` previous and next lane, `N` new booking, `W` walk-in —
     only without a modifier, never while typing, never under a dialog. A keyboard button in the
     greeting row opens the app's shortcuts list, which gains the three Today rows.

## Why

The floor showed one lane at a time and treated a patient 25 minutes late the same as one booked
for this afternoon. The front desk had to click through lanes to find who needs them, and through
seven lanes to answer "is Mrs Sharma here yet?". The new Today surfaces urgency first, keeps the
whole journey in one row, and finds anyone in one keystroke — for the front desk, doctors,
therapists, pharmacists and owners alike.

## Affected screens, entities and routes

- Screens: Today (`today`) only; the app's keyboard-shortcuts list gains three rows.
- Entities: none — every cue is derived from the floor, the enquiries and today's bills already
  read.
- Routes: none — no new API read; the checkout bills read also runs while Checkout has people (it
  ran only while the Checkout lane was open).

## Rules

- Permissions unchanged: an item's action is the card's (`useFloorActions`, hidden without the
  code); the name opens what the card's name opens; lanes the member cannot read never appear in
  the list, the strip or the finder.
- View-as previews read everything and act on nothing, as today.
- Thresholds are constants (late 5/15, due 10, waiting 15/30, in room 30/45, reply 30/120 min).
- Times are clinic-local; minutes never go below zero.
- Shortcuts never fire in a field, with Ctrl/⌘/Alt, or while a dialog is open; the app's own keys
  (`?`, digits, `G`, ⌘K) keep their meaning.
- Semantic tokens only, named radius steps, logical CSS (RTL mirrors, the chevrons flip), WCAG AA in
  light and dark, motion only under `prefers-reduced-motion: no-preference`.
- Every new string in all eleven locales; the test ids are listed in the inventory.

## Acceptance criteria

- [ ] With a late arrival, a long wait and a checkout on the floor, Needs you now lists them hot →
      warm → soon, each with its action, and the action works as the card's does.
- [ ] With nothing urgent, the section shows the calm line.
- [ ] A focused member sees only their lanes' items; Owner/Admin see all readable lanes.
- [ ] The strip shows seven connected tiles in one row at 1440px and scrolls at 390px; alert
      badges count late/long/unanswered people per lane.
- [ ] The finder finds a person by name and by phone, picks with the keyboard, opens their lane and
      spotlights the card; no match offers Search all contacts.
- [ ] Arriving cards show Late / Due now / In n min; Waiting and With-doctor cards show the meter.
- [ ] `/`, `[`, `]`, `N`, `W` work on Today and do nothing in a field or under a dialog; the app's
      shortcuts list shows the Today rows.
- [ ] Light and dark, 390 · 834 · 1440, Arabic mirrors; no raw colours; existing Today flows and
      test ids unchanged; `pnpm health` green.

## Out of scope

The backend (no new field or route), the Tasks room, the patient visit flow, the lane panel's card
actions and the work queue's behaviour, any change to how lanes are derived.
