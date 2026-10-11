# `pages/organization/$organizationSlug/stock/vendors` — Clinic stock › Vendors

Route: `/organization/$organizationSlug/stock/vendors` (KICKOFF §6.8, L-51; Q-K1 — the prototype has no
Vendors tab). Same gates as the Clinic stock room.

The clinic's vendors on clinozy-be (`GET /app/stock-vendors`), modelled on Medical › Suppliers (`S:81–83`,
PRD.md:81, 146): Vendor (and phone, or "Add phone") · Purchases ("1 purchase" / "No purchases" — the
server's `purchase_count`) · Payable (blush rupees, or "—" — the server's `payable`). Sort by Vendor
(`sort=name`) or Payable (`sort=payable`); Purchases does not sort. Search by name only (`q`) — no Filters.
The footer reads "5 vendors · ₹2,310 payable": `estimated_total` and `meta.payable_total` of one
single-row read keyed by the search (a sort changes neither). On a phone the Vendor leads with the
Payable as its key. A first read that fails shows in place with Retry. AMBER: the column labels and the
empty copy are not in the source.

## Gates

`stock_item:create` — "+ New clinic vendor" (toolbar and empty state) · `stock_item:update` — a saved
vendor opens editable, else view only · `stock_item:delete` — Delete (row and drawer) — the member's own
codes (`useStockAccess`); under View-as the previewed role's codes answer instead.

## Dialog routes

`create/` (New clinic vendor) · `$vendorId/edit/` (Edit clinic vendor, `GET /app/stock-vendors/:id`) —
each renders nothing; this page opens the clinic vendor drawer
(`../shared/components/StockVendorDrawer/`) over the list (D24). Delete shows only while nothing is owed
(`vendorDeleteBlock`); it asks for a reason (`DELETE …?reason=&note=`, Undo restores). A delete refused
with `409 vendor_has_dues` (a purchase owes them since the list was read) closes with "Settle this
vendor’s purchases first", and the vendors, the footer and the vendor's own read are read again.

"Pay ₹X" (what they are owed), while a vendor is owed, opens Payments › Send payment on their oldest open
bill — one read on the click (`fetchOldestOpenStockPurchase`,
`GET /app/stock-purchases?stock_vendor_id=…&payment_status=unpaid,partial&sort=purchase_date&order=asc&limit=1`),
never one read per row; a vendor paid up meanwhile says "Nothing is owed to … now" and the vendors are read
again. It shows for `payment:create` and `payment:read` (Q-S3).

## Files

| File                           | Responsibility                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `vendors.route.tsx`            | Route marker — exports `Component` rendering `VendorsPage`.                                               |
| `vendors.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `app-stock`.                                   |
| `vendors.params.ts`            | The list read from the URL (search; sort `name` · `payable`) and its filter key.                          |
| `VendorsPage.tsx`              | The tab: the Clinic stock toolbar, the table, the footer, its row actions and states; hosts the `Outlet`. |
| `hooks/useStockVendorColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, rupees.                           |

## Test ids

`stock-vendors-page`; the shared toolbar and table ids prefixed `stock-vendors` (`stock-vendors-new`,
`stock-vendors-table-row`, `stock-vendors-table-footer`, `stock-vendors-row-action-pay` · `-edit` ·
`-delete`); `retry-error` / `retry-button` for a failed first read.
