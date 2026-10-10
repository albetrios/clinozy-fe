# `pages/organization/$organizationSlug/invoices` — the shared Invoice drawer's routes

Route: `/organization/$organizationSlug/invoices` (`S:92–94`; KICKOFF §4, §6.9, D24). The island
has no page of its own: its routes are URL-driven dialogs over a referrer. Opened from another
room — `?from=` on the referrer allow-list — the drawer opens over that room, which stays mounted
behind it with its guards and search, while the URL bar shows the drawer's own route (A-P1): the
app's cross-room host (`src/app/routes/CrossRoomDialogs.tsx`) renders this island's host there,
and `hooks/useInvoicesDialogRoute/` reads the drawer's route from it. Otherwise the Payments ledger
stands behind it — `src/app/routes/routeTree.tsx` renders `PaymentsPage` beside this island's
host, the §4 default — and closing goes to `from`, else the ledger.

Gated like the Payments room, the money domain: membership (`organization:read`) and the
`clinic-payments` module, then `requireOrgStatus`; in-room View / Create / Edit / Delete are the
member's `payment:read` / `payment:create` / `payment:update` / `payment:delete` codes
(`canPayment` from the drawer's barrel — View as falls back to the fixture matrix). A member
without `payment:create` who follows a create link lands on the ledger with the permission toast;
an invoice that is gone — or an id that is no clinozy-be public id (`invc_…`), never sent —
answers "Invoice not found · it may have been deleted" (`S:115`). While the invoice is read the
host shows the drawer's skeleton (`invoice-drawer-skeleton`); a read that fails for another
reason shows Retry in the drawer.

## Dialog routes

Each child renders nothing — the host (`InvoicesLayout.tsx`) reads the URL through
`hooks/useInvoicesDialogRoute/` and opens:

- `create/` — New invoice (the shared `InvoiceDrawer`), prefilled from `?type=&patient=`
  (`S:92`). On `?copyOf=` it opens as a copy of a saved invoice, once that invoice is read: the
  patient file's "Copy invoice" (`patient-file.md:43`). It takes the invoice's party, team,
  lines, discount and remark, dated today with nothing paid (`copiedInvoiceForm`), and its
  save says "Copied as #788" (H:5017). A copy of an invoice that is gone answers "Invoice not
  found"; the invoice is not read for a member without Payments Create.
- `$invoiceId/` — the invoice's preview: the shared `PrintPreview` (820) holding its A4 sheet
  (`InvoicePrint`, the Remark on it) with "Print / Save PDF" (`S:93`) — the saved invoice as
  `GET /app/invoices/{invoice_id}` returns it, the clinic's name and the branch's phone and GSTIN
  from `GET /tenancy/organization` and `GET /app/branches/my`.
- `$invoiceId/edit/` — Edit invoice, the same drawer on the saved invoice (`S:94`).

The drawer itself is shared — `@/shared/components/InvoiceDrawer/` — because the Medical room
opens it as New sale and the patient file, Today and ⌘K open it too. A clinic or consultation
invoice is clinozy-be's (`@/shared/api/clinic/invoices-api.ts`, `@/shared/hooks/useInvoices/`):
the server prices every line — the best live offer at the branch and date, never under the
lowest price (#159) — and the drawer shows its preview (`POST /app/invoices/preview`, an edit's
`POST /app/invoices/{invoice_id}/preview`) as the member types, never its own sums. The save is
`POST /app/invoices` with "Paid now" as one receipt, or `PATCH /app/invoices/{invoice_id}` with
what changed and the read's `updated_at`. Medical's New sale stays on the fixture world
(`@/shared/api/clinic/invoices-fixture-api.ts`, its sums in `@/shared/api/clinic/clinic-money.ts`;
D153 seam).

## Files

| File                                             | Responsibility                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `invoices.route.tsx`                             | Route marker — exports `Component` rendering `InvoicesLayout`.                               |
| `invoices.manifest.ts`                           | Manifest — `kind: 'layout'`, children `create`, `$invoiceId`.                                |
| `invoices.search.ts`                             | URL params — `?from=` on every invoice route (entry chunk).                                  |
| `invoices.dialog-search.ts`                      | New invoice's `?type=&patient=` — parsed by `useInvoicesDialogRoute`; loads with the drawer. |
| `InvoicesLayout.tsx`                             | The host — the drawer or the preview the URL names, its skeleton or Retry while it reads.    |
| `hooks/useInvoicesDialogRoute/`                  | Reads the URL into the dialog, reads the invoice (`invc_…` ids only), closes to `from`.      |
| `__tests__/integration/invoices-test-router.tsx` | Test harness — the island's routes in a memory router.                                       |

## Test ids

`invoice-drawer` (create, edit), `invoice-drawer-skeleton` (the drawer while the invoice is read)
and `invoice-preview` (the preview, with `-close` and `-print`) — their parts are listed in
`docs/reference/e2e-testids-inventory.md`.
