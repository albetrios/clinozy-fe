# `pages/organization/$organizationSlug/payments/pending/$creditId/edit` — Edit pending

Route: `/organization/$organizationSlug/payments/pending/$creditId/edit` (`S:90`) — a URL-driven dialog over Payments › Pending (KICKOFF §4, D24).
The route renders nothing: the Pending page reads the URL — the credit by its public id (`GET /app/pending-credits/{pending_credit_id}`) — and opens the Edit pending drawer (`../../components/CreditDrawer/`) over itself, only while nothing of the credit is settled (the API refuses a change after the first settlement, `409 credit_settled`). An unknown or deleted id opens nothing: the URL goes back to `/payments/pending` with "Pending not found · it may have been deleted" (`S:115`); a settled credit goes back with its state named ("CR-1 · Received"), a part-settled one with "CR-1 · ₹50 settled · it can’t change now".
Gated like the room — membership (`organization:read`) and the `app-payments` module, then
`requireOrgStatus`; in-room, the member's `payment:update` edits (else the drawer only shows the
credit) and `payment:delete` deletes (`usePaymentAccess`). A save sends only what changed with the
read's `updated_at` (`PATCH`); a save over a newer change offers Reload.

## Files

| File                  | Responsibility                                                                  |
| --------------------- | ------------------------------------------------------------------------------- |
| `edit.route.tsx`      | Route marker — exports `Component` rendering `EditPendingPage` (nothing).       |
| `edit.manifest.ts`    | Manifest — `kind: 'leaf'`, test id `credit-drawer` (the drawer the page opens). |
| `EditPendingPage.tsx` | Renders `null` — the dialog opens on the parent page.                           |

## Test ids

`credit-drawer` — the drawer the Pending page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
