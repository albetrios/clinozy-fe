# `pages/organization/$organizationSlug/users` — Users

Route: `/organization/$organizationSlug/users` — the Users room (KICKOFF §6.12), the
single members surface (D17; the spec is the intake's users.md). The bare URL is its first tab, the Team: clinozy-be's memberships
(every page read up front), each carrying the member's clinic details — mobile, colour, branches,
days, hours and commission — searched, filtered and sorted in place. Its children are URL-driven dialogs over the Team (D24): New user
(`create/`, an invitation — never an admin-set password) and the member drawer
(`$userId/edit/`, keyed by membership id) — and the other tabs, Roles & access (`roles/`) and
Branches (`branches/`), registered beside the Team in the route tree. A member opened from a role page
(`?from=roles`) keeps Roles & access behind the drawer, and closing it returns to that role.

Gated on `membership:read` and the `app-users` module, then `requireOrgStatus`. In-room, the
Users section follows the member's clinozy-be codes (D17): "New user" needs `membership:create`
and `role:read` (its role picker); edit, status and "Resend invitation" need `membership:update`;
removing a member and cancelling an invitation need `membership:delete`; Export needs only
`membership:read`. Each tab shows with its own code — Team `membership:read`, Roles & access
`role:read`, Branches `branch:read` — and the tab you are on always shows. View-as narrows it all
to the previewed role's codes. Never a
Delete on your own row or the owner's: your own row and drawer offer **Leave clinic** instead
(`components/UserLeaveConfirm/`) — any member but the owner, through clinozy-be's self-service
`POST /organization/leave`; the row leaves at once, the membership after the 10s Undo, then the
session context is dropped and you land on your clinics (`/organization`).

It is the single members surface (D17): where the room is open to the member, Settings › Members
and Settings › Roles render a link here (`shared/components/SettingsModal/organization/UsersRoomLink.tsx`) instead
of their panels. Each Settings capability has its place: invite → "New user"; resend / cancel an
invitation → the drawer's invitation line / Delete; change role, suspend → the drawer's Roles and
Status; remove → Delete; leave the clinic yourself → Leave clinic; create, rename, describe, set
the permissions of and delete a role → Roles & access. Where the room is off or shut to the member, Settings keeps its panels.

The toolbar (h1, the tab links, search, Filters, Columns, "New user" — the floating pill on a
phone) is family-shared in `shared/components/UsersToolbar/`, with the role directory
(`shared/hooks/useRoleDirectory/`, each role's name and tone), Roles & access itself
(`shared/components/RolesAccess/`), "New role" (`shared/hooks/useNewRole/`) and the words for
days and hours (`shared/hooks/useHoursFormat/`).

## Files

| File                              | Responsibility                                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users.route.tsx`                 | Route marker — exports `Component` rendering `UsersPage`.                                                                                                                                                         |
| `users.manifest.ts`               | Manifest — `kind: 'layout'`, children `create`, `$userId`, `roles`, `branches`; `membership:read`, module `app-users`, nav `users`.                                                                               |
| `users.search.ts`                 | `validateUsersSearch` (`q`, `role` — a role id, `branch`, `status`, `created`, `sort`), `validateRolesSearch` (`role`, a role id).                                                                                |
| `users.dialog-search.ts`          | `validateUserEditSearch` (`from`) — the member drawer's own param, parsed by the Team; loads with the room.                                                                                                       |
| `users.constants.ts`              | `USERS_NS` / `USERS_KEYS` (the `users` namespace), `TEAM_TABLE_ID`, `USER_DRAWER_TEST_ID`.                                                                                                                        |
| `UsersPage.tsx`                   | The Team (or Roles & access, `from=roles`): toolbar, table, row actions, bulk Export, the user drawers and the delete confirm. Owns `users-page`.                                                                 |
| `components/TeamCells/`           | The Team's cells (ID, User, Roles with "Main role" / "Also", Branches, Status with the invitation).                                                                                                               |
| `components/UserDrawer/`          | The user drawer: form, read-outs, the two steps' fields and the save (invite or edit, D47).                                                                                                                       |
| `components/UserDeleteConfirm/`   | "Delete this user?" — the row leaves at once, the membership after the 10s Undo (or the invitation is cancelled). Mounted by the page for the row and the drawer alike, so the window outlives the drawer (L-64). |
| `hooks/useTeamTable/`             | The Team's columns and table instance (Roles is the phone key column; no Branches column with one open branch).                                                                                                   |
| `hooks/useUsersDialogRoute/`      | Which drawer the URL opens; refusal and "User not found" back to the Team (or to the role it was opened from).                                                                                                    |
| `roles/`                          | Roles & access (`/users/roles`) — renders `RolesAccess` for the URL's `role`.                                                                                                                                     |
| `branches/`                       | Branches (`/users/branches`) and the branch drawer — its own island with `branches/create/` and `branches/$branchId/edit/`.                                                                                       |
| `shared/components/UsersToolbar/` | The room toolbar for every tab.                                                                                                                                                                                   |
| `shared/components/RolesAccess/`  | Roles & access: the role list, the role page, the matrix, the special permissions; instant writes with rollback.                                                                                                  |
| `shared/hooks/useRoleDirectory/`  | Every listed role named and toned (presets by the clinic vocabulary, custom roles by name).                                                                                                                       |
| `shared/hooks/useNewRole/`        | "New role": the next "New role" name, `organization:read` only, the next custom tone; selects it.                                                                                                                 |
| `shared/hooks/useHoursFormat/`    | The words for days and hours — "Mon–Sat · 10:00–19:00", "Every day" — for the Team, the user drawer and Branches.                                                                                                 |
| `__tests__/integration/`          | The test router (the family's routes over a mocked clinozy-be) and the drawer / removal flows.                                                                                                                    |

## Test ids

`users-page`, `users-team-table`, `user-drawer`, `users-roles-panel` — and the shared toolbar and
table ids with the prefix `users-team`, the tabs `users-tabs` / `users-tab-<tab>`; the drawer's and
Roles & access's parts are listed in `docs/reference/e2e-testids-inventory.md` › User drawer and
› Roles & access.
