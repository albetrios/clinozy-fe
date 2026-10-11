# `pages/organization/$organizationSlug/payments/$paymentId/edit` — Edit payment

Route: `/organization/$organizationSlug/payments/$paymentId/edit` (`S:87`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the entry's drawer over itself — Receive payment for money in, Send payment (`pay-drawer`) for money out — only while its day is open and the entry is one they record (a receipt, an expense, a supplier bill): a closed day sends the URL back to the ledger with "PAY-5509 · Day closed" (it is reversed from its row instead), an entry a pending credit settled with "PAY-5601 · From CR-2" — it is the credit's — and a refund or a reversal with "PAY-9 · its amount can't change". A save sends only what changed with the read's `updated_at` (`PATCH /app/payments/:id`); `409 record_changed` offers Reload. An unknown or deleted id opens nothing: the URL goes back to `/payments`, the ledger's filters kept, with "Payment not found · it may have been deleted" (`S:115`).
Gated like the room — membership (`organization:read`) and the `app-payments` module, then
`requireOrgStatus`; in-room, without `payment:update` (`usePaymentAccess`) the drawer opens view only.

## Files

| File                  | Responsibility                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| `edit.route.tsx`      | Route marker — exports `Component` rendering `EditPaymentPage` (nothing).        |
| `edit.manifest.ts`    | Manifest — `kind: 'leaf'`, test id `receive-drawer` (the drawer the page opens). |
| `EditPaymentPage.tsx` | Renders `null` — the dialog opens on the parent page.                            |

## Test ids

`receive-drawer` — the drawer the Payments ledger opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
