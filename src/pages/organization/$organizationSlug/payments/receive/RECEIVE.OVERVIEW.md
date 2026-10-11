# `pages/organization/$organizationSlug/payments/receive` — Receive payment

Route: `/organization/$organizationSlug/payments/receive` (`S:85`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Receive payment drawer over itself. `?patient=&invoice=` prefill it (an invoice's "Record payment" in the patient file's Invoices, ⌘K "New receipt") and a `from` naming another room opens it over that room instead, which stays behind it while the URL bar shows this route (A-P1, `useAppNavigate`) — parsed by `validatePaymentReceiveSearch` in the parent's `../payments.dialog-search.ts`.
The drawer records the receipt on clinozy-be (`POST /app/payments`, `kind: receipt`) against one of
the patient's open invoices, or none (an advance); `?patient=` is the patient file's public id
(`pat_…`), `?invoice=` an invoice's (`invc_…`).
Gated like the room — membership (`organization:read`) and the `app-payments` module, then
`requireOrgStatus`; in-room, `payment:create` (`usePaymentAccess`) — without it the link lands back on
the ledger with the permission toast.

## Files

| File                     | Responsibility                                                                   |
| ------------------------ | -------------------------------------------------------------------------------- |
| `receive.route.tsx`      | Route marker — exports `Component` rendering `ReceivePaymentPage` (nothing).     |
| `receive.manifest.ts`    | Manifest — `kind: 'leaf'`, test id `receive-drawer` (the drawer the page opens). |
| `ReceivePaymentPage.tsx` | Renders `null` — the dialog opens on the parent page.                            |

## Test ids

`receive-drawer` — the drawer the Payments ledger opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
