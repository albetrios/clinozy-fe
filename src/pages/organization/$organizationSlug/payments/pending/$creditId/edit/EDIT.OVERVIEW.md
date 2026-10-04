# `pages/organization/$organizationSlug/payments/pending/$creditId/edit` — Edit pending

Route: `/organization/$organizationSlug/payments/pending/$creditId/edit` (`S:90`) — a URL-driven dialog over Payments › Pending (KICKOFF §4, D24).
The route renders nothing: the Pending page reads the URL and opens the Edit pending drawer (`../../components/CreditDrawer/`) over itself, only while the credit is open. An unknown or deleted id opens nothing: the URL goes back to `/payments/pending` with "Pending not found · it may have been deleted" (`S:115`); a settled credit goes back the same way.
Gated like the room — membership (`organization:read`) and the `clinic-payments` module, then
`requireOrgStatus`; in-room access is `useClinicAccess`.

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
