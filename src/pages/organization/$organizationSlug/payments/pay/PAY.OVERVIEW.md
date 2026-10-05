# `pages/organization/$organizationSlug/payments/pay` — Send payment

Route: `/organization/$organizationSlug/payments/pay` (`S:86`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Send payment drawer over itself. `?bill=md:<poId>` or `?bill=is:<purchaseId>` opens it on that supplier bill (Medical and Clinic stock "Pay ₹X", Q-M1) — parsed by `validatePaymentPaySearch` in the parent's `../payments.dialog-search.ts`.
Gated like the room — membership (`organization:read`) and the `clinic-payments` module, then
`requireOrgStatus`; in-room access is `useClinicAccess`.

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
