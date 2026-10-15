# KICKOFF — change-prescription-compact-line-2026-10-15-wfqh

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| Iteration     | `change-prescription-compact-line-2026-10-15-wfqh` |
| Mode          | initial — from scratch                             |
| Baseline      | `none` ([D2](plans/decisions.md))                  |
| Intake mode   | brief — `BRIEF.md` alone                           |
| Intake hash   | `d04e22b0c856` (gate passed 2026-10-15)            |
| Schema-routes | —                                                  |
| Sibling       | none                                               |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): scope (D1), the iteration (D2), the tray (D3), the dose
(D4), the courses (D5), where Days sits (D6), the note (D7), the copy (D8), touch (D9), approval
(D10).

## 3. Build notes

- **Widths with a mouse** — segment 24px high, a digit 24px wide; Dose ≈ 156px (three taps, a
  hairline, ×2, SOS); Days ≈ 216px (six segments and the Other box); Qty 92px; × 30px; gaps 32px;
  the table's padding 20px. With a medicine of at least 200px, Days fits as a column from a 760px
  table — 1024, 1280 beside the Rx check and 1440 hold it; 768 and 820 fold it.
- **On touch** the segments are 44 × 40px; Days fits as a column from a 1000px table.
- `rx-form.ts`: `RX_DAY_CHIPS` = 3 · 5 · 7 · 10 · 14 · 30.
- `ItemsField.tsx`: `noteBesideDetail` (D7).
- `rx-item-cells.tsx`: the tray (`Segment`, the group restyled), `RxDoseCell` (taps · ×2 · SOS),
  `RxDaysCell` (a line cell, the same tray as the rail's), `RxLineRail` (Days when folded · Meal or
  When · Where), `RxAllDays` slim.
- `rx-medicines-field.tsx`: the fold (D6), the tracks per pointer (D9), the rail beside the note.
- Copy: `rx.items.dose` "Dose · M A N", `rx.items.meal` "Meal", `rx.meal.before` "Before",
  `rx.meal.after` "After" — from `b94604d`, 11 locales.

## 4. Verification

| #   | Criterion                                      | Proven by                                       |
| --- | ---------------------------------------------- | ----------------------------------------------- |
| 1   | `1 0 1` taps, ×2, SOS                          | drawer tests + screenshots                      |
| 2   | 24px with a mouse, 44px on touch               | screenshots 1440, 1024 touch, 390 touch         |
| 3   | Days a column with room, else on line 2        | screenshots 1440 / 1280 and 1024 touch / 390    |
| 4   | A tablet line is two lines                     | screenshot 1440                                 |
| 5   | Keyboard: one Tab stop per tray, arrows inside | drawer tests                                    |
| 6   | Gates                                          | tests, lint, types, theme axis, sync, SonarQube |

## 5. The route — the ordered ledger

| #   | Row                                          | Kind       | Depends on | Skills                                    | Proves       | Assignee | Status                       |
| --- | -------------------------------------------- | ---------- | ---------- | ----------------------------------------- | ------------ | -------- | ---------------------------- |
| L-1 | `RX_DAY_CHIPS` and its units                 | global     | —          | fe-test-generation                        | §4 row 1     | Claude   | done                         |
| L-2 | `ItemsField` `noteBesideDetail` + its test   | global     | —          | composition-patterns · fe-test-generation | §4 row 4     | Claude   | done                         |
| L-3 | The tray, the cells, the fold and the tracks | structural | L-1, L-2   | frontend-design · ui-ux-pro-max · shadcn  | §4 rows 1–5  | Claude   | done · revised → AS-BUILT #3 |
| L-4 | Copy in 11 locales; tests; docs              | structural | L-3        | fe-i18n · fe-test-generation              | §4 rows 1, 5 | Claude   | done                         |
| L-5 | Verify in the running app; gates; close      | structural | L-4        | fe-kickoff-iteration                      | §4 rows 1–6  | Claude   | done                         |
