# `pages/organization/$organizationSlug/payments/day-close` — Day close

Route: `/organization/$organizationSlug/payments/day-close` (`S:91`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Day close drawer over itself — the ledger behind it listing only the reviewed day. `?date=YYYY-MM-DD` (default today) and `?branch=` — parsed by `validateDayCloseSearch` in the parent's `../payments.search.ts`.
Gated like the room — membership (`organization:read`) and the `clinic-payments` module, then
`requireOrgStatus`; in-room access is `useClinicAccess`.

## Files

| File                    | Responsibility                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `day-close.route.tsx`   | Route marker — exports `Component` rendering `DayClosePage` (nothing).             |
| `day-close.manifest.ts` | Manifest — `kind: 'leaf'`, test id `day-close-drawer` (the drawer the page opens). |
| `DayClosePage.tsx`      | Renders `null` — the dialog opens on the parent page.                              |

## Test ids

`day-close-drawer` — the drawer the Payments ledger opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md`. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
