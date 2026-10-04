# `pages/organization/$organizationSlug/medical/purchases` — Medical › Purchases

Route: `/organization/$organizationSlug/medical/purchases` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every purchase order but the cancelled (`medical.md:57–71`): PO (and the supplier's bill number) · Supplier · Items (and the free units) · Date · Total · Stage (Ordered sky · Received butter · Paid sage, with what a part-paid order has paid). The sequence follows the stage: an Ordered order opens for editing with "Receive goods"; a Received or Paid one opens its read-only view. Filters: Stage · Created; the footer counts the orders.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New purchase order, `?supplier=` · `?reorder=low`) · `$purchaseOrderId/` (the view) · `$purchaseOrderId/edit/` · `$purchaseOrderId/receive/` — each renders nothing; this page reads the URL and opens the drawer over the
list (D24; the drawers land with L-50b).

## Files

| File                             | Responsibility                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `purchases.route.tsx`            | Route marker — exports `Component` rendering `PurchasesPage`.                                           |
| `purchases.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                            |
| `purchases.params.ts`            | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `PurchasesPage.tsx`              | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/usePurchaseOrderColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |

## Test ids

`medical-purchases-page`; the shared toolbar and table ids prefixed `medical-purchases`.
