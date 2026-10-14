# `pages/organization/$organizationSlug/medical/medicines` — Medical › Medicines

Route: `/organization/$organizationSlug/medical/medicines` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every medicine on clinozy-be (`GET /app/medicines`, api-integration §5.5; `medical.md:41–55`): ID · Medicine (its composition, or "Needs MRP and composition" while the server flags it) · Manufacturer · Stock (the line and a bar to the fill-up level) · Nearest expiry (≤ 30 days blush, ≤ 90 butter) · MRP (and the near-expiry discount) · Best rate (hidden) · Margin — money in the API's rupees; the stock level, nearest expiry, best rate and margin are the server's. The row edge is the stock level. Filters: Stock (All · Low stock) · Nearest expiry · the automatic Manufacturer section · Created; every column but Nearest expiry and Best rate sorts on the server. The view action is "Reorder low stock" with Low stock on (a new purchase order with `?reorder=low`) and "Sell all at 20% off" / "Remove near-expiry discount" with a Nearest expiry window — one write over every medicine in the window (`POST /app/medicines/near-expiry-discount`), its Undo the opposite write; a batch expiring within 90 days adds "Return expiring stock to supplier" (its drawer, no URL — a supplier credit, `POST /app/suppliers/:supplier_id/credits`, which the server sets against the supplier's dues) and the row's discount toggle, its Undo putting the old percent back. A row opens Edit medicine.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New medicine) · `$medicineId/edit/` (Edit medicine) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24): the Medicine drawer (`../shared/components/MedicineDrawer/`), New with `?name=` or Edit, with any manufacturer or supplier stacked on it; Delete asks for a reason (`../shared/components/MedicalDeleteConfirm/`).

## Files

| File                               | Responsibility                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `medicines.route.tsx`              | Route marker — exports `Component` rendering `MedicinesPage`.                                           |
| `medicines.manifest.ts`            | Manifest — `kind: 'layout'` over its dialog routes, module `app-medical`.                               |
| `medicines.params.ts`              | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `MedicinesPage.tsx`                | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useMedicineColumns/`        | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |
| `components/ExpiringReturnDrawer/` | Return expiring stock: the supplier (cheapest first), the quantity (capped at the batch), the credit.   |

Tests mock `@/shared/api/app/medicines-api.ts` and `../shared/medical-api.ts` with the doubles of
`tests/utils/medical-doubles.ts`.

## Test ids

`medical-medicines-page`; the shared toolbar and table ids prefixed `medical-medicines`; the row
action `medical-medicines-row-action-return-expiring`; `expiring-return-drawer`.
