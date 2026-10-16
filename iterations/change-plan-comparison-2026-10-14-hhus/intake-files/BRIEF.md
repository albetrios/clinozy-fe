# Brief — the plan comparison reads the way Claude's does: tiers that build on each other, one price unit, and a side-by-side table

## What changes

The **Change plan** card of Settings › Account › Billing (`#settings/account/billing`), following
how Claude presents its own plans:

1. **One card per plan, cheapest first, that builds on the one before it.** Each card shows:
   - the plan's name, and a one-line tagline under it — the plan's own description, or, when it has
     none, who it is for, read from its seat allowance ("For one practitioner", "For teams of up to
     5", "For teams of any size");
   - the price as a large figure with a small unit — **always per month**, so every card is read in
     the same unit: in the yearly view a plan's yearly price is shown as its monthly equivalent, with
     "Billed yearly · <yearly price> a year" under it and a "Save N%" chip; a plan with no yearly
     price says it is billed monthly only; a free plan says "Free for ever";
   - its action (below);
   - its features as a checklist: the first plan lists what it includes ("Includes:"), every later
     plan lists only what it adds — "Everything in <previous plan>, plus:" — its larger seat
     allowance and each capability the previous plan does not have.
2. **Actions say what they do.** With a subscription: the current plan's button reads "Current
   plan" and is disabled; a dearer plan reads "Upgrade to <plan>" (the primary button); a cheaper
   one "Switch to <plan>" (the outline button). With no subscription: "Choose <plan>". Members who
   may not manage billing see no buttons; the current plan still says so.
3. **The Monthly · Yearly switch tells you what yearly saves.** The Yearly segment carries a
   "Save up to N%" chip — the largest saving any plan offers. The switch keeps its rule: it is
   offered before there is a subscription; after that each card is priced on the subscription's
   own cycle.
4. **"Compare all features" opens a side-by-side table** under the cards: one column per plan
   (the current one marked and tinted), rows grouped as Pricing (monthly, yearly), Team (seats
   included) and Features (audit log, single sign-on, priority support), each row with a one-line
   explanation; a tick or "Not included" per cell, values where the row has one. On a phone the
   table scrolls sideways with the row names held in place.
5. **The grid fits the plans.** Four plans sit two by two in the settings panel and four across
   when it is wide enough; never three and an orphan.

## Why

The plan grid today is four identical tiles — a name, a price and "Workspace billing plan." on
each — so nobody can tell what a dearer plan buys. The yearly view mixes "/ mo" and "/ yr" in one
row, and every button reads the same whether it upgrades or downgrades. clinozy-be already sends
each plan's seat allowance and capability flags; the frontend drops them. Claude's plan picker
solves the same problem with tiers that build on each other, one price unit and a comparison
table — the owner deciding whether to upgrade should see it at a glance.

## Affected screens, entities and routes

- Screens: Settings › Account › Billing — the Change plan card (`AccountBillingPanel`)
- Entities: none — the plan's existing `features` map and `limits.seats` are read, not changed
- Routes: none — `GET /api/v1/billing/plans` is read as it is; no API, data or background change

## Rules

- Frontend only; clinozy-be is not changed.
- A capability is shown only when the frontend knows its key (`audit_log`, `sso`,
  `priority_support`) — every visible string is an i18n key in all 11 locales; an unknown key is
  skipped, never shown as a raw key.
- A feature whose value is `false` or absent is "not included"; a number or text value is shown as
  the value.
- Plan selection, its single-flight guard, the payment step and every existing test id keep
  working; the subscription's cycle still decides the prices once there is one.
- Prices are formatted in the viewer's locale and the plan's currency; whole amounts lose their
  `.00` on the large figure.
- Semantic tokens only; dark mode, every preset and the theme axes follow; logical properties
  (RTL mirrors).
- The table is a real table: column headers are the plans, row headers the features; a tick and a
  dash each carry a screen-reader word.

## Acceptance criteria

- [ ] Plans are ordered cheapest first; every card after the first reads "Everything in
      <previous>, plus:" and lists only what it adds.
- [ ] A plan without a description shows a tagline from its seat allowance, never "Workspace
      billing plan.".
- [ ] In the yearly view every card shows a per-month figure; plans with a yearly price show
      "Billed yearly · <price> a year" and "Save N%"; the Yearly segment reads "Save up to N%".
- [ ] With a subscription the current plan's button is a disabled "Current plan", dearer plans
      "Upgrade to …", cheaper ones "Switch to …"; selection and the payment step work as before.
- [ ] "Compare all features" opens a table with one column per plan, the current one marked;
      ticks and "Not included" are announced.
- [ ] Four plans sit 2 × 2 at 1440 in the settings panel; on a 375 phone the cards stack and the
      table scrolls sideways with its row names held.
- [ ] Light and dark read correctly; no raw palette colours; every new string in all 11 locales.
- [ ] Type-check, lint, the static design gates and the colocated tests pass.

## Out of scope

- clinozy-be: the plan catalog, its prices, descriptions and feature keys.
- Plan-based gating of any feature in the app.
- The billing summary, payment methods, invoices and cancellation cards.
- A public pricing page.
