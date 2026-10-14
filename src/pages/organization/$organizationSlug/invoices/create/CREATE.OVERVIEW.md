# `pages/organization/$organizationSlug/invoices/create` — New invoice

Route: `/organization/$organizationSlug/invoices/create` (`S:92`) — a URL-driven dialog over its
referrer (KICKOFF §4, D24). The route renders nothing: the invoices island reads the URL and
opens the shared Invoice drawer. `?type=clinic|consultation&patient=` prefill it — never
`medical`: a medical bill is the Medical room's New sale and clinozy-be refuses one on
`/app/invoices` (MD28), so `?type=medical` is dropped and the drawer opens on Clinic —
`?appointment=` (the visit flow's "Create invoice from visit", D156) fills its lines with the
visit's sessions still to bill (`GET /app/patients/:patient_id/treatments?appointment_id=
&is_billed=false`, one line per offering carrying them), `?copyOf=` starts it as a copy, and
`?from=` keeps the room it was opened from — parsed by `validateInvoiceCreateSearch` in the
parent's `../invoices.dialog-search.ts`. The patient is read for their contact (the invoice's
`contact_id`); each line the member adds is priced by the server's preview as they type; the
save is `POST /app/invoices`, with "Paid now" as one receipt for a member with `payment:create`.
Without `payment:create` the link lands on the ledger with the permission toast.

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
