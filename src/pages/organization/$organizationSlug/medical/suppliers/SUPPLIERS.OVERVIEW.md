# `pages/organization/$organizationSlug/medical/suppliers` — Medical › Suppliers

Route: `/organization/$organizationSlug/medical/suppliers` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every supplier (`medical.md:73–87`): Supplier (and phone, or "Add phone") · Manufacturers · Orders · Payable (received orders not paid in full) · Ageing (days since the oldest open bill; ≥ 30 blush, ≥ 7 butter). The row edge is the ageing while money is due; the footer counts the suppliers and what they are owed. Filters: the automatic Manufacturers section · Created. A row opens Edit supplier; "Pay ₹827", while something is due, opens Payments › Send payment on its oldest open bill (`?bill=md:<poId>`, Q-M1); "New purchase order" opens one on that supplier.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New supplier) · `$supplierId/edit/` (Edit supplier) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24): the Supplier drawer (`../shared/components/SupplierDrawer/`) — 560px new, 840px editing with its Account — with a manufacturer stacked on it; its Quick fill "New purchase order" opens one on that supplier and, while it is owed, "Pay ₹827" pays its oldest open bill. Delete, only with nothing due and no order to settle, asks for a reason.

## Files

| File                        | Responsibility                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `suppliers.route.tsx`       | Route marker — exports `Component` rendering `SuppliersPage`.                                           |
| `suppliers.manifest.ts`     | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                            |
| `suppliers.params.ts`       | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `SuppliersPage.tsx`         | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useSupplierColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |

## Test ids

`medical-suppliers-page`; the shared toolbar and table ids prefixed `medical-suppliers`; the row
action `medical-suppliers-row-action-pay`; the drawer's `supplier-drawer-quick-fill-pay`.
