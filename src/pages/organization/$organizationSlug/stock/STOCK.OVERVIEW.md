# `pages/organization/$organizationSlug/stock` — Clinic stock

Route: `/organization/$organizationSlug/stock` (KICKOFF §6.8, L-51). Consumables and equipment used in
procedures, never sold and never shared with Medical: what is on the shelf, every use, receipt and
adjustment, the bills from clinic vendors and the vendors themselves.

Gated like every clinic room: membership (`organization:read`) and the `clinic-stock` module, then
`requireOrgStatus` on every tab and dialog route. In-room access is `useStockAccess` over the `stock`
section of the clinic matrix (Q-K2): View for Admin, Pharmacist, Accountant, Therapist and Front desk;
**use** (Create) adds Therapist and Front desk; **keeping the stock** — the creates, receive, adjust and
Stock check — takes Create with Edit (Admin, Pharmacist); Delete is Admin's.

The bare `/stock` redirects to its first tab, `/stock/items` (`S:72`). The tabs are literal child routes
(D24): `items/`, `purchases/`, `movements/` — the prototype's three — and `vendors/` (Q-K1). The toolbar
keeps all four; its track scrolls sideways when short.

## Files

| File                                     | Responsibility                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `stock.route.tsx`                        | Route marker — exports `Component` rendering `StockLayout`.                                                                                |
| `stock.manifest.ts`                      | Manifest — `kind: 'layout'`, children `items`, `purchases`, `movements`, `vendors`; module `clinic-stock`, nav section `stock`.            |
| `stock.constants.ts`                     | `STOCK_NS` / `STOCK_KEYS` (the `clinic-stock` namespace) and `STOCK_TABLE_IDS`.                                                            |
| `stock.search.ts`                        | Every tab's URL params (search, filters, sort) and the dialog routes' prefills — the entry chunk's dependency-free reader.                 |
| `StockLayout.tsx`                        | Layout over the tab routes (`<Outlet />`).                                                                                                 |
| `shared/stock-contracts.ts`              | The rows each list read returns (the contract record + what the server derives).                                                           |
| `shared/stock-api.ts`                    | The fixture reads (REPLACE_WITH_API): cursor pages, a record by id, the footer figures, the automatic sections' values.                    |
| `shared/stock-units.ts`                  | The pure stock arithmetic: ×1000 quantities, level, bar, runway ("Lasts"), reorder quantity, the tones.                                    |
| `shared/stock-filters.ts`                | An automatic Filters chip from a stock word; a tab's facet values.                                                                         |
| `shared/stock-records-contracts.ts`      | What each drawer, the Use popover and Stock check send (Zod), and what the writes answer.                                                  |
| `shared/stock-records-api.ts`            | The fixture writes (REPLACE_WITH_API): vendors, items, movements (use, receive, adjust, revert, Undo), purchases, Stock check.             |
| `shared/stock-movement.ts`               | The movement arithmetic the popover and the drawer share: unit ⇄ measure, steps, quick chips, the stock after it.                          |
| `shared/stock-drawers.constants.ts`      | The drawers', popover's and confirms' copy keys and root test ids.                                                                         |
| `shared/hooks/useStockLists/`            | The tabs' cursor lists, footer figures and facets.                                                                                         |
| `shared/hooks/useStockNav/`              | The family's navigation: each dialog route over its tab, keeping the list's params.                                                        |
| `shared/hooks/useStockAccess/`           | Use / keep / delete, from the clinic access matrix (Q-K2).                                                                                 |
| `shared/hooks/useStockWords/`            | "3 tube · 90 g · OK", "per tube of 30 g · uses ~0.5/week", "~6 weeks", the change, dates, the tones.                                       |
| `shared/hooks/useStockDialogRoute/`      | Which drawer a tab's URL opens — the shared `useRoomDialogRoute` over the `stock` section (creates and Stock check need Create with Edit). |
| `shared/hooks/useStockStack/`            | The stacked "New clinic vendor" / "New clinic item" (component state).                                                                     |
| `shared/hooks/useStockWrites/`           | Every write, refreshing the room — and, for purchases and vendors, the bills Send payment offers.                                          |
| `shared/components/StockItemDrawer/`     | New / Edit item (680px; Item → Levels → Supplier) and the stacked New clinic item (Item → Details).                                        |
| `shared/components/StockMovementDrawer/` | Log usage / Receive stock / Adjust stock (560px; Movement → Details → Notes), with Undo.                                                   |
| `shared/components/StockUsePopover/`     | The Use popover: 300px at the row's Use button — quantity, its measure, "Used for", the After line, Undo.                                  |
| `shared/components/StockPurchaseDrawer/` | New / Edit purchase (840px; Bill → Items received → Payment), "⚡ Reorder low items".                                                      |
| `shared/components/StockVendorDrawer/`   | New / Edit clinic vendor (560px), stacked or on the Vendors tab's routes.                                                                  |
| `shared/components/StockCheckDrawer/`    | Stock check (840px): the count grid — 2 × 2 cards on a phone — the counter and "Fill rest as matching".                                    |
| `shared/components/StockPickers/`        | The Supplier and Item pickers with their "New … · “q”" + "full details".                                                                   |
| `shared/components/StockStackHost/`      | The stacked child on top of the open drawer.                                                                                               |
| `shared/components/StockDeleteConfirm/`  | Delete an item, a purchase or a clinic vendor for a reason, Undo in the toast.                                                             |
| `shared/components/StockRevertConfirm/`  | Revert a movement for a `revert_reason`.                                                                                                   |
| `shared/components/StockToolbar/`        | h1, the four tabs, search, Filters, Columns, "Stock check" (Items), the tab's "+ New …".                                                   |
| `shared/components/StockTable/`          | The shared room table in the room's mint with its `Package` empty tile.                                                                    |
| `__tests__/integration/`                 | `__tests__/integration/stock-test-router.tsx` (the family's routes in a memory router) and the tabs' flows.                                |

## Test ids

`stock-page`; each tab's `stock-<tab>-page`, and its shared toolbar and table ids prefixed `stock-<tab>`.
The drawers: `stock-item-drawer`, `stock-movement-drawer`, `stock-purchase-drawer`, `stock-vendor-drawer`,
`stock-check-drawer`; the Use popover `stock-use-popover`; a stacked child adds `-stacked`
(`stock-vendor-drawer-stacked`, `stock-new-item-drawer-stacked`). Each drawer's parts derive from its
root (`-save`, `-step-<id>`, `-name` …).
