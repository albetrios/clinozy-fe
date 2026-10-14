# Brief — Today stops offering Dispense once the prescription is sold

## What changes

On `today`, a visit in the Pharmacy lane offers "Dispense" while its approved prescription is still
to fill (`today.md:46`). Dispense opens New sale over Today, prefilled from that prescription. Today,
once that sale is saved, the card keeps offering Dispense until the page is reloaded or the floor's
next poll (every minute) comes round.

After this change, the card updates as soon as the sale is saved: the prescription is filled, so
the card no longer offers Dispense. The same holds for every other sale write that changes whether a
prescription is still to fill, wherever it is made: a sale voided brings Dispense back to its card,
and its Undo takes it away again.

## Why

Found while recording Today › Dispense after the medical store merge. The pharmacist sees a
"Dispense" that the server will refuse (a filled prescription is sold once), and cannot tell whether
the sale went through without reloading. The server is right; only the screen is stale. Saving a sale
refreshes the Medical room, its medicines, the ledger and the credits, but not Today's floor, which
reads the pharmacy queue.

## Affected screens, entities and routes

- Screens: `today` (Pharmacy lane), `medical` (Sales: New sale, Void, its Undo, Return, Collect)
- Entities: MedicalSale, Prescription (the derived `filled`)
- Routes: none — `/organization/:organizationSlug/medical/sales/create` over Today, unchanged

## Rules

- Prescription writes already refresh Today's floor; a sale write now does the same.
- A sale write refreshes Today's floor whether or not Today is on screen: on screen it reads again
  at once; behind another room, it reads again when Today opens next.
- Nothing else about Dispense changes: who sees it (Medical Create and `patient_prescription:read`),
  what it opens, what New sale prefills.
- No new read and no new API call: the floor's existing read answers, the same one it polls.

## Acceptance criteria

- [ ] After a sale from Today's Dispense is saved, the visit's card in the Pharmacy lane no longer
      offers Dispense, without a reload.
- [ ] A sale write (new, collect, return, void, restore) refreshes Today's floor; a unit test pins it.
- [ ] The running app shows it: Dispense, save, the card without Dispense, at 1440.

## Out of scope

- The patient file's "Sell medicines" on an approved prescription: its read carries no `filled`, so
  it stays offered and the server refuses a second sale, as built.
- The floor's poll interval, Today's lanes and cards, New sale itself.
- clinozy-be: nothing changes there.
