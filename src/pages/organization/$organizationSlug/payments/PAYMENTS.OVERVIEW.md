# `pages/organization/$organizationSlug/payments` — Payments

Route: `/organization/$organizationSlug/payments`. One ledger of the money in and out, the
pending credits and the daily cash close (KICKOFF §6.9). The bare URL is the ledger itself
(D24, `S:84`).

Gated like every clinic room: membership (`organization:read`) and the `clinic-payments`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7): without Create, Pay and Receive (and the phone pills)
hide; without Edit the row Edit goes; without Delete the row Delete goes; Export follows
the `export` ability.

## The ledger (L-39)

The shared room toolbar (`RoomToolbar`, layout `actions`): h1 "Payments" · the tabs
Payments · Pending (route links — `/payments` and `/payments/pending` — that fold into
"More" when the measured space runs out) · search "Patient, invoice or receipt" · saved
views · Filters (Show — All by default — · What · Mode · Created) · Columns · "Day close" ·
the paired "Pay" (outline, red ↗) and "Receive". On a phone: the search row, then the tabs
with "Day close", and Pay + Receive as floating pills.

Under it the shared `DataTable`: Ref · What · When · From / to · Mode · Amount · By —
receipts, refunds, expenses, supplier bills and money back, newest first; nothing sorts.
The row's 3px edge is the What tone. When carries the meta line from `md` (What · When ·
Amount at 820), From / to on a phone, with Amount the key column. An edited entry says
"Edited 1× · last ₹600 UPI → ₹700 UPI" under its time. Selection and the bulk bar from `md`
(Export as CSV); infinite scroll over cursor pages, "All entries loaded".

An open day's entry opens its drawer (`$paymentId/edit`) and offers Edit and Delete; a
closed day's (`dayCloseId` set — the fixture's auto-close job closes every past day but
yesterday, Q-G2) answers its click with "PAY-305 · Day closed" and offers no actions.
Delete is the shared reason confirm — "Delete this payment?", the entry in the grey pill,
the ledger's reasons, "Invoice #785 goes back to ₹1,300 due" for a receipt — optimistic,
with Undo for 10s.

The filters and search live in the URL (`payments.search.ts`); a filter change shows the
skeleton over the rows, a failed read keeps the last copy and toasts "Retry". While Day
close is open the ledger lists only its day.

## Pending (`pending/`)

The room's second tab is a page of its own — a child folder on disk, a sibling route
(`payments/pending`) in the route tree, so the ledger never renders under it. See
`pending/PENDING.OVERVIEW.md`.

## Dialog routes

A layout island over four URL-driven dialogs (D24), each a direct child whose route renders
nothing — this page reads the URL (`hooks/usePaymentsDialogRoute/`) and opens the drawer
over the ledger:

- `receive/` — Receive payment, prefilled from `?patient=&invoice=`; `from` keeps the room
  it came from behind it and is where it closes to (A-P1, `safeReferrer`).
- `pay/` — Send payment, on `?bill=md:<poId>|is:<purchaseId>`.
- `$paymentId/edit/` — the entry's drawer while its day is open; a closed day's entry goes
  back to the ledger with "PAY-5509 · Day closed", an unknown one with "Payment not found ·
  it may have been deleted" (`S:115`).
- `day-close/` — Day close on `?date=` (default today) and `?branch=`.

A member without Create who follows a Receive or Pay link lands back on the ledger with
the permission toast. The drawers land with their rows — Receive and Send payment
(L-39b), the pending drawers (L-39c), Day close (L-41); until then the routes open nothing.

The data is the shared money domain: `@/shared/api/clinic/payments-api.ts`,
`@/shared/api/clinic/credits-api.ts` and `@/shared/api/clinic/day-close-api.ts` (fixture
world, `REPLACE_WITH_API`), their contracts beside them, and the hooks in
`@/shared/hooks/usePayments/` and `@/shared/hooks/useCredits/`.

## Files

| File                                                 | Responsibility                                                                                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments.route.tsx`                                 | Route marker — exports `Component` rendering `PaymentsPage`.                                                                                                                       |
| `payments.manifest.ts`                               | Manifest — `kind: 'layout'` over `receive`, `pay`, `$paymentId/edit`, `day-close` and `pending`; permission `organization:read`, module `clinic-payments`, nav section `payments`. |
| `payments.search.ts`                                 | URL schemas (`validateSearch`): the ledger's `direction`, `kind`, `mode`, `created`, `q`; Receive's, Pay's and Day close's params. Rides the entry chunk; the list read doesn't.   |
| `payments.params.ts`                                 | The ledger read from the URL — `ledgerListParamsOf` (the header's branches, Day close's day) — off the entry chunk.                                                                |
| `payments.constants.ts`                              | `PAYMENTS_NS` / `PAYMENTS_KEYS` (the `payments` namespace), both table ids and the ledger's Filters fields.                                                                        |
| `PaymentsPage.tsx`                                   | The ledger — toolbar, table, states, row and bulk actions, the delete confirm; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="payments-page"`.               |
| `shared/components/PaymentsToolbar/`                 | Family-shared: the room toolbar both tabs mount — h1, the tab links, search, Filters, Columns, Day close and the tab's create actions.                                             |
| `components/LedgerCells/`                            | The cells and their wording (`components/LedgerCells/ledger-cells.ts`): Ref, What, When with the edit line, From / to with its sub line, Mode, the signed Amount, By.              |
| `components/PaymentDeleteConfirm/`                   | Delete an entry: the reason confirm, the invoice sentence, the optimistic delete and its Undo.                                                                                     |
| `hooks/useLedgerTable/`                              | The columns (tracks, folds, the meta line and key column by tier), hidden columns, the row tone.                                                                                   |
| `hooks/usePaymentsDialogRoute/`                      | Which dialog the URL opens, the closed-day and permission refusals, and the close back to the referrer or the ledger.                                                              |
| `__tests__/integration/`                             | The ledger and Pending end to end; `__tests__/integration/payments-test-router.tsx` mirrors the family's routes for the tests.                                                     |
| `receive/`, `pay/`, `$paymentId/edit/`, `day-close/` | The dialog-route islands — see their overviews.                                                                                                                                    |
| `pending/`                                           | The Pending tab — see its overview.                                                                                                                                                |

## Test ids

`payments-page`; the shared toolbar's and table's under the `payments` table id —
`payments-toolbar`, `payments-tabs`, `payments-tab-<ledger|pending>`, `payments-search`,
`payments-filters-trigger`, `payments-columns-trigger`, `payments-day-close`,
`payments-pay`, `payments-receive` (the toolbar buttons and the phone pills in `payments-fab`),
`payments-table`, `payments-table-row`, `payments-row-action-<edit|delete>`,
`payments-table-bulk-export`; the delete confirm's `confirm-…`; the drawers the dialog
routes open: `receive-drawer`, `pay-drawer`, `day-close-drawer`
(`docs/reference/e2e-testids-inventory.md` › Payments).
