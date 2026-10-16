# KICKOFF — fix-billing-css-budget-2026-10-15-lutj

> The plan and the ordered ledger for a small `fix` iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Iteration     | `fix-billing-css-budget-2026-10-15-lutj`                                                |
| Mode          | initial — from scratch                                                                  |
| Baseline      | `none` ([D2](plans/decisions.md))                                                       |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                            |
| Intake hash   | `8e405ed6d600` (gate passed 2026-10-15)                                                 |
| Schema-routes | — (no entity or route changes)                                                          |
| Sources       | `intake-files/BRIEF.md`; CI "Build verify" on albetrios/clinozy-fe#84; the code         |
| Date          | 2026-10-15                                                                              |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` and `fe-bundle-performance` |
| Sibling       | none                                                                                    |

## 2. Locked decisions

1. **D1** — Get albetrios/clinozy-fe#84 green and merge it.
2. **D2** — A `fix` iteration: the three it corrects are frozen.
3. **D3** — Reuse the stylesheet's utilities; the 36 kB budget stays.
4. **D4** — Viewport steps (`sm`, `md`) for the row of plans.
5. **D5** — `border-e` for the row-name line; `sticky top-0 z-20 shadow-xs` for the head.
6. **D6** — Approved on the user's instruction.

## 3. Foundation

No token, shell, store or icon change.

## 4. Route / island map

No route change.

| Unit                                                                                    | Kind       | Change                                              |
| --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| `…/BillingPlanComparison/BillingPlanComparison.tsx`                                     | unit file  | viewport grid steps; no container                   |
| `…/BillingPlanComparison/BillingPlanTable.tsx`                                          | unit file  | `border-e`, the sticky head, `min-w-140`, the tints |
| `…/BillingPlanComparison/BillingPlanCard.tsx`                                           | unit file  | `text-2xl`, `min-h-9`, `gap-x-2`, flex centring     |
| `…/BillingPlanComparison/BillingPlanChangeConfirm.tsx`, `BillingSubscriptionNotice.tsx` | unit files | flex centring; `bg-muted/30`                        |

## 5. Verification

The built first-paint stylesheet diffed rule by rule against `main`'s; the colocated tests; the
picker at 1440, 820 and 375; CI "Build verify" on the PR.

## 6. The route — the ordered ledger

| #   | Work item                                   | Kind    | Depends on | Skill/driver           | Acceptance                 | Assignee | Status             |
| --- | ------------------------------------------- | ------- | ---------- | ---------------------- | -------------------------- | -------- | ------------------ |
| L-1 | Swap the 25 new utilities for shipped ones  | styling | —          | fe-bundle-performance  | no new rule against `main` | Claude   | done → AS-BUILT #1 |
| L-2 | Tests that pin the classes                  | verify  | L-1        | fe-test-generation     | suites pass                | Claude   | done → AS-BUILT #2 |
| L-3 | Verify at 1440, 820 and 375                 | verify  | L-2        | fe-kickoff-iteration   | §5                         | Claude   | done → AS-BUILT #3 |
| L-4 | Close: AS-BUILT, `done`, `frozen`; CI green | gate    | L-3        | fe-before-commit-guard | "Build verify" passes      | Claude   | done → AS-BUILT #4 |
