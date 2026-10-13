# `pages/organization/$organizationSlug/stock/purchases` — Clinic stock › Purchases

Route: `/organization/$organizationSlug/stock/purchases` (KICKOFF §6.8, L-51). Same gates as the Clinic
stock room.

The bills from clinic vendors, read from clinozy-be (`GET /app/stock-purchases`, `clinic-stock.md:41–55`): ID ·
Supplier (and phone, joined from the room's vendor catalogue — one cached read per page, never one per row) ·
Invoice (hidden by default) · Date ("22 Sep 2026") · Bill · Due (blush, or "—") · Status ("Paid" sage /
"Partly paid" butter / "Unpaid" blush). The bill, what is paid and due, and the status are the server's
(`bill_amount`, `due_amount`, `payment_status`), in rupees. The row edge is the status; the footer reads
"4 purchases · ₹2,310 due" — the server's `estimated_total` and `meta.due_total` over the filters
(`stockListSummary('purchases', …)`). On a phone the Supplier leads with the Bill as its key. Sorts: ID, Bill
and Due (`stock_purchase_number`, `bill_amount`, `due_amount`; none is the bill date, latest first) — the API
does not sort by supplier, so that column does not sort and a `vendor` sort in the URL is dropped. Filters:
Status (all three `payment_status` values, fixed) · Supplier (one vendor, a searchable picker over the vendor
catalogue — `stock_vendor_id`) · Created ("Follow-up date" is not built — a purchase has no follow-up). A first
read that fails shows the error in place with Retry; a later failure keeps the last copy with the rooms'
list-error toast.

A row opens Edit purchase; "+ New purchase" (and the empty state's) shows for those who may record one
(`stock_item:create`). "Pay ₹1,710", while something is due, opens Payments › Send payment on the bill
(`usePayBill`, `?bill=spur_…`; `payment:create` and `payment:read`, Q-S3); a new purchase can also be paid by
its "Paid" when it is recorded.

The search, filters and sort live in the URL (`../stock.search.ts`).

## Dialog routes

`create/` (New purchase; `?reorder=low` presets "Reorder low items") · `$purchaseId/edit/` (Edit purchase)
— each renders nothing; this page opens the Purchase drawer (`../shared/components/StockPurchaseDrawer/`) over
the list (D24), a clinic vendor or item stacked on it from its pickers. Delete (`stock_item:delete`) — the row's
and the drawer's — goes only for an unpaid purchase: one with money paid on it says why ("A purchase with money
paid on it can’t be deleted") instead of asking; an unpaid one asks for a reason — "Purchase #15 deleted" +
Undo (restore). A purchase paid on since the list was read is refused by the server (`409 purchase_paid`, or
`409 not_enough_stock` when what it received was used since): the confirm closes, says why and the room reads
its lists again.

## The Purchase drawer (`StockPurchaseDrawer`)

- **New purchase** — `POST /app/stock-purchases`: Supplier\* (a clinic vendor; "New clinic vendor" stacked),
  Invoice no. (≤ 30), Bill date (never after today) · Items received — 1 to 50 lines, each an item (a listed
  one, or "add as typed" / the stacked "New clinic item", created at once from the bill's vendor), its quantity
  and rate (required) · Bill amount (empty follows the lines' total). With `payment:create`, "Paid" — an
  amount ("Full" · "Nothing"), Cash · UPI · Card, and the paying branch (the member's branches, shown with two or
  more; it starts on the header's one branch, else the main one) — is sent as the purchase's `payment` and
  recorded as a supplier-bill payment. "Purchase saved · stock updated".
- **Edit purchase** — `PATCH /app/stock-purchases/:id` with `expected_updated_at`: the supplier, invoice no.,
  date and bill amount only — the lines were received into stock and stay as they are (the server's amounts),
  and what is paid is the server's ("₹892.50 paid · Partly paid"). A save over someone else's — a payment
  moves the purchase too — is `409 record_changed`: the toast's "Reload" reads the purchase again and starts the
  form over on it.
- Refusals on their fields: the API's field errors (a line's `items/0/rate` on that row's Rate; `bill_amount`,
  `bill_number`, `purchase_date`, `payment.branch_id`), "Paid is more than the bill" (`409 more_than_due`) and a
  closed day at the paying branch (`409 day_closed`) on Paid.

## Files

| File                             | Responsibility                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `purchases.route.tsx`            | Route marker — exports `Component` rendering `PurchasesPage`.                                 |
| `purchases.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `app-stock`.                       |
| `purchases.params.ts`            | The list read from the URL (the API's sort keys) and its filter key.                          |
| `PurchasesPage.tsx`              | The tab: the Clinic stock toolbar, the table, its row actions and states; hosts the `Outlet`. |
| `hooks/useStockPurchaseColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.  |

## Test ids

`stock-purchases-page`; the shared toolbar and table ids prefixed `stock-purchases` (`stock-purchases-new`,
`stock-purchases-filters`, `stock-purchases-row-action-pay` / `-edit` / `-delete`). The drawer: `stock-purchase-drawer`
with `-vendor`, `-bill-no`, `-date`, `-lines` (`-lines-row`, `-lines-qty`, `-lines-rate`, `-lines-add`,
`-lines-error`), `-quick-line-…`, `-bill`, `-paid` (New: the Paid input, `-paid-quick-full` / `-nothing`,
`-paid-mode-cash` / `-upi` / `-card`, `-paid-branch-<brn_…>`; Edit: the read-only Paid).
