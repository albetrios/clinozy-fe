# A bill line carries an optional description — kickoff plan (frontend)

> **Status: approved on 2026-10-31** under the user's straight-through answer (FD9). Every decision
> is in [`plans/decisions.md`](plans/decisions.md). The contract — the column, the bodies, the
> keep/clear rule — is clinozy-be's same-named iteration: its
> `clinozy-be/iterations/feat-bill-line-description-2026-10-31-rjxx/plans/routes-final.md`
> (Route review final, 2026-10-31) and
> `clinozy-be/iterations/feat-bill-line-description-2026-10-31-rjxx/plans/frontend-route-map.md`
> §§ 1–2. This plan adds only the screens.

## 1. Header

| Field            | Value                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/feat-bill-line-description-2026-10-31-rjxx/` · **initial** (`feat`, Baseline none) |
| Intake           | `brief` — [`intake-files/BRIEF.md`](intake-files/BRIEF.md), byte-identical to clinozy-be's     |
| Date             | 2026-10-31                                                                                     |
| Branch           | `feat/bill-line-description`                                                                   |
| Sibling          | clinozy-be `feat-bill-line-description-2026-10-31-rjxx` (frozen) — `items[].description`       |

## 2. The contract, in one line

Every bill line (and medical sale line) reads `description: string | null` (≤ 280); the four bill
writes and `POST /app/medical-sales` take `items[].description` — trimmed, 1–280, `null` clears,
an empty string is a 400; on a change a kept line keeps its description when the field is omitted.

## 3. Surfaces

| Surface                 | Where                                                                                                          | Change                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| API types and contracts | `core/http/openapi-types.d.ts`, `shared/api/app/invoices-contracts.ts`, `medical/shared/medical-*contracts.ts` | `pnpm api:types`; `description` on the wire line, the record and the bodies |
| Bill drawer — each row  | `shared/components/InvoiceDrawer/` (`InvoiceItemsField`, `invoice-form`, `sale-form`)                          | NEW dashed "Description" line under every row (280); preloaded on edit      |
| Bill view and print     | `shared/components/PrintTemplate/InvoicePrint/` (the bill view renders it)                                     | the description under the line's name — muted, smaller, wrapping            |
| Medical sale            | `medical/sales/components/SaleDrawer/`                                                                         | the description under the medicine's name                                   |

```text
Bill drawer · Items                         Printed bill · Items
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│ LHR Axilla      1   ₹550  0%  18% …  │    │ LHR AXILLA            1  ₹550 …      │
│ ┆DESCRIPTION  10 sessions =10*550  ┆ │    │ 10 sessions =10*550   (muted, small) │
└──────────────────────────────────────┘    └──────────────────────────────────────┘
```

## 4. Ledger (ROUTE)

| #   | Row                                                                                   | Skill / check                |
| --- | ------------------------------------------------------------------------------------- | ---------------------------- |
| R1  | Regenerate the API types; `description` on the bill and preview lines, sale lines     | `pnpm api:types`, contracts  |
| R2  | Bodies: create / change / previews; a kept line always carries it, a new one when set | `invoices-api.test.ts`       |
| R3  | Bill drawer: the Description line per row (ItemsField's note line, tagged)            | `InvoiceDrawer.test.tsx`     |
| R4  | Print (and so the bill view) and the Sale drawer show it                              | `InvoicePrint`, `SaleDrawer` |
| R5  | New sale sends it per medicine                                                        | `invoice-form.test.ts`       |
| R6  | Locales (11), test-id inventory, gates                                                | `pnpm health`                |

## 5. Acceptance

[`plans/acceptance.md`](plans/acceptance.md) — BRIEF A-7 and the frontend checks.
