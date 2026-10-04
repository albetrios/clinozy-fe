# `pages/organization/$organizationSlug/invoices/create` — New invoice

Route: `/organization/$organizationSlug/invoices/create` (`S:92`) — a URL-driven dialog over its
referrer (KICKOFF §4, D24). The route renders nothing: the invoices island reads the URL and
opens the shared Invoice drawer. `?type=clinic|medical|consultation&patient=` prefill it and
`?from=` keeps the room it was opened from — parsed by `validateInvoiceCreateSearch` in the
parent's `../invoices.search.ts`. Without Payments Create the link lands on the ledger with the
permission toast.

## Files

| File                 | Responsibility                                                             |
| -------------------- | -------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewInvoicePage` (nothing).   |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, test id `invoice-drawer` (the drawer it opens). |
| `NewInvoicePage.tsx` | Renders `null` — the drawer opens on the parent island's host.             |

## Test ids

`invoice-drawer` — the drawer the island opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
