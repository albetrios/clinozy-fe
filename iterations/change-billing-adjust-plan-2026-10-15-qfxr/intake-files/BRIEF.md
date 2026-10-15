# Brief — Billing at a glance, with one "Adjust plan" button

## What changes

The user's reference is Claude's own Settings › Billing page. It opens on the plan in one line —
its mark, "Max plan" and a one-line description — with a single **Adjust plan** button at the
right. Under it a slim notice states the subscription's state ("Your subscription will be
canceled on Nov 10, 2026.") with its one action beside it (**Resubscribe**). Then **Payment**
(the default card, "Add payment method") and **Invoices** (Date, Total, Status, "Download PDF").
Nothing else competes for attention. The user: "let's have change/adjust plan button … follow
this kind of easiness".

Settings › Account › Billing changes to match:

1. **The plan header.** Round two's "Your plan" card (eyebrow, status pill, a large price, a seat
   meter, an includes list and two buttons) becomes one row: the plan's mark, "<Plan> plan", and
   one line with the price and the seats ("$30 / month · 9 of 15 seats used"; Free: "Free for
   ever · 1 seat"). One button at the inline end opens the plan picker: **Adjust plan** on a paid
   plan, **Upgrade plan** on Free, **View plans** to a member who may not manage billing. A status
   pill shows only when something needs attention (trialing, past due, incomplete, unpaid).
2. **The notice.** A slim bordered strip under the header with a calendar icon:
   - paid and renewing: "Your plan renews on <day>."
   - set to end: "Your subscription will be canceled on <day>." with **Resubscribe** (resumes it).
   - trialing: "Your trial ends on <day>."
   - past due / unpaid: "Your last payment didn't go through. Update your payment method to keep
     <plan>."
   - incomplete: "Your first payment hasn't gone through yet."
   - Free (no subscription): no notice.
3. **Cancellation** stays a quiet section at the bottom, but only while the plan renews; once it is
   set to end, the notice carries "Resubscribe" and the section goes (Claude shows one or the
   other, never both).
4. **Invoices**: Date, Total, Status, and the action — "Download PDF" when the provider gives a
   PDF, else "View invoice". The Due column goes.

The plan picker and its confirms (round two) are unchanged: "Adjust plan" opens them.

## Why

The Billing panel asks the reader to scan a card of eight parts before reaching the one thing
most visits are for — changing the plan. Claude's page answers "what am I on, when does it
renew, how do I change it" in one glance and one button.

## Affected screens, entities and routes

- Screens: Settings › Account › Billing (the plan header, the notice, cancellation, invoices)
- Entities: none — plans, the subscription and invoices are read as they are
- Routes: none — `GET /billing/plans`, `GET /billing/subscriptions`,
  `POST /billing/subscriptions/{subscription_id}/resume` and `/cancel`, `GET /billing/invoices`, all
  unchanged

## Rules

- Frontend only; no API, data or background change.
- "Adjust plan" / "Upgrade plan" / "View plans" all open the same picker; only managers (team
  workspace, `subscription:manage`) see the picker's actions, as before.
- "Resubscribe" resumes the subscription (the existing resume route) and is offered to managers
  only; a member sees the notice without the button.
- Dates are days ("Nov 14, 2026"), as in round two.
- Copy in all 11 locales, in the lazily loaded `app` namespace (nothing new on the first paint).

## Acceptance criteria

- [ ] Billing opens on one plan row: mark, "<Plan> plan", price and seats on one line, one button.
- [ ] The button reads "Adjust plan" on a paid plan, "Upgrade plan" on Free, "View plans" to a
      member who may not manage billing; each opens the picker.
- [ ] A renewing plan shows "Your plan renews on <day>."; Free shows no notice.
- [ ] A plan set to end shows "Your subscription will be canceled on <day>." with "Resubscribe",
      which resumes it; the cancellation section is gone in that state.
- [ ] Trialing, past due and incomplete each show their own notice (and the status pill).
- [ ] Invoices show Date, Total, Status and "Download PDF" (or "View invoice").
- [ ] Light and dark, 1440 and 375; every new string in 11 locales.
- [ ] Type-check, lint, the static gates, the colocated tests and the billing E2E spec pass.

## Out of scope

- The plan picker, its table and the change confirms (round two).
- Updating a saved card ("Update" in Claude's page) — clinozy-be has no route for it; "Add payment
  method" stays.
- Usage, and the other Settings panels.
