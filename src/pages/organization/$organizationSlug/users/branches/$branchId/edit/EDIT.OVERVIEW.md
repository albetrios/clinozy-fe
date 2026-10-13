# `pages/organization/$organizationSlug/users/branches/$branchId/edit` — Edit branch

Route: `/organization/$organizationSlug/users/branches/$branchId/edit` — the branch drawer, a
URL-driven dialog over Users › Branches (KICKOFF §4, §6.12, D24; `S:110`). The route renders
nothing: the Branches page reads the URL and opens the drawer; an id the list doesn't have — a
stale link — leaves the drawer with "Branch not found · it may have been deleted" (`S:115`). The `$branchId` folder has no page of its own: the schema has no
`/users/branches/$branchId` route.

Edit saves the branch (`saveBranch`): its team first when the Team field changed (`PUT
…/branches/:id/members`, the whole set — clinozy-be clears a default who no longer works there),
then its fields (`PATCH`, with the read's `updated_at`: someone else's save first is a stale save
with Reload). A unique name; Main is read-only. There is no Delete: a branch is closed with Status
"Closed". Gated like Branches; without `branch:update` the drawer is view only.

## Files

| File                 | Responsibility                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `edit.route.tsx`     | Route marker — exports `Component` rendering `EditBranchPage`.                                |
| `edit.manifest.ts`   | Manifest — `kind: 'leaf'`, permission `branch:read`, module `app-users`, title "Edit branch". |
| `EditBranchPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Branches page.          |

## Test ids

`branch-drawer` — the drawer the Branches page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Branch drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
