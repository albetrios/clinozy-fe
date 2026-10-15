# Brief — a plan picker with every plan side by side, and an upgrade or downgrade you see before you confirm

## What changes

The user's review of the first build: "think of plan with features as well — how claude.com is
following — follow the same", "amazing plan selection and upgrade downgrade … more beautiful UI/UX".
claude.com shows its plans in one row — name, tagline, a large price with its fine print, one
action, "Everything in <previous>, plus:" — over a "Compare features across plans" table in
sections. The best upgrade and downgrade flows (Paddle's plan-change preview, Slack, Notion,
GitHub) show what changes — from, to, the price, what you gain or lose, and when — before anything
happens.

1. **Your plan** (Settings › Account › Billing). The summary card becomes the current plan at a
   glance: the plan's icon in its tone, its name, the status pill, the price and its cycle, the
   renewal date, a seat meter (used of included), and what the plan includes as a short list.
   Two actions for a member who may manage billing: "Compare plans" (opens the picker) and
   "Upgrade to <next plan>" (the next plan up, straight to its confirm) when there is one. No
   subscription: the card is the workspace's Free plan — "You're on Free".
2. **The plan picker.** "Compare plans" opens a wide drawer over Settings (1040px, "Back" returns to
   Billing; full screen on a phone):
   - its head: "Plans", a line on what changes with each plan, and — before there is a
     subscription — the Monthly · Yearly switch with "Save up to N%";
   - **every plan in one row** from 1024px (two by two below it, stacked on a phone), as tall as
     each other, each card top to bottom: the plan's icon on its tone, the name, the tagline, the
     price (large, per month) with its fine print ("Billed yearly · $100 a year" / "Billed
     monthly" / "Free for ever"), "Save N%", one full-width action, then "Includes:" or
     "Everything in <previous>, plus:" and the checklist;
   - the current plan carries "Current plan" on its card and the ink edge; the plan right above it
     carries "Next step up";
   - below, **"Compare features across plans"**: the table, open, its head row of plan names
     staying in view while it scrolls; Pricing · Team · Features rows with their one-line
     explanations.
3. **Each action says what it does, then shows what will happen before it happens.**
   - No subscription: Free is the plan the workspace is on ("Current plan"); a paid plan reads
     "Choose <plan>".
   - Subscribed: a dearer plan "Upgrade to <plan>", a cheaper paid plan "Switch to <plan>", Free
     "Switch to Free".
   - Every action opens **a confirm** (the app's confirm: a panel at the inline end, a sheet on a
     phone): from → to as two plan chips; the price before and after on the subscription's cycle;
     what you get (an upgrade) or what you lose (a downgrade), from the same checklist; and when:
     - an upgrade or switch between paid plans takes effect now, the difference prorated on the
       next invoice (when the subscription is billed through the provider);
     - choosing a first plan: you confirm your payment method next (when payments are on);
     - switching to Free cancels the paid plan at the end of the period — it stays until the
       renewal date, then the workspace is on Free;
     - a plan with fewer seats than are in use says how many active members, not owners, the most
       recently joined first, will be suspended until seats free up.
   - The confirm's button repeats the action ("Upgrade to Growth"); "Keep <current plan>" closes
     it.

## Why

The first build put four cards two by two inside the settings panel and hid the features behind a
toggle; the user wants plans read side by side with their features, as claude.com shows them, and
an upgrade or downgrade that never surprises — what you gain or lose, what you pay and when, shown
before you confirm. The backend already decides those facts: a plan change applies at once and keeps
the cycle, Stripe prorates the difference, a workspace without a paid plan is held to the cheapest
(Free) plan's seats, Free has no price to subscribe to, and a smaller plan suspends the members it
cannot seat.

## Affected screens, entities and routes

- Screens: Settings › Account › Billing — the summary card (now "Your plan"), the Change plan card
  (now the plan picker drawer), and a new plan-change confirm
- Entities: none — plans and the subscription are read as they are
- Routes: none — `GET /billing/plans`, `POST /billing/subscriptions`,
  `POST /billing/subscriptions/{subscription_id}/change-plan` and
  `POST /billing/subscriptions/{subscription_id}/cancel` are called as they are

## Rules

- Frontend only; no API, data or background change.
- The picker is a stacked drawer over Settings, not a URL: Settings stays the `#settings/*` hash
  modal.
- Free is the cheapest active plan when its price is zero, as clinozy-be reads it; with no
  subscription it is the current plan and has no action.
- Moving to Free is a cancellation at period end; a subscription already ending reads "Free from
  <date>" on the Free card, and resuming stays in the cancellation card.
- The cycle switch keeps its rule: offered before there is a subscription, to members who may manage
  billing; afterwards every price is on the subscription's own cycle.
- Members who may not manage billing see the plans and their prices with no actions.
- Plan selection keeps its single-flight guard, the payment step and its error toasts; every
  existing test id stays (`billing-summary`, `plan-options`, `plan-<id>`, `plan-current`,
  `billing-cycle-*`, `plan-compare-table`).
- Copy in all 11 locales, in the lazily loaded `app` namespace (nothing new on the first paint);
  icons from the registry only (no new glyph); semantic tokens and room tones only; logical CSS;
  dark mode, every preset and the theme axes follow.
- The confirm is the app's own `ConfirmPanel`; it takes focus on "Keep", and a second press while
  the change runs does nothing.

## Acceptance criteria

- [ ] Billing shows "Your plan" with the icon, name, status, price and cycle, renewal, a seat meter
      and what it includes, with "Compare plans" and "Upgrade to <next>".
- [ ] "Compare plans" opens the picker; at 1440 all four seeded plans sit in one row, equal height,
      with "Current plan" and "Next step up" marked; "Back" returns to Billing.
- [ ] The picker's comparison table is open under the cards and its head row stays in view.
- [ ] With no subscription, Free reads "Current plan" and has no button; paid plans read "Choose".
- [ ] Each action opens a confirm with from → to, the prices, the gains or losses, and when it
      takes effect; confirming runs the change; "Keep" closes it with nothing changed.
- [ ] A downgrade below the seats in use names how many members will be suspended.
- [ ] "Switch to Free" cancels at period end and says until when the paid plan stays.
- [ ] Phone (375): the picker is full screen, cards stacked, table scrolls sideways; the confirm is
      a bottom sheet.
- [ ] Light and dark read correctly; every new string in 11 locales; no new first-paint bytes.
- [ ] Type-check, lint, the static gates, the colocated tests and the billing E2E spec pass.

## Out of scope

- clinozy-be, its prices, descriptions and capability keys; a proration amount preview (the backend
  has no endpoint for one).
- A public pricing page.
- Payment methods, invoices and the cancellation card (resuming stays there).
