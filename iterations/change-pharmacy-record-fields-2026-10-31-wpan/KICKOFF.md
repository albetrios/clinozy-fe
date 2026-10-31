# KICKOFF — change-pharmacy-record-fields-2026-10-31-wpan

The plan for the frontend half of the change: every screen that edits or reads the new pharmacy
fields, and the loose-unit selling the brief adds. The contract (tables, routes, rules) is
clinozy-be's — [its `KICKOFF.md`](https://github.com/albetrios/clinozy-be/blob/main/iterations/change-pharmacy-record-fields-2026-10-31-wpan/KICKOFF.md)
and [`plans/`](https://github.com/albetrios/clinozy-be/tree/main/iterations/change-pharmacy-record-fields-2026-10-31-wpan/plans),
merged in albetrios/clinozy-be#182.

## 1. Header

| Field             | Value                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Iteration         | `change-pharmacy-record-fields-2026-10-31-wpan`                                                |
| Mode              | initial — from scratch                                                                         |
| Baseline          | `none`                                                                                         |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot                                                   |
| Intake hash       | `b96b02cab069` (gate passed 2026-10-31)                                                        |
| Schema-routes     | — (clinozy-be owns the contract; no new route, nine new fields)                                |
| Sources           | `intake-files/BRIEF.md`; clinozy-be's merged contract; the current code                        |
| Date              | 2026-10-31                                                                                     |
| Evidence notation | `BRIEF.md` › section in `intake-files/`, `src/…` in the code, D/F rows in `plans/decisions.md` |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)           |
| Sibling           | clinozy-be `change-pharmacy-record-fields-2026-10-31-wpan` (`--both`), merged first            |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md); D1–D12 are clinozy-be's, shared
under the same numbers.

1. **D1** — Loose selling is in: `units_per_pack`, stock counted in units.
2. **D2** — A sale line charges the MRP of the batch it draws, else the medicine's.
3. **D3** — A bill line snapshots `hsn_code` (and `pack_size`) when billed.
4. **D4** — Straight through: planned, approved and built on the user's instruction, stopping only
   on a scope change or a red gate.
5. **D5** — Stock numbers count units; supplier-side numbers (order lines, rates, MRP) count packs.
6. **D6** — A unit's price rounds down to the paisa — never above the printed MRP.
7. **D7** — `units_per_pack` is locked while the medicine holds stock (409 `medicine_has_stock`).
8. **D8** — The batch MRP comes from the order line on receive.
9. **D10** — A received order still takes a change of its note alone.
10. **F1–F8** — the frontend's own: answer types (F1), one shared units hook (F2), the New sale unit
    price (F3), the locked field (F4), the receive prefill (F5), reorder in packs (F6), the return
    credit per unit (F7), approval (F8).

## 3. Foundation (before any screen)

### 3.1 Theme

No token added. Every new sub-line (pack + HSN, pack equivalent, unit price) is the existing
`text-caption text-muted-foreground` caption the Medical room's cells already use.

### 3.2 Shell

n/a.

### 3.3 Stores

None — the new fields are server state (TanStack Query) and form state (react-hook-form).

### 3.4 Icons

None added.

### 3.5 Contracts and copy

- `src/shared/api/app/medicines-contracts.ts`, `invoices-contracts.ts`, the Medical room's
  `medical-contracts.ts` / `medical-records-contracts.ts`: the new wire fields, parsed strictly (F1).
- `src/shared/api/app/medicine-stock.ts`: `packsAndLoose`, `reorderPacks`, `unitRatePaise`;
  `medicines-contracts.ts` › `saleUnitPaise`.
- `src/shared/hooks/useMedicineUnits/`: the words for units — "3 packs + 4", "= 1 pack + 2",
  "₹12.55 a unit", "1*10 · HSN 3004" (F2); copy in `app` › `medicineUnits`, 11 locales.

## 4. Route / island map

No route added or moved. Units changed (paths under `src/pages/organization/$organizationSlug/medical/`):

| Unit                                                                    | Kind   | Change                                                        |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| `shared/components/MedicineDrawer/` (drawer, stock panel, items fields) | drawer | HSN, Pack, Units per pack; batch MRP; levels as packs + loose |
| `medicines/hooks/useMedicineColumns/`                                   | table  | stock in packs + loose; HSN and pack in the row's details     |
| `medicines/components/ExpiringReturnDrawer/`                            | drawer | the credit preview per unit                                   |
| `shared/components/SupplierDrawer/`                                     | drawer | Email, Address                                                |
| `purchases/components/PurchaseOrderDrawer/`                             | drawer | the order Note; each line's MRP; reorder in whole packs       |
| `purchases/components/ReceiveGoodsDrawer/`                              | drawer | each line's MRP (prefilled); the Note                         |
| `purchases/components/PurchaseOrderView/`                               | view   | the Note (saved alone on a received order); the MRP column    |
| `sales/components/SaleDrawer/`                                          | view   | pack and HSN under each line; a loose line's pack equivalent  |
| `src/shared/components/InvoiceDrawer/`                                  | drawer | New sale: unit price, stock as packs + loose, pack equivalent |
| `src/shared/components/PrintTemplate/InvoicePrint/`                     | print  | an HSN column on a pharmacy bill                              |
| `src/locales/*/{app,medical,print}.json`                                | copy   | new keys in 11 locales                                        |

## 5. State management map

| Surface          | Server state                                        | Client state | URL state | Form state               |
| ---------------- | --------------------------------------------------- | ------------ | --------- | ------------------------ |
| Medicine drawer  | `useMedicine`, create / update medicine             | —            | as before | `medicine-form.ts`       |
| Supplier drawer  | `useSupplier`, create / update supplier             | —            | as before | the drawer's form        |
| Purchase order   | create / update order; `useUpdatePurchaseOrderNote` | —            | as before | `purchase-order-form.ts` |
| Receive goods    | receive order                                       | —            | as before | `receive-form.ts`        |
| New sale         | the medicines catalogue                             | —            | as before | `invoice-form.ts`        |
| Sale view, print | `useSale`, the invoice                              | —            | as before | —                        |

## 6. Per-screen build notes

### 6.1 Medicine drawer and Medicines tab — `fe-http-forms-errors`, `fe-e2e-testids`

```text
HSN code [30049099]   Pack [1*10]   Units per pack [10]  (locked: "Sell or return its stock first")
Stock 63 = 6 packs + 3 · Reorder at 20 (2 packs) · Fill up to 100 (10 packs)
Batch  026-312 · 12/27 · Qty 60 · Rate ₹90 · MRP ₹125.55
```

### 6.2 Supplier drawer — `fe-http-forms-errors`

Email (a valid address, up to 120) and Address (up to 240), each clearable.

### 6.3 Purchases — `fe-resource-crud`

Order drawer: a Note (up to 500) and an MRP cell per line. Receive goods: each line's MRP prefilled
(F5) and the Note. Order view: the Note, saved alone ("Save note") once the order is received (D10),
and an MRP column.

### 6.4 Selling — `fe-code-structure`

New sale lists a loose medicine at its unit price ("₹12.55 a unit", F3) with stock as packs + loose;
the quantity counts units and shows "= 1 pack + 3" under it. The sale view names "1*10 · HSN 3004"
under each line; the printed pharmacy bill gains an HSN column after Pack Size.

## 7. Deviations

### 7.1 Brief over the code

Stock and its levels read in units where a medicine sells loose; a medicine with `units_per_pack` 1
(all today's) reads exactly as before.

### 7.2 Project rules over the brief

- The response fields are added to the documented answer types by hand until clinozy-be's OpenAPI
  response map lists them (F1).
- The New sale price is a guide; the server prices the saved line from the batch it draws (F3).

### 7.3 Standing deviations touched

None — from scratch.

## 8. Verification

By Intake mode `brief`: every `BRIEF.md` acceptance criterion the frontend owns, proved by the
colocated unit and component tests (contracts, helpers, drawers, views, print); then `pnpm sync:check`,
the before-commit guard on every commit and the pre-push hook (build, the full suite, SonarQube),
and PR CI.

## 9. The route — the ordered ledger

| #    | Work item                                                                       | Kind       | Depends on | Skill/driver                          | Acceptance                            | Assignee | Status              |
| ---- | ------------------------------------------------------------------------------- | ---------- | ---------- | ------------------------------------- | ------------------------------------- | -------- | ------------------- |
| L-1  | Contracts, helpers, the units hook, copy in 11 locales                          | foundation | —          | fe-code-structure · fe-i18n-constants | contract + helper tests; i18n parity  | Claude   | done → AS-BUILT #1  |
| L-2  | Supplier drawer: Email, Address                                                 | structural | L-1        | fe-http-forms-errors                  | drawer tests                          | Claude   | done → AS-BUILT #2  |
| L-3  | Medicine drawer: HSN, Pack, Units per pack (locked while stocked), batch MRP    | structural | L-1        | fe-http-forms-errors · fe-e2e-testids | form + drawer tests                   | Claude   | done → AS-BUILT #3  |
| L-4  | Medicines tab: stock as packs + loose; HSN and pack in the details              | styling    | L-1        | fe-code-structure                     | columns read through the units hook   | Claude   | done → AS-BUILT #4  |
| L-5  | Purchase order drawer: Note, line MRP, reorder in whole packs                   | structural | L-1        | fe-resource-crud                      | form + drawer tests                   | Claude   | done → AS-BUILT #5  |
| L-6  | Receive goods: line MRP prefilled, Note                                         | structural | L-5        | fe-resource-crud                      | drawer tests                          | Claude   | done → AS-BUILT #6  |
| L-7  | Purchase order view: Note (alone on a received order), MRP column               | structural | L-5        | fe-resource-crud                      | view reads them                       | Claude   | done → AS-BUILT #7  |
| L-8  | New sale: unit price, stock as packs + loose, pack equivalent                   | structural | L-1        | fe-code-structure                     | invoice-lines tests                   | Claude   | done → AS-BUILT #8  |
| L-9  | Sale view and printed bill: pack and HSN; the HSN column                        | structural | L-1        | fe-code-structure                     | sale drawer + print tests             | Claude   | done → AS-BUILT #9  |
| L-10 | Return expiring stock: the credit preview per unit                              | structural | L-1        | fe-code-structure                     | drawer test (60 units, ₹12.56 a unit) | Claude   | done → AS-BUILT #10 |
| L-11 | Gates: sync:check, before-commit guard, pre-push (build, full suite, SonarQube) | gate       | L-2–L-10   | fe-before-commit-guard                | green                                 | Claude   | done → AS-BUILT #11 |
| L-12 | Close: `AS-BUILT.md`, Status `done`, then `frozen`                              | verify     | L-11       | fe-kickoff-iteration                  | README Status `frozen`                | Claude   | done → AS-BUILT #12 |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                                   | In plan at     |
| ---------------------- | ----------- | ---------- | -------------------------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | eleven screens, nine fields, the unit and MRP rules, eleven criteria | §2, §4, §6, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact                      | Brief says                            | Code before says                     | Winner | Action   |
| --- | ------------------------- | ------------------------------------- | ------------------------------------ | ------ | -------- |
| R1  | what stock counts         | units; packs + loose when loose       | packs everywhere                     | brief  | L-1, L-4 |
| R2  | a sale line's price       | the drawn batch's MRP, per unit       | the medicine's MRP                   | brief  | L-8      |
| R3  | the order's note          | written on create, change and receive | no note                              | brief  | L-5–L-7  |
| R4  | a bill line's HSN         | snapshotted and shown                 | no HSN; pack size read from the name | brief  | L-9      |
| R5  | a supplier credit's price | per unit                              | units × pack rate in the preview     | brief  | L-10     |
