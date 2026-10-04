# `pages/organization/$organizationSlug/medical/medicines` — Medical › Medicines

Route: `/organization/$organizationSlug/medical/medicines` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every medicine (`medical.md:41–55`): ID · Medicine (its composition, or "Needs MRP and composition" on a quick record) · Manufacturer · Stock (the line and a bar to the fill-up level) · Nearest expiry (≤ 30 days blush, ≤ 90 butter) · MRP (and the near-expiry discount) · Best rate (hidden) · Margin. The row edge is the stock level. Filters: Stock (All · Low stock) · Nearest expiry · the automatic Manufacturer section · Created. The view action is "Reorder low stock" with Low stock on (a new purchase order with `?reorder=low`) and "Sell all at 20% off" / "Remove near-expiry discount" with a Nearest expiry window; a batch expiring within 90 days adds the row's discount toggle. A row opens Edit medicine.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New medicine) · `$medicineId/edit/` (Edit medicine) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24; the drawers land with L-50b).

## Files

| File                        | Responsibility                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `medicines.route.tsx`       | Route marker — exports `Component` rendering `MedicinesPage`.                                           |
| `medicines.manifest.ts`     | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                            |
| `medicines.params.ts`       | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `MedicinesPage.tsx`         | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useMedicineColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |

## Test ids

`medical-medicines-page`; the shared toolbar and table ids prefixed `medical-medicines`.
