# `pages/organization/$organizationSlug/invoices/$invoiceId/edit` — Edit invoice

Route: `/organization/$organizationSlug/invoices/$invoiceId/edit` (`S:94`) — a URL-driven dialog
over its referrer (KICKOFF §4, D24). The route renders nothing: the invoices island reads the URL
and opens the shared Invoice drawer on the saved invoice — its number in the header, Print, and
Delete for a role with `void`. A Medical sale keeps its medicines read only (`S:51`); a role
without Payments Edit sees it view only.

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
