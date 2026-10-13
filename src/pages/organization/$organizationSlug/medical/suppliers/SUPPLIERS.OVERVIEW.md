# `pages/organization/$organizationSlug/medical/suppliers` — Medical › Suppliers

Route: `/organization/$organizationSlug/medical/suppliers` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every supplier on clinozy-be (`GET /app/suppliers`, `medical.md:73–87`): Supplier (and phone, or "Add phone") · Manufacturers · Orders · Payable · Ageing (≥ 30 days blush, ≥ 7 butter) — the payable, ageing and order count are the server's, money in rupees. The row edge is the ageing while money is due; the footer counts the suppliers and what they are owed over every page (`meta.payable_total`), one read keyed by the filters alone. Filters: the automatic Manufacturers section — one maker at a time, the API filters by one — · Payable (All · Owed something, `?payable=owed` → `has_payable`, where "Pay all received" lands) · Created; sort by Supplier or Payable. A row opens Edit supplier; "Pay ₹827", while something is owed, reads the supplier's oldest received order still due once, on the click (`fetchOldestOpenPurchaseOrder`), and opens Payments › Send payment on it (`?bill=mpo_…`) — Clinic stock's Vendors pattern; the supplier-level payment route is not used. A supplier paid up meanwhile says so and the list is read again. "New purchase order" opens one on that supplier.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed first read shows in place with Retry.

## Dialog routes

`create/` (New supplier) · `$supplierId/edit/` (Edit supplier) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24): the Supplier drawer (`../shared/components/SupplierDrawer/`) — 560px new, 840px editing with its Account — with a manufacturer stacked on it; its Quick fill "New purchase order" opens one on that supplier and, while it is owed, "Pay ₹827" pays its oldest open order the same way. Delete shows while nothing is owed; an open credit or an order still to receive is the server's refusal (`409 supplier_has_dues`), and a confirm that closes without deleting reads the list again.

## Files

| File                        | Responsibility                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `suppliers.route.tsx`       | Route marker — exports `Component` rendering `SuppliersPage`.                                            |
| `suppliers.manifest.ts`     | Manifest — `kind: 'layout'` over its dialog routes, module `app-medical`.                                |
| `suppliers.params.ts`       | The list read from the URL (one maker, "owed something", the tab's sort keys), the footer's and its key. |
| `SuppliersPage.tsx`         | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`.  |
| `hooks/useSupplierColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.             |

## Test ids

`medical-suppliers-page`; the shared toolbar and table ids prefixed `medical-suppliers`; the row
action `medical-suppliers-row-action-pay`; the drawer's `supplier-drawer-quick-fill-pay`.
