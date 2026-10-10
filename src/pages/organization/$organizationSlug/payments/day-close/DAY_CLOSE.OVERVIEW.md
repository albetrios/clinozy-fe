# `pages/organization/$organizationSlug/payments/day-close` — Day close

Route: `/organization/$organizationSlug/payments/day-close` (`S:91`) — a URL-driven dialog over the Payments ledger (KICKOFF §4, D24).
The route renders nothing: the Payments ledger reads the URL and opens the Day close drawer (`../components/DayCloseDrawer/`, L-41) over itself — the ledger behind it listing only the reviewed day. `?date=YYYY-MM-DD` (default today; a later day reads as today) and `?branch=` (a branch's public id; else the header's one branch, the member's own from the team directory, the main one — Q-G6) — parsed by `validateDayCloseSearch` in the parent's `../payments.dialog-search.ts`. Picking another day keeps it in the URL.
Gated like the room — membership (`organization:read`) and the `clinic-payments` module, then
`requireOrgStatus`; in-room access is the member's `payment:*` codes (`usePaymentAccess`).

## On clinozy-be (L-60)

The drawer reads and writes `/app/day-closes` through `useDayClose` (`../hooks/useDayClose/`,
over `@/shared/api/clinic/day-close-api.ts`). Every figure is the server's, in rupees:

| Step                    | Route                                                                                                                                    | Code             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| The day                 | `GET /app/day-closes?branch_id=&close_date_from=&close_date_to=` + the closed and open days + `GET /app/payments?branch_id=&paid_date_*` | `payment:read`   |
| Accept the opening cash | `POST /app/day-closes` (`carried`, or `recounted` + `opening_cash`)                                                                      | `payment:update` |
| Close the day           | `POST /app/day-closes/{day_close_id}/close` (`counted_cash`, `difference_reason` when the count is off)                                  | `payment:update` |
| Reopen it               | `POST /app/day-closes/{day_close_id}/reopen` (`reason`, from the reason confirm)                                                         | `payment:delete` |

- **The gate** shows what accepting would carry — the last close's count before the day, ₹0 for a
  branch's first (no default float, §6 #17) — with a Recount box.
- **The working day** shows the server's `cash_in` / `cash_out`, `expected_cash` (live while open),
  `net_by_mode` and `by_member` (each member's entry count and net). The difference pill is a
  preview of the count being typed; a count that is off asks why under the strip, and clinozy-be
  refuses a close without it (its `400` lands on the field).
- **The report** shows the opening, cash in · out with the day's entries each way, the counted and
  expected cash, the server's `difference` ("Not counted" for a day the worker auto-closed,
  `close_kind: auto`), the net by mode, and "What happened" — the server's `events`, worded by
  `kind` and the day's figures; the English `text` is read only for a reopen's reason (PAY-M4).
- **Refusals** read in the room's words and re-read the day: a day someone opened meanwhile
  (`409 record_already_exists`), closed meanwhile (`409 transition_not_allowed` on close) or
  reopened meanwhile (`409 transition_not_allowed` on reopen).
- **Removed:** "Mark as checked" and its progress bar (§6 #16 — clinozy-be keeps no per-entry
  check), the default float (§6 #17), the per-mode in/out tooltip and the "collected / paid out"
  totals across modes (the server sends the net by mode and the cash in and out only — G-P14).
- The review lists the day's entries; a row opens the entry's drawer (view only without
  `payment:update`), an open day's entry offers Edit / Delete and a closed day's Reverse
  (`payment:delete`), as on the ledger.

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
