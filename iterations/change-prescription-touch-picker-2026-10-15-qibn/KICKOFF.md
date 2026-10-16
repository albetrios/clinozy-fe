# KICKOFF — change-prescription-touch-picker-2026-10-15-qibn

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| Iteration     | `change-prescription-touch-picker-2026-10-15-qibn` |
| Mode          | initial — from scratch                             |
| Baseline      | `none` ([D2](plans/decisions.md))                  |
| Intake mode   | brief — `BRIEF.md` alone                           |
| Intake hash   | `530b0f4c5513` (gate passed 2026-10-15)            |
| Schema-routes | —                                                  |
| Sibling       | none                                               |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): scope (D1), the iteration (D2), where the size lives (D3),
the list (D4), approval (D5).

## 3. Build notes

`rx-medicine-cell.tsx`: the line's `PickerTrigger` gains `pointer-coarse:min-h-11` beside its `pe-2`.
A drawer test pins it; the overview's touch note follows.

## 4. Verification

| #   | Criterion                                          | Proven by                                                            |
| --- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 44px on touch, 32px with a mouse; this picker only | drawer test + screenshots 1024 and 390 with touch, 1440 with a mouse |
| 2   | Gates                                              | tests, lint, types, theme axis, SonarQube                            |

## 5. The route — the ordered ledger

| #   | Row                                                          | Kind       | Depends on | Skills                                            | Proves      | Assignee | Status |
| --- | ------------------------------------------------------------ | ---------- | ---------- | ------------------------------------------------- | ----------- | -------- | ------ |
| L-1 | The line's picker at 44px on touch + its test + the overview | structural | —          | fe-test-generation · fe-documentation-maintenance | §4 row 1    | Claude   | done   |
| L-2 | Verify in the running app; gates; close                      | structural | L-1        | fe-kickoff-iteration                              | §4 rows 1–2 | Claude   | done   |
