# fix-billing-css-budget-2026-10-15-lutj — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built in the commit
`fix(billing): keep the plan picker within the 36 kB first-paint CSS budget`.

## Rows

| #   | Ledger row | Planned                                    | Actually built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Difference                                                 | Why                                                                                                                                                                 | Decision                 | Commit      |
| --- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------- |
| #1  | L-1        | Swap the 25 new utilities for shipped ones | `BillingPlanComparison`: `sm:grid-cols-2` / `sm:grid-cols-3` / `sm:grid-cols-2 md:grid-cols-4`, no `@container`, `gap-6`. `BillingPlanTable`: row names `border-e` (no `after:` hairline, no `align-top`), the head `sticky top-0 z-20 shadow-xs`, the corner `z-30`, plan columns `w-32`, `min-w-140`, `md:overflow-visible`, tints `bg-muted/30`, the group label `start-2`. `BillingPlanCard`: `text-2xl`, `min-h-9`, `gap-x-2`, flex centring. Confirm chevron: flex centring. Notice: `bg-muted/30` | plan columns `w-32` and the corner `z-30`, beyond the plan | without the fixed table layout, the current plan's column took twice the width (its pill); the head cells, now sticky at every width, covered the corner on a phone | [D5](plans/decisions.md) | this commit |
| #2  | L-2        | Tests that pin the classes                 | `BillingPlanComparison.test.tsx` (`sm:grid-cols-2`, `md:grid-cols-4`), `BillingPlanTable.test.tsx` (`sticky`, `top-0`, `md:overflow-visible`)                                                                                                                                                                                                                                                                                                                                                            | —                                                          | —                                                                                                                                                                   | —                        | this commit |
| #3  | L-3        | Verify at 1440, 820 and 375                | The built `index-*.css`: no rule added or removed against `main`'s (35,934 B gzipped either side); `pnpm size` Initial CSS 35.99 kB of 36. In the running app: four plans in one row at 1440 and 820, the head pinned, even plan columns; at 375 the plans stack and the table scrolls with the row names and the corner held                                                                                                                                                                            | on a phone the row names' line scrolls on with the plans   | a collapsed table's border belongs to the table                                                                                                                     | [D5](plans/decisions.md) | —           |
| #4  | L-4        | Close; CI green                            | This file; Status `done`, then `frozen` with the commit; "Build verify" re-runs on the push                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                          | —                                                                                                                                                                   | [D6](plans/decisions.md) | this commit |

## Revisions to upcoming rows

None.

## Summary

- **Planned, not built:** —
- **Built, not planned:** plan columns `w-32` and the corner `z-30` (#1).
- **Follow-ups:** the 36 kB budget has ≈ 10 B of headroom on `main`; the next first-paint utility
  needs a declared, itemised raise or a removal.

## Standing deviations

Against the three iterations it corrects: the row of plans steps by the viewport (`sm`, `md`), not
by the picker's own width; on a phone the row names' line scrolls on with the plans; the plan
card's price figure is `text-2xl`.
