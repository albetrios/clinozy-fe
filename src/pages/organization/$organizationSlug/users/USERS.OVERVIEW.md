# `pages/organization/$organizationSlug/users` — Users

Route: `/organization/$organizationSlug/users` — the Users room (KICKOFF §6.12), the
single members surface (D17; the spec is the intake's users.md). The bare URL is its first tab, the Team: clinozy-be's memberships
(every page read up front) joined with the fixture staff profiles (`REPLACE_WITH_API`), searched,
filtered and sorted in place. Its children are URL-driven dialogs over the Team (D24): New user
(`create/`, an invitation — never an admin-set password) and the member drawer
(`$userId/edit/`, keyed by membership id).

Gated on `membership:read` and the `clinic-users` module, then `requireOrgStatus`. In-room, the
Users section follows the member's clinozy-be codes (D17): "New user" needs `invitation:manage`
and `membership:manage` (clinozy-be's invite asks for the second, D47); edit, status and
remove need `membership:manage`. View-as narrows it to the previewed role's matrix. Never a
Delete on your own row or the owner's.

The toolbar (h1, the tab links, search, Filters, Columns, "New user" — the floating pill on a
phone) is family-shared in `shared/components/UsersToolbar/`, with the role directory
(`shared/hooks/useRoleDirectory/`, each role's name and tone) for the children to come.

## Files

| File                              | Responsibility                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `users.route.tsx`                 | Route marker — exports `Component` rendering `UsersPage`.                                                               |
| `users.manifest.ts`               | Manifest — `kind: 'layout'`, children `create`, `$userId`; `membership:read`, module `clinic-users`, nav `users`.       |
| `users.search.ts`                 | `validateUsersSearch` — `q`, `role`, `branch`, `status`, `created`, `sort` (entry chunk: no zod).                       |
| `users.constants.ts`              | `USERS_NS` / `USERS_KEYS` (the `users` namespace), `TEAM_TABLE_ID`, `USER_DRAWER_TEST_ID`.                              |
| `UsersPage.tsx`                   | The Team: toolbar, table, row actions, bulk Export, the user drawers and the delete confirm. Owns `users-page`.         |
| `components/TeamCells/`           | The Team's cells (ID, User, Roles with "Main role" / "Also", Branches, Status with the invitation) and `useTeamFormat`. |
| `components/UserDrawer/`          | The user drawer: form, read-outs, the two steps' fields and the save (invite or edit, D47).                             |
| `components/UserDeleteConfirm/`   | "Delete this user?" — the row leaves at once, the membership after the 10s Undo (or the invitation is cancelled).       |
| `hooks/useTeamTable/`             | The Team's columns and table instance (Roles is the phone key column; no Branches column with one open branch).         |
| `hooks/useUsersDialogRoute/`      | Which drawer the URL opens; refusal and "User not found" back to the Team.                                              |
| `shared/components/UsersToolbar/` | The room toolbar for every tab.                                                                                         |
| `shared/hooks/useRoleDirectory/`  | Every listed role named and toned (presets by the clinic vocabulary, custom roles by name).                             |
| `__tests__/integration/`          | The test router (the family's routes over a mocked clinozy-be) and the drawer / removal flows.                          |

## Test ids

`users-page`, `users-team-table`, `user-drawer` — and the shared toolbar and table ids with the
prefix `users-team`, the tabs `users-tabs` / `users-tab-<tab>`; the drawer's parts are listed in
`docs/reference/e2e-testids-inventory.md` › User drawer.
