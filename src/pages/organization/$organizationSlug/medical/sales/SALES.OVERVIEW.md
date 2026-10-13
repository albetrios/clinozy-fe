# `pages/organization/$organizationSlug/medical/sales` — Medical › Sales

Route: `/organization/$organizationSlug/medical/sales` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every sale (`medical.md:25–39`): Sale · Customer (the patient with the "P" badge, or a Medical contact) · Medicines (and their batches) · Bill (less what came back) · Margin (hidden) · Status ("Returned", then Paid / Unpaid) · When. The row edge is sage when paid, blush when unpaid. Filters: Status (All · Unpaid · Returned) · Created; the footer counts the sales. A row opens the read-only Sale. Row actions (L-50c): "Collect ₹563" on an unpaid sale — its due as one UPI receipt on the ledger, "₹563 received" with Undo (Q-M1) · "Return medicines" · "Print" (the sale's invoice on the A4 sheet) · "Void sale" on an unpaid sale with nothing paid or returned (Admin with `void`; Q-M2). With Status All the view action "Prescriptions to fill" lists the unfilled prescriptions; picking one opens New sale on it. With Status Unpaid the view action "Send payment reminders" (L-64, Q-M6) lists each customer the unpaid sales name, the largest due first, with WhatsApp — their chat opens with the reminder typed, in English (Q-X2) — Call and Copy; messaging is not built, so nothing is sent from here and nothing says it was.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New sale — the shared Invoice drawer with the type locked to Medical, on `?prescription=&customer=`; it closes back to `from` — Today's Dispense — else to the list) · `$saleId/` (the Sale: Collect, Void, Return medicines) · `$saleId/return/` (Return from patient) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24).

## Files

| File                              | Responsibility                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sales.route.tsx`                 | Route marker — exports `Component` rendering `SalesPage`.                                               |
| `sales.manifest.ts`               | Manifest — `kind: 'layout'` over its dialog routes, module `app-medical`.                               |
| `sales.params.ts`                 | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `SalesPage.tsx`                   | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useSaleColumns/`           | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |
| `hooks/useSaleActions/`           | What a sale offers by its state and the member's access; Collect with its Undo; Print.                  |
| `components/SaleDrawer/`          | The read-only Sale: badges, medicines, Collect / Return medicines / Void.                               |
| `components/SaleReturnDrawer/`    | Return from patient in two steps, its form's rules (`components/SaleReturnDrawer/sale-return-form.ts`). |
| `components/PrescriptionsToFill/` | The view action's list of unfilled prescriptions.                                                       |
| `components/PaymentReminders/`    | Unpaid's view action: who owes, each with WhatsApp (the reminder typed), Call and Copy.                 |

## Test ids

`medical-sales-page`; the shared toolbar and table ids prefixed `medical-sales`; the row actions
`medical-sales-row-action-<collect|return|print|void>`; `sale-drawer`, `sale-return-drawer`,
`prescriptions-to-fill` (behind `medical-sales-view-action-prescriptions`), `payment-reminders`
(behind `medical-sales-view-action-reminders`; `-summary`, `-row`), New sale's `invoice-drawer`.
