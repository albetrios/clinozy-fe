# KICKOFF — change-prescription-touch-quantity-2026-10-15-eovi

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                |
| ------------- | ---------------------------------------------------- |
| Iteration     | `change-prescription-touch-quantity-2026-10-15-eovi` |
| Mode          | initial — from scratch                               |
| Baseline      | `none` ([D2](plans/decisions.md))                    |
| Intake mode   | brief — `BRIEF.md` alone                             |
| Intake hash   | `b58502b33ad0` (gate passed 2026-10-15)              |
| Schema-routes | —                                                    |
| Sibling       | none                                                 |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): scope (D1), the iteration (D2), the opt-in (D3), the
column (D4), approval (D5).

## 3. Build notes

`src/shared/forms/ItemsField/items-field-cells.tsx`: `ItemsQtyCell` gains `largeOnTouch` — on a
coarse pointer the box is 44px high, its buttons 44px wide, its icons 16px. `rx-medicines-field.tsx`
sets it and widens Qty to 120px.

## 4. Verification

| #   | Criterion                                     | Proven by                                 |
| --- | --------------------------------------------- | ----------------------------------------- |
| 1   | 44px on touch, 32px with a mouse; opt-in only | `ItemsField` cell test + screenshots      |
| 2   | Gates                                         | tests, lint, types, theme axis, SonarQube |

## 5. The route — the ordered ledger

| #   | Row                                                  | Kind       | Depends on | Skills                                    | Proves      | Assignee | Status                       |
| --- | ---------------------------------------------------- | ---------- | ---------- | ----------------------------------------- | ----------- | -------- | ---------------------------- |
| L-1 | `ItemsQtyCell` `largeOnTouch` + its test             | global     | —          | composition-patterns · fe-test-generation | §4 row 1    | Claude   | done                         |
| L-2 | The Rx line sets it; Qty 120px; verify; gates; close | structural | L-1        | ui-ux-pro-max · fe-kickoff-iteration      | §4 rows 1–2 | Claude   | done · revised → AS-BUILT #2 |
