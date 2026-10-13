# `pages/organization/$organizationSlug/users/roles` — Roles & access

Route: `/organization/$organizationSlug/users/roles` — the Users room's second tab (KICKOFF §6.12;
`S:107`; the spec is the intake's users.md › Roles & access). It is registered beside the Team in the
route tree rather than under it, because the Team route renders the Team; its folder still nests
under the room, as the URL does. The URL's `role` is the role on screen, by its clinozy-be id
(`rol_…`) — Front desk when absent (H:5179).

Gated on `role:read` and the `app-users` module, then `requireOrgStatus`. A role is its
clinozy-be permission codes and nothing else: the matrix has one row per resource (Leads,
Contacts, Contact activity, Appointments, Patients, Prescriptions, Treatments, Reviews,
Medicines, Stock, Payments, Tasks, Offerings, Users, Roles, Branches) whose View · Create · Edit ·
Delete boxes are that resource's `read` / `create` / `update` / `delete` codes ("—" where
clinozy-be has none); **Special permissions** are the eight exports and three reads (lower
prices, the clinical record, the private album); **Workspace permissions** list every other code
in the catalogue — settings, integrations, billing, the audit log, uploads — as switch cards
named by the catalogue. Every box and switch is an instant, optimistic whole-set write
(`PUT …/roles/:id/permissions`) rolled back with the save-error toast (Q-U6). Changing a role needs
`role:update`; Owner and Admin are locked; clinozy-be refuses a change while the role holds a code
the viewer lacks, so the page says so and stays read-only, and a viewer only gives codes they hold.
A custom role's name and description are boxes under its name (an emptied description saves the
default, "Custom role"); "Copy from" replaces its codes with another role's. Delete role
(`role:delete`, with the reason "Not needed") is offered for a custom role nobody holds; a
system role is never renamed or deleted.

Settings › Roles links here when the Users room is open to the member (D17, L-31f), so what
Settings' role dialog did lives on the role page too.

"Preview as <role>" starts View-as for any role but Owner and Admin, a custom role included (by its
clinozy-be id): `useUIStore.previewRole` narrows `useAppAccess` everywhere, the shell's pill
names the role, and a role that can't view Users is taken to its first room by the org layout
(`useRoomLanding`, Q-U11). Session-only — a reload ends it.

The page itself is thin: the family-shared `../shared/components/RolesAccess/` holds the toolbar,
the role list, the role page and the writes, because the Team page also keeps it behind a member
drawer opened from here (`?from=roles`).

## Files

| File                | Responsibility                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `roles.route.tsx`   | Route marker — exports `Component` rendering `RolesPage`.                                |
| `roles.manifest.ts` | Manifest — `kind: 'leaf'`, permission `role:read`, module `app-users`.                   |
| `RolesPage.tsx`     | Reads `role` (`validateRolesSearch`) and renders `RolesAccess`. Owns `users-roles-page`. |

## Test ids

`users-roles-page` — and inside it `users-roles-panel` with the parts listed in
`docs/reference/e2e-testids-inventory.md` › Roles & access.
