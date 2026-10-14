# `pages/organization/$organizationSlug/medical/purchases` — Medical › Purchases

Route: `/organization/$organizationSlug/medical/purchases` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every purchase order but the cancelled, on clinozy-be (`GET /app/medical-purchase-orders`, api-integration §5.5; `medical.md:57–71`): PO (and the supplier's bill number) · Supplier · Items (and the free units) · Date · Total · Stage (Ordered sky · Received butter · Paid sage — a received order paid in full, `payment_status` — with what a part-paid order has paid). Money is the API's rupees; the total, due and stage are the server's. The sequence follows the stage: an Ordered order opens for editing with "Receive goods" and — for an Admin — "Cancel order" (its toast's Undo restores it); a Received one opens its read-only view with "Pay ₹2,980"; a Paid one its view with "Print" — its A4 purchase order (L-64, Q-M7). A medicine typed on a line rides it by name, and the save has the server add it as a quick medicine (MD26). Receive goods' "+ Add unexpected item" takes in what came that was not ordered: its medicine, counts, rate, batch and expiry are sent without a line id, into stock and onto the bill. The row's and the view's "Pay ₹X" open Payments › Send payment on the order's bill (Q-M1, `usePayBill`); the view action "Pay all received · ₹X" with Stage Received — what the suppliers owed something are owed — opens Suppliers filtered `payable=owed`, where each row pays (route 13). Filters: Stage · Created; PO, Date and Total sort on the server (Supplier and Stage do not); the footer counts the orders.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New purchase order, `?supplier=` · `?reorder=low`) · `$purchaseOrderId/` (the view; an Ordered order's opens as Edit) · `$purchaseOrderId/edit/` · `$purchaseOrderId/receive/` (both on an Ordered order — past it they show the view, `S:59`) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24).

## Files

| File                              | Responsibility                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `purchases.route.tsx`             | Route marker — exports `Component` rendering `PurchasesPage`.                                                         |
| `purchases.manifest.ts`           | Manifest — `kind: 'layout'` over its dialog routes, module `app-medical`.                                             |
| `purchases.params.ts`             | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.                            |
| `PurchasesPage.tsx`               | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`.               |
| `hooks/usePurchaseOrderColumns/`  | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.                          |
| `components/PurchaseOrderDrawer/` | New / Edit purchase order: Order → Items with the quick line ("azel 20 +2 @180"), its Low stock chips and its Browse. |
| `components/ReceiveGoodsDrawer/`  | Receive goods: "Tick what arrived", its form's rules (`components/ReceiveGoodsDrawer/receive-form.ts`).               |
| `components/PurchaseOrderView/`   | A received or paid order, locked, with "Pay ₹X" — or, once paid, "Print": the A4 purchase order.                      |

Tests mock `../shared/medical-api.ts`, `../shared/medical-records-api.ts` and
`@/shared/api/app/medicines-api.ts` with the doubles of `tests/utils/medical-doubles.ts`.

## Test ids

`medical-purchases-page`; the shared toolbar and table ids prefixed `medical-purchases`; the row
actions `medical-purchases-row-action-<receive|edit|cancel|pay|view>`; the view action
`medical-purchases-view-action-pay-received`; `purchase-order-drawer`, `receive-goods-drawer`,
`purchase-order-view-drawer`.
