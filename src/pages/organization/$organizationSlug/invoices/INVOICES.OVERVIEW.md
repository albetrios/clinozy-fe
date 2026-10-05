# `pages/organization/$organizationSlug/invoices` — the shared Invoice drawer's routes

Route: `/organization/$organizationSlug/invoices` (`S:92–94`; KICKOFF §4, §6.9, D24). The island
has no page of its own: its routes are URL-driven dialogs over a referrer. The Payments ledger
stands behind them — `src/app/routes/routeTree.tsx` renders `PaymentsPage` beside this island's host, the §4
default (deviation A-P1, as L-38) — and `?from=` names the room that opened the drawer, where it
closes to (`safeReferrer`; else the ledger).

Gated like the Payments room, the money domain: membership (`organization:read`) and the
`clinic-payments` module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come
from `useClinicAccess`. A member without Payments Create who follows a create link lands on the
ledger with the permission toast; an invoice that is gone answers "Invoice not found · it may
have been deleted" (`S:115`).

## Dialog routes

Each child renders nothing — the host (`InvoicesLayout.tsx`) reads the URL through
`hooks/useInvoicesDialogRoute/` and opens:

- `create/` — New invoice (the shared `InvoiceDrawer`), prefilled from `?type=&patient=`
  (`S:92`).
- `$invoiceId/` — the invoice's preview: the shared `PrintPreview` (820) holding its A4 sheet
  (`InvoicePrint`, the Remark on it) with "Print / Save PDF" (`S:93`).
- `$invoiceId/edit/` — Edit invoice, the same drawer on the saved invoice (`S:94`).

The drawer itself is shared — `@/shared/components/InvoiceDrawer/` — because the Medical room
opens it as New sale and the patient file, Today and ⌘K open it too. Its data is the shared
money domain: `@/shared/api/clinic/invoices-api.ts` (fixture world, `REPLACE_WITH_API`) and
`@/shared/hooks/useInvoices/`; the arithmetic is `@/shared/api/clinic/clinic-money.ts` (Q-G7).

## Files

| File                                             | Responsibility                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `invoices.route.tsx`                             | Route marker — exports `Component` rendering `InvoicesLayout`.                               |
| `invoices.manifest.ts`                           | Manifest — `kind: 'layout'`, children `create`, `$invoiceId`.                                |
| `invoices.search.ts`                             | URL params — `?from=` on every invoice route (entry chunk).                                  |
| `invoices.dialog-search.ts`                      | New invoice's `?type=&patient=` — parsed by `useInvoicesDialogRoute`; loads with the drawer. |
| `InvoicesLayout.tsx`                             | The host — the drawer or the preview the URL names; nothing at the bare URL.                 |
| `hooks/useInvoicesDialogRoute/`                  | Reads the URL into the dialog, reads the invoice, closes to `from`.                          |
| `__tests__/integration/invoices-test-router.tsx` | Test harness — the island's routes in a memory router.                                       |

## Test ids

`invoice-drawer` (create, edit) and `invoice-preview` (the preview, with `-close` and `-print`)
— their parts are listed in `docs/reference/e2e-testids-inventory.md`.
