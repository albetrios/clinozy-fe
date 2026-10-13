# `pages/organization/$organizationSlug/users/create` — New user

Route: `/organization/$organizationSlug/users/create` — a URL-driven dialog over the Team
(KICKOFF §4, §6.12, D24; `S:105`). The route renders nothing: the Users page reads the URL
and opens the user drawer over the Team, so a refresh or a shared link reopens it. New user
sends an invitation by email — no admin-set password, and no name: the person sets their own
(D17). One call (`POST /tenancy/organization/memberships`, one idempotency key per save) carries
every role picked — the first is the main role — and the clinic details: mobile, colour,
branches (the one open branch when there is one), days, hours and commission. An email already
in the clinic (`409 membership_already_exists`) outlines Email. Gated like the room —
`membership:read` and the `app-users` module, then `requireOrgStatus`; "New user" itself needs
`membership:create` and `role:read` — without them the link lands back on the Team with the
permission toast. The drawer is the island's `../components/UserDrawer/`, opened by the
page through `../hooks/useUsersDialogRoute/`.

## Files

| File                 | Responsibility                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewUserPage`.                                    |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `membership:read`, module `app-users`, title "New user". |
| `NewUserPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Users page.              |

## Test ids

`user-drawer` — the drawer the Users page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › User drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
