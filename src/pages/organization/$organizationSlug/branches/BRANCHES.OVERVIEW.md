# `pages/organization/$organizationSlug/branches` — Branches

Route: `/organization/$organizationSlug/branches` — the Branches room (KICKOFF §6.12; `S:108`; the
spec is the intake's users.md › Branches). Once the Users room's third tab, it is its own room since
change-branches-in-navbar: the `branches` section of the primary nav (the Building icon, the stone
tone), pinned in the header by default after Payments, a row of its own in Users › Roles & access
and the eleventh room in All sections and ⌘K. The old `/users/branches…` URLs redirect here, the
rest of the path, the search and the hash kept. Its children are URL-driven dialogs over the list
(D24): New branch (`create/`) and the branch drawer (`$branchId/edit/`).

Every branch, open and closed (a closed one reads "Closed"), the main branch first, then as they
were opened — `GET /app/branches?include_inactive=true`, one answer — joined with the Team: who
works at each (each membership's branches) and its default people. Filters has one section,
Created; no search, no sort, no Columns button. The table folds on a tablet into the address cell;
on a phone the chip leads and the address block carries Contact · Opening hours · Status · Default
people (`DataTable`'s `phoneKeyFirst`).

Gated on `branch:read` and the `app-branches` module, then `requireOrgStatus`; "New branch" needs
`branch:create`, editing `branch:update`, and Export only `branch:read`. A branch is never deleted
— clinozy-be has no delete — it is closed from its drawer (Status "Closed"), so Edit is the row's
one action. Main is read-only: one per clinic, set when it opened. A branch write refreshes every
branch read and the Team, so the header picker and one-open-branch mode follow at once: with one
open branch the clinic shows no branch UI, while this room still lists the closed ones.

**Places & days** (clinic-setup KICKOFF §6.6, D3, D23) is the drawer's fourth step, on an
existing branch only: its rooms and machines (add, rename, switch on / off, remove) and its
holidays from today on (date + label; add, remove), read from clinozy-be's
`/app/branches/{branch_id}/rooms`, `…/machines` and `…/holidays`
(`shared/api/app/branch-places-api.ts`). Each row saves on its own — never through the drawer's
Save — as an inline row (RHF + Zod per row, Enter adds, Esc cancels a rename without closing the
drawer); the switch changes in place at once and rolls back on a refusal; Remove goes through the
reason confirm and offers Undo (`…/restore`). Every member reads the lists; adding needs
`branch:create`, renaming and the switch `branch:update` (the switch stays, disabled, without
it), removing `branch:delete` — a control the codes do not allow is not offered. A name (or day)
the branch already has is refused at its field (a reasonless 409); someone else's change first
(`409 record_changed`) toasts and reads the list again. Text typed in a row and not yet saved
makes the drawer ask "Discard changes?" like its own fields. Collapsed, the step peeks at each
list ("Rooms · 2 added"); while the lists load it shows a skeleton, and one retry when a read failed.

## Files

| File                            | Responsibility                                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branches.route.tsx`            | Route marker — exports `Component` rendering `BranchesPage`.                                                                                                                                                                                 |
| `branches.manifest.ts`          | Manifest — `kind: 'layout'`, children `create`, `$branchId`; `branch:read`, module `app-branches`, nav `branches`.                                                                                                                           |
| `branches.search.ts`            | `validateBranchesSearch` — `created` (entry chunk: no zod).                                                                                                                                                                                  |
| `branches.constants.ts`         | `BRANCHES_NS` (the `branches` namespace), `BRANCHES_KEYS`, `BRANCHES_TABLE_ID` and `BRANCH_DRAWER_TEST_ID`.                                                                                                                                  |
| `BranchesPage.tsx`              | The list: the room toolbar (h1, Filters, "New branch"), table, the Edit row action, bulk Export and the branch drawers. Owns `branches-page`.                                                                                                |
| `components/BranchCells/`       | The cells — the chip with "Main", two-line Address / Contact / Default people, hours, the Team's avatars, Open / Closed.                                                                                                                     |
| `components/BranchDrawer/`      | The branch drawer: form, read-outs, the three steps' fields and the save; on an edit, "Places & days" (`BranchPlacesFields`, `branch-place-rows`, `branch-holiday-rows`, `branch-places-parts`, `branch-places-form`, `branch-places-view`). |
| `hooks/useBranchRows/`          | The list ⨝ the Team: each branch's people and default people.                                                                                                                                                                                |
| `hooks/useBranchWrites/`        | Save a branch (`saveBranch` — create, or its team then its fields), refreshing every branch read and the Team.                                                                                                                               |
| `hooks/useBranchPlaces/`        | "Places & days" reads (rooms, machines, holidays from today) and each row's writes — add, rename / switch, remove, restore.                                                                                                                  |
| `hooks/useBranchesTable/`       | The columns and table instance (Address is the primary cell; the Branch chip the phone row's key).                                                                                                                                           |
| `hooks/useBranchesDialogRoute/` | Which drawer the URL opens; refusal and "Branch not found" back to the list.                                                                                                                                                                 |
| `__tests__/integration/`        | The test router: the room's routes (the list and its two dialog routes) over a mocked clinozy-be.                                                                                                                                            |

## Test ids

`branches-page`, `branches-table`, `branch-drawer` — and the shared toolbar and table
ids with the prefix `branches` (`branches-toolbar`, `branches-new-branch`, `branches-fab`,
`branches-filters-trigger`, `branches-table-row`); the drawer's parts are listed in
`docs/reference/e2e-testids-inventory.md` › Branch drawer.

"Places & days" (`<d>` is `branch-drawer`, `<l>` a list: `rooms` · `machines` · `holidays`):
`<d>-step-places` (`-trigger`, `-peek`), `<d>-places` (the step's body), `<l>` (a list's
section), `<l>-row` (one row; `data-place-id` / `data-holiday-id`), `<l>-empty`,
`<l>-row-action-rename` · `<l>-row-action-remove`, `<d>-rooms-active` · `<d>-machines-active`
(a row's switch), `<l>-rename` (`-name`, `-submit`, `-cancel`, `-error`), `<l>-add` (rooms and
machines: `-name`, `-submit`, `-error`; holidays: `-date`, `-date-option-<YYYY-MM-DD>`, `-label`,
`-submit`, `-error`).
