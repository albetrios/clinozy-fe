# change-prescription-touch-picker-2026-10-15-qibn — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built 2026-10-15 on `feat/prescription-composer`, in the commit
`feat(prescriptions): the medicine picker is 44px on touch`.

## Rows

| #   | Ledger row | Planned                                                      | Actually built                                                                                                                                                                                                                                                                                                                 | Difference |
| --- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| #1  | L-1        | The line's picker at 44px on touch + its test + the overview | `rx-medicine-cell.tsx`: the line's `PickerTrigger` carries `pointer-coarse:min-h-11` beside its `pe-2`; the shared picker and every other caller are unchanged. A drawer test pins `min-h-8` (mouse) and `pointer-coarse:min-h-11` (touch) on `rx-items-medicine`; `PRESCRIPTIONS.OVERVIEW.md` says so                         | As planned |
| #2  | L-2        | Verify in the running app; gates; close                      | Measured in the running app: on touch the picker, the dose segments and the stepper's box are 44px (1024 and 390); with a mouse the picker stays 32px (1440). Three stills. Type-check, ESLint, theme axis, `pnpm sync:check` and the prescriptions, `ItemsField` and `Picker` suites (328 tests) pass; the push runs the rest | As planned |

## Revisions to upcoming rows

None — L-2 was the last row.

## Summary

- **Planned, not built:** — every ledger row is done.
- **Planned, not kept:** —
- **Built, not planned:** —
- **Follow-ups for the next iteration:** none from this brief.

## Standing deviations

| Item                            | Design (`BRIEF.md`) says                                             | Built as                                                                                   | Since iteration                                    | Decision |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------- |
| A tablet line on a narrow table | (from `change-prescription-compact-line`) "a tablet takes two lines" | Two lines wherever Days is a column (760px with a mouse, 1000px on touch); narrower, three | `change-prescription-compact-line-2026-10-15-wfqh` | Its D6   |
