# `pages/organization/$organizationSlug/medical/sales` — Medical › Sales

Route: `/organization/$organizationSlug/medical/sales` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every sale on clinozy-be (`GET /app/medical-sales`, `medical.md:25–39`; api-integration §5.5 M5): Sale · Customer (the patient with the "P" badge, or a Medical contact) · Medicines (the batches the server drew) · Bill (less what came back) · Margin (hidden; the server's) · Status ("Returned", then Paid / Unpaid by the server's due) · When. Money is the API's rupees. The row edge is sage when paid, blush when unpaid. Filters: Status (All · Unpaid · Paid · Returned) · Created; sorts Sale · Customer · Bill; the footer counts the sales. A row opens the read-only Sale — a sale is never edited (MD19). Row actions (L-50c): "Collect ₹563" on a sale still owing — its due as one UPI receipt on the ledger (`payment:create`), "₹563 received" with Undo for a member who deletes payments (Q-M1) · "Return medicines" on a sale paid in full (`payment:delete`, MD23, MD24) · "Print" (the sale's invoice on the A4 sheet) · "Void sale" on an unpaid sale with nothing paid or returned (`medicine:delete`; Q-M2), its toast's Undo the restore. With Status All the view action "Prescriptions to fill" lists the approved prescriptions no sale filled; picking one opens New sale on its patient's contact and the prescription. With Status Unpaid the view action "Send payment reminders" (L-64, Q-M6; `GET /app/medical-sales/dues`) lists each customer the unpaid sales name, the largest due first, with WhatsApp — their chat opens with the reminder typed, in English (Q-X2) — Call and Copy; messaging is not built, so nothing is sent from here and nothing says it was.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New sale — the shared Invoice drawer with the type locked to Medical and the room's write, `POST /app/medical-sales` — the server draws the batches by earliest expiry and prices the lines; on `?prescription=&customer=` (the buyer's contact, or a patient's file); it closes back to `from` — Today's Dispense — else to the list) · `$saleId/` (the Sale: Collect, Void, Return medicines) · `$saleId/return/` (Return from patient) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24).

## Files

| File                              | Responsibility                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sales.route.tsx`                 | Route marker — exports `Component` rendering `SalesPage`.                                                     |
| `sales.manifest.ts`               | Manifest — `kind: 'layout'` over its dialog routes, module `app-medical`.                                     |
| `sales.params.ts`                 | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.                    |
| `SalesPage.tsx`                   | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`.       |
| `hooks/useSaleColumns/`           | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.                  |
| `hooks/useSaleActions/`           | What a sale offers by its state and the member's access; Collect with its Undo; Print.                        |
| `components/SaleDrawer/`          | The read-only Sale: badges, medicines, Collect / Return medicines / Void.                                     |
| `components/SaleDrawers/`         | The drawer the URL names: New sale (the Invoice drawer and the room's write), the Sale, the return.           |
| `components/SaleReturnDrawer/`    | Return from patient — refund or Store credit — its rules (`components/SaleReturnDrawer/sale-return-form.ts`). |
| `components/PrescriptionsToFill/` | The view action's list of unfilled prescriptions.                                                             |
| `components/PaymentReminders/`    | Unpaid's view action: who owes, each with WhatsApp (the reminder typed), Call and Copy.                       |

## Test ids

`medical-sales-page`; the shared toolbar and table ids prefixed `medical-sales`; the row actions
`medical-sales-row-action-<collect|return|print|void>`; `sale-drawer`, `sale-return-drawer`,
`prescriptions-to-fill` (behind `medical-sales-view-action-prescriptions`), `payment-reminders`
(behind `medical-sales-view-action-reminders`; `-summary`, `-row`), New sale's `invoice-drawer`.
