# `pages/organization/$organizationSlug/users/create` — New user

Route: `/organization/$organizationSlug/users/create` — a URL-driven dialog over the Team
(KICKOFF §4, §6.12, D24; `S:105`). The route renders nothing: the Users page reads the URL
and opens the user drawer over the Team, so a refresh or a shared link reopens it. New user
sends an invitation — no admin-set password (D17): the membership takes Admin when Admin is
picked, else the main role's clinozy-be role, else the least-privileged one (Member, then
Viewer; D47), and the clinic roles, branches, hours and pay go on the staff profile. Gated
like the room — `membership:read` and the `clinic-users` module, then `requireOrgStatus`;
"New user" itself needs `invitation:manage` and `membership:manage` (clinozy-be's invite
route asks for the second, D47) — without them the link lands back on the Team with the
permission toast. The drawer is the island's `../components/UserDrawer/`, opened by the
page through `../hooks/useUsersDialogRoute/`.

## Files

| File                 | Responsibility                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewUserPage`.                                       |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `membership:read`, module `clinic-users`, title "New user". |
| `NewUserPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Users page.                 |

## Test ids

`user-drawer` — the drawer the Users page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › User drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
