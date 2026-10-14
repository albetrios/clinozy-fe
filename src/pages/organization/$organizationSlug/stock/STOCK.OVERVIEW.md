# `pages/organization/$organizationSlug/stock` — Clinic stock

Route: `/organization/$organizationSlug/stock` (KICKOFF §6.8, L-51). Consumables and equipment used in
procedures, never sold and never shared with Medical: what is on the shelf, every use, receipt and
adjustment, the bills from clinic vendors and the vendors themselves.

On clinozy-be (D154): every read and write goes to `/app/stock-items`, `/app/stock-item-movements`,
`/app/stock-purchases`, `/app/stock-vendors` and `/app/stock-counts` through the room's own data layer
in `shared/` — ids are public ids (`sitm_` · `smov_` · `spur_` · `svnd_` · `scnt_`), money is the API's
rupees, quantities its decimals (×1000 inside the room). The level, the runway, what is due and owed are
the server's; the room joins vendor and item names and the authors from one cached catalogue read each,
never one read per row. The room is out of `FIXTURE_BACKED_APP_MODULES`, so production serves it.

Gated like every clinic room: membership (`organization:read`) and the `app-stock` module, then
`requireOrgStatus` on every tab and dialog route. In-room access is `useStockAccess` over the member's own
codes (api-integration §5.6 Roles; Q-S1, Q-S2): `stock_item:read` sees the room; `stock_item:create` adds
items, purchases and vendors; `stock_item:update` edits them and moves stock — Use, Receive, Adjust,
Revert, Stock check; `stock_item:delete` deletes (and its Undo restores); `stock_item:export` exports;
`payment:create` pays at "Paid" on a new purchase. So Therapist and Front desk keep the stock too, and
Delete and Export stay Owner's and Admin's. View-as answers with the previewed role's codes instead.

The bare `/stock` redirects to its first tab, `/stock/items` (`S:72`). The tabs are literal child routes
(D24): `items/`, `purchases/`, `movements/` — the prototype's three — and `vendors/` (Q-K1). The toolbar
keeps all four; its track scrolls sideways when short. Its search says what the API searches: Items the
name or `#ID`, Purchases the invoice, `#ID` or supplier, Vendors the name; Movements has none (the Item
filter narrows it).

Paying a purchase later is "Pay ₹X" on Purchases and Vendors rows — Payments › Send payment on the bill
(`?bill=spur_…`; a vendor's at their oldest open bill, read on the click), for `payment:create` and
`payment:read` (Q-S3, D156). What is not on the screens, and why: a purchase's payments are not Movements rows
(G7); a revert is final (no Undo of a revert); delete takes an item at zero and an
unpaid purchase or a vendor owed nothing (`409 item_has_stock` · `purchase_paid` · `vendor_has_dues`).

## Files

| File                                     | Responsibility                                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stock.route.tsx`                        | Route marker — exports `Component` rendering `StockLayout`.                                                                                                                                                                                            |
| `stock.manifest.ts`                      | Manifest — `kind: 'layout'`, children `items`, `purchases`, `movements`, `vendors`; module `app-stock`, nav section `stock`.                                                                                                                           |
| `stock.constants.ts`                     | `STOCK_NS` / `STOCK_KEYS` (the `app-stock` namespace) and `STOCK_TABLE_IDS`.                                                                                                                                                                           |
| `stock.search.ts`                        | Every tab's URL params (search, filters, sort) — the entry chunk's dependency-free reader.                                                                                                                                                             |
| `stock.dialog-search.ts`                 | The create drawers' prefills — parsed by `useStockDialogRoute`; loads with the room.                                                                                                                                                                   |
| `StockLayout.tsx`                        | Layout over the tab routes (`<Outlet />`).                                                                                                                                                                                                             |
| `shared/stock-contracts.ts`              | The API's wire rows (`wireSchema`) and the room's records and rows they map to — milli quantities, rupees, the joins.                                                                                                                                  |
| `shared/stock-api.ts`                    | The reads on clinozy-be: cursor pages, the catalogues (every page), a record by id, the footers' one-row reads (`meta` totals).                                                                                                                        |
| `shared/stock-units.ts`                  | The pure stock arithmetic: ×1000 quantities, the bar, the runway's words, reorder quantity, the tones (level and runway are the server's).                                                                                                             |
| `shared/stock-filters.ts`                | A fixed Filters chip from a stock word (clinozy-be serves no facets).                                                                                                                                                                                  |
| `shared/stock-records-contracts.ts`      | What each drawer, the Use popover and Stock check send — the input types and the request bodies they build.                                                                                                                                            |
| `shared/stock-records-api.ts`            | The writes on clinozy-be, each with its idempotency key: vendors, items, movements (use, receive, adjust, revert), purchases, Stock check.                                                                                                             |
| `shared/stock-movement.ts`               | The movement arithmetic the popover and the drawer share: unit ⇄ measure, steps, quick chips, the stock after it.                                                                                                                                      |
| `shared/stock-drawers.constants.ts`      | The drawers', popover's and confirms' copy keys and root test ids.                                                                                                                                                                                     |
| `shared/hooks/useStockLists/`            | The tabs' cursor lists, footer figures and the item and vendor catalogues, keyed by organization.                                                                                                                                                      |
| `shared/hooks/useStockNav/`              | The family's navigation: each dialog route over its tab, keeping the list's params.                                                                                                                                                                    |
| `shared/hooks/useStockAccess/`           | Create / edit / delete from the `stock_item:*` codes, Pay from `payment:create` (the matrix under View-as).                                                                                                                                            |
| `shared/hooks/useStockWords/`            | "3 tube · 90 g · OK", "per tube of 30 g · uses ~0.5/week", "~6 weeks", the change, dates, the tones.                                                                                                                                                   |
| `shared/hooks/useStockDialogRoute/`      | Which drawer a tab's URL opens — the shared `useRoomDialogRoute` over the `stock` section (creates need Create, Stock check Edit).                                                                                                                     |
| `shared/hooks/useStockStack/`            | The stacked "New clinic vendor" / "New clinic item" (component state).                                                                                                                                                                                 |
| `shared/hooks/useStockWrites/`           | Every write (`useAppMutation`), refreshing the room — and, for purchases and vendors, the bills Send payment offers.                                                                                                                                   |
| `shared/components/StockItemDrawer/`     | New / Edit item (680px; Item → Levels → Supplier) and the stacked New clinic item (Item → Details).                                                                                                                                                    |
| `shared/components/StockMovementDrawer/` | Log usage / Receive stock / Adjust stock (560px; Movement → Details → Notes), with Undo (a revert).                                                                                                                                                    |
| `shared/components/StockUsePopover/`     | The Use popover: 300px at the row's Use button — quantity, its measure, "Used for", the After line, Undo (a revert).                                                                                                                                   |
| `shared/components/StockPurchaseDrawer/` | New / Edit purchase (840px; Bill → Items received → Payment): Paid on a new one, lines and Paid read-only on a saved one; quick line.                                                                                                                  |
| `shared/components/StockVendorDrawer/`   | New / Edit clinic vendor (560px), stacked or on the Vendors tab's routes.                                                                                                                                                                              |
| `shared/components/StockCheckDrawer/`    | Stock check (840px): the count grid — 2 × 2 cards on a phone — the counter and "Fill rest as matching".                                                                                                                                                |
| `shared/components/StockPickers/`        | The Supplier and Item pickers with their "New … · “q”" + "full details".                                                                                                                                                                               |
| `shared/components/StockStackHost/`      | The stacked child on top of the open drawer.                                                                                                                                                                                                           |
| `shared/components/StockDeleteConfirm/`  | Delete an item, a purchase or a clinic vendor for a reason, Undo in the toast; the `409` reasons in the room's words.                                                                                                                                  |
| `shared/components/StockRevertConfirm/`  | Revert a movement for a `revert_reason` — final, no Undo; `409 already_reverted` / `not_enough_stock` in the room's words.                                                                                                                             |
| `shared/components/StockToolbar/`        | h1, the four tabs, search, Filters, Columns, "Stock check" (Items), the tab's "+ New …".                                                                                                                                                               |
| `shared/components/StockTable/`          | The shared room table in the room's mint; each tab's own empty tile (`Package`, `ShoppingCart`, `ArrowLeftRight`, `Truck`).                                                                                                                            |
| `__tests__/integration/`                 | `__tests__/integration/stock-test-router.tsx` (the family's routes in a memory router, the member's codes or View-as), `__tests__/integration/stock-room-test-data.ts` (the mocked reads) and the flows: the four tabs, a drawer from each, the gates. |

## Test ids

`stock-page`; each tab's `stock-<tab>-page`, and its shared toolbar and table ids prefixed `stock-<tab>`.
The drawers: `stock-item-drawer`, `stock-movement-drawer`, `stock-purchase-drawer`, `stock-vendor-drawer`,
`stock-check-drawer`; the Use popover `stock-use-popover`; a stacked child adds `-stacked`
(`stock-vendor-drawer-stacked`, `stock-new-item-drawer-stacked`). Each drawer's parts derive from its
root (`-save`, `-step-<id>`, `-name` …).
