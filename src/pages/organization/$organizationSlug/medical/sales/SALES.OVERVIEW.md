# `pages/organization/$organizationSlug/medical/sales` — Medical › Sales

Route: `/organization/$organizationSlug/medical/sales` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every sale (`medical.md:25–39`): Sale · Customer (the patient with the "P" badge, or a Medical contact) · Medicines (and their batches) · Bill (less what came back) · Margin (hidden) · Status ("Returned", then Paid / Unpaid) · When. The row edge is sage when paid, blush when unpaid. Filters: Status (All · Unpaid · Returned) · Created; the footer counts the sales. A row opens the read-only Sale; "Return medicines" opens Return from patient.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New sale — the shared Invoice drawer, L-50c) · `$saleId/` (the Sale) · `$saleId/return/` (Return from patient) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24; the drawers land with L-50b).

## Files

| File                    | Responsibility                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `sales.route.tsx`       | Route marker — exports `Component` rendering `SalesPage`.                                               |
| `sales.manifest.ts`     | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                            |
| `sales.params.ts`       | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `SalesPage.tsx`         | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useSaleColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |

## Test ids

`medical-sales-page`; the shared toolbar and table ids prefixed `medical-sales`.
