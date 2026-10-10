# `pages/organization/$organizationSlug/invoices/$invoiceId/edit` — Edit invoice

Route: `/organization/$organizationSlug/invoices/$invoiceId/edit` (`S:94`) — a URL-driven dialog
over its referrer (KICKOFF §4, D24). The route renders nothing: the invoices island reads the URL
and opens the shared Invoice drawer on the saved invoice — its number in the header, the
server's preview of the change (`POST /app/invoices/{invoice_id}/preview`), Print, and Delete
with a reason and Undo for a member with `payment:delete` (`409 invoice_paid` keeps an invoice
with money on it). The save sends only what changed, the lines kept by id, with the read's
`updated_at`; someone else's save first answers with Reload. A Medical sale's invoice and a
settled one (a payment on a closed day) open read-only with the reason above the steps; a
member without `payment:update` sees it view only.

## Files

| File                  | Responsibility                                                             |
| --------------------- | -------------------------------------------------------------------------- |
| `edit.route.tsx`      | Route marker — exports `Component` rendering `EditInvoicePage` (nothing).  |
| `edit.manifest.ts`    | Manifest — `kind: 'leaf'`, test id `invoice-drawer` (the drawer it opens). |
| `EditInvoicePage.tsx` | Renders `null` — the drawer opens on the island's host.                    |

## Test ids

`invoice-drawer` — the drawer the island opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
