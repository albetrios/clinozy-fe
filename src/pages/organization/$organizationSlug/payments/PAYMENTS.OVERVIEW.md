# `pages/organization/$organizationSlug/payments` — Payments

Route: `/organization/$organizationSlug/payments`. One ledger of the money in and out, the
pending credits and the daily cash close (KICKOFF §6.9). The bare URL is the ledger itself
(D24, `S:84`).

Gated like every clinic room: membership (`organization:read`) and the `app-payments`
module, then `requireOrgStatus`. In the room the ledger, Receive, Send, an entry's edit and Reverse
answer from the member's own clinozy-be codes (`@/shared/hooks/usePaymentAccess/`; under View-as the
previewed role's matrix): `payment:read` sees the ledger and Day close; without `payment:create`,
Pay and Receive (and the phone pills) hide; without `payment:update` an entry opens view only and
the row Edit goes; without `payment:delete` the row Delete and Reverse go; Export needs
`payment:export`.

## The ledger (L-39) — on clinozy-be

The shared room toolbar (`RoomToolbar`, layout `actions`): h1 "Payments" · the tabs
Payments · Pending (route links — `/payments` and `/payments/pending` — that fold into
"More" when the measured space runs out) · search "Patient, payee or PAY- number" (the API's `q`
finds the person — name, mobile, contact number — the payee or the number, never an invoice
number) · saved views · Filters (Show — All by default — · What · Mode · Created) · Columns ·
"Day close" · the paired "Pay" (outline, red ↗) and "Receive". On a phone: the search row, then the
tabs with "Day close", and Pay + Receive as floating pills.

Under it the shared `DataTable` over `GET /app/payments` (cursor pages of 50, `useLedgerList`):
Ref · What · When · From / to · Mode · Amount · By — receipts, refunds, expenses, supplier bills,
money back and reversals, newest first; nothing sorts. Money is rupees as the API sends it. The
row's 3px edge is the What tone; a reversal's What reads "Reversal". When carries the meta line
from `md` (What · When · Amount at 820), From / to on a phone, with Amount the key column. An edited
entry says "Edited 1× · last ₹600 UPI → ₹700 UPI" under its time (`edit_count`, `last_edit`). From /
to names the person (the P chip) or the payee over the sub line built from the numbers the API
joins onto each row: "Invoice #5", "Sale · Invoice #3", "Refund · Credit note CN-001", "Stock PO #8 · bill ZZ-0001", "Medical PO #431", "From CR-1", the note, and "Reversed" once a
reversal undid it. A reversal of money out names nobody on the API: it takes the name of the entry
it undid when that entry is loaded. By is the team directory's member for `created_by_membership_id`
(one cached read). The footer counts the entries (`estimated_total`, one `limit=1` read —
`useLedgerCount`); "All entries loaded" at the end. Selection and the bulk bar from `md`: Export as
CSV of the selected rows (signed rupees, the full date).

An open day's receipt, expense or supplier bill opens its drawer (`$paymentId/edit`) and offers Edit
and Delete; a refund or a reversal only Delete (its money is another write's — a click says "PAY-9 ·
its amount can't change"); a pending credit's entry nothing ("PAY-6 · From CR-1"). A closed day's
entry (`is_settled`) answers its click with "PAY-305 · Day closed" and offers **Reverse** once
(`POST /app/payments/:id/reverse`, `shared/components/PaymentReverseConfirm/`): the reason confirm,
"PAY-305 reversed · PAY-16" — the reversal lands today at the entry's branch. Delete is the shared
reason confirm — "Delete this payment?", the entry in the grey pill, the ledger's reasons, its invoice "goes back to ₹250 due" for a receipt — optimistic, with Undo for 10s; a `409 day_closed` or
`more_than_paid` closes it and says why.

The filters and search live in the URL (`payments.search.ts`); a filter change shows the
skeleton over the rows, a failed read keeps the last copy and toasts "Retry"; a first read that
fails shows the error in place with Retry. While Day close is open the ledger lists only its day.

## Pending (`pending/`)

The room's second tab is a page of its own — a child folder on disk, a sibling route
(`payments/pending`) in the route tree, so the ledger never renders under it. See
`pending/PENDING.OVERVIEW.md`.

## Dialog routes

A layout island over four URL-driven dialogs (D24), each a direct child whose route renders
nothing — this page reads the URL (`hooks/usePaymentsDialogRoute/`) and opens the drawer
over the ledger:

- `receive/` — Receive payment, prefilled from `?patient=&invoice=`. Opened from another room
  (`from`, `safeReferrer`) it opens over that room, which stays behind it (A-P1): the app's
  cross-room host renders `components/PaymentsDrawers/`'s `PaymentsDialogHost` there.
- `pay/` — Send payment, on `?bill=<mpo_… | spur_…>` (the purchase's public id).
- `$paymentId/edit/` — the entry's drawer while its day is open: a receipt in Receive, money
  out in Send. A closed day's entry goes back to the ledger with "PAY-5509 · Day closed", a
  pending credit's ("PAY-5601 · From CR-2", it is the credit's), a refund's or a reversal's
  (its money is fixed), an unknown one with "Payment not found · it may have been deleted"
  (`S:115`).
- `day-close/` — Day close on `?date=` (default today) and `?branch=`; its drawer loads as it
  opens (`lazy`).

A member without `payment:create` who follows a Receive or Pay link lands back on the ledger with
the permission toast.

**Receive payment** (`components/ReceivePaymentDrawer/`, L-39b) — `POST /app/payments`
(`kind: receipt`), 560px, one section, "Who is paying": Branch (two or more open branches) ·
Patient (the shared `PatientPicker` — the drawers' contact picker over patients only, its quick add
registering a new one; the receipt names their contact) · Against
invoice (their open ones, `GET /app/invoices?patient_id=&payment_status=unpaid,partial`, oldest
first; picking a patient takes the oldest and its due; tapping the picked one again is an advance,
"Total ₹500 · advance") · the Mode · Amount rows (the shared `SplitRowsField`, compact, "+ Split · add
a mode"; the rows hold paise, the write sends rupees) · Reference (≤ 60) · Note (≤ 280); Quick fill
Full / Half / Cash + UPI once an invoice is picked. Save checks a patient, then an amount, then at
most the invoice's due; the server's `409 more_than_due` outlines the rows. An edit keeps the
entry's patient and invoice (its own amount back on the due) and sends only what changed with the
read's `updated_at`.

**Send payment** (`components/SendPaymentDrawer/`, L-39b) — `POST /app/payments`, 680px in steps:
"Pay against a bill" (new, while bills are open — Clinic stock's with `stock_item:read`, Medical's
with `medicine:read`; the bill picker and "Pending longest"; a failed read offers Retry) ·
"Expense" (Category — or the bill, which takes none — Paid to, its chips the clinic's four most
recent payees from its expenses then "Electricity", feat-write-less D14 — Note) · "Payment" (Amount, Date —
never ahead, fixed on an edit — Mode, the bill photo). A bill pays as `supplier_bill` with its
`stock_purchase_id` or `medical_purchase_order_id` and the supplier as payee; other spend as
`expense` in its category. The photos upload through the tray and file onto the saved entry's
`attachment_keys` one after another
(`components/SendPaymentDrawer/send-attachments.ts`). Quick fill and "Add & another" on a new
payment; Delete on an edit (`payment:delete`).

Either drawer: a save over a newer change (`409 record_changed`) offers Reload, which reads the
entry again and starts the form over on it (`useEditingRecord`); a day closed while it is open
(`409 day_closed`) turns it view only. The pending drawers live on Pending
(`pending/PENDING.OVERVIEW.md`).

**Day close** (`components/DayCloseDrawer/`, L-41) on clinozy-be (`/app/day-closes`) — the
1040px record drawer on the canvas (full screen on a phone), no footer — its actions sit in the
bar; the ledger behind lists only its day. The bar picks the day (today back 120 days), shows the
state ("Open", "Open · auto-closes in 14 h", "Closed by Riya S.", "Force-closed"), "6 entries on
Oct 3", yesterday's open-day chip while today shows, "Previous closes ⌄" (its chips jump to their
day) and "Close day". The day runs **gate → working → report**: the gate accepts the opening cash
— the carried opening (the last close's count), ₹0 for a branch's first day, or a recount; the
working day shows the server's cash in · out, the expected cash, the net by mode and each
member's net, and a count that is off asks why; the report shows the opening, cash in · out with
the day's entries each way, the count, the server's difference, the net by mode, and "What
happened" from the server's events by kind, with Reopen and its reason. "Review every entry"
lists the day's entries (no ticks, §6 #16) with Edit / Delete on an open day and Reverse on a
closed one (Q-G11); it re-grids to the phone layout below a 910px card (`@container`). A row
opens the entry's drawer over Day close. Accept and Close day need `payment:update`, Reopen
`payment:delete`; the drawer opens with `payment:read`. Its own overview:
`day-close/DAY_CLOSE.OVERVIEW.md`.

The data is the shared money domain on clinozy-be: `@/shared/api/app/payments-api.ts`,
`@/shared/api/app/invoices-api.ts`, `@/shared/api/app/credits-api.ts` and
`@/shared/api/app/day-close-api.ts`, their contracts beside them, and the hooks in
`@/shared/hooks/usePayments/` and `@/shared/hooks/useCredits/`. Medical › Payments and Credits
read the store's own slice through the same modules (`GET /app/medical-payments`,
`GET /app/medical-pending-credits`).

## Files

| File                                                 | Responsibility                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments.route.tsx`                                 | Route marker — exports `Component` rendering `PaymentsPage`.                                                                                                                                                                                                                          |
| `payments.manifest.ts`                               | Manifest — `kind: 'layout'` over `receive`, `pay`, `$paymentId/edit`, `day-close` and `pending`; permission `organization:read`, module `app-payments`, nav section `payments`.                                                                                                       |
| `payments.search.ts`                                 | URL schemas (`validateSearch`): the ledger's `direction`, `kind`, `mode`, `created`, `q`. Rides the entry chunk; the list read doesn't.                                                                                                                                               |
| `payments.dialog-search.ts`                          | Receive's, Pay's and Day close's params — their routes keep the raw values, `usePaymentsDialogRoute` parses them; loads with the room.                                                                                                                                                |
| `payments.params.ts`                                 | The ledger read from the URL — `ledgerListParamsOf` (the header's branches, Day close's day) — off the entry chunk.                                                                                                                                                                   |
| `payments.constants.ts`                              | `PAYMENTS_NS` / `PAYMENTS_KEYS` (the `payments` namespace), both table ids and the ledger's Filters fields.                                                                                                                                                                           |
| `PaymentsPage.tsx`                                   | The ledger — toolbar, table, states, row and bulk actions, the delete confirm; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="payments-page"`.                                                                                                                  |
| `shared/components/PaymentsToolbar/`                 | Family-shared: the room toolbar both tabs mount — h1, the tab links, search, Filters, Columns, Day close and the tab's create actions.                                                                                                                                                |
| `shared/hooks/useDayLabel/`                          | Family-shared: a day as the drawers' tiles name it — "Today", else "Oct 2" (Send's Date, Add pending's Settle by and invoice days).                                                                                                                                                   |
| `components/DayCloseDrawer/`                         | Day close: the bar, the gate, the working strip and its net by mode, the report and its reopen confirm, the review, and the rules they share (`components/DayCloseDrawer/day-close-view.ts`).                                                                                         |
| `components/ReceivePaymentDrawer/`                   | Receive payment / Edit payment in: the form's rules (`components/ReceivePaymentDrawer/receive-form.ts`), the fields, the save, the refusals and Reload.                                                                                                                               |
| `components/SendPaymentDrawer/`                      | Send payment / Edit payment out: the form's rules (`components/SendPaymentDrawer/send-form.ts`), the three steps' fields, the save, the photos (`components/SendPaymentDrawer/send-attachments.ts`).                                                                                  |
| `components/PaymentsDrawers/`                        | The drawer the URL names, and `PaymentsDialogHost` for Receive over another room; Day close loads as it opens.                                                                                                                                                                        |
| `hooks/useDayClose/`                                 | Day close's read and writes: the day, accept the opening, close, reopen.                                                                                                                                                                                                              |
| `hooks/usePaymentsDialogRoute/`                      | Which dialog the URL opens, the closed-day and permission refusals, and the close back to the referrer or the ledger.                                                                                                                                                                 |
| `__tests__/integration/`                             | The ledger end to end (`__tests__/integration/payments-ledger.test.tsx`, over `__tests__/integration/payments-ledger-data.ts`); `__tests__/integration/payments-test-router.tsx` mirrors the family's routes and signs a member in. Pending's run under `pending/` (its own harness). |
| `receive/`, `pay/`, `$paymentId/edit/`, `day-close/` | The dialog-route islands — see their overviews.                                                                                                                                                                                                                                       |
| `pending/`                                           | The Pending tab — see its overview.                                                                                                                                                                                                                                                   |

The ledger's own units live in the shared layer, because Medical › Payments shows the same ledger
limited to Medical (L-50c): the cells and their words (`src/shared/components/LedgerCells/`, keys
`LEDGER_KEYS` in the `payments` namespace — `PAYMENTS_KEYS` composes them), the delete confirm
(`src/shared/components/PaymentDeleteConfirm/`), the reverse confirm
(`src/shared/components/PaymentReverseConfirm/`), the table (`src/shared/hooks/useLedgerTable/`,
under its table id), the row actions (`src/shared/hooks/useLedgerRowActions/`) and the gates
(`src/shared/hooks/usePaymentAccess/`). The Filters' values are `LEDGER_FILTER_VALUES`
(`src/shared/api/app/ledger-filter-values.ts`).

## Test ids

`payments-page`; the shared toolbar's and table's under the `payments` table id —
`payments-toolbar`, `payments-tabs`, `payments-tab-<ledger|pending>`, `payments-search`,
`payments-filters-trigger`, `payments-columns-trigger`, `payments-day-close`,
`payments-pay`, `payments-receive` (the toolbar buttons and the phone pills in `payments-fab`),
`payments-table`, `payments-table-row`, `payments-row-action-<edit|delete|reverse>`,
`payments-table-footer`, `payments-table-bulk-export`, `retry-button` on a failed first read; the
delete and reverse confirms' `confirm-…`; the drawers the dialog routes open: `receive-drawer`
(`receive-drawer-invoice-retry` when the open invoices can't be read), `pay-drawer`
(`pay-drawer-bill-label`, `pay-drawer-bill-retry`), `day-close-drawer`
(`docs/reference/e2e-testids-inventory.md` › Payments).
