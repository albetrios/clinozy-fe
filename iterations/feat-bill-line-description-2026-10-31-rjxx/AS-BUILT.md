# feat-bill-line-description-2026-10-31-rjxx — as built (frontend)

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built 2026-10-31 on `feat/bill-line-description`, in one commit
(`feat(billing): a bill line shows and edits its description`). Baseline: `none`. The rows ran
straight through under the user's standing answer (FD1, FD9); each is reviewed at Close.

## Rows

| #   | Ledger row                | Actually built                                                                                                                                                                                                                                                                                         | Difference | Decision      | Reviewed |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------- | -------- |
| R1  | API types, contracts      | `pnpm api:types` from clinozy-be's `docs/openapi/openapi.json` (17 `description` fields, nothing else moved); `description` on `invoiceLineFieldsWire` → `InvoiceLine` (bill and preview lines) and on the sale line wire → `SaleLine`                                                                 | none       | FD8           | at Close |
| R2  | Bodies                    | `InvoiceLineInput.description`; `lineBodyOf` sends a kept line's always (`null` clears) and a new line's only with text; `sameLine` counts it, so a description-only change sends the lines; the remark's trim helper now serves both (`textOrNull`)                                                   | none       | FD3           | at Close |
| R3  | Drawer row                | `ItemsRowNote` gains `tag`; `InvoiceItemsField` puts a "Description" note line (280, `INVOICE_LINE_DESCRIPTION_MAX`) under every row; `invoiceFormOf` preloads it; the live preview sends the saved description so typing never re-asks it; a view-only drawer shows the line only when a row has text | none       | FD2, FD4, FD7 | at Close |
| R4  | Print, bill view, sale    | `InvoicePrint` prints it under the line's name — muted, 2.9mm, not uppercased, wrapping (`invoice-print-line-description`); the bill view renders the same sheet; `SaleDrawer` shows it under the medicine                                                                                             | none       | FD5           | at Close |
| R5  | New sale                  | `SaleDraft`/`SaleInput` items carry it; `saleBodyOf` sends it trimmed when set; merged rows of one medicine send the first typed                                                                                                                                                                       | none       | FD6           | at Close |
| R6  | Locales, inventory, gates | `invoiceDrawer.items.description` / `descriptionPlaceholder` in all 11 locales (English first); the test-id inventory row; gates in § Summary                                                                                                                                                          | none       | —             | at Close |

## Revisions to upcoming rows

None.

## Summary

- **Built:** a per-line Description in the bill drawer (new bill, change, New sale), shown under
  the line's name on the bill view, the print and the Sale drawer; the API types and contracts
  carry `description` on every bill, preview and sale line.
- **Tests:** `invoices-api.test.ts` (create trims / omits blank, change replaces and clears, reads),
  `invoice-form.test.ts` (preload, clear, sale merge), `InvoiceDrawer.test.tsx` (edit preloaded,
  cleared on save), `InvoicePrint.test.tsx`, `SaleDrawer.test.tsx`, `medical-records-api.test.ts`,
  `ItemsField.test.tsx` (the tag); doubles gained `description: null`.
- **Gates:** `pnpm health` — all 15 phases pass (format, lint, Biome, docs lint, type check,
  unit tests, build, bundle size, env, public assets, TSDoc, knip, tokens and test ids, structure,
  agent-os); the touched suites: 105 files, 611 tests pass.

## Standing deviations

None. This iteration has no design input (Intake mode `brief`).
