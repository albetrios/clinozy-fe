# `pages/organization/$organizationSlug/medical` — Medical

Route: `/organization/$organizationSlug/medical`. The in-house medicine store: medicines with
batches and expiry, sales to patients and Medical contacts, purchase orders, suppliers,
manufacturers, MRs and the Medical slice of the payments ledger (KICKOFF §6.7; the intake’s Medical spec).

Gated like every clinic room: membership (`organization:read`) and the `app-medical`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useAppAccess` (KICKOFF §3.7) — without Create the split "New" and the tabs' "New …" hide,
without Edit the row actions that change a record go.

## The room (L-50)

A layout over seven literal tab routes (D24): `sales/` (where `/medical` lands, D25) ·
`medicines/` · `purchases/` · `suppliers/` · `manufacturers/` · `mrs/` · `payments/`. Each tab
renders the family's Medical toolbar and its table:

- **Toolbar** (`shared/components/MedicalToolbar/`): h1 "Medical" · the seven tabs on the shared
  room tabs folding into "More ⌄" when the measured space runs out (the current tab alone beside
  "More" on a phone; More's list grouped Selling · Stock · Buying · Money) · search · saved views
  · Filters · Columns · the tab's view action · the split "+ New <thing>" whose "⌄" Create menu
  holds every other create, grouped Selling · Stock · Buying. A create opens over its own tab
  (a standing deviation, §6.7).
- **Tables** (`shared/components/MedicalTable/`): the shared table with folds on a tablet and
  rows on a phone, selection and the bulk bar from `md` (Export as CSV), infinite scroll over
  cursor pages, the footer count and the end line, and the blush empty state with the tab's
  "New …".
- **Data**: medicines are the shared `@/shared/api/app/medicines-api.ts` (the Invoice and Rx
  drawers read them) with their stock rules in `@/shared/api/app/medicine-stock.ts`; the
  rest is the family's `shared/medical-api.ts` over the fixture world (`REPLACE_WITH_API`).

## The drawers (L-50b)

Each tab page reads its dialog routes (`shared/hooks/useMedicalDialogRoute/`, the shared
`useRoomDialogRoute` over the Medical section: a create with its prefill, or a record — an unknown id
goes back to the list with "<Record> not found") and opens
its drawer over the list, on the shared record drawer:

- **Medicine** (`shared/components/MedicineDrawer/`, 840px): "Medicine, price & stock" — Name,
  Manufacturer, Composition, Sold with; the price panel (MRP incl. GST, the GST rate, the live
  split and margin) and the stock levels — then "Batches & supplier prices".
- **Supplier** (560px new, 840px editing with its Account), **Manufacturer** (560px; its links are
  written on the suppliers and MRs), **MR** (560px), and Log MR visit (the MRs tab's own).
- **Stacked children** (`shared/hooks/useMedicalStack/`, `shared/components/MedicalStackHost/`):
  a picker's "New <thing> · “q”" + "full details" opens that record's drawer on top, named from
  the picker; Esc, Back, × and the backdrop close only the child; its save picks the new record.
  The pickers (`shared/components/MedicalPartnerPicker/`, `shared/hooks/useMedicalPickers/`) also
  quick-add a record from their create row.
- **Delete** (`shared/components/MedicalDeleteConfirm/`): the shared reason confirm; "<name>
  deleted" offers Undo.

The partners' writes are `shared/medical-partners-api.ts` (contracts in
`shared/medical-partners-contracts.ts`; hooks in `shared/hooks/useMedicalPartners/`); a medicine's
are the shared `useMedicines` hooks.

## The flows (L-50c)

- **Sales** (`sales/`): New sale is the shared Invoice drawer with the type locked to Medical
  (`createSale`, stock by earliest expiry), on `?prescription=&customer=`, closing back to `from`
  (Today's Dispense) or the list; the Sale view, Collect (one UPI receipt on the ledger, Undo),
  Print (the invoice on the A4 sheet), Return from patient (stock back or written off; a refund
  and its credit note when paid) and Void (`shared/components/MedicalFlowConfirm/`, Q-M2; Undo for
  10s puts the sale, its invoice and its stock back, L-64); the "Prescriptions to fill" view action.
- **Purchases** (`purchases/`): New / Edit purchase order ("⚡ Reorder low stock"), Receive goods
  (each arrived line a batch of qty + free; its expiry asked for), the received or paid view, and
  Cancel order (Undo for 10s puts it back to Ordered, L-64). Every PO payment goes through
  Payments › Send payment — "Pay ₹2,980" on a row and
  the view, "Pay all received" with Stage Received, a supplier's "Pay ₹827" on its row and in its
  drawer's Quick fill — via the shared `usePayBill` (`?bill=md:<poId>`, Q-M1).
- **Medicines**: "Return expiring stock to supplier" (`medicines/components/ExpiringReturnDrawer/`,
  no URL) — the batch drops, the supplier gives a credit that lowers its payable and joins its
  Account (`shared/medical-supplier-credits.ts`, Appendix F).
- **Payments**: the shared ledger units with `scope=medical` (`listMedicalPayments`, `S:1662`).

The flows' writes are `shared/medical-flows-api.ts` (contracts in
`shared/medical-flows-contracts.ts`; hooks in `shared/hooks/useMedicalFlows/`), money through the
ledger's `newLedgerEntry` and Day close's `assertDayOpen` (REPLACE_WITH_API).

The search, filters and sort of every tab live in the URL (`medical.search.ts`, one reader for
all tabs, on the entry chunk); each tab's list read is its own `<tab>.params.ts`.

## Files

| File                       | Responsibility                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medical.route.tsx`        | Route marker — exports `Component` rendering `MedicalLayout`.                                                                                                                               |
| `medical.manifest.ts`      | Manifest — `kind: 'layout'` over the seven tabs, module `app-medical`, nav section `medical`.                                                                                               |
| `medical.constants.ts`     | `MEDICAL_NS` / `MEDICAL_KEYS` (the `medical` namespace) and the tabs' table ids.                                                                                                            |
| `medical.search.ts`        | The tabs' URL reader (`validateMedicalSearch`).                                                                                                                                             |
| `medical.dialog-search.ts` | The create drawers' prefills — parsed by `useMedicalDialogRoute`; loads with the room.                                                                                                      |
| `MedicalLayout.tsx`        | Layout over the tab routes (`<Outlet />`).                                                                                                                                                  |
| `shared/`                  | Family-shared: contracts, api, tones, filters, params; the toolbar, table and cells; the drawers, pickers, stack, delete and flow confirms; the list, partner, flow and dialog-route hooks. |
| `__tests__/integration/`   | The tabs end to end; `__tests__/integration/medical-test-router.tsx` mirrors the family's routes.                                                                                           |

## Test ids

`medical-page`; each tab's `medical-<tab>-page` and the shared toolbar and table ids prefixed
`medical-<tab>` (`medical-sales-toolbar`, `medical-sales-tab-medicines`, `medical-sales-new`,
`medical-sales-new-menu`, `medical-sales-table-row`); the view action
`medical-<tab>-view-action-<id>`; the drawers `medicine-drawer`, `supplier-drawer`,
`manufacturer-drawer`, `rep-drawer`, `rep-visit-drawer` (a stacked child adds `-stacked`),
`purchase-order-drawer`, `receive-goods-drawer`, `purchase-order-view-drawer`, `sale-drawer`,
`sale-return-drawer`, `expiring-return-drawer`, New sale's `invoice-drawer`, and the
`prescriptions-to-fill` list.
