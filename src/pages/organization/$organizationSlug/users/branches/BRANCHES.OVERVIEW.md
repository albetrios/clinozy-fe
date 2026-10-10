# `pages/organization/$organizationSlug/users/branches` — Branches

Route: `/organization/$organizationSlug/users/branches` — the Users room's third tab (KICKOFF
§6.12; `S:108`; the spec is the intake's users.md › Branches). It is registered beside the Team
in the route tree rather than under it, because the Team route renders the Team; its folder still
nests under the room, as the URL does. Its children are URL-driven dialogs over the list (D24): New
branch (`create/`) and the branch drawer (`$branchId/edit/`).

Every branch, open and closed (a closed one reads "Closed"), the main branch first, then as they
were opened — `GET /app/branches?include_inactive=true`, one answer — joined with the Team: who
works at each (each membership's branches) and its default people. Filters has one section,
Created; no search, no sort, no Columns button. The table folds on a tablet into the address cell;
on a phone the chip leads and the address block carries Contact · Opening hours · Status · Default
people (`DataTable`'s `phoneKeyFirst`).

Gated on `branch:read` and the `clinic-users` module, then `requireOrgStatus`; "New branch" needs
`branch:create`, editing `branch:update`, and Export only `branch:read`. A branch is never deleted
— clinozy-be has no delete — it is closed from its drawer (Status "Closed"), so Edit is the row's
one action. Main is read-only: one per clinic, set when it opened. A branch write refreshes every
branch read and the Team, so the header picker and one-open-branch mode follow at once: with one
open branch the clinic shows no branch UI, while this tab still lists the closed ones.

## Files

| File                            | Responsibility                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `branches.route.tsx`            | Route marker — exports `Component` rendering `BranchesPage`.                                                             |
| `branches.manifest.ts`          | Manifest — `kind: 'layout'`, children `create`, `$branchId`; `branch:read`, module `clinic-users`.                       |
| `branches.search.ts`            | `validateBranchesSearch` — `created` (entry chunk: no zod).                                                              |
| `BranchesPage.tsx`              | The list: toolbar, table, the Edit row action, bulk Export and the branch drawers. Owns `users-branches-page`.           |
| `components/BranchCells/`       | The cells — the chip with "Main", two-line Address / Contact / Default people, hours, the Team's avatars, Open / Closed. |
| `components/BranchDrawer/`      | The branch drawer: form, read-outs, the three steps' fields and the save.                                                |
| `hooks/useBranchRows/`          | The list ⨝ the Team: each branch's people and default people.                                                            |
| `hooks/useBranchWrites/`        | Save a branch (`saveBranch` — create, or its team then its fields), refreshing every branch read and the Team.           |
| `hooks/useBranchesTable/`       | The columns and table instance (Address is the primary cell; the Branch chip the phone row's key).                       |
| `hooks/useBranchesDialogRoute/` | Which drawer the URL opens; refusal and "Branch not found" back to the list.                                             |

## Test ids

`users-branches-page`, `users-branches-table`, `branch-drawer` — and the shared toolbar and table
ids with the prefix `users-branches`; the drawer's parts are listed in
`docs/reference/e2e-testids-inventory.md` › Branch drawer.
