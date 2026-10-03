# `pages/organization/$organizationSlug/users` — Users

Route: `/organization/$organizationSlug/users`. Team, roles & access, branches (KICKOFF §6.12).

Gated like every clinic room: membership (`membership:read`) and the `clinic-users`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                 | Responsibility                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `users.route.tsx`    | Route marker — exports `Component` rendering `UsersPage`.                                            |
| `users.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `membership:read`, module `clinic-users`, nav section `users`. |
| `users.constants.ts` | `USERS_NS` / `USERS_KEYS` (the `users` namespace).                                                   |
| `UsersPage.tsx`      | Room page. Owns `data-testid="users-page"`.                                                          |
