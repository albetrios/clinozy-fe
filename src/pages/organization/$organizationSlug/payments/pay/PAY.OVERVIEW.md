# `pages/organization/$organizationSlug/payments/pay` — Send payment

Route: `/organization/$organizationSlug/payments/pay` (`S:86`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Send payment drawer over itself. `?bill=<mpo_… | spur_…>` — the purchase's public id, its prefix the kind — opens it on that supplier bill (Medical and Clinic stock "Pay ₹X", Q-M1); a bill no longer open is ignored and the member picks one — parsed by `validatePaymentPaySearch` in the parent's `../payments.dialog-search.ts`.
The drawer records money out on clinozy-be (`POST /app/payments`): a supplier bill as `supplier_bill`
with its purchase and no category, other spend as `expense` in its category.
Gated like the room — membership (`organization:read`) and the `app-payments` module, then
`requireOrgStatus`; in-room, `payment:create` (`usePaymentAccess`); the bills shown follow
`stock_item:read` and `medicine:read`.

## Files

| File                  | Responsibility                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `pay.route.tsx`       | Route marker — exports `Component` rendering `SendPaymentPage` (nothing).    |
| `pay.manifest.ts`     | Manifest — `kind: 'leaf'`, test id `pay-drawer` (the drawer the page opens). |
| `SendPaymentPage.tsx` | Renders `null` — the dialog opens on the parent page.                        |

## Test ids

`pay-drawer` — the drawer the Payments ledger opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
