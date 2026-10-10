# `pages/organization/$organizationSlug/stock/items` — Clinic stock › Items

Route: `/organization/$organizationSlug/stock/items` (KICKOFF §6.8, L-51) — where `/stock` lands. Same
gates as the Clinic stock room.

Every consumable and piece of equipment on clinozy-be (`GET /app/stock-items`, `clinic-stock.md:25–39`):
ID · Item (and "per tube of 30 g · uses ~0.5/week") · Category (pill in its tone) · Stock ("3 tube · 90 g
· OK" over a bar of stock ÷ maximum — the level is the server's `stock_level`) · Lasts ("~6 weeks", "~5
days" or "No usage" — the server's `lasts_days`; ≤ 7 days blush, ≤ 21 butter, else sage) · Supplier and
Last rate (the rupees of its latest purchase line, `last_rate`), both hidden by default. A row's vendor
is joined from the vendor list (one cached read, never one per row). The row edge is the stock level; the
footer has no count. On a phone the Item leads with the Category pill as its key; at 820 Item and
Category stay and the rest fold. Filters: Stock (All · Low stock — `stock_level=low,out`) · Category (the
six; clinozy-be serves no facets) · Lasts (All · Within a week · Within 3 weeks — the pill's blush and
butter bands, each one upper bound, `lasts_days_to` 7 / 21) · Created. A row opens Edit item; "Stock
check" shows with `stock_item:update`, "+ New item" with `stock_item:create`.

The search (the name or `#167`), filters and sort live in the URL (`../stock.search.ts`); the list read
follows them — a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the
skeleton. A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New item, `?name=`) · `$itemId/edit/` (Edit item, `GET /app/stock-items/:id`) · `check/`
(Stock check) — each renders nothing; this page reads the URL (`useStockDialogRoute`) and opens the drawer
over the list (D24), with a clinic vendor stacked on it from the Supplier picker. A create takes
`stock_item:create`, Stock check `stock_item:update`; an unknown or deleted id goes back to the list with
"Item not found".

## Row actions

With `stock_item:update`: Use (the Use popover at the row's button; out of stock: "D-Tan Mask is out of
stock"), Receive stock, Log usage… and Adjust count — each opens the movement drawer on its type, with no
URL (`POST /app/stock-items/:id/movements`; the toast's Undo reverts it as "Logged by mistake"). Edit
always (read-only without update). Delete with `stock_item:delete`: only an item with nothing in stock goes
(`409 item_has_stock`), so one with stock toasts "adjust it to 0 first" and asks nothing; at zero it asks
for a reason, then "… removed" + Undo. The popover and the drawer show the item as the list now has it, so
a move refused because someone used some since (`409 not_enough_stock` — the room read again) shows what is
really on the shelf.

## Files

| File                         | Responsibility                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `items.route.tsx`            | Route marker — exports `Component` rendering `ItemsPage`.                                                  |
| `items.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-stock`.                                 |
| `items.params.ts`            | The list read from the URL (the tab's own sort keys, a Lasts tier's day bound) and its filter key.         |
| `ItemsPage.tsx`              | The tab: the toolbar, the table, its row actions and states; the drawers, popover and confirm.             |
| `hooks/useStockItemColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the hidden Supplier and Last rate. |

## Test ids

`stock-items-page`; the shared toolbar and table ids prefixed `stock-items` (`stock-items-new` for "+ New
item", `stock-items-view-action-check` for Stock check, `stock-items-row-action-{use,receive,log,adjust,edit,delete}`).
