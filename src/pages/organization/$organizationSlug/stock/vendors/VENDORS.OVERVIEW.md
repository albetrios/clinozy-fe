# `pages/organization/$organizationSlug/stock/vendors` — Clinic stock › Vendors

Route: `/organization/$organizationSlug/stock/vendors` (KICKOFF §6.8, L-51; Q-K1 — the prototype has no
Vendors tab). Same gates as the Clinic stock room.

The clinic's vendors, modelled on Medical › Suppliers (`S:81–83`, PRD.md:81, 146): Vendor (and phone, or
"Add phone") · Purchases ("1 purchase" / "No purchases") · Payable (blush, or "—"). The footer reads "5
vendors · ₹2,310 payable". On a phone the Vendor leads with the Payable as its key. Search only — no
Filters (`listVendors` takes `q`). A row opens Edit clinic vendor; "+ New clinic vendor" shows for those
who keep the stock. AMBER: the column labels and the empty copy are not in the source.

## Dialog routes

`create/` (New clinic vendor) · `$vendorId/edit/` (Edit clinic vendor) — each renders nothing; this page
opens the clinic vendor drawer over the list (D24). Delete shows only while nothing is owed; it asks for a
reason. "Pay ₹X" waits on the Payments pay route (L-50c, Q-M1).

## Files

| File                           | Responsibility                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `vendors.route.tsx`            | Route marker — exports `Component` rendering `VendorsPage`.                                   |
| `vendors.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-stock`.                    |
| `vendors.params.ts`            | The list read from the URL (the tab's own sort keys) and its filter key.                      |
| `VendorsPage.tsx`              | The tab: the Clinic stock toolbar, the table, its row actions and states; hosts the `Outlet`. |
| `hooks/useStockVendorColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids.                       |

## Test ids

`stock-vendors-page`; the shared toolbar and table ids prefixed `stock-vendors`.
