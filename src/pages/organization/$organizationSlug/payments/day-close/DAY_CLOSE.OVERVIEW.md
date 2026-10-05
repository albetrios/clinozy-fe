# `pages/organization/$organizationSlug/payments/day-close` — Day close

Route: `/organization/$organizationSlug/payments/day-close` (`S:91`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Day close drawer (`../components/DayCloseDrawer/`, L-41) over itself — the ledger behind it listing only the reviewed day. `?date=YYYY-MM-DD` (default today; a later day reads as today) and `?branch=` (else the header's one branch, the member's own, the main one — Q-G6) — parsed by `validateDayCloseSearch` in the parent's `../payments.dialog-search.ts`. Picking another day keeps it in the URL.
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
