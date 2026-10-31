# KICKOFF — feat-purchase-line-gst-2026-10-31-vcec

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Iteration     | `feat-purchase-line-gst-2026-10-31-vcec`                                                  |
| Mode          | initial — from scratch                                                                    |
| Baseline      | `none`                                                                                    |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                              |
| Intake hash   | `35ce19d3e29b` (gate passed 2026-10-31)                                                   |
| Schema-routes | — (brief from scratch)                                                                    |
| Sources       | `intake-files/BRIEF.md`; the current code; clinozy-be's `plans/routes-final.md`           |
| Date          | 2026-10-31                                                                                |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration`                               |
| Sibling       | clinozy-be `iterations/feat-purchase-line-gst-2026-10-31-vcec/` — the contract (PG1–PG18) |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — the drawer, the view, the summary screen.
2. **D2** — the contract is clinozy-be's route review.
3. **D3** — GST % per line, prefilled from the medicine; one inclusive switch per order (AMBER).
4. **D4** — the summary page under Purchases, `medicine:read`; CSV `medicine:export` (AMBER).
5. **D5** — approved.

## 3. Foundation

No token, shell, store or icon change.

## 4. Unit map

| Unit                                                           | Change                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/shared/api` medical contracts and generated OpenAPI types | the line's GST fields, the order's totals, the summary and its export |
| `…/medical/purchases/components/PurchaseOrderDrawer/`          | GST % per line, the inclusive switch, the taxable / GST totals        |
| `…/medical/purchases/components/PurchaseOrderView/`, the print | GST % per line, the totals                                            |
| `…/medical/purchases/gst-summary/` (new route)                 | month picker, by rate, by HSN, totals, CSV download                   |
| `src/locales/*/`                                               | the new copy                                                          |
| overviews                                                      | the purchases folder and the new page                                 |

## 5. State management map

No store. Server state: the order (as today), the month's summary (a query keyed by month), the export (a mutation-like download).

## 6. Build notes

- The line preview uses the invoice formula (inclusive: taxable = q × rate ÷ (1 + GST ÷ 100), rounded to the paisa; exclusive: GST on top), and the totals add the lines.
- The summary page: a month input (`YYYY-MM`, not after this month), two tables (by rate, by HSN — "No HSN" for a null code), a totals row, a "Download CSV" button saving the export's `content` under its `file_name`.

## 7. Verification

By Intake mode `brief`: `BRIEF.md:69` — unit tests for the drawer's GST fields and totals, the view's totals, the summary page (states: loading, empty month, data, the CSV button's gate); `pnpm health`.

## 8. The route — the ordered ledger

| #   | Work item                                                                          | Kind       | Depends on | Skill/driver           | Acceptance        | Assignee | Status  |
| --- | ---------------------------------------------------------------------------------- | ---------- | ---------- | ---------------------- | ----------------- | -------- | ------- |
| L-1 | Contracts: the line's GST, the totals, the summary (OpenAPI types from clinozy-be) | api        | BE         | fe-resource-crud       | types compile     | Claude   | planned |
| L-2 | Purchase-order drawer: GST % per line, inclusive switch, totals                    | structural | L-1        | fe-code-structure      | criterion A-8     | Claude   | planned |
| L-3 | Order view (and print): GST per line, totals                                       | structural | L-1        | fe-code-structure      | criterion A-8     | Claude   | planned |
| L-4 | GST summary page + CSV                                                             | structural | L-1        | fe-resource-crud       | criterion A-8     | Claude   | planned |
| L-5 | Copy in every locale, docs                                                         | copy       | L-2–L-4    | fe-i18n-constants      | `pnpm sync:check` | Claude   | planned |
| L-6 | Gates; close: `AS-BUILT.md`, `done`                                                | gate       | L-5        | fe-before-commit-guard | `pnpm health`     | Claude   | planned |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                      | In plan at |
| ---------------------- | ----------- | ---------- | --------------------------------------- | ---------- |
| `BRIEF.md`             | yes         | the change | the screens (`:29–31`), criterion `:69` | §2–§8      |
