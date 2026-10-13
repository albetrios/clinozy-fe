# `pages/organization/$organizationSlug/medical` — Medical

Route: `/organization/$organizationSlug/medical`. The in-house medicine store: medicines with
batches and expiry, sales to any contact, purchase orders, suppliers, manufacturers, MRs, the
store's slice of the payments ledger and its credits (KICKOFF §6.7; the intake’s Medical spec), on
clinozy-be's medical store (its routes-final §11 rev 2 — D168).

Gated like every clinic room: membership (`organization:read`) and the `app-medical`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useAppAccess` (KICKOFF §3.7) — without Create the split "New" and the tabs' "New …" hide,
without Edit the row actions that change a record go.

## The room (L-50)

A layout over eight literal tab routes (D24): `sales/` (where `/medical` lands, D25) ·
`medicines/` · `purchases/` · `suppliers/` · `manufacturers/` · `mrs/` · `payments/` · `credits/`
(clinozy-be D90). Each tab
renders the family's Medical toolbar and its table:

- **Toolbar** (`shared/components/MedicalToolbar/`): h1 "Medical" · the eight tabs on the shared
  room tabs folding into "More ⌄" when the measured space runs out (the current tab alone beside
  "More" on a phone; More's list grouped Selling · Stock · Buying · Money) · search · saved views
  · Filters · Columns · the tab's view action · the split "+ New <thing>" whose "⌄" Create menu
  holds every other create, grouped Selling · Stock · Buying. A create opens over its own tab
  (a standing deviation, §6.7).
- **Tables** (`shared/components/MedicalTable/`): the shared table with folds on a tablet and
  rows on a phone, selection and the bulk bar from `md` (Export as CSV), infinite scroll over
  cursor pages, the footer count and the end line, and the blush empty state with the tab's
  "New …".
- **Data** (clinozy-be, the stock room's four files — D154, clinozy-be D91): medicines are the
  shared `@/shared/api/app/medicines-api.ts` / `@/shared/api/app/medicines-contracts.ts` (the Invoice and Rx
  drawers read them) with their stock rules in `@/shared/api/app/medicine-stock.ts`; the rest is
  the family's `shared/medical-contracts.ts` (wire schemas and rows — rupees, expiry `MM/YY`),
  `shared/medical-api.ts` (reads: pages of 50 keyed by the organization, catalogues through
  `collectAllPages`), `shared/medical-records-contracts.ts` and `shared/medical-records-api.ts`
  (writes, an idempotency key each); the hooks `useMedicalLists`, `useMedicalFlows`,
  `useMedicalPartners`. Forms keep paise and convert at the edge.

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

The partners' writes are `shared/medical-records-api.ts` (hooks in
`shared/hooks/useMedicalPartners/`); a medicine's are the shared `useMedicines` hooks.

## The flows (L-50c)

- **Sales** (`sales/`): New sale is the shared Invoice drawer in sale mode — the room passes its
  write (`POST /app/medical-sales`; the server takes stock by earliest expiry) — on
  `?prescription=&customer=`, closing back to `from` (Today's Dispense) or the list; the Sale view,
  Collect (a receipt on the ledger, `payment:create`; Undo with `payment:delete`), Print (the live
  invoice on the A4 sheet), Return from patient (`payment:delete`, a sale paid in full; stock back
  or written off; refunded in cash, UPI or card, or kept as store credit — clinozy-be MD33) and Void
  (`shared/components/MedicalFlowConfirm/`; Undo for 10s puts the sale, its invoice and its stock
  back); the "Prescriptions to fill" view action and Send payment reminders
  (`GET /app/medical-sales/dues`).
- **Purchases** (`purchases/`): New / Edit purchase order ("⚡ Reorder low stock"), Receive goods
  (each arrived line a batch of qty + free; its expiry asked for), the received or paid view, and
  Cancel order (Undo for 10s puts it back to Ordered, L-64); a line not on the order is received
  too (clinozy-be MD26). Every PO payment goes through Payments › Send payment — "Pay ₹2,980" on a
  row and the view, a supplier's "Pay ₹827" at its oldest open order — via the shared `usePayBill`
  (Q-M1); "Pay all received" opens Suppliers filtered `payable=owed` (D168).
- **Medicines**: "Return expiring stock to supplier" (`medicines/components/ExpiringReturnDrawer/`,
  no URL) — a supplier credit under its supplier (`POST /app/suppliers/:supplier_id/credits`): the
  batch drops, the credit lowers the supplier's payable and joins its Account.
- **Payments** (`payments/`): the store's slice of the ledger (`GET /app/medical-payments`, clinozy-be
  MD31) — Edit, Delete and Undo, Reverse, Export.
- **Credits** (`credits/`, clinozy-be D90): supplier credits with Void and Undo, and the customers'
  credits on sales (`GET /app/medical-pending-credits`).

The flows' writes are `shared/medical-records-api.ts` (hooks in `shared/hooks/useMedicalFlows/`);
money goes through the ledger's own routes, and a closed day answers `409 day_closed`.

The search, filters and sort of every tab live in the URL (`medical.search.ts`, one reader for
all tabs, on the entry chunk); each tab's list read is its own `<tab>.params.ts`.

## Files

| File                       | Responsibility                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medical.route.tsx`        | Route marker — exports `Component` rendering `MedicalLayout`.                                                                                                                               |
| `medical.manifest.ts`      | Manifest — `kind: 'layout'` over the eight tabs, module `app-medical`, nav section `medical`.                                                                                               |
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
