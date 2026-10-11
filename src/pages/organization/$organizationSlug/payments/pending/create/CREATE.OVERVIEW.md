# `pages/organization/$organizationSlug/payments/pending/create` — Add pending

Route: `/organization/$organizationSlug/payments/pending/create` (`S:89`) — a URL-driven dialog over Payments › Pending (KICKOFF §4, D24).
The route renders nothing: the Pending page reads the URL and opens the Add pending drawer (`../components/CreditDrawer/`) over itself. `?direction=give|take` picks Which way (the "⌄" menu's Give and Take): it is Pending's own `direction` filter (`S:88`), parsed by `validatePendingSearch` in the parent's `../pending.search.ts` — one key, read by both, so naming exactly one way prefills the drawer.
Gated like the room — membership (`organization:read`) and the `app-payments` module, then
`requireOrgStatus`; in-room, Add pending needs the member's `payment:create` (`usePaymentAccess`) —
without it the link lands back on Pending with the permission toast. The drawer adds the credit
with `POST /app/pending-credits`.

## Files

| File                 | Responsibility                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewPendingPage` (nothing).        |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, test id `credit-drawer` (the drawer the page opens). |
| `NewPendingPage.tsx` | Renders `null` — the dialog opens on the parent page.                           |

## Test ids

`credit-drawer` — the drawer the Pending page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
