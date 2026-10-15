# Brief — Billing's plan picker within the 36 kB first-paint CSS budget

## What changes

PR albetrios/clinozy-fe#84 (the three frozen iterations change-plan-comparison-2026-10-14-hhus,
change-plan-picker-2026-10-15-wvnm and change-billing-adjust-plan-2026-10-15-qfxr) failed CI's
"Build verify": **Initial CSS 36.22 kB against its 36 kB limit**. Tailwind emits every utility a
source file names into the one first-paint stylesheet, whether or not the screen is open; the
picker, its table, the plan card, the confirm and the notice named 25 utilities the stylesheet
did not yet ship (≈ 226 B gzipped), and `main` had ≈ 10 B of headroom.

The same screens, built only from utilities the stylesheet already ships:

1. **The row of plans**: viewport steps instead of the picker's own container queries — two by
   two from `sm`, all four in one row from `md` (where the drawer is a 1040px side panel); three
   plans `sm:grid-cols-3`.
2. **The comparison table**: the head row is `sticky top-0 z-20 shadow-xs` (inert inside the
   sideways-scrolling box below `md`, pinned from `md` where the box is `md:overflow-visible`);
   the row-name column's line is the cell's `border-e` instead of a pseudo-element; `min-w-140`
   (35rem) instead of 34rem; no fixed table layout; cells keep the default vertical alignment; the
   current plan's column and the group rows tint `bg-muted/30`.
3. **The plan card**: the price figure `text-2xl` (was `text-3xl`), the tagline's two lines held by
   `min-h-9`, `gap-x-2`; the mark and the confirm's chevron centre with flex.
4. **The notice**: `bg-muted/30`.

## Why

A failed size budget blocks the merge, and budgets are not raised to let a change in: the
stylesheet's history keeps every raise itemised, and none of these screens is first-paint.

## Affected screens, entities and routes

- Screens: Settings › Account › Billing — the plan header's notice, the plan picker, its table,
  the change confirm
- Entities: none
- Routes: none

## Rules

- No new utility in the first-paint stylesheet: the built `index-*.css` has the same rules as
  `main`'s.
- What the three frozen iterations specify stays true: one row of plans at the picker's width,
  the table head pinned while the picker scrolls, the row names held while the table scrolls
  sideways on a phone.

## Acceptance criteria

- [ ] "Build verify" passes: Initial CSS within 36 kB.
- [ ] The built first-paint stylesheet has no rule `main`'s lacks.
- [ ] At 1440 the four plans sit in one row and the table head pins; at 375 the plans stack and
      the table scrolls sideways with the row names held.
- [ ] Type-check, lint, the static gates and the colocated tests pass.

## Out of scope

- Raising the CSS budget.
- Anything the three frozen iterations do not already specify.
