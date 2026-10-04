# `pages/organization/$organizationSlug/users/branches/$branchId/edit` — Edit branch

Route: `/organization/$organizationSlug/users/branches/$branchId/edit` — the branch drawer, a
URL-driven dialog over Users › Branches (KICKOFF §4, §6.12, D24; `S:110`). The route renders
nothing: the Branches page reads the URL and opens the drawer; an id the list doesn't have — a
stale link, a deleted branch — leaves the drawer with "Branch not found · it may have been
deleted" (`S:115`). The `$branchId` folder has no page of its own: the schema has no
`/users/branches/$branchId` route.

Edit saves the branch (`saveBranch`: a unique name, one main branch, the Team field moving
people on and off it) and offers Delete — never on the main branch — through the shared
reason confirm with a 10s Undo. Gated like the room; without the matrix's Users row Edit the
drawer is view only.

## Files

| File                 | Responsibility                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`     | Route marker — exports `Component` rendering `EditBranchPage`.                                       |
| `edit.manifest.ts`   | Manifest — `kind: 'leaf'`, permission `membership:read`, module `clinic-users`, title "Edit branch". |
| `EditBranchPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Branches page.                 |

## Test ids

`branch-drawer` — the drawer the Branches page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Branch drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
