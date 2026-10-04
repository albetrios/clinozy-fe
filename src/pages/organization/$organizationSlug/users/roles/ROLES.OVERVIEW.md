# `pages/organization/$organizationSlug/users/roles` — Roles & access

Route: `/organization/$organizationSlug/users/roles` — the Users room's second tab (KICKOFF §6.12;
`S:107`; the spec is the intake's users.md › Roles & access). It is registered beside the Team in the
route tree rather than under it, because the Team route renders the Team; its folder still nests
under the room, as the URL does. The URL's `role` is the role on screen — Front desk when absent
(H:5179).

Gated like the room — `membership:read` and the `clinic-users` module, then `requireOrgStatus`.
Every box and switch is an instant, optimistic write rolled back with the save-error toast
(Q-U6); changing a role needs "Change roles & access" (`role:manage`, D47), and Admin is never
narrowed. The clinic rows and the special permissions live on the fixture matrix
(`REPLACE_WITH_API`); a bound role's Users row and "Change roles & access" are its clinozy-be
permission codes (D17) — read-only for a role bound to a clinozy-be system role (D47).

"Preview as <role>" starts View-as for any role but Admin, a custom role included (by its
clinozy-be id): `useUIStore.previewRole` narrows `useClinicAccess` everywhere, the shell's pill
names the role, and a role that can't view Users is taken to its first room by the org layout
(`useRoomLanding`, Q-U11). Session-only — a reload ends it.

The page itself is thin: the family-shared `../shared/components/RolesAccess/` holds the toolbar,
the role list, the role page and the writes, because the Team page also keeps it behind a member
drawer opened from here (`?from=roles`).

## Files

| File                | Responsibility                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `roles.route.tsx`   | Route marker — exports `Component` rendering `RolesPage`.                                |
| `roles.manifest.ts` | Manifest — `kind: 'leaf'`, permission `membership:read`, module `clinic-users`.          |
| `RolesPage.tsx`     | Reads `role` (`validateRolesSearch`) and renders `RolesAccess`. Owns `users-roles-page`. |

## Test ids

`users-roles-page` — and inside it `users-roles-panel` with the parts listed in
`docs/reference/e2e-testids-inventory.md` › Roles & access.
