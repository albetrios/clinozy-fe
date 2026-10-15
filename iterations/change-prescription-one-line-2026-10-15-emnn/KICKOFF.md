# KICKOFF — change-prescription-one-line-2026-10-15-emnn

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| Iteration     | `change-prescription-one-line-2026-10-15-emnn` |
| Mode          | initial — from scratch                         |
| Baseline      | `none` ([D2](plans/decisions.md))              |
| Intake mode   | brief — `BRIEF.md` alone                       |
| Intake hash   | `a34b62d812a9` (gate passed 2026-10-15)        |
| Schema-routes | —                                              |
| Sibling       | none                                           |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): scope (D1), the iteration (D2), the Meal · Where column
(D3), More (D4), ×2 (D5), the note (D6), separation (D7), the medicine column (D8), the fold (D9),
approval (D10).

## 3. Build notes

- `rx-item-cells.tsx`: `RxDoseCell` without ×2; `RxDirectionsCell` (the two usual picks and More,
  its label from what is set inside); `RxMorePanel` (a popover: Meal or When, Where, ×2, the note);
  `RxNoteLine`; `RxLineRail` holds Days and Meal · Where when folded.
- `rx-medicines-field.tsx`: the columns Medicine · Dose · Days · Meal · Where · Qty, the fold, no
  `note` on the table — the note line is the row's detail.
- `rx-medicine-cell.tsx`: the line's number before its picker.
- `ItemsField.tsx`: `noteBesideDetail` removed with its tests.
- Copy: "More for this medicine" and "Note" in 11 locales.

## 4. Verification

| #   | Criterion                                            | Proven by                                                              |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | A tablet is one line                                 | screenshot 1440 and 1280 beside the Rx check                           |
| 2   | More: the rarer choices, shown on the line once made | drawer tests + screenshots                                             |
| 3   | The note line only when there is one                 | drawer test + screenshot                                               |
| 4   | The medicine picker's width                          | screenshot 1440                                                        |
| 5   | Keyboard, touch, the gates                           | drawer tests; screens 1024 and 390 with touch; health, sync, SonarQube |

## 5. The route — the ordered ledger

| #   | Row                                                            | Kind       | Depends on | Skills                                          | Proves          | Assignee | Status                       |
| --- | -------------------------------------------------------------- | ---------- | ---------- | ----------------------------------------------- | --------------- | -------- | ---------------------------- |
| L-1 | The cells: Dose, Meal · Where, More, the note line, the number | structural | —          | frontend-design · shadcn · composition-patterns | §4 rows 1–4     | Claude   | done                         |
| L-2 | The columns and the fold; `noteBesideDetail` removed           | structural | L-1        | fe-code-structure                               | §4 rows 1, 4    | Claude   | done · revised → AS-BUILT #2 |
| L-3 | Copy in 11 locales; tests; docs                                | structural | L-2        | fe-i18n-constants · fe-test-generation          | §4 rows 2, 3, 5 | Claude   | done                         |
| L-4 | Verify in the running app; walkthrough; gates; close           | structural | L-3        | fe-kickoff-iteration                            | §4 rows 1–5     | Claude   | done                         |
