# `pages/organization/$organizationSlug/stock/items` — Clinic stock › Items

Route: `/organization/$organizationSlug/stock/items` (KICKOFF §6.8, L-51) — where `/stock` lands. Same
gates as the Clinic stock room.

Every consumable and piece of equipment (`clinic-stock.md:25–39`): ID · Item (and "per tube of 30 g ·
uses ~0.5/week") · Category (pill in its tone) · Stock ("3 tube · 90 g · OK" over a bar of stock ÷
maximum) · Lasts ("~6 weeks", "~5 days" or "No usage"; ≤ 7 days blush, ≤ 21 butter, else sage) ·
Supplier (hidden by default). The row edge is the stock level; the footer has no count. On a phone the
Item leads with the Category pill as its key; at 820 Item and Category stay and the rest fold. Filters:
Stock (All · Low stock) · the automatic Category and Lasts sections · Created. A row opens Edit item;
"Stock check" and "+ New item" show for those who keep the stock.

The search, filters and sort live in the URL (`../stock.search.ts`); the list read follows them — a sort
keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton. A failed read
keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New item, `?name=`) · `$itemId/edit/` (Edit item) · `check/` (Stock check) — each renders
nothing; this page reads the URL (`useStockDialogRoute`) and opens the drawer over the list (D24), with a
clinic vendor stacked on it from the Supplier picker. A create or Stock check takes keeping the stock;
an unknown id goes back to the list with "Item not found".

## Row actions

Use (the Use popover at the row's button; out of stock: "D-Tan Mask is out of stock") and Log usage…
for whoever uses stock; Receive stock and Adjust count for those who keep it — each opens the movement
drawer on its type, with no URL; Edit; Delete (Stock Delete) asks for a reason, then "… removed" + Undo.

## Files

| File                         | Responsibility                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `items.route.tsx`            | Route marker — exports `Component` rendering `ItemsPage`.                                      |
| `items.manifest.ts`          | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-stock`.                     |
| `items.params.ts`            | The list read from the URL (the tab's own sort keys) and its filter key.                       |
| `ItemsPage.tsx`              | The tab: the toolbar, the table, its row actions and states; the drawers, popover and confirm. |
| `hooks/useStockItemColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.   |

## Test ids

`stock-items-page`; the shared toolbar and table ids prefixed `stock-items` (`stock-items-view-action-check`
for Stock check).
