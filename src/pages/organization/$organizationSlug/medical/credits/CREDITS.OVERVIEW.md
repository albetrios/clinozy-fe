# `pages/organization/$organizationSlug/medical/credits` — Medical › Credits

Route: `/organization/$organizationSlug/medical/credits` (clinozy-be D90 — beyond the design, a
standing deviation of the launch iteration). Same gates as the Medical room. The store's credits in
one tab beside its Payments, in "More"'s Money group, with a segmented switch between two sides
(`?side=customers`; "From suppliers" is the default and stays out of the URL):

- **From suppliers** (`GET /app/supplier-credits`, MD34): every credit returned stock earned
  against a supplier's dues — Credit (the medicine over its batch) · Supplier · Packs · Amount ·
  Adjusted · State · Since, newest first. Filters: State (Open · Adjusted). No search — the API
  reads supplier credits by supplier and state only. A row opens its supplier (the drawer's Account
  lists the credit); Void (`medicine:delete`) asks why — "Added by mistake" · "Wrong quantity" ·
  "Supplier refused" · "Other" — puts the packs back and the supplier's dues up, and offers Undo
  for 10s (`DELETE`/`POST …/restore` under `/app/suppliers/:supplier_id/credits`). A credit is
  added by Return expiring stock on Medicines.
- **With customers** (`GET /app/medical-pending-credits`, MD32, MD33): the store's credits on its
  sales — a return kept as store credit, money owed either way — as the Payments room's Pending
  holds them: Who · Which way · Amount · Left · State · Since, newest first. Filters: Which way,
  State, Created, and the search (the person or a `CR-` number). A row opens it in Payments ›
  Pending (`/payments/pending/$creditId/edit` — Edit, Use on next bill); Give back
  (`payment:create` + `payment:delete`) and Got it back (`payment:create`) settle an open one here
  through the shared Settle drawer; Add credit, under the empty state, opens Pending's.

Each side's footer counts its credits ("2 credits") — one read of a single row for the side's
filters: the `supplierCredits` summary on suppliers, `fetchStoreCreditCount` on customers.

## Files

| File                                    | Responsibility                                                     |
| --------------------------------------- | ------------------------------------------------------------------ |
| `credits.route.tsx`                     | Route marker — exports `Component` rendering `MedicalCreditsPage`. |
| `credits.manifest.ts`                   | Manifest — `kind: 'leaf'`, module `app-medical`.                   |
| `MedicalCreditsPage.tsx`                | The tab: the side switch, each side's toolbar, table and actions.  |
| `hooks/useSupplierCreditColumns/`       | "From suppliers" columns and the state tones.                      |
| `hooks/useCustomerCreditColumns/`       | "With customers" columns.                                          |
| `components/SupplierCreditVoidConfirm/` | Void a supplier credit with its reason, and its Undo.              |

## Test ids

`medical-credits-page`; `medical-credits-side`, `medical-credits-side-suppliers`,
`medical-credits-side-customers`; the shared toolbar and table ids prefixed `medical-credits`
(`medical-credits-row-action-void`, `medical-credits-row-action-settle`).
