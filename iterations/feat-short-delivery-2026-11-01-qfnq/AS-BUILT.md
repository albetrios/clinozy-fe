# feat-short-delivery-2026-11-01-qfnq — as built

Baseline: none · KICKOFF.md approved 2026-11-01 ([D5](plans/decisions.md)) · branch `feat/short-delivery` · against clinozy-be `main` after #189 (feat-short-delivery)

## Rows

| #   | Planned                       | Actually built                                                                                                                                                                                                                                                                                                                                        | Difference                                                             | Why                                                      | Decision | Reviewed              |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | -------- | --------------------- |
| L-1 | Contracts and types           | `openapi-types.d.ts` regenerated; the order wire's lines gain `received_quantity`, `received_free_quantity`, `is_short` and the order `short_line_count` (row: `receivedQty`, `receivedFree`, `short`, `shortCount`); the receive body sends `received_quantity` / `received_free_quantity` for an arrived ordered line                               | —                                                                      | —                                                        | D2       | straight through (D5) |
| L-2 | Receive goods: received cells | an ordered line's Qty and Free cells take what came (prefilled with the order, 0…ordered); "Ordered 10 + 2 free" under the medicine; more than ordered stops the save ("add the extra as an unexpected item"); the total bills what came (`receiveTotal`, the line's amount × came ÷ ordered); `isShortLine`, `overOrderedLines` in `receive-form.ts` | the existing Qty / Free cells take the counts instead of two new cells | one count per column on phone and desktop; no wider grid | D3       | straight through      |
| L-3 | Order view: short lines       | a short line reads "Short · 8 of 10" (warning) under its medicine; "Lines that came short: N" above the GST totals                                                                                                                                                                                                                                    | the count's wording                                                    | reads in every locale with a plural-free count           | D4       | straight through      |
| L-4 | Copy, docs, gates, close      | the copy in all 11 locales; `PURCHASES.OVERVIEW.md`; `pnpm type-check`, `pnpm lint`, `pnpm sync:check`, the medical unit suites (new: the short-line form test, the view's short marks 2/2); `pnpm health` before push                                                                                                                                | —                                                                      | —                                                        | —        | straight through      |

## Summary

- Planned, not built: none.
- Built, not planned: none.
- Follow-ups for the next iteration: none.

## Standing deviations

| Item           | Design says                             | Built as                                | Since iteration                     | Decision |
| -------------- | --------------------------------------- | --------------------------------------- | ----------------------------------- | -------- |
| Received cells | two new cells "Came" / "Free came" (D3) | the Qty / Free cells of an ordered line | feat-short-delivery-2026-11-01-qfnq | D3       |
