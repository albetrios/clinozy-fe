# `pages/organization/$organizationSlug/stock/movements` — Clinic stock › Movements

Route: `/organization/$organizationSlug/stock/movements` (KICKOFF §6.8, L-51). Same gates as the Clinic
stock room.

Every stock change, newest first, read from clinozy-be (`GET /app/stock-item-movements`, `clinic-stock.md:57–71`):
Type (Used blush · Received sage · Adjust sky · Damaged butter · Returned lav · Opening stock mint · Reverted
stone; a reverted entry adds a grey "Reverted") · Item / party and its note · When ("Today", "25 Sep") · By ·
Change ("− 1 tube", "+ 24 bottle"; grey once reverted). The item and the author are joined from the room's item
catalogue and the team directory (one cached read each per page, never one per row): an entry whose item was
deleted reads "Deleted item" with its bare figure, one logged by a member who has left shows no avatar. The note:
what a use was for and its remark ("LHR · Dharti Galani · 15 g"; "Stock check" on a count's adjust); a receipt's
"From purchase #16 · bill AP-1042" (the server's `stock_purchase_number` and `bill_number`) opens that purchase;
a Reverted entry's "Reverts used of Today · Logged by mistake" (the server's `reverts_type`, `reverts_created_at`
and `revert_reason`; "Other" shows what was typed — a purchase delete's reverts carry "Purchase #2 deleted").
There are no payment rows — the API keeps a purchase's payments in Payments.

Nothing sorts, no row opens, there is no create and no search — clinozy-be does not search movements; the
Item filter narrows them to one item. The footer counts the entries (`stockListSummary('movements', …)` →
`estimated_total`, "20 entries"). On a phone the Item / party leads with the Change as its key. Filters: Item
(one item, a searchable picker over the item catalogue — `stock_item_id`) · Type (all seven `type` values,
fixed) · Created. A first read that fails shows the error in place with Retry; a later failure keeps the last
copy with the rooms' list-error toast.

"Revert" — a red row action for whoever may move stock (`stock_item:update`), on an entry neither reverted nor
itself a revert, whose item is still in the room — opens `StockRevertConfirm` ("Revert this movement?", reasons
Logged by mistake · Wrong item · Wrong quantity · Other with its note). clinozy-be answers with the Reverted
entry; the toast reads "Used reverted · … back to 4 pack" from its balance. A revert has no Undo. A refusal —
`409 already_reverted` (reverted meanwhile) or `409 not_enough_stock` (taking a receipt back would go below
zero) — closes the confirm, says why and refreshes the list.

## Files

| File                             | Responsibility                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `movements.route.tsx`            | Route marker — exports `Component` rendering `MovementsPage`.                                  |
| `movements.manifest.ts`          | Manifest — `kind: 'leaf'`, module `app-stock`.                                                 |
| `movements.params.ts`            | The list read from the URL (`type`, `item`, `created`) and its filter key; no search, no sort. |
| `MovementsPage.tsx`              | The tab: the toolbar and its Filters (Item, Type, Created), the table, its states and Revert.  |
| `hooks/useStockMovementColumns/` | The columns: tracks, folds (the meta line and the phone key), the note and the purchase link.  |

The Revert confirm is family-shared: `../shared/components/StockRevertConfirm/` — the confirm, and which rows
can be reverted (`isRevertable`).

## Test ids

`stock-movements-page`; `stock-movements-purchase` (a receipt's "From purchase …" link); the shared toolbar and
table ids prefixed `stock-movements` (`stock-movements-filters-trigger`, `stock-movements-filters`,
`stock-movements-filters-apply`, `stock-movements-table-row`, `stock-movements-row-action-revert`,
`stock-movements-table-footer`, `stock-movements-table-end`).
