# `pages/organization/$organizationSlug/stock/purchases` — Clinic stock › Purchases

Route: `/organization/$organizationSlug/stock/purchases` (KICKOFF §6.8, L-51). Same gates as the Clinic
stock room.

The bills from clinic vendors (`clinic-stock.md:41–55`): ID · Supplier (and phone) · Invoice (hidden by
default) · Date ("22 Sep 2026") · Bill · Due (blush, or "—") · Status ("Paid" sage / "Partly paid" butter
/ "Unpaid" blush). The row edge is the status; the footer reads "4 purchases · ₹2,310 due". On a phone the
Supplier leads with the Bill as its key. Filters: the automatic Status section · Created ("Follow-up
date" is not built — a purchase has no follow-up). A row opens Edit purchase; "+ New purchase" shows for
those who keep the stock.

The search, filters and sort live in the URL (`../stock.search.ts`).

## Dialog routes

`create/` (New purchase; `?reorder=low` presets "Reorder low items") · `$purchaseId/edit/` (Edit purchase)
— each renders nothing; this page opens the drawer over the list (D24) with L-51b. "Pay ₹X" waits on the
Payments pay route (L-50c, Q-M1).

## Files

| File                             | Responsibility                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `purchases.route.tsx`            | Route marker — exports `Component` rendering `PurchasesPage`.                                 |
| `purchases.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-stock`.                    |
| `purchases.params.ts`            | The list read from the URL (the tab's own sort keys) and its filter key.                      |
| `PurchasesPage.tsx`              | The tab: the Clinic stock toolbar, the table, its row actions and states; hosts the `Outlet`. |
| `hooks/useStockPurchaseColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.  |

## Test ids

`stock-purchases-page`; the shared toolbar and table ids prefixed `stock-purchases`.
