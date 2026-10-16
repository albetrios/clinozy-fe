# change-prescription-touch-quantity-2026-10-15-eovi — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built 2026-10-15 on `feat/prescription-composer`, in the commit
`feat(prescriptions): the compact medicine line, and a 44px quantity stepper on touch`.

## Rows

| #   | Ledger row | Planned                                              | Actually built                                                                                                                                                                                                                                                                                           | Difference                                                                                                                               |
| --- | ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | L-1        | `ItemsQtyCell` `largeOnTouch` + its test             | `items-field-cells.tsx`: `largeOnTouch` — on a coarse pointer the box is 44px high (`pointer-coarse:h-11`), its buttons 44px wide, its marks 16px; the classes picked once per cell (`STEPPER_TOUCH` / `STEPPER_NO_TOUCH`). A test: the classes are there only when the row asks. Other tables unchanged | As planned                                                                                                                               |
| #2  | L-2        | The Rx line sets it; Qty 120px; verify; gates; close | `rx-medicines-field.tsx` sets `largeOnTouch`; its Qty track is `var(--rx-qty-track)` — 92px with a mouse, 120px on touch (`RX_QTY_TRACK_CLASS` on the table). Screens at 1024 with touch and 1440 with a mouse; the `ItemsField` and prescriptions suites (206 tests) pass                               | The track follows the pointer instead of 120px at every width ([D6](plans/decisions.md)); the gates run with the next iteration's commit |

## Revisions to upcoming rows

None — L-2 was the last row.

## Summary

- **Planned, not built:** — every ledger row is done.
- **Planned, not kept:** a 120px Qty track at every width (D4 → D6).
- **Built, not planned:** —
- **Follow-ups for the next iteration:** the user asked mid-build for a compact line — the `1 0 1` dose
  taps and SOS back, smaller controls, tidier columns: `change-prescription-compact-line`.

## Standing deviations

| Item                         | Design (`BRIEF.md`) says            | Built as                                                       | Since iteration                               | Decision                           |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| The medicine picker on touch | The line's controls are finger-size | The stepper is 44px now; the shared medicine picker keeps 32px | `change-prescription-writing-2026-10-15-wmdt` | Its D13; out of scope (`BRIEF.md`) |
